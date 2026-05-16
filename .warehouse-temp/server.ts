import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import pg from 'pg';
const { Pool } = pg;
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import zlib from 'zlib';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import multer from 'multer';
import lzma from 'lzma';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

// Force bypass for self-signed certificates globally for DB connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const _fetch = fetch;
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_PROX = 5 * 60 * 1000; // 5 minutes cache

function timeframeToMinutes(tf: string): number {
  if (tf.endsWith('m') && !tf.endsWith('mo')) return parseInt(tf);
  if (tf.endsWith('h')) return parseInt(tf) * 60;
  if (tf.endsWith('d')) return parseInt(tf) * 1440;
  if (tf.endsWith('w')) return parseInt(tf) * 10080;
  if (tf.endsWith('mo')) return parseInt(tf) * 43200; // Approx
  return 1;
}

async function startServer() {
  console.log(`[SERVER] startServer() called...`);
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Pairs Distribution (Consolidated to 4 nodes as requested)
  let nodes: { id: number; url: string; pairs: string[] }[] = [];
  const pools = new Map<number, { pool: pg.Pool; id: number }>();

  const warehousePairs = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 
    'USDCHF', 'USDCAD', 'NZDUSD', 'EURGBP', 
    'EURJPY', 'GBPJPY', 'AUDJPY', 'EURCHF', 
    'EURAUD', 'GBPAUD', 'XAUUSD'
  ];

  for (let i = 1; i <= 4; i++) {
    const url = process.env[`DATABASE_URL_${i}`];
    if (url && !url.includes('host:port') && !url.includes('YOUR_DB_URL') && url.trim() !== '') {
      const startIdx = (i - 1) * 4;
      const endIdx = Math.min(startIdx + 4, warehousePairs.length);
      const nodePairs = warehousePairs.slice(startIdx, endIdx);
      nodes.push({ id: i, url, pairs: nodePairs });
    }
  }

  // Helper to initialize a pool
  function createPool(id: number, url: string) {
    console.log(`Configuring Pool for Node ${id}`);
    const pool = new Pool({ 
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 20, 
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 60000, 
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error(`[DB ERROR] Node ${id}:`, err.message);
    });
    pools.set(id, { pool, id });
    return pool;
  }

  const node_schema = (id: number) => `node_${id}`;

  // Initialize existing pools
  nodes.forEach(n => createPool(n.id, n.url));

  // Sequential Sync State
  let isSyncing = false;
  let currentSyncNodeId: number | null = null;
  let currentSyncPair: string | null = null;
  let currentSyncSource: string = 'histdata';
  let abortSync = false;
  let syncProgress: { year: number; week: number; day?: number } = { year: 0, week: 0 };
  let lastSyncActivity = Date.now();
  const partitionCache = new Set<string>();

  const resetSyncState = () => {
    isSyncing = false;
    currentSyncNodeId = null;
    currentSyncPair = null;
    currentSyncSource = 'histdata';
    abortSync = false;
    syncProgress = { year: 0, week: 0 };
  };

  async function logSync(nodeId: number, pair: string, source: string, level: string, message: string, details: any = {}) {
    const poolObj = pools.get(nodeId);
    if (!poolObj) {
      console.log(`[SYNC_LOG_FALLBACK] Node ${nodeId} not found for log. | ${pair} | ${message}`);
      return;
    }
    try {
      const { pool, id } = poolObj;
      const schemaName = `node_${id}`;
      // Ensure sync_logs table is checked/created if needed? No, initDB handles it.
      await pool.query(`INSERT INTO "${schemaName}".sync_logs (node_id, pair, source, level, message, details) VALUES ($1, $2, $3, $4, $5, $6)`, 
        [nodeId, pair, source, level, message, JSON.stringify(details)]);
    } catch (e) {
      console.error(`[LOG_FAILURE] Node ${nodeId} for ${pair}:`, e);
    }
  }

  async function internalProcessHistDataCSV(client: any, symbolId: number, schema: string, source: string, csvContent: string, nodeId: number, pair: string, startYear: number) {
    const separator = csvContent.includes(';') ? ';' : (csvContent.includes(',') ? ',' : '\t');
    const rawRows = parse(csvContent, { delimiter: separator, skip_empty_lines: true, trim: true, relax_column_count: true });

    if (rawRows.length === 0) {
      await logSync(nodeId, pair, source, 'WARNING', `CSV is empty`);
      return 0;
    }

    let startIdx = 0;
    // Handle Exness header or general date-based header
    if (rawRows[0][0] && (
      rawRows[0][0].toLowerCase().includes('exness') || 
      rawRows[0][0].toLowerCase().includes('date') || 
      rawRows[0][0].toLowerCase().includes('symbol') ||
      isNaN(parseInt(rawRows[0][0].substring(0, 4)))
    )) {
      startIdx = 1;
    }

    if (rawRows.length <= startIdx) {
      await logSync(nodeId, pair, source, 'WARNING', `No data rows after header`);
      return 0;
    }

    const weekGroups = new Map<string, any[]>();
    const exnessAggregator = new Map<string, any>();

    for (let i = startIdx; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (row.length < 4) continue;
      
      let tsDate: Date | null = null;
      let bidO: number, bidH: number, bidL: number, bidC: number;
      let askO: number, askH: number, askL: number, askC: number;
      let tickVolume = 0;

      if (source === 'exness' && row.length >= 5) {
        // ... (exness parsing)
        const [_, __, tsStr, bidVal, askVal] = row;
        tsDate = new Date(tsStr);
        if (isNaN(tsDate.getTime())) continue;
        
        // Exness 2015 starts in August
        if (tsDate.getUTCFullYear() === 2015 && tsDate.getUTCMonth() < 7) continue;

        const b = parseFloat(bidVal);
        const a = parseFloat(askVal);
        
        const tsMinute = Math.floor(tsDate.getTime() / 60000) * 60000;
        // ...
        const minuteKey = tsMinute.toString();
        
        if (!exnessAggregator.has(minuteKey)) {
          exnessAggregator.set(minuteKey, {
            ts: tsMinute,
            bo: b, bh: b, bl: b, bc: b,
            ao: a, ah: a, al: a, ac: a,
            v: 1,
            totalSpread: Math.max(0, a - b)
          });
        } else {
          const agg = exnessAggregator.get(minuteKey);
          agg.bh = Math.max(agg.bh, b);
          agg.bl = Math.min(agg.bl, b);
          agg.bc = b;
          agg.ah = Math.max(agg.ah, a);
          agg.al = Math.min(agg.al, a);
          agg.ac = a;
          agg.v += 1;
          agg.totalSpread += Math.max(0, a - b);
        }
        continue; // Handled by aggregator
      } else {
        const dateIdx = 0;
        let openIdx = 1, highIdx = 2, lowIdx = 3, closeIdx = 4;
        let timeStrOverride = null;

        // HistData typically 6 columns.
        // Axiory provided format: 2015.01.02,00:00,1.21029,1.21036,1.21029,1.21036,1 (7 cols)
        if (row.length >= 7) {
          if (row[1] && row[1].includes(':')) {
            // Axiory style: Col0=Date, Col1=Time
            timeStrOverride = row[1];
            openIdx = 2; highIdx = 3; lowIdx = 4; closeIdx = 5;
          } else if (isNaN(parseFloat(row[1]))) {
            // Pair name in index 1
            openIdx = 2; highIdx = 3; lowIdx = 4; closeIdx = 5;
          }
        }

        const rawDate = row[dateIdx];
        if (!rawDate) continue;

        try {
          if (rawDate.includes('.')) {
            const parts = rawDate.split(' ');
            const dateParts = parts[0].split('.');
            const timeStr = timeStrOverride || parts[1] || '00:00:00';
            let h, m, s;
            if (timeStr.includes(':')) {
              const timeParts = timeStr.split(':');
              h = parseInt(timeParts[0]); m = parseInt(timeParts[1]); s = parseInt(timeParts[2] || '0');
            } else {
              h = parseInt(timeStr.substring(0, 2)); m = parseInt(timeStr.substring(2, 4)); s = parseInt(timeStr.substring(4, 6) || '0');
            }
            // Force 0 seconds and 0 ms for non-exness sources to ensure strictly 1-minute intervals
            tsDate = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), h, m, 0));
          } else if (rawDate.length >= 8) {
            const y = parseInt(rawDate.substring(0, 4));
            const m = parseInt(rawDate.substring(4, 6));
            const d = parseInt(rawDate.substring(6, 8));
            const timePart = timeStrOverride || rawDate.split(' ')[1] || '';
            const h = parseInt(timePart.substring(0, 2) || '0');
            const mi = parseInt(timePart.substring(2, 4) || '0');
            tsDate = new Date(Date.UTC(y, m - 1, d, h, mi, 0));
          } else {
            // Try generic date parse
            tsDate = new Date(rawDate);
            if (!isNaN(tsDate.getTime()) && source !== 'exness') {
              tsDate.setUTCSeconds(0, 0);
            }
          }
        } catch (e) { continue; }

        if (!tsDate || isNaN(tsDate.getTime())) continue;
        
        bidO = parseFloat(row[openIdx]);
        bidH = parseFloat(row[highIdx]);
        bidL = parseFloat(row[lowIdx]);
        bidC = parseFloat(row[closeIdx]);
        askO = bidO; askH = bidH; askL = bidL; askC = bidC;
        tickVolume = row[closeIdx + 1] ? parseFloat(row[closeIdx + 1]) : 0;
      }

      if (tsDate.getUTCFullYear() < startYear) continue;
      
      // Special 2015-08 constraint for Axiory as well
      if (source === 'axiory' && tsDate.getUTCFullYear() === 2015 && tsDate.getUTCMonth() < 7) continue;

      const { year: wYear, week: wNo } = getISOWeek(tsDate);
      const key = `${wYear}-${wNo}`;
      if (!weekGroups.has(key)) weekGroups.set(key, []);
      weekGroups.get(key)!.push({
        ts: tsDate.getTime(),
        bo: bidO, bh: bidH, bl: bidL, bc: bidC,
        ao: askO, ah: askH, al: askL, ac: askC,
        v: tickVolume
      });
    }

    if (source === 'exness') {
      for (const agg of exnessAggregator.values()) {
        const tsDate = new Date(agg.ts);
        const { year: wYear, week: wNo } = getISOWeek(tsDate);
        const key = `${wYear}-${wNo}`;
        if (!weekGroups.has(key)) weekGroups.set(key, []);
        weekGroups.get(key)!.push(agg);
      }
    }

    // After grouping, de-duplicate if not exness
    if (source !== 'exness') {
      for (const [key, groupRecords] of weekGroups.entries()) {
        const seen = new Set<number>();
        const unique = [];
        // Sort to keep the first occurrence or latest? Usually first in the file 
        // because its time-series data.
        groupRecords.sort((a, b) => a.ts - b.ts); 
        for (const r of groupRecords) {
          if (!seen.has(r.ts)) {
            seen.add(r.ts);
            unique.push(r);
          }
        }
        weekGroups.set(key, unique);
      }
    }

    let savedWeeks = 0;
    
    // Ensure all needed partitions OUTSIDE the week loop (though we are likely already in a transaction)
    const yearsNeeded = new Set<number>();
    for (const key of weekGroups.keys()) {
      yearsNeeded.add(parseInt(key.split('-')[0]));
    }
    for (const y of yearsNeeded) {
      await ensurePartition(client, y, schema);
    }

    for (const [key, groupRecords] of weekGroups.entries()) {
      const [wYear, wNo] = key.split('-').map(Number);
      
      syncProgress = { year: wYear, week: wNo };
      
      if (groupRecords.length > 0) {
        // --- GAP DETECTION ---
        if (source !== 'exness') { // Gaps only make sense for regular timeframe data
          groupRecords.sort((a, b) => a.ts - b.ts);
          const gaps = [];
          for (let i = 0; i < groupRecords.length - 1; i++) {
            const current = groupRecords[i].ts;
            const next = groupRecords[i+1].ts;
            const diff = next - current;
            if (diff > 65000) { 
              let tradingMins = 0;
              const totalGapMins = Math.floor(diff / 60000) - 1;
              if (totalGapMins > 0 && totalGapMins < 10000) {
                for (let m = 1; m <= totalGapMins; m++) {
                  if (!isWeekend(current + (m * 60000))) tradingMins++;
                }
              }
              if (tradingMins > 0) {
                gaps.push({ start: current + 60000, end: next - 60000, mins: tradingMins });
              }
            }
          }
          if (gaps.length > 0) {
            await client.query({
              text: `INSERT INTO ${schema}.candle_gaps (symbol_id, start_timestamp, end_timestamp, gap_minutes, source)
                     SELECT $1, start_ts, end_ts, mins, $2
                     FROM UNNEST($3::bigint[], $4::bigint[], $5::integer[]) AS data(start_ts, end_ts, mins)
                     ON CONFLICT (symbol_id, start_timestamp, end_timestamp, source) DO NOTHING`,
              values: [symbolId, source, gaps.map(g => g.start), gaps.map(g => g.end), gaps.map(g => g.mins)]
            });
          }
        }

        try {
          const values = groupRecords
            .filter(r => !isWeekend(r.ts))
            .map(r => {
            return [
              BigInt(r.ts), 
              r.bo, r.bh, r.bl, r.bc, 
              r.ao, r.ah, r.al, r.ac, 
              r.v,
              source === 'exness' ? (r.totalSpread / r.v) : Math.max(0, r.ac - r.bc) // Spread
            ];
          });

          await client.query({
            text: `INSERT INTO ${schema}.candles (symbol_id, timestamp_utc, source, open_bid, high_bid, low_bid, close_bid, open_ask, high_ask, low_ask, close_ask, volume, volume_type, spread, spread_type, spread_source, is_repaired) 
                   SELECT $1, ts, $2, bo, bh, bl, bc, ao, ah, al, ac, vol, $13, spr, 'REAL', $2, FALSE
                   FROM UNNEST($3::bigint[], $4::double precision[], $5::double precision[], $6::double precision[], $7::double precision[], $8::double precision[], $9::double precision[], $10::double precision[], $11::double precision[], $12::double precision[], $14::double precision[]) 
                   AS data(ts, bo, bh, bl, bc, ao, ah, al, ac, vol, spr)
                   ON CONFLICT (symbol_id, timestamp_utc, source) DO NOTHING`,
            values: [
              symbolId, 
              source, 
              values.map(v => v[0]), 
              values.map(v => v[1]), values.map(v => v[2]), values.map(v => v[3]), values.map(v => v[4]), 
              values.map(v => v[5]), values.map(v => v[6]), values.map(v => v[7]), values.map(v => v[8]),
              values.map(v => v[9]),
              source === 'exness' ? 'TICKS' : 'BARS',
              values.map(v => v[10])
            ]
          });

          await client.query(`INSERT INTO ${schema}.download_progress (symbol_id, year, week, source, status) VALUES ($1, $2, $3, $4, 'completed') ON CONFLICT (symbol_id, year, week, source) DO UPDATE SET status = 'completed', updated_at = CURRENT_TIMESTAMP`, [symbolId, wYear, wNo, source]);
          savedWeeks++;
        } catch (e) {
          await logSync(nodeId, pair, source, 'ERROR', `Error in week processing block: ${e}`);
        }
      }
    }
    return savedWeeks;
  }

  const syncAbort = () => {
    if (isSyncing) {
      console.log(`[SYNC] Abort signal received for ${currentSyncPair} (${currentSyncSource})`);
      abortSync = true;
    }
  };

  // Initialize DB schema per node
  async function initDB(poolObj: { pool: pg.Pool; id: number }, pairs: string[]) {
    const { pool, id } = poolObj;
    const schema = `node_${id}`;
    let client;
    let retries = 3;
    while (retries > 0) {
      try {
        client = await pool.connect();
        break;
      } catch (err: any) {
        retries--;
        console.error(`Connection attempt failed for Node ${id}. Retries left: ${retries}. Error: ${err.message}`);
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "node_${id}"`);
      await client.query(`SET search_path TO "node_${id}"`);
      
      await client.query('BEGIN');
      await client.query(`CREATE TABLE IF NOT EXISTS "node_${id}".symbols (id SERIAL PRIMARY KEY, name VARCHAR(20) UNIQUE NOT NULL)`);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS "node_${id}".download_progress (
          symbol_id INTEGER REFERENCES "node_${id}".symbols(id), 
          year INTEGER, 
          week INTEGER, 
          source VARCHAR(20) DEFAULT 'histdata',
          status VARCHAR(20), 
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
          PRIMARY KEY (symbol_id, year, week, source)
        )
      `);

      // Add indexes for faster status queries
      await client.query(`CREATE INDEX IF NOT EXISTS idx_dp_symbol_source_status ON "node_${id}".download_progress(symbol_id, source, status)`);

      // Symbols
      for (const pair of pairs) {
        await client.query(`INSERT INTO "node_${id}".symbols (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [pair]);
      }

      // Migrations for existing tables
      await client.query(`ALTER TABLE "node_${id}".candles ADD COLUMN IF NOT EXISTS is_repaired BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE "node_${id}".candles ADD COLUMN IF NOT EXISTS repair_source VARCHAR(50)`);
      await client.query(`ALTER TABLE "node_${id}".candle_gaps ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open'`);

      // Sync logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS "node_${id}".sync_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          level VARCHAR(10),
          node_id INTEGER,
          pair VARCHAR(20),
          source VARCHAR(20),
          message TEXT,
          details JSONB
        )
      `);

      // Candle gaps tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS "node_${id}".candle_gaps (
          id SERIAL PRIMARY KEY,
          symbol_id INTEGER REFERENCES "node_${id}".symbols(id),
          start_timestamp BIGINT NOT NULL,
          end_timestamp BIGINT NOT NULL,
          gap_minutes INTEGER,
          source VARCHAR(20),
          status VARCHAR(20) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(symbol_id, start_timestamp, end_timestamp, source)
        )
      `);

      // Candles / Partitions logic... (omitted for brevity in target but I'll include the essential part)
      const candlesCheck = await client.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = 'candles'`, [schema.replace(/"/g, '')]);
      if (candlesCheck.rows.length === 0) {
        await client.query(`
          CREATE TABLE "${schema.replace(/"/g, '')}".candles (
            symbol_id INTEGER NOT NULL, 
            timestamp_utc BIGINT NOT NULL, 
            source VARCHAR(20) DEFAULT 'histdata',
            open_bid DOUBLE PRECISION, 
            high_bid DOUBLE PRECISION, 
            low_bid DOUBLE PRECISION, 
            close_bid DOUBLE PRECISION, 
            open_ask DOUBLE PRECISION, 
            high_ask DOUBLE PRECISION, 
            low_ask DOUBLE PRECISION, 
            close_ask DOUBLE PRECISION, 
            spread DOUBLE PRECISION,
            spread_type VARCHAR(10) DEFAULT 'ESTIMATED',
            spread_source VARCHAR(20),
            volume DOUBLE PRECISION,
            volume_type VARCHAR(10) DEFAULT 'TICKS',
            is_repaired BOOLEAN DEFAULT FALSE,
            repair_source VARCHAR(50),
            PRIMARY KEY (symbol_id, timestamp_utc, source)
          ) PARTITION BY RANGE (timestamp_utc)
        `);
      }
      await client.query(`CREATE INDEX IF NOT EXISTS idx_candles_brin_ts ON "${schema.replace(/"/g, '')}".candles USING BRIN(timestamp_utc)`);
      
      await client.query('COMMIT');
      console.log(`Node ${id} initialized successfully`);
    } catch (e) {
      if (client) try { await client.query('ROLLBACK'); } catch (rbErr) {}
      console.error(`Error initializing node ${id}:`, e);
    } finally {
      if (client) client.release();
    }
  }

  async function ensurePartition(client: pg.PoolClient, year: number, schema: string) {
    const startTs = new Date(`${year}-01-01T00:00:00Z`).getTime();
    const endTs = new Date(`${year + 1}-01-01T00:00:00Z`).getTime();
    const schemaName = schema.replace(/"/g, '');
    const tableName = `candles_y${year}`;
    const cacheKey = `${schemaName}.${tableName}`;

    if (partitionCache.has(cacheKey)) return;

    const schemaQuoted = `"${schemaName}"`;
    const fullTableName = `${schemaQuoted}."${tableName}"`;
    const parentTable = `${schemaQuoted}."candles"`;
    
    try {
      // Check if partition exists
      const checkRes = await client.query(`
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
      `, [schemaName, tableName]);
      
      if (checkRes.rows.length === 0) {
        // Double check if the parent table is partitioned to avoid "not a partitioned table" error
        const isPartitioned = await client.query(`
          SELECT 1 FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = 'candles' AND c.relkind = 'p'
        `, [schemaName]);

        if (isPartitioned.rows.length > 0) {
          await client.query(`CREATE TABLE ${fullTableName} PARTITION OF ${parentTable} FOR VALUES FROM (${startTs}) TO (${endTs})`);
        } else {
          return;
        }
      }
      partitionCache.add(cacheKey);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.error(`[PARTITION ERROR] ${year}:`, e.message);
      } else {
        partitionCache.add(cacheKey);
      }
    }
  }

  function isWeekend(timestampUtc: number): boolean {
    const d = new Date(timestampUtc);
    const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const hour = d.getUTCHours();
    
    // Friday starting from 10pm UTC (22:00)
    if (day === 5 && hour >= 22) return true;
    // Saturday all day
    if (day === 6) return true;
    // Sunday until 10pm UTC (22:00)
    if (day === 0 && hour < 22) return true;
    
    return false;
  }

  async function fetchHistData(pair: string, year: number, month: number, nodeId: number) {
    try {
      const monthStr = month.toString();
      const landingUrl = `https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/${pair.toLowerCase()}/${year}/${monthStr}`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      await logSync(nodeId, pair, 'histdata', 'INFO', `Fetching landing page: ${landingUrl}`);
      const landingRes = await _fetch(landingUrl, { headers });
      if (!landingRes.ok) {
        await logSync(nodeId, pair, 'histdata', 'ERROR', `Landing page error: ${landingRes.status}`, { status: landingRes.status, url: landingUrl });
        return null;
      }
      const html = await landingRes.text();
      
      const tkMatch = html.match(/id="tk" name="tk" value="(.*?)"/);
      if (!tkMatch) {
        await logSync(nodeId, pair, 'histdata', 'ERROR', `Token (tk) not found in HTML`, { htmlSample: html.substring(0, 1000) });
        return null;
      }
      const tk = tkMatch[1];

      const params = new URLSearchParams();
      params.append('tk', tk);
      params.append('date', year.toString());
      params.append('datany', month.toString());
      params.append('fs', 'ascii');
      params.append('uni', pair.toUpperCase());

      await logSync(nodeId, pair, 'histdata', 'INFO', `Posting to get.php`, { tkPresent: !!tk });
      const fileRes = await _fetch('https://www.histdata.com/get.php', {
        method: 'POST',
        body: params,
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': landingUrl,
          'Origin': 'https://www.histdata.com'
        }
      });

      if (!fileRes.ok) {
        await logSync(nodeId, pair, 'histdata', 'ERROR', `File download error: ${fileRes.status}`, { status: fileRes.status });
        return null;
      }
      
      const contentType = fileRes.headers.get('content-type') || '';
      if (!contentType.includes('zip') && !contentType.includes('octet-stream')) {
        const text = await fileRes.text();
        await logSync(nodeId, pair, 'histdata', 'ERROR', `Unexpected content type: ${contentType}`, { firstChars: text.substring(0, 200) });
        return null;
      }

      const buffer = await fileRes.arrayBuffer();
      await logSync(nodeId, pair, 'histdata', 'SUCCESS', `Downloaded buffer`, { size: buffer.byteLength });
      return buffer;
    } catch (e: any) {
      await logSync(nodeId, pair, 'histdata', 'ERROR', `Fetch failed: ${e.message}`);
      return null;
    }
  }

  async function fetchAxioryYear(pair: string, year: number, nodeId: number) {
    try {
      const url = `https://www.axiory.com/jp/assets/download/historical/mt4_standard/${year}/${pair.toUpperCase()}.zip`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };

      await logSync(nodeId, pair, 'axiory', 'INFO', `Fetching Axiory Year: ${url}`);
      const response = await _fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          await logSync(nodeId, pair, 'axiory', 'WARNING', `Axiory data not found for ${pair} ${year} (404)`);
        } else {
          await logSync(nodeId, pair, 'axiory', 'ERROR', `Axiory download error: ${response.status}`, { status: response.status, url });
        }
        return null;
      }

      const buffer = await response.arrayBuffer();
      await logSync(nodeId, pair, 'axiory', 'SUCCESS', `Downloaded Axiory zip`, { size: buffer.byteLength });
      return buffer;
    } catch (e: any) {
      await logSync(nodeId, pair, 'axiory', 'ERROR', `Axiory fetch failed: ${e.message}`);
      return null;
    }
  }

  async function fetchExnessMonth(pair: string, year: number, month: number, nodeId: number) {
    try {
      const pairName = pair.endsWith('m') ? pair : pair + 'm';
      const monthStr = month.toString().padStart(2, '0');
      const url = `https://ticks.ex2archive.com/ticks/${pairName}/${year}/${monthStr}/Exness_${pairName}_${year}_${monthStr}.zip`;
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };

      await logSync(nodeId, pair, 'exness', 'INFO', `Fetching Exness Month: ${url}`);
      const response = await _fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          await logSync(nodeId, pair, 'exness', 'WARNING', `Exness data not found for ${pairName} ${year}-${monthStr} (404)`);
        } else {
          await logSync(nodeId, pair, 'exness', 'ERROR', `Exness download error: ${response.status}`, { status: response.status, url });
        }
        return null;
      }

      const buffer = await response.arrayBuffer();
      await logSync(nodeId, pair, 'exness', 'SUCCESS', `Downloaded Exness zip`, { size: buffer.byteLength });
      return buffer;
    } catch (e: any) {
      await logSync(nodeId, pair, 'exness', 'ERROR', `Exness fetch failed: ${e.message}`);
      return null;
    }
  }

  async function fetchDukascopyDay(pair: string, year: number, month: number, day: number, nodeId: number, side: 'BID' | 'ASK' = 'BID') {
    try {
      // month is 1-indexed in our system (Jan=1), but Dukascopy uses 0-indexed (Jan=0)
      const dukasMonth = month - 1;
      const dukasDay = day.toString().padStart(2, '0');
      const url = `https://datafeed.dukascopy.com/datafeed/${pair}/${year}/${dukasMonth.toString().padStart(2, '0')}/${dukasDay}/${side}_candles_min_1.bi5`;
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };

      await logSync(nodeId, pair, 'dukascopy', 'INFO', `Fetching Dukascopy Day ${side}: ${year}-${month}-${day} | ${url}`);
      const response = await _fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status !== 404) {
          await logSync(nodeId, pair, 'dukascopy', 'WARNING', `Dukascopy day error: ${response.status}`);
        }
        return null;
      }

      const buffer = await response.arrayBuffer();
      
      // Decompress LZMA
      try {
        return new Promise((resolve, reject) => {
          lzma.decompress(Buffer.from(buffer), (result: any, error: any) => {
            if (error) {
              logSync(nodeId, pair, 'dukascopy', 'ERROR', `Decompression error: ${error.message || error}`).catch(() => {});
              resolve(null);
            } else {
              resolve(Buffer.from(result));
            }
          });
        });
      } catch (decompressErr: any) {
        await logSync(nodeId, pair, 'dukascopy', 'ERROR', `Decompression failed: ${decompressErr.message}`);
        return null;
      }
    } catch (e: any) {
      await logSync(nodeId, pair, 'dukascopy', 'ERROR', `Fetch failed: ${e.message}`);
      return null;
    }
  }

  function getISOWeek(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: date.getUTCFullYear(), week: weekNo };
  }

  function getDukascopyDivisor(pair: string) {
    if (pair.includes('JPY')) return 1000;
    if (pair.includes('XAU') || pair.includes('XAG') || pair.includes('GOLD') || pair.includes('SILVER')) {
      return 1000; // Gold/Silver usually 1000 for OHLC in Bi5
    }
    return 100000;
  }

  async function downloadAndParse(nodeId: number, pair: string, year: number, week: number, source: string = 'histdata') {
    if (abortSync) return false;
    const poolObj = pools.get(nodeId);
    if (!poolObj) return false;
    const { pool, id } = poolObj;
    const schema = `node_${id}`;
    
    let client;
    let retries = 3;
    while (retries > 0) {
      try {
        client = await pool.connect();
        break;
      } catch (err: any) {
        retries--;
        console.error(`Sync connection failed for Node ${id}. Retries left: ${retries}. Error: ${err.message}`);
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    try {
      // No schema prefix here, table check is by schema/relname args
      const symbolIdRes = await client.query(`SELECT id FROM ${schema}.symbols WHERE name = $1`, [pair]);
      if (symbolIdRes.rows.length === 0) return false;
      const symbolId = symbolIdRes.rows[0].id;
      
      const check = await client.query(`SELECT status FROM ${schema}.download_progress WHERE symbol_id = $1 AND year = $2 AND week = $3 AND source = $4`, [symbolId, year, week, source]);
      if (check.rows[0]?.status === 'completed') return true;

      await ensurePartition(client, year, schema);
      await ensurePartition(client, year - 1, schema);
      await ensurePartition(client, year + 1, schema);
      
      if (source === 'histdata') {
        const jan4 = new Date(year, 0, 4);
        const targetDate = new Date(jan4.getTime() + (week - 1) * 7 * 86400000);
        const month = targetDate.getMonth() + 1;
        
        console.log(`[SYNC] HistData for ${pair} Week ${week} Year ${year} -> Requesting Month ${month}`);
        
        const buffer = await fetchHistData(pair, year, month, id);
        if (!buffer) {
          await client.query(`INSERT INTO ${schema}.download_progress (symbol_id, year, week, source, status) VALUES ($1, $2, $3, $4, 'not_found') ON CONFLICT (symbol_id, year, week, source) DO UPDATE SET status = 'not_found', updated_at = CURRENT_TIMESTAMP`, [symbolId, year, week, source]);
          return true;
        }

        const zip = new AdmZip(Buffer.from(buffer));
        const zipEntries = zip.getEntries();
        const csvEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.csv'));
        if (!csvEntry) {
          await logSync(id, pair, 'histdata', 'ERROR', `No CSV found in ZIP`);
          return false;
        }
        const csvContent = zip.readAsText(csvEntry);
        
        await client.query('BEGIN');
        const savedCount = await internalProcessHistDataCSV(client, symbolId, schema, source, csvContent, id, pair, 2015);
        if (savedCount === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query('COMMIT');
        await logSync(id, pair, 'histdata', 'INFO', `Saved ${savedCount} weeks from month file`);
        return true;
      } else if (source === 'dukascopy') {
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfJan4 = jan4.getUTCDay() || 7;
        const mondayOfW1 = new Date(jan4.getTime() - (dayOfJan4 - 1) * 86400000);
        const mondayOfWantedWeek = new Date(mondayOfW1.getTime() + (week - 1) * 7 * 86400000);
        
        await logSync(id, pair, 'dukascopy', 'INFO', `Syncing Week: ${year} W${week}`);
        
        let foundAny = false;
        let totalRecords = 0;
        const divisor = getDukascopyDivisor(pair);
        
        // Fetch all 7 days in parallel for 7x speedup on networking
        const dayPromises = Array.from({ length: 7 }, (_, i) => {
          const currentDay = new Date(mondayOfWantedWeek.getTime() + i * 86400000);
          const dYear = currentDay.getUTCFullYear();
          const dMonth = currentDay.getUTCMonth() + 1;
          const dDay = currentDay.getUTCDate();
          return (async () => {
             const bid = await fetchDukascopyDay(pair, dYear, dMonth, dDay, id, 'BID');
             const ask = await fetchDukascopyDay(pair, dYear, dMonth, dDay, id, 'ASK');
             return { bid: bid as Buffer | null, ask: ask as Buffer | null, date: currentDay };
          })();
        });

        const dayResults = await Promise.all(dayPromises);
        
        for (const { bid: bi5Buffer, ask: askBuffer, date: currentDay } of dayResults) {
          if (abortSync) return false;
          
          if (bi5Buffer) {
            foundAny = true;
            const values = [];
            const candleSize = (bi5Buffer.length % 24 === 0 && bi5Buffer.length > 0) ? 24 : 20;
            const candleCount = Math.floor(bi5Buffer.length / candleSize);
            const dayStartTs = BigInt(currentDay.getTime());

            for (let j = 0; j < candleCount; j++) {
              const offset = j * candleSize;
              const timeFromStart = bi5Buffer.readInt32BE(offset); 
              const flooredSecs = Math.floor(timeFromStart / 60) * 60;
              const ts = Number(dayStartTs + BigInt(flooredSecs) * 1000n);
              
              if (isWeekend(ts)) continue;

              const bo = bi5Buffer.readInt32BE(offset + 4) / divisor;
              const bh = bi5Buffer.readInt32BE(offset + 8) / divisor;
              const bl = bi5Buffer.readInt32BE(offset + 12) / divisor;
              const bc = bi5Buffer.readInt32BE(offset + 16) / divisor;
              
              let ao = bo, ah = bh, al = bl, ac = bc;
              let spread = 0;

              if (askBuffer && askBuffer.length >= offset + candleSize) {
                 ao = askBuffer.readInt32BE(offset + 4) / divisor;
                 ah = askBuffer.readInt32BE(offset + 8) / divisor;
                 al = askBuffer.readInt32BE(offset + 12) / divisor;
                 ac = askBuffer.readInt32BE(offset + 16) / divisor;
                 spread = Math.max(0, ac - bc);
              }

              const vol = candleSize === 24 ? bi5Buffer.readFloatBE(offset + 20) : 0;
              values.push({ ts, bo, bh, bl, bc, ao, ah, al, ac, vol, spread });
            }

            if (values.length > 0) {
              totalRecords += values.length;
              await ensurePartition(client, currentDay.getUTCFullYear(), schema);
              await client.query('BEGIN');
              try {
                await client.query({
                  text: `INSERT INTO ${schema}.candles (symbol_id, timestamp_utc, source, open_bid, high_bid, low_bid, close_bid, open_ask, high_ask, low_ask, close_ask, volume, volume_type, spread, spread_type, spread_source) 
                         SELECT $1, ts, $2, bo, bh, bl, bc, ao, ah, al, ac, vol, 'REAL', spr, 'REAL', $2 
                         FROM UNNEST($3::bigint[], $4::double precision[], $5::double precision[], $6::double precision[], $7::double precision[], $8::double precision[], $9::double precision[], $10::double precision[], $11::double precision[], $12::double precision[], $13::double precision[]) 
                         AS data(ts, bo, bh, bl, bc, ao, ah, al, ac, vol, spr)
                         ON CONFLICT (symbol_id, timestamp_utc, source) DO NOTHING`,
                  values: [
                    symbolId, 
                    source, 
                    values.map(v => BigInt(v.ts)), 
                    values.map(v => v.bo), values.map(v => v.bh), values.map(v => v.bl), values.map(v => v.bc), 
                    values.map(v => v.ao), values.map(v => v.ah), values.map(v => v.al), values.map(v => v.ac),
                    values.map(v => v.vol),
                    values.map(v => v.spread)
                  ]
                });
                await client.query('COMMIT');
              } catch (e) {
                await client.query('ROLLBACK');
                throw e;
              }
            }
          }
        }
        
        if (foundAny) {
          await client.query(`INSERT INTO ${schema}.download_progress (symbol_id, year, week, source, status) VALUES ($1, $2, $3, $4, 'completed') ON CONFLICT (symbol_id, year, week, source) DO UPDATE SET status = 'completed', updated_at = CURRENT_TIMESTAMP`, [symbolId, year, week, source]);
          await logSync(id, pair, 'dukascopy', 'SUCCESS', `Saved ${totalRecords} records from Dukascopy weeks`);
          return true;
        } else {
          await client.query(`INSERT INTO ${schema}.download_progress (symbol_id, year, week, source, status) VALUES ($1, $2, $3, $4, 'not_found') ON CONFLICT (symbol_id, year, week, source) DO UPDATE SET status = 'not_found', updated_at = CURRENT_TIMESTAMP`, [symbolId, year, week, source]);
          return true;
        }
      }
      return false;
    } catch (e) { 
      if (client) try { await client.query('ROLLBACK'); } catch (rbErr) {}
      console.error(`Failed ${pair} ${year} ${source} unit ${week}:`, e); 
      return false;
    } finally { 
      if (client) client.release(); 
    }
  }

  async function syncPairSequentially(pair: string, nodeId: number, startYear = 2020, source = 'histdata') {
    if (isSyncing) return;
    isSyncing = true; currentSyncNodeId = nodeId; currentSyncPair = pair; currentSyncSource = source; abortSync = false;
    console.log(`[SYNC] Started for ${pair} from ${startYear} using ${source} on node ${nodeId}`);
    try {
      const poolObj = pools.get(nodeId);
      if (!poolObj) return;

      const { pool, id } = poolObj;
      const schema = `node_${id}`;
      
      const now = new Date();
      const { year: currentYear, week: currentWeek } = getISOWeek(now);

      // 1. Fetch already completed units to avoid redundant single-row DB checks in the loop
      let completedSet = new Set<string>();
      let client;
      try {
        client = await pool.connect();
        const res = await client.query(`
          SELECT year, week FROM "${schema}".download_progress dp 
          JOIN "${schema}".symbols s ON s.id = dp.symbol_id 
          WHERE s.name = $1 AND dp.status = 'completed' AND dp.year >= $2 AND dp.source = $3
        `, [pair, startYear, source]);
        res.rows.forEach(r => completedSet.add(`${r.year}-${r.week}`));
      } catch (err) {
        console.error(`[SYNC PRE-CHECK ERROR] ${pair}:`, err);
      } finally {
        if (client) client.release();
      }

      await logSync(nodeId, pair, source, 'INFO', `Started sequential sync from ${startYear}`);
      
      // Handle Axiory as a whole year fetch (faster than week-by-week)
      if (source === 'axiory') {
        // ... (axiory logic)
        for (let y = startYear; y <= currentYear; y++) {
          if (abortSync) break;
          
          // Check if any week in this year is missing
          let missingWeeks = [];
          const lastUnit = (y === currentYear) ? currentWeek : 52;
          for (let u = 1; u <= lastUnit; u++) {
            if (!completedSet.has(`${y}-${u}`)) missingWeeks.push(u);
          }

          if (missingWeeks.length > 0) {
            syncProgress = { year: y, week: 0 };
            lastSyncActivity = Date.now();
            await logSync(nodeId, pair, 'axiory', 'INFO', `Syncing year ${y} from Axiory...`);
            const buffer = await fetchAxioryYear(pair, y, nodeId);
            if (buffer) {
              const zip = new AdmZip(Buffer.from(buffer));
              const zipEntries = zip.getEntries();
              
              let csvContent = '';
              const allCsvEntry = zipEntries.find(e => e.entryName.toLowerCase().includes('all.csv'));
              
              if (allCsvEntry) {
                csvContent = zip.readAsText(allCsvEntry);
              } else {
                // If not all.csv, find all monthly csv files, sort them, and merge
                const csvEntries = zipEntries
                  .filter(e => e.entryName.toLowerCase().endsWith('.csv'))
                  .sort((a, b) => a.entryName.localeCompare(b.entryName));
                
                if (csvEntries.length > 0) {
                  await logSync(nodeId, pair, 'axiory', 'INFO', `Merging ${csvEntries.length} monthly CSV files for ${y}...`);
                  for (const entry of csvEntries) {
                    csvContent += zip.readAsText(entry) + '\n';
                  }
                }
              }
              
              if (csvContent) {
                let client;
                try {
                  client = await pool.connect();
                  const symbolIdRes = await client.query(`SELECT id FROM "${schema}".symbols WHERE name = $1`, [pair]);
                  if (symbolIdRes.rows.length > 0) {
                    const symbolId = symbolIdRes.rows[0].id;
                    await internalProcessHistDataCSV(client, symbolId, schema, 'axiory', csvContent, nodeId, pair, y);
                  }
                } catch (e: any) {
                  await logSync(nodeId, pair, 'axiory', 'ERROR', `Failed processing Axiory CSV: ${e.message}`);
                } finally {
                  if (client) client.release();
                }
              } else {
                await logSync(nodeId, pair, 'axiory', 'ERROR', `No 'all.csv' or other CSV found in Axiory zip for ${y}`);
              }
            }
          }
        }
        isSyncing = false;
        resetSyncState();
        return;
      }

      // Handle Exness as monthly fetch
      if (source === 'exness') {
        const fetchExnessMonthWithCheck = async (y: number, m: number) => {
          // Check if any week of this month is missing
          const firstDay = new Date(Date.UTC(y, m - 1, 1));
          const lastDay = new Date(Date.UTC(y, m, 0)); // last day of month
          
          let anyWeekMissing = false;
          // Loop through days 1, 8, 15, 22, lastDay to cover all possible weeks in the month
          const checkDays = [1, 8, 15, 22, lastDay.getUTCDate()];
          for (const d of checkDays) {
            const checkDate = new Date(Date.UTC(y, m - 1, d));
            const { year: wYear, week: wNo } = getISOWeek(checkDate);
            if (!completedSet.has(`${wYear}-${wNo}`)) {
              anyWeekMissing = true;
              break;
            }
          }

          if (anyWeekMissing) {
            const firstWeekOfM = getISOWeek(firstDay);
            syncProgress = { year: y, week: firstWeekOfM.week };
            lastSyncActivity = Date.now();
            await logSync(nodeId, pair, 'exness', 'INFO', `Syncing ${y}-${m.toString().padStart(2, '0')} from Exness...`);
            const buffer = await fetchExnessMonth(pair, y, m, nodeId);
            if (buffer) {
              const zip = new AdmZip(Buffer.from(buffer));
              const zipEntries = zip.getEntries();
              const csvEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.csv'));
              if (csvEntry) {
                const csvContent = zip.readAsText(csvEntry);
                let client;
                try {
                  client = await pool.connect();
                  const symbolIdRes = await client.query(`SELECT id FROM "${schema}".symbols WHERE name = $1`, [pair]);
                  if (symbolIdRes.rows.length > 0) {
                    const symbolId = symbolIdRes.rows[0].id;
                    await internalProcessHistDataCSV(client, symbolId, schema, 'exness', csvContent, nodeId, pair, y);
                    
                    // After successful processing, we need to refresh the completedSet for subsequent months in the same sync run
                    // But for simplicity, we can just assume subsequent months will check their own weeks.
                    // Actually, let's mark the weeks we just found missing as potentially completed now to avoid re-syncing?
                    // internalProcessHistDataCSV already marks them in DB.
                  }
                } catch (e: any) {
                  await logSync(nodeId, pair, 'exness', 'ERROR', `Failed processing Exness CSV: ${e.message}`);
                } finally {
                  if (client) client.release();
                }
              }
            }
          }
        };

        for (let y = startYear; y <= currentYear; y++) {
          if (abortSync) break;
          for (let m = 1; m <= 12; m++) {
            if (abortSync) break;
            if (y === 2015 && m < 8) continue;
            if (y === currentYear && m > (now.getUTCMonth() + 1)) break;
            await fetchExnessMonthWithCheck(y, m);
          }
        }
        isSyncing = false;
        resetSyncState();
        return;
      }

      // 2. Iterate and only process what is missing (Syncing up to 5 weeks in parallel)
      const CONCURRENCY = source === 'dukascopy' ? 3 : 5; 
      
      for (let y = startYear; y <= currentYear; y++) {
        await logSync(nodeId, pair, source, 'INFO', `Processing year ${y}...`);
        
        // --- STORAGE CRITICAL CHECK ---
        const lastUnit = (y === currentYear) ? currentWeek : 52;
        const missingUnitsInYear = [];
        for (let u = 1; u <= lastUnit; u++) {
          if (!completedSet.has(`${y}-${u}`)) missingUnitsInYear.push(u);
        }

        // Process missing units in batches
        for (let i = 0; i < missingUnitsInYear.length; i += CONCURRENCY) {
          const batch = missingUnitsInYear.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(async (u) => {
            if (abortSync) return;
            syncProgress = { year: y, week: u };
            lastSyncActivity = Date.now();
            await downloadAndParse(nodeId, pair, y, u, source);
          }));
          
          if (abortSync) return;

          // Periodically check storage
          if (i % (CONCURRENCY * 4) === 0) {
            try {
              const dbSizeRes = await pool.query(`SELECT pg_database_size(current_database()) as raw_size`);
              if (dbSizeRes.rows.length > 0 && dbSizeRes.rows[0].raw_size !== null) {
                const currentBytes = parseInt(dbSizeRes.rows[0].raw_size);
                const maxBytes = 10 * 1024 * 1024 * 1024; // 10GB
                if (currentBytes > maxBytes * 0.95) {
                  await logSync(nodeId, pair, source, 'ERROR', `CRITICAL: Storage limit reached (95%+ of 10GB).`);
                  abortSync = true;
                }
              }
            } catch (e) {}
          }
        }
      }
      console.log(`[SYNC] Completed for ${pair} (${source})`);
    } catch (e) {
      console.error(`[SYNC ERROR] ${pair} (${source}):`, e);
    } finally {
      isSyncing = false;
      currentSyncNodeId = null;
      currentSyncPair = null;
      currentSyncSource = 'histdata';
      abortSync = false;
    }
  }

  async function resyncMissingWeeks(pair: string, nodeId: number, source = 'histdata') {
    if (isSyncing) return;
    isSyncing = true; currentSyncNodeId = nodeId; currentSyncPair = pair; currentSyncSource = source; abortSync = false;
    console.log(`[RESYNC] Started for missing units of ${pair} (${source}) on node ${nodeId}`);
    try {
      const poolObj = pools.get(nodeId);
      if (!poolObj) return;
      
      const { pool, id } = poolObj;
      const schema = `node_${id}`;
      
      let client;
      let missingUnits: { year: number; week: number }[] = [];
      
      try {
        client = await pool.connect();
        const symbolRes = await client.query(`SELECT id FROM ${schema}.symbols WHERE name = $1`, [pair]);
        if (symbolRes.rows.length > 0) {
          const symbolId = symbolRes.rows[0].id;
          const missingRes = await client.query(`SELECT year, week FROM ${schema}.download_progress WHERE symbol_id = $1 AND status = 'not_found' AND source = $2 ORDER BY year ASC, week ASC`, [symbolId, source]);
          missingUnits = missingRes.rows;
        }
      } finally {
        if (client) client.release();
      }

      for (const item of missingUnits) {
        if (abortSync) {
          console.log(`[RESYNC] Stopped ${pair} abort signal`);
          await logSync(nodeId, pair, source, 'WARNING', `Resync aborted`);
          return;
        }
        syncProgress = { year: item.year, week: item.week };
        lastSyncActivity = Date.now();
        await logSync(nodeId, pair, source, 'INFO', `Resyncing missing unit: ${item.year} W${item.week}`);
        await downloadAndParse(nodeId, pair, item.year, item.week, source);
      }
      
      console.log(`[RESYNC] Completed for ${pair} (${source})`);
    } catch (e) {
      console.error(`[RESYNC ERROR] ${pair} (${source}):`, e);
    } finally {
      isSyncing = false;
      currentSyncNodeId = null;
      currentSyncPair = null;
      currentSyncSource = 'histdata';
      abortSync = false;
    }
  }

  // Cache for DB status to prevent overlapping heavy queries
  let cachedStatus: any = null;
  let lastStatusFetch: number = 0;
  const CACHE_TTL = 3000; // 3 seconds

  // Patch a specific missing unit using EXISTING data from another source (if available)




  // Database Status
  app.get('/api/db-status', async (req, res) => {
    // Check for stale sync
    const STALE_THRESHOLD = 45000; // 45 seconds of no activity
    if (isSyncing && (Date.now() - lastSyncActivity > STALE_THRESHOLD)) {
      console.log(`[SYNC] Stale sync detected for ${currentSyncPair} on node ${currentSyncNodeId}. Resetting.`);
      resetSyncState();
    }

    const source = (req.query.source || 'histdata') as string;
    const force = req.query.force === 'true';
    const now = Date.now();

    // Check cache
    if (!force && cachedStatus && (now - lastStatusFetch < CACHE_TTL) && cachedStatus.source === source) {
      return res.json(cachedStatus.data);
    }

    console.log(`[API] Processing /db-status cache-miss for source: ${source}...`);
    try {
      const status = await Promise.all(nodes.map(async (node) => {
        const nodeId = node.id;
        const poolObj = pools.get(nodeId);
        const pairs = node.pairs;
        console.log(`[DB_STATUS] Querying node ${nodeId}, configured: ${!!poolObj}`);

        if (!poolObj) {
          return { 
            id: nodeId, 
            status: 'not_configured', 
            pairs: pairs.map(p => ({ 
              name: p, 
              weeks: 0, 
              missingCount: 0, 
              missingDetails: [], 
              syncedYears: [], 
              completeYears: [], 
              isSyncing: isSyncing && currentSyncNodeId === nodeId && currentSyncPair === p && currentSyncSource === source,
              progress: isSyncing && currentSyncNodeId === nodeId && currentSyncPair === p && currentSyncSource === source ? syncProgress : null
            })), 
            db_size: '0 MB',
            source_size: '0 B',
            used_bytes: 0,
            total_bytes: parseFloat(process.env.DB_QUOTA_GB || '10') * 1024 * 1024 * 1024
          };
        }
        
        const { pool } = poolObj;
        const schema = `node_${nodeId}`;
        let client;
        
        try {
          client = await pool.connect();
          // Optimized query to get all symbols and their aggregate progress for all sources
          const statsRes = await client.query({
            text: `
              WITH all_sources AS (
                SELECT symbol_id, source, 
                       COUNT(*) FILTER (WHERE status = 'completed') as weeks_downloaded,
                       COUNT(*) FILTER (WHERE status = 'not_found') as weeks_missing,
                       MIN(year) as start_year,
                       MIN(week) FILTER (WHERE year = (SELECT MIN(year) FROM ${schema}.download_progress d2 WHERE d2.symbol_id = dp.symbol_id AND d2.source = dp.source)) as start_week,
                       MAX(year) as end_year,
                       MAX(week) FILTER (WHERE year = (SELECT MAX(year) FROM ${schema}.download_progress d2 WHERE d2.symbol_id = dp.symbol_id AND d2.source = dp.source)) as end_week
                FROM ${schema}.download_progress dp
                GROUP BY symbol_id, source
              )
              SELECT s.name as pair, s.id as symbol_id,
                     COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
                       'source', als.source,
                       'weeks', als.weeks_downloaded,
                       'missingCount', als.weeks_missing,
                       'startYear', als.start_year,
                       'startWeek', als.start_week,
                       'endYear', als.end_year,
                       'endWeek', als.end_week
                     )) FILTER (WHERE als.source IS NOT NULL), '[]') as sources
              FROM ${schema}.symbols s 
              LEFT JOIN all_sources als ON s.id = als.symbol_id
              GROUP BY s.name, s.id
            `,
            values: []
          });

          // Get completion info per year (to identify "Complete" years)
          const completionRes = await client.query({
            text: `
              SELECT symbol_id, year, COUNT(*) as completed_weeks 
              FROM ${schema}.download_progress 
              WHERE status = 'completed' AND source = $1
              GROUP BY symbol_id, year
            `,
            values: [source]
          });

          // Get per-pair row counts to estimate size
          const pairCountsRes = await client.query(`SELECT symbol_id, COUNT(*) as count FROM "${schema}".candles GROUP BY symbol_id`);
          const pairCountsMap = new Map<number, number>(pairCountsRes.rows.map((r: any) => [parseInt(r.symbol_id), parseInt(r.count)]));

          // Get node-specific used size (Schema-specific sum)
          let dbSize = '0 B';
          let usedBytes = 0;
          let sourceSize = '0 B';
          let sourceBytes = 0;
          let totalWeeks = 0;

          try {
            // Priority 1: pg_total_relation_size (if available)
            try {
              const res = await client.query({
                text: `SELECT SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))::bigint as bytes FROM pg_tables WHERE schemaname = $1`,
                values: [schema]
              });
              usedBytes = parseInt(res.rows[0].bytes || '0');
            } catch (e) { usedBytes = 0; }

            // Priority 2: CRDB table_statistics (usually available and accurate)
            if (usedBytes <= 0) {
              try {
                const res = await client.query(`SELECT SUM(total_size) as bytes FROM crdb_internal.table_statistics WHERE schema_name = $1`, [schema]);
                usedBytes = parseInt(res.rows[0].bytes || '0');
              } catch (e) { usedBytes = 0; }
            }

            // Priority 3: SHOW TABLES (virtual table)
            if (usedBytes <= 0) {
              try {
                const res = await client.query(`SELECT SUM(table_size + index_size) as bytes FROM [SHOW TABLES FROM "${schema}" WITH SIZES]`);
                usedBytes = parseInt(res.rows[0].bytes || '0');
              } catch (e) { usedBytes = 0; }
            }

            // Priority 4: Row Count Fallback (Guaranteed to work if tables exist)
            if (usedBytes <= 0) {
              try {
                const res = await client.query(`SELECT count(*) as count FROM "${schema}".candles`);
                usedBytes = parseInt(res.rows[0].count || '0') * 132; 
              } catch (e) { usedBytes = 0; }
            }
            
            // Format dbSize using Postgres if possible, else manual
            if (usedBytes > 0) {
              try {
                const prettyRes = await client.query('SELECT pg_size_pretty($1::bigint) as pretty', [usedBytes]);
                dbSize = prettyRes.rows[0].pretty;
              } catch (e) {
                dbSize = usedBytes > 1048576 
                  ? `${(usedBytes/1048576).toFixed(1)} MB` 
                  : `${(usedBytes/1024).toFixed(1)} KB`;
              }
            } else {
              dbSize = '0 B';
            }

            // Calculate source ratio
            const ratioRes = await client.query({
              text: `
                WITH total AS (SELECT COUNT(*) as total_weeks FROM "${schema}".download_progress WHERE status = 'completed'),
                     src AS (SELECT COUNT(*) as src_weeks FROM "${schema}".download_progress WHERE status = 'completed' AND source = $1)
                SELECT total_weeks, src_weeks FROM total, src
              `,
              values: [source]
            });

            totalWeeks = parseInt(ratioRes.rows[0].total_weeks || '0');
            const srcWeeks = parseInt(ratioRes.rows[0].src_weeks || '0');

            if (totalWeeks > 0 && usedBytes > 0) {
              sourceBytes = Math.floor((srcWeeks / totalWeeks) * usedBytes);
              try {
                const sourcePrettyRes = await client.query('SELECT pg_size_pretty($1::bigint) as pretty', [sourceBytes]);
                sourceSize = sourcePrettyRes.rows[0].pretty;
              } catch (e) {
                sourceSize = sourceBytes > 1048576 
                  ? `${(sourceBytes/1048576).toFixed(1)} MB` 
                  : `${(sourceBytes/1024).toFixed(1)} KB`;
              }
            } else if (usedBytes > 0) {
              // Direct count fallback for source ratio
              try {
                const candleRatioRes = await client.query(`SELECT count(*) as count FROM "${schema}".candles WHERE source = $1`, [source]);
                const srcCount = parseInt(candleRatioRes.rows[0].count || '0');
                if (srcCount > 0) {
                   const totalCountRes = await client.query(`SELECT count(*) as count FROM "${schema}".candles`);
                   const totalCount = parseInt(totalCountRes.rows[0].count || '1');
                   sourceBytes = Math.floor((srcCount / totalCount) * usedBytes);
                   sourceSize = sourceBytes > 1048576 ? `${(sourceBytes/1048576).toFixed(1)} MB` : `${(sourceBytes/1024).toFixed(1)} KB`;
                }
              } catch (ratioErr) {
                sourceSize = '0 B';
                sourceBytes = 0;
              }
            }
          } catch (e: any) {
            console.warn(`[DB_STATUS] Size calc failed for node ${nodeId}:`, e.message);
            // Default to minimal values instead of "Unknown" to keep UI functional
            if (!dbSize || dbSize === '0 B') dbSize = '0 B';
          }

          const gapsRes = await client.query({
            text: `
              SELECT s.name as pair, g.id, g.start_timestamp, g.end_timestamp, g.gap_minutes, g.status
              FROM ${schema}.candle_gaps g
              JOIN ${schema}.symbols s ON s.id = g.symbol_id
              WHERE g.source = $1
              ORDER BY g.start_timestamp ASC
            `,
            values: [source]
          });

          const quotaGB = parseFloat(process.env.DB_QUOTA_GB || '10');
          const totalBytes = quotaGB * 1024 * 1024 * 1024;

          // Fetch missing details for all pairs in this node for the selected source
          const missingDetailsRes = await client.query({
            text: `
              SELECT s.name as pair, year, week
              FROM ${schema}.download_progress dp
              JOIN ${schema}.symbols s ON s.id = dp.symbol_id
              WHERE dp.status = 'not_found' AND dp.source = $1
              ORDER BY year ASC, week ASC
            `,
            values: [source]
          });

          return { 
            id: nodeId, 
            status: 'connected', 
            db_size: dbSize,
            source_size: sourceSize,
            used_bytes: usedBytes,
            total_bytes: totalBytes,
            total_weeks: totalWeeks,
            pairs: pairs.map(p => {
              const row = statsRes.rows.find((r: any) => r.pair === p);
              const pairGaps = gapsRes.rows.filter((r: any) => r.pair === p);
              const openGaps = pairGaps.filter((g: any) => g.status === 'open');
              const sources = row?.sources || [];
              const selectedSourceInfo = sources.find((s: any) => s.source === source) || {};
              
              const currentYear = new Date().getFullYear();
              const completeYears = completionRes.rows
                .filter((r: any) => {
                  const symbolRow = statsRes.rows.find((sr: any) => sr.pair === p);
                  return r.symbol_id === symbolRow?.symbol_id; 
                })
                .filter((r: any) => {
                  const count = parseInt(r.completed_weeks);
                  return count >= 52 || (r.year === currentYear && count >= 1); // rough check
                })
                .map((r: any) => r.year);
 
              const missingDetails = missingDetailsRes.rows
                .filter((r: any) => r.pair === p)
                .map((r: any) => ({ year: r.year, week: r.week }));
 
              const symbolRow = statsRes.rows.find((sr: any) => sr.pair === p);
              const symbolId = symbolRow?.symbol_id;
              const pairRowCount = (symbolId && pairCountsMap.has(Number(symbolId))) ? (pairCountsMap.get(Number(symbolId)) || 0) : 0;
              const pairEstimatedBytes = pairRowCount * 132; // ~132 bytes per candle record
              
              let pairSizeStr = '0 B';
              if (pairEstimatedBytes > 1048576) pairSizeStr = `${(pairEstimatedBytes / 1048576).toFixed(1)} MB`;
              else if (pairEstimatedBytes > 1024) pairSizeStr = `${(pairEstimatedBytes / 1024).toFixed(1)} KB`;
              else pairSizeStr = `${pairEstimatedBytes} B`;
 
              return {
                name: p,
                weeks: parseInt(selectedSourceInfo.weeks || '0'),
                size_str: pairSizeStr,
                used_bytes: pairEstimatedBytes,
                missingCount: missingDetails.length,
                gapCount: openGaps.length,
                gapMinutes: openGaps.reduce((acc: number, g: any) => acc + parseInt(g.gap_minutes), 0),
                gapDetails: pairGaps.map((g: any) => ({
                    id: g.id,
                    start: g.start_timestamp,
                    end: g.end_timestamp,
                    minutes: g.gap_minutes,
                    status: g.status
                })),
                missingDetails: missingDetails,
                syncedYears: [],
                completeYears: completeYears,
                startYear: selectedSourceInfo.startYear,
                startWeek: selectedSourceInfo.startWeek,
                endYear: selectedSourceInfo.endYear,
                endWeek: selectedSourceInfo.endWeek,
                lastUpdate: null,
                isSyncing: isSyncing && currentSyncNodeId === nodeId && currentSyncPair === p && currentSyncSource === source,
                progress: isSyncing && currentSyncNodeId === nodeId && currentSyncPair === p && currentSyncSource === source ? syncProgress : null,
                sources: sources
              };
            })
          };
        } catch (e: any) { 
          console.error(`[DB ERROR] Node ${nodeId}:`, e.message);
          return { 
            id: nodeId, 
            status: 'error', 
            error: e.message, 
            db_size: 'Error',
            source_size: '0 B',
            used_bytes: 0,
            total_bytes: parseFloat(process.env.DB_QUOTA_GB || '1') * 1024 * 1024 * 1024,
            pairs: pairs.map(p => ({ 
              name: p, 
              weeks: 0, 
              isSyncing: isSyncing && currentSyncNodeId === nodeId && currentSyncPair === p && currentSyncSource === source, 
              progress: null 
            })) 
          }; 
        } finally {
          if (client) client.release();
        }
      }));
      
      const responseData = { 
        status, 
        isSyncing: isSyncing
      };
      
      // Update cache
      cachedStatus = { source, data: responseData };
      lastStatusFetch = Date.now();
      
      res.json(responseData);
    } catch (error: any) {
      console.error(`[FATAL] /db-status failure:`, error);
      res.status(500).json({ status: [], error: error.message });
    }
  });

  app.post('/api/wipe-all-databases', async (req, res) => {
    try {
      // Emergency stop for any active syncs before wiping
      abortSync = true;
      isSyncing = false;
      
      // Use pools.values() to ensure we target all active connections
      await Promise.all(Array.from(pools.values()).map(async (poolObj) => {
        const { pool, id: nodeId } = poolObj;
        const schema = `node_${nodeId}`;
        
        let client;
        try {
          client = await pool.connect();
          // Add a timeout to the client for this operation to prevent "rolling" indefinitely
          await client.query('SET statement_timeout = 30000'); // 30s timeout
          
          await client.query('BEGIN');
          const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name IN ('candles', 'download_progress', 'sync_logs', 'candle_gaps')
          `, [schema]);
          
          const existingTables = tableCheck.rows.map(r => r.table_name);
          
          if (existingTables.includes('candles')) {
            await client.query(`TRUNCATE TABLE "${schema}".candles CASCADE`);
          }
          if (existingTables.includes('download_progress')) {
            await client.query(`TRUNCATE TABLE "${schema}".download_progress CASCADE`);
          }
          if (existingTables.includes('sync_logs')) {
            await client.query(`TRUNCATE TABLE "${schema}".sync_logs CASCADE`);
          }
          if (existingTables.includes('candle_gaps')) {
            await client.query(`TRUNCATE TABLE "${schema}".candle_gaps CASCADE`);
          }
          
          await client.query('COMMIT');
        } catch (err) {
          if (client) await client.query('ROLLBACK').catch(() => {});
          console.warn(`[WIPE_NODE_WARN] Node ${nodeId} wipe partially failed or tables missing:`, err);
        } finally {
          if (client) {
            await client.query('SET statement_timeout = 0').catch(() => {}); // Reset
            client.release();
          }
        }
      }));
      
      // Success - reset flags after completion
      abortSync = false;
      res.json({ success: true, message: 'All database nodes wiped successfully' });
    } catch (e: any) {
      console.error('[WIPE_ALL_ERROR]', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sync-logs', async (req, res) => {
    try {
      const logs = await Promise.all(nodes.map(async (node) => {
        const nodeId = node.id;
        const poolObj = pools.get(nodeId);
        if (!poolObj) return [];
        const { pool } = poolObj;
        const schema = `node_${nodeId}`;
        const res = await pool.query(`SELECT * FROM ${schema}.sync_logs ORDER BY timestamp DESC LIMIT 50`);
        return res.rows;
      }));
      res.json(logs.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/clear-logs', async (req, res) => {
    try {
      await Promise.all(Array.from(pools.values()).map(async (poolObj) => {
        const { pool, id: nodeId } = poolObj;
        const schema = `node_${nodeId}`;
        
        try {
          // Use DELETE with a short timeout to prevent hanging the whole request
          await pool.query({
            text: `DELETE FROM "${schema}".sync_logs`
          });
        } catch (e) {
          console.warn(`[CLEAR_LOGS_WARN] Node ${nodeId} clear failed:`, e);
        }
      }));
      res.json({ success: true, message: 'Logs cleared successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
    const { pair, nodeId: nodeIdStr, source } = req.body || {};
    const nodeId = parseInt(nodeIdStr);
    
    if (!req.file || !pair || !nodeId || !source) {
      return res.status(400).json({ error: 'Missing file, pair, source or nodeId' });
    }

    if (isSyncing) {
      return res.status(400).json({ error: 'Another sync or upload is already in progress' });
    }

    const poolObj = pools.get(nodeId);
    if (!poolObj) return res.status(404).json({ error: 'Node not configured' });

    const { pool } = poolObj;
    const schema = `node_${nodeId}`;
    const csvContent = req.file.buffer.toString('utf-8');

    // Set global state so UI shows "Syncing" (Uploading)
    isSyncing = true;
    currentSyncPair = pair;
    currentSyncSource = source;
    syncProgress = { year: 0, week: 0 }; // Will be updated during process if we want, but for now just presence

    try {
      const client = await pool.connect();
      try {
        const symbolRes = await client.query(`SELECT id FROM ${schema}.symbols WHERE name = $1`, [pair]);
        if (symbolRes.rows.length === 0) throw new Error('Symbol not found');
        const symbolId = symbolRes.rows[0].id;
        const startYear = parseInt(req.body.startYear || '2015');

        // Pre-ensure partitions OUTSIDE the transaction
        // First skip the header and find years
        const separator = csvContent.includes(';') ? ';' : (csvContent.includes(',') ? ',' : '\t');
        const previewRows = parse(csvContent, { delimiter: separator, skip_empty_lines: true, trim: true, relax_column_count: true, to: 100 });
        const yearsToEnsure = new Set<number>();
        for (const r of previewRows) {
          if (!r[0] || isNaN(parseInt(r[0].substring(0, 4)))) continue;
          yearsToEnsure.add(parseInt(r[0].substring(0, 4)));
        }
        for (const y of yearsToEnsure) {
          await ensurePartition(client, y, schema);
        }

        await client.query('BEGIN');
        const savedCount = await internalProcessHistDataCSV(client, symbolId, schema, source, csvContent, nodeId, pair, startYear);
        await client.query('COMMIT');

        await logSync(nodeId, pair, source, 'SUCCESS', `Manual upload processed ${savedCount} weeks`);
        res.json({ success: true, weeksSaved: savedCount });
      } finally {
        client.release();
      }
    } catch (e: any) {
      await logSync(nodeId, pair, source, 'ERROR', `Manual upload failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    } finally {
      isSyncing = false;
      currentSyncNodeId = null;
      currentSyncPair = null;
      currentSyncSource = 'histdata';
      syncProgress = { year: 0, week: 0 };
    }
  });

  // Client-side logging endpoint
  app.post('/api/client-log', async (req, res) => {
    try {
      const { nodeId, pair, source, level, message, details } = req.body || {};
      await logSync(nodeId || 1, pair || 'unknown', source || 'client', level || 'INFO', message, details);
      res.json({ success: true });
    } catch (e) {
      console.error(`[CLIENT_LOG_ERR]`, e);
      res.json({ success: true }); // Still return success to client
    }
  });

  // NEW: Batch candle storage for client-side parsed CSVs
  app.post('/api/batch-store-candles', async (req, res) => {
    const { nodeId: nodeIdStr, pair, source, records, isStart, isEnd } = req.body || {};
    const nodeId = parseInt(nodeIdStr);

    if (isStart) {
      isSyncing = true;
      currentSyncNodeId = nodeId;
      currentSyncPair = pair;
      currentSyncSource = source || 'histdata';
      syncProgress = { year: 0, week: 0 };
      lastSyncActivity = Date.now();
      await logSync(nodeId, pair, source, 'INFO', `Started manual CSV upload`);
      return res.json({ success: true });
    }

    if (isEnd) {
      resetSyncState();
      await logSync(nodeId, pair, source, 'SUCCESS', `Manual CSV upload completed`);
      return res.json({ success: true });
    }

    lastSyncActivity = Date.now();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided' });
    }

    const poolObj = pools.get(nodeId);
    if (!poolObj) return res.status(404).json({ error: 'Node not configured' });

    const schema = `node_${nodeId}`;
    const client = await poolObj.pool.connect();
    try {
      const symbolRes = await client.query(`SELECT id FROM ${schema}.symbols WHERE name = $1`, [pair]);
      if (symbolRes.rows.length === 0) throw new Error('Symbol not found');
      const symbolId = symbolRes.rows[0].id;

      // Group by year-week for partitioning and progress tracking
      const weekGroups = new Map<string, any[]>();
      const yearsNeeded = new Set<number>();
      for (const row of records) {
        // row: { ts, o, h, l, c, oa, ha, la, ca, v }
        if (isWeekend(row.ts)) continue;
        const tsDate = new Date(row.ts);
        const y = tsDate.getUTCFullYear();
        yearsNeeded.add(y);

        const jan4 = new Date(y, 0, 4);
        const weekNo = Math.ceil((((tsDate.getTime() - jan4.getTime()) / 86400000) + jan4.getUTCDay() + 1) / 7);
        const key = `${y}-${weekNo}`;
        
        if (!weekGroups.has(key)) weekGroups.set(key, []);
        weekGroups.get(key)!.push(row);
      }

      // Pre-ensure all needed partitions BEFORE starting transaction
      for (const y of yearsNeeded) {
        await ensurePartition(client, y, schema);
      }

      await client.query('BEGIN');
      let totalInserted = 0;
      let loopCount = 0;
      for (const [key, groupRows] of weekGroups.entries()) {
        const [wYear, wNo] = key.split('-').map(Number);
        
        // HistData usually comes sorted, but we sort once per week to be safe
        groupRows.sort((a, b) => a.ts - b.ts);

        let finalRows = groupRows;
        // De-duplicate if not exness
        if (source !== 'exness') {
          const seen = new Set<number>();
          finalRows = [];
          for (const r of groupRows) {
            if (!seen.has(r.ts)) {
              seen.add(r.ts);
              finalRows.push(r);
            }
          }
        }

        // --- GAP DETECTION for Manual Upload ---
        const manualGaps = [];
        if (source !== 'exness') {
          for (let i = 0; i < finalRows.length - 1; i++) {
            const current = finalRows[i].ts;
            const next = finalRows[i+1].ts;
            const diff = next - current;
            if (diff > 65000) {
              let tradingMins = 0;
              const totalGapMins = Math.floor(diff / 60000) - 1;
              if (totalGapMins > 0 && totalGapMins < 10000) {
                for (let m = 1; m <= totalGapMins; m++) {
                  if (!isWeekend(current + (m * 60000))) tradingMins++;
                }
              }
              if (tradingMins > 0) {
                manualGaps.push({ start: current + 60000, end: next - 60000, mins: tradingMins });
              }
            }
          }
        }
        if (manualGaps.length > 0) {
          await client.query({
            text: `INSERT INTO "${schema}".candle_gaps (symbol_id, start_timestamp, end_timestamp, gap_minutes, source)
                   SELECT $1, start_ts, end_ts, mins, $2
                   FROM UNNEST($3::bigint[], $4::bigint[], $5::integer[]) AS data(start_ts, end_ts, mins)
                   ON CONFLICT (symbol_id, start_timestamp, end_timestamp, source) DO NOTHING`,
            values: [symbolId, source, manualGaps.map(g => g.start), manualGaps.map(g => g.end), manualGaps.map(g => g.mins)]
          });
        }
        
        // Update global progress for UI transparency
        syncProgress = { year: wYear, week: wNo };
        
        // --- MAPPING FOR INSERT ---
        const tsA: bigint[] = [];
        const oA: number[] = [], hA: number[] = [], lA: number[] = [], cA: number[] = [];
        const oaA: number[] = [], haA: number[] = [], laA: number[] = [], caA: number[] = [];
        const vA: number[] = [];
        
        for (const r of finalRows) {
          tsA.push(BigInt(r.ts));
          oA.push(r.o); hA.push(r.h); lA.push(r.l); cA.push(r.c);
          oaA.push(r.oa || r.o); haA.push(r.ha || r.h); laA.push(r.la || r.l); caA.push(r.ca || r.c);
          vA.push(r.v || 0);
        }

        const insertRes = await client.query(`INSERT INTO "${schema}".candles (symbol_id, timestamp_utc, source, open_bid, high_bid, low_bid, close_bid, open_ask, high_ask, low_ask, close_ask, volume, volume_type, spread, spread_type, spread_source, is_repaired) 
                 SELECT $1, ts, $2, o, h, l, c, oa, ha, la, ca, v, $13, (oa-o), $14, $2, FALSE FROM UNNEST($3::bigint[], $4::double precision[], $5::double precision[], $6::double precision[], $7::double precision[], $8::double precision[], $9::double precision[], $10::double precision[], $11::double precision[], $12::double precision[]) AS data(ts, o, h, l, c, oa, ha, la, ca, v)
                 ON CONFLICT (symbol_id, timestamp_utc, source) DO NOTHING`,
          [symbolId, source, tsA, oA, hA, lA, cA, oaA, haA, laA, caA, vA,
           source === 'exness' ? 'TICKS' : 'BARS',
           source === 'exness' ? 'REAL' : 'ZERO'
          ]);
        
        const rowCount = insertRes.rowCount || 0;
        totalInserted += rowCount;
        
        // Throttle logs: only log every 5 loops or if it's the first/last
        if (loopCount === 0 || loopCount % 5 === 0 || rowCount === groupRows.length) {
          await logSync(nodeId, pair, source, 'INFO', `Processing ${wYear} W${wNo}: Stored ${rowCount}/${groupRows.length} records`);
        }
        loopCount++;

        await client.query(`INSERT INTO ${schema}.download_progress (symbol_id, year, week, source, status) VALUES ($1, $2, $3, $4, 'completed') ON CONFLICT (symbol_id, year, week, source) DO UPDATE SET status = 'completed', updated_at = CURRENT_TIMESTAMP`, [symbolId, wYear, wNo, source]);
      }
      await client.query('COMMIT');
      
      console.log(`[BATCH SUCCESS] Pair ${pair}: Total ${totalInserted} records cached`);
      await logSync(nodeId, pair, source, 'SUCCESS', `Batch upload finished: ${totalInserted} records total`);
      res.json({ success: true, inserted: totalInserted });
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error(`[BATCH ERROR] Pair ${pair}:`, e.message);
      await logSync(nodeId, pair, source, 'ERROR', `Batch upload error: ${e.message}`);
      
      // If error occurs, we should probably reset the global sync state too
      isSyncing = false;
      currentSyncNodeId = null;
      currentSyncPair = null;
      
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/api/unpatch-gap', async (req, res) => {
    const { nodeId, pair, source, gapId } = req.body;
    const schema = `node_${nodeId}`;
    let client;
    try {
      client = await pool.connect();
      const symbolRes = await client.query(`SELECT id FROM "${schema}".symbols WHERE name = $1`, [pair]);
      if (symbolRes.rows.length === 0) throw new Error('Symbol not found');
      const symbolId = symbolRes.rows[0].id;

      const gapRes = await client.query(`SELECT * FROM ${schema}.candle_gaps WHERE id = $1`, [gapId]);
      if (gapRes.rows.length === 0) throw new Error('Gap not found');
      const gap = gapRes.rows[0];

      await client.query('BEGIN');
      // Delete patched candles in this range
      await client.query(`
        DELETE FROM "${schema}".candles 
        WHERE symbol_id = $1 AND source = $2 
        AND timestamp_utc >= $3 AND timestamp_utc <= $4 AND is_repaired = TRUE
      `, [symbolId, source, gap.start_timestamp, gap.end_timestamp]);
      
      // Reset gap status
      await client.query(`UPDATE ${schema}.candle_gaps SET status = 'open', patched_at = NULL WHERE id = $1`, [gapId]);
      await client.query('COMMIT');

      res.json({ message: 'Gap unpatched successfully' });
    } catch (e: any) {
      if (client) await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      if (client) client.release();
    }
  });

  app.post('/api/patch-gaps', async (req, res) => {
    const { nodeId, pair, source: targetSource } = req.body || {};
    if (!nodeId || !pair || !targetSource) return res.status(400).json({ error: 'Missing params' });

    res.json({ message: 'Gap patching started in background' });

    (async () => {
      const pId = parseInt(nodeId);
      const poolObj = pools.get(pId);
      if (!poolObj) return;
      const { pool, id } = poolObj;
      const schema = `node_${id}`;
      let client;
      try {
        client = await pool.connect();
        const symbolRes = await client.query(`SELECT id FROM ${schema}.symbols WHERE name = $1`, [pair]);
        if (symbolRes.rows.length === 0) return;
        const symbolId = symbolRes.rows[0].id;

        const gaps = await client.query(`SELECT * FROM ${schema}.candle_gaps WHERE symbol_id = $1 AND source = $2 AND status = 'open' ORDER BY start_timestamp ASC`, [symbolId, targetSource]);
        
        if (gaps.rows.length === 0) {
           await logSync(pId, pair, 'patch', 'INFO', `No open gaps found for ${targetSource} for ${pair}`);
           return;
        }

        await logSync(pId, pair, 'patch', 'INFO', `Starting patch for ${gaps.rows.length} gaps using Dukascopy source (Bid only)...`);

        let totalPatchedCount = 0;
        for (const gap of gaps.rows) {
          const start = BigInt(gap.start_timestamp);
          const end = BigInt(gap.end_timestamp);
          
          const copyRes = await client.query(`
            INSERT INTO ${schema}.candles (symbol_id, timestamp_utc, source, open_bid, high_bid, low_bid, close_bid, open_ask, high_ask, low_ask, close_ask, volume, volume_type, spread, spread_type, spread_source, is_repaired, repair_source)
            SELECT symbol_id, timestamp_utc, $1, open_bid, high_bid, low_bid, close_bid, open_bid, high_bid, low_bid, close_bid, volume, volume_type, 0, 'ZERO', 'none', TRUE, 'dukascopy_bid'
            FROM ${schema}.candles
            WHERE symbol_id = $2 
              AND source = 'dukascopy' 
              AND timestamp_utc >= $3 
              AND timestamp_utc <= $4
              AND NOT (
                (EXTRACT(DOW FROM TO_TIMESTAMP(timestamp_utc/1000.0) AT TIME ZONE 'UTC') = 5 AND EXTRACT(HOUR FROM TO_TIMESTAMP(timestamp_utc/1000.0) AT TIME ZONE 'UTC') >= 22) OR
                (EXTRACT(DOW FROM TO_TIMESTAMP(timestamp_utc/1000.0) AT TIME ZONE 'UTC') = 6) OR
                (EXTRACT(DOW FROM TO_TIMESTAMP(timestamp_utc/1000.0) AT TIME ZONE 'UTC') = 0 AND EXTRACT(HOUR FROM TO_TIMESTAMP(timestamp_utc/1000.0) AT TIME ZONE 'UTC') < 22)
              )
            ON CONFLICT (symbol_id, timestamp_utc, source) DO NOTHING
          `, [targetSource, symbolId, start, end]);

          if (copyRes.rowCount && copyRes.rowCount > 0) {
            await client.query(`UPDATE ${schema}.candle_gaps SET status = 'patched' WHERE id = $1`, [gap.id]);
            totalPatchedCount += copyRes.rowCount;
          }
        }
        
        await logSync(pId, pair, 'patch', 'SUCCESS', `Patching complete. Recovered ${totalPatchedCount} minutes across ${gaps.rows.length} gaps.`);
      } catch (e: any) {
        console.error(`[PATCH ERROR]`, e.message);
        await logSync(pId, pair, 'patch', 'ERROR', `Patch failed: ${e.message}`);
      } finally {
        if (client) client.release();
      }
    })().catch(console.error);
  });

  // Node management
  app.get('/api/nodes', (req, res) => {
    res.json(nodes.map(n => ({ id: n.id, pairs: n.pairs }))); // Don't leak URLs
  });

  app.post('/api/nodes', async (req, res) => {
    try {
      const { url, pairs } = req.body || {};
      if (!url || !pairs || !Array.isArray(pairs)) {
        return res.status(400).json({ error: 'Missing url or pairs array' });
      }
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    const newNode = { id: newId, url, pairs };
    nodes.push(newNode);
    const pool = createPool(newId, url);
    
    // Initialize DB for the new node
    await initDB({ pool, id: newId }, pairs);
    
    res.json({ id: newId, pairs });
    } catch (e: any) {
      console.error(`[NODES_POST_ERR]`, e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/nodes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = nodes.findIndex(n => n.id === id);
    if (index === -1) return res.status(404).json({ error: 'Node not found' });
    
    nodes.splice(index, 1);
    const poolObj = pools.get(id);
    if (poolObj) {
      poolObj.pool.end();
      pools.delete(id);
    }
    res.json({ success: true });
  });

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Update
  app.post('/api/trigger-update', async (req, res) => {
    try {
      const { pair, nodeId, startYear, source } = req.body || {};
      if (!nodeId || !pair) return res.status(400).json({ error: 'Missing pair or nodeId' });

      if (isSyncing) return res.status(429).json({ error: 'Sync in progress' });
      
      // Fire and forget, but catch rejections
      syncPairSequentially(pair, parseInt(nodeId as any), startYear || 2020, source || 'histdata')
        .catch(err => console.error(`[BG_SYNC_ERROR] ${pair}:`, err));

      res.json({ message: `Sync started for ${pair} (${source || 'histdata'})` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/resync-missing', async (req, res) => {
    try {
      const { pair, nodeId, source } = req.body || {};
      if (!nodeId || !pair) return res.status(400).json({ error: 'Missing pair or nodeId' });

      if (isSyncing) return res.status(429).json({ error: 'Sync in progress' });
      
      // Fire and forget, but catch rejections
      resyncMissingWeeks(pair, parseInt(nodeId as any), source || 'histdata')
        .catch(err => console.error(`[BG_RESYNC_ERROR] ${pair}:`, err));

      res.json({ message: `Resync started for ${pair} (${source || 'histdata'})` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/stop-update', async (req, res) => {
    if (!isSyncing) return res.json({ message: 'No sync in progress' });
    syncAbort();
    
    // Also reset batch sync states if they were stuck
    if (currentSyncNodeId && !abortSync) { // if it wasn't a sequential sync
       isSyncing = false;
       currentSyncNodeId = null;
       currentSyncPair = null;
    }

    res.json({ message: 'Sync stop requested' });
  });

  // Wipe
  app.post('/api/wipe-node', async (req, res) => {
    const { nodeId } = req.body;
    const poolObj = pools.get(nodeId);
    if (!poolObj) return res.status(404).json({ error: 'Node not found' });
    const { pool, id } = poolObj;
    const schema = `node_${id}`;
    
    // Invalidate cache
    cachedStatus = null;
    
    let client;
    try {
      client = await pool.connect();
      await logSync(nodeId, 'ALL', 'system', 'WARNING', `Wiping node ${nodeId} database...`);
      await client.query(`TRUNCATE TABLE "${schema}".candles, "${schema}".download_progress, "${schema}".candle_gaps CASCADE`);
      await logSync(nodeId, 'ALL', 'system', 'SUCCESS', `Node ${nodeId} wiped successfully`);
      res.json({ message: `Node ${nodeId} wiped successfully` });
    } catch (e: any) {
      await logSync(nodeId, 'ALL', 'system', 'ERROR', `Wipe failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    } finally { if (client) client.release(); }
  });

  // Clear Pair Source
  app.post('/api/clear-pair-source', async (req, res) => {
    const { nodeId, pair, source } = req.body;
    if (!nodeId || !pair || !source) return res.status(400).json({ error: 'Missing nodeId, pair or source' });
    
    const poolObj = pools.get(nodeId);
    if (!poolObj) return res.status(404).json({ error: 'Node not found' });
    const { pool, id } = poolObj;
    const schema = `node_${id}`;
    
    cachedStatus = null;

    let client;
    try {
      client = await pool.connect();
      const symbolRes = await client.query(`SELECT id FROM "${schema}".symbols WHERE name = $1`, [pair]);
      if (symbolRes.rows.length > 0) {
        const symbolId = symbolRes.rows[0].id;
        await logSync(nodeId, pair, source, 'WARNING', `Deleting all ${source} data for ${pair}...`);
        
        await client.query('BEGIN');
        await client.query(`DELETE FROM "${schema}".candles WHERE symbol_id = $1 AND source = $2`, [symbolId, source]);
        await client.query(`DELETE FROM "${schema}".download_progress WHERE symbol_id = $1 AND source = $2`, [symbolId, source]);
        await client.query(`DELETE FROM "${schema}".candle_gaps WHERE symbol_id = $1 AND source = $2`, [symbolId, source]);
        await client.query('COMMIT');
        
        await logSync(nodeId, pair, source, 'SUCCESS', `Cleared ${source} data for ${pair} successfully`);
        res.json({ message: `Source ${source} cleared for ${pair}` });
      } else {
        res.status(404).json({ error: 'Symbol not found' });
      }
    } catch (e: any) {
      if (client) await client.query('ROLLBACK');
      await logSync(nodeId, pair, source, 'ERROR', `Source clear failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    } finally { if (client) client.release(); }
  });

  // Clear Pair
  app.post('/api/clear-pair', async (req, res) => {
    const { nodeId, pair } = req.body;
    const poolObj = pools.get(nodeId);
    if (!poolObj) return res.status(404).json({ error: 'Node not found' });
    const { pool, id } = poolObj;
    const schema = `node_${id}`;
    
    // Invalidate cache
    cachedStatus = null;

    let client;
    try {
      client = await pool.connect();
      const symbolRes = await client.query(`SELECT id FROM "${schema}".symbols WHERE name = $1`, [pair]);
      if (symbolRes.rows.length > 0) {
        const symbolId = symbolRes.rows[0].id;
        await logSync(nodeId, pair, 'system', 'WARNING', `Deleting all data for ${pair}...`);
        await client.query(`DELETE FROM "${schema}".candles WHERE symbol_id = $1`, [symbolId]);
        await client.query(`DELETE FROM "${schema}".download_progress WHERE symbol_id = $1`, [symbolId]);
        await client.query(`DELETE FROM "${schema}".candle_gaps WHERE symbol_id = $1`, [symbolId]);
        await logSync(nodeId, pair, 'system', 'SUCCESS', `Cleared ${pair} data successfully`);
        res.json({ message: `Data cleared for ${pair}` });
      } else {
        res.status(404).json({ error: 'Symbol not found' });
      }
    } catch (e: any) {
      await logSync(nodeId, pair, 'system', 'ERROR', `Clear failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    } finally { if (client) client.release(); }
  });

  // Warehouse Data Fetching (Aggregated Candles)
  app.get('/api/warehouse-candles', async (req, res) => {
    try {
      const { symbol, source, timeframe, limit, startTime, endTime } = req.query;
      if (!symbol || !source || !timeframe) {
        return res.status(400).json({ error: 'Missing symbol, source or timeframe' });
      }

      // Find node for symbol
      const node = nodes.find(n => n.pairs.includes(symbol as string));
      if (!node) {
        return res.status(404).json({ error: `Symbol ${symbol} not mapped to any warehouse node` });
      }

      const poolObj = pools.get(node.id);
      if (!poolObj) return res.status(500).json({ error: 'Node pool not initialized' });

      const schema = `node_${node.id}`;
      const intervalMinutes = timeframeToMinutes(timeframe as string);
      const bucketSizeMs = intervalMinutes * 60 * 1000;

      const client = await poolObj.pool.connect();
      try {
        const symbolIdRes = await client.query(`SELECT id FROM ${schema}.symbols WHERE name = $1`, [symbol]);
        if (symbolIdRes.rows.length === 0) throw new Error('Symbol not found in node');
        const symbolId = symbolIdRes.rows[0].id;

        // Query with aggregation
        let query = `
          SELECT 
            FLOOR(timestamp_utc / ${bucketSizeMs}) * ${bucketSizeMs} as bucket,
            (ARRAY_AGG(open_bid ORDER BY timestamp_utc ASC))[1] as open,
            MAX(high_bid) as high,
            MIN(low_bid) as low,
            (ARRAY_AGG(close_bid ORDER BY timestamp_utc DESC))[1] as close,
            SUM(volume) as volume
          FROM ${schema}.candles
          WHERE symbol_id = $1 AND source = $2
        `;
        
        const params: any[] = [symbolId, (source as string).toLowerCase()];
        let paramIdx = 3;

        if (startTime) {
          query += ` AND timestamp_utc >= $${paramIdx++}`;
          params.push(BigInt(startTime as string));
        }
        if (endTime) {
          query += ` AND timestamp_utc <= $${paramIdx++}`;
          params.push(BigInt(endTime as string));
        }

        query += ` GROUP BY bucket ORDER BY bucket DESC LIMIT $${paramIdx++}`;
        params.push(parseInt(limit as string) || 1000);

        const result = await client.query(query, params);
        
        const candles = result.rows.map(r => ({
          time: Math.floor(Number(r.bucket) / 1000),
          open: parseFloat(r.open),
          high: parseFloat(r.high),
          low: parseFloat(r.low),
          close: parseFloat(r.close),
          volume: parseFloat(r.volume || 0)
        }));

        res.json(candles);
      } finally { client.release(); }
    } catch (e: any) {
      console.error('[WAREHOUSE_CANDLES_ERR]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- CockroachDB Storage Stats ---
  app.get('/api/storage-stats', async (req, res) => {
    try {
      const poolEntries = Array.from(pools.values());
      if (poolEntries.length === 0) {
        return res.json({ totalSize: '0 B', rawSize: 0, tables: [] });
      }

      const firstPool = poolEntries[0].pool;
      let dbSize = '0 B';
      let dbRaw = 0;
      
      let client;
      try {
        client = await firstPool.connect();
        const sizeRes = await client.query(`SELECT pg_database_size(current_database()) as raw_size, pg_size_pretty(pg_database_size(current_database())) as size`);
        dbSize = sizeRes.rows[0].size;
        dbRaw = parseInt(sizeRes.rows[0].raw_size);
      } catch (e) {
        try {
          if (client) {
            const crdbSizeRes = await client.query(`SELECT SUM(table_size + index_size) as raw_size FROM [SHOW TABLES WITH SIZES]`);
            dbRaw = parseInt(crdbSizeRes.rows[0].raw_size || '0');
            const prettyRes = await client.query(`SELECT pg_size_pretty($1::bigint) as size`, [dbRaw]);
            dbSize = prettyRes.rows[0].size;
          }
        } catch (crdbErr) {
          dbSize = '0 B';
        }
      } finally {
        if (client) client.release();
      }

      // Get sizes for all node schemas
      const tables: any[] = [];
      for (const poolObj of poolEntries) {
        const nodeId = poolObj.id;
        const schema = `node_${nodeId}`;
        const nodeInfo = nodes.find(n => n.id === nodeId);
        
        let nodeClient;
        try {
          nodeClient = await poolObj.pool.connect();
          let tableRaw = 0;
          let tablePretty = '0 B';

          // Try Postgres standard total_relation_size
          try {
            const tSize = await nodeClient.query({
              text: `SELECT pg_total_relation_size(quote_ident($1) || '.candles') as raw_size, pg_size_pretty(pg_total_relation_size(quote_ident($1) || '.candles')) as size`,
              values: [schema]
            });
            if (tSize.rows.length > 0 && parseInt(tSize.rows[0].raw_size) > 0) {
              tableRaw = parseInt(tSize.rows[0].raw_size);
              tablePretty = tSize.rows[0].size;
            }
          } catch (pgErr) {
            tableRaw = 0;
          }

          // Fallback for CockroachDB: SHOW TABLES FROM schema WITH SIZES
          if (tableRaw <= 0) {
            try {
              const crdbRes = await nodeClient.query(`SELECT table_name, (table_size + index_size) as raw_size FROM [SHOW TABLES FROM "${schema}" WITH SIZES] WHERE table_name = 'candles'`);
              if (crdbRes.rows.length > 0 && parseInt(crdbRes.rows[0].raw_size) > 0) {
                tableRaw = parseInt(crdbRes.rows[0].raw_size);
                const prettyRes = await nodeClient.query('SELECT pg_size_pretty($1::bigint) as pretty', [tableRaw]);
                tablePretty = prettyRes.rows[0].pretty;
              }
            } catch (crdbErr) {
              tableRaw = 0;
            }
          }

          // Final fallback: Row count estimate
          if (tableRaw <= 0) {
            try {
              const countRes = await nodeClient.query(`SELECT count(*) as count FROM "${schema}".candles`);
              const rowCount = parseInt(countRes.rows[0].count);
              tableRaw = rowCount * 132;
              tablePretty = `~${(tableRaw / (1024*1024)).toFixed(1)} MB`;
            } catch (countErr) {
              tableRaw = 0;
            }
          }

          tables.push({
            node_id: nodeId,
            pairs: nodeInfo?.pairs || [],
            size: tablePretty,
            raw: tableRaw
          });
        } catch (nodeErr) {
          console.warn(`[STORAGE STATS] Node ${nodeId} failed:`, nodeErr);
        } finally {
          if (nodeClient) nodeClient.release();
        }
      }

      res.json({
        totalSize: dbSize,
        rawSize: dbRaw,
        tables: tables.sort((a,b) => b.raw - a.raw)
      });
    } catch (e: any) {
      console.error('[STORAGE INFO ERR]', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // Fallback for API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite/Static middleware
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[SERVER] Initializing Vite middleware...");
      const vite = await createViteServer({ 
        server: { middlewareMode: true }, 
        appType: "spa" 
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }
  } catch (viteError) {
    console.error("[FATAL] Vite initialization failed:", viteError);
    // Fallback static serving if vite fails in dev (might not help much but prevents crash)
    app.get('*', (req, res) => res.status(500).send("Vite initialization failed. Check server logs."));
  }

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
  });

  app.listen(PORT, "0.0.0.0", () => {
    // Initialize database schemas and tables on startup
    nodes.forEach((node) => { 
      const poolObj = pools.get(node.id);
      if (poolObj) {
        initDB(poolObj, node.pairs).catch(err => {
          console.error(`Failed to initialize database schema for node ${node.id}:`, err);
        });
      } 
    });
  });
}

startServer();
