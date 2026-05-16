import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, ArrowLeft, RefreshCw, Layers, ShieldCheck, AlertCircle, Clock, Save, HardDrive, Trash2, Upload, XCircle, X, Loader2, Zap } from 'lucide-react';

import Papa from 'papaparse';

interface PairStatus {
  name: string;
  weeks: number;
  size_str?: string;
  used_bytes?: number;
  missingCount: number;
  gapCount?: number;
  gapMinutes?: number;
  missingDetails: { year: number; week: number }[];
  syncedYears: number[];
  completeYears: number[];
  startYear: number | null;
  startWeek: number | null;
  endYear: number | null;
  endWeek: number | null;
  lastUpdate: string | null;
  isSyncing?: boolean;
  progress?: { year: number; week: number; day?: number } | null;
}

interface DBStatus {
  id: number;
  status: 'connected' | 'not_configured' | 'error';
  db_size: string;
  source_size: string;
  used_bytes: number;
  total_bytes: number;
  pairs: PairStatus[];
  error?: string;
}

interface DatabasePageProps {
  onBack?: () => void;
}

export function DatabasePage({ onBack }: DatabasePageProps) {
  const [dbStatus, setDbStatus] = useState<DBStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<{ id: number, pairs: string[] }[]>([]);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeUrl, setNewNodeUrl] = useState('');
  const [newNodePair, setNewNodePair] = useState('');
  const [addingNode, setAddingNode] = useState(false);

  const fetchNodesList = async () => {
    try {
      const res = await fetch('/api/nodes');
      if (res.ok) setNodes(await res.json());
    } catch (e) { console.error('Failed to fetch nodes', e); }
  };

  useEffect(() => {
    fetchNodesList();
  }, []);

  const handleAddNode = async () => {
    if (!newNodeUrl || !newNodePair) return alert('Enter URL and Pair name');
    setAddingNode(true);
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newNodeUrl, pairs: [newNodePair.toUpperCase()] })
      });
      if (res.ok) {
        setNewNodeUrl('');
        setNewNodePair('');
        setShowAddNode(false);
        fetchNodesList();
        fetchStatus(selectedSource, true);
      } else {
        const err = await res.json();
        alert('Failed: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Network error adding node');
    } finally {
      setAddingNode(false);
    }
  };

  const deleteNode = async (id: number) => {
    if (!confirm(`Are you sure you want to delete Node ${id}? This only removes the connection, not the data if it's external.`)) return;
    try {
      const res = await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNodesList();
        fetchStatus(selectedSource, true);
      }
    } catch (e) { alert('Failed to delete node'); }
  };
  const [fetching, setFetching] = useState(false);
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [deletingPair, setDeletingPair] = useState<string | null>(null);
  const [wipingNode, setWipingNode] = useState<number | null>(null);
  const [stoppingPair, setStoppingPair] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'histdata' | 'dukascopy' | 'exness' | 'axiory'>('histdata');
  const [showLogs, setShowLogs] = useState(false);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [currentSelectingPair, setCurrentSelectingPair] = useState<{name: string, nodeId: number} | null>(null);
  const [activeUploads, setActiveUploads] = useState<Record<string, {
    processed: number,
    week: {year: number, week: number} | null
  }>>({});

  const [isPatching, setIsPatching] = useState(false);
  const [globalSyncStatus, setGlobalSyncStatus] = useState<{ isGlobalSyncing: boolean, progress: any } | null>(null);
  const [storageStats, setStorageStats] = useState<{ totalSize: string, rawSize: number, tables: any[] } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const currentSourceRef = React.useRef(selectedSource);

  useEffect(() => {
    currentSourceRef.current = selectedSource;
  }, [selectedSource]);

  useEffect(() => {
    fetchStorage();
    const interval = setInterval(fetchStorage, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStorage = async () => {
    try {
      const res = await fetch('/api/storage-stats');
      if (res.ok) setStorageStats(await res.json());
    } catch (e) {
      console.error('Storage info failed:', e);
    }
  };

  const fetchLogs = async () => {
    setFetchingLogs(true);
    try {
      const res = await fetch('/api/sync-logs');
      if (res.ok) {
        setSyncLogs(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setFetchingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all sync logs? This cannot be undone.')) return;
    setClearingLogs(true);
    try {
      const res = await fetch('/api/clear-logs', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to clear logs');
      setSyncLogs([]);
    } catch (e) {
      console.error('Clear logs error:', e);
      alert('Failed to clear logs');
    } finally {
      setClearingLogs(false);
    }
  };

   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const pairInfo = currentSelectingPair;
    if (!file || !pairInfo) return;

    const uploadKey = `${pairInfo.nodeId}-${pairInfo.name}`;
    setActiveUploads(prev => ({ 
      ...prev, 
      [uploadKey]: { processed: 0, week: null } 
    }));

    const isWeekend = (timestampUtc: number): boolean => {
      const d = new Date(timestampUtc);
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      if (day === 5 && hour >= 22) return true; // Fri 22:00
      if (day === 6) return true; // Sat
      if (day === 0 && hour < 22) return true; // Sun < 22:00
      return false;
    };

    try {
      // 1. Notify server we are starting a batch upload
      await fetch('/api/batch-store-candles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: pairInfo.nodeId,
          pair: pairInfo.name,
          source: selectedSource,
          isStart: true
        })
      });

      let batch: any[] = [];
      const BATCH_SIZE = 10000;
      let totalProcessed = 0;

      const sendBatch = async (records: any[]) => {
        const res = await fetch('/api/batch-store-candles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: pairInfo.nodeId,
            pair: pairInfo.name,
            source: selectedSource,
            records
          })
        });
        if (!res.ok) throw new Error('Batch upload failed');
        
        // Update stored progress for UI
        if (records.length > 0) {
          const lastTs = records[records.length - 1].ts;
          const d = new Date(Number(lastTs));
          const jan4 = new Date(d.getUTCFullYear(), 0, 4);
          const w = Math.ceil((((d.getTime() - jan4.getTime()) / 86400000) + jan4.getUTCDay() + 1) / 7);
          
          setActiveUploads(prev => {
            const current = prev[uploadKey];
            if (!current) return prev;
            return {
              ...prev,
              [uploadKey]: {
                ...current,
                week: { year: d.getUTCFullYear(), week: w }
              }
            };
          });
        }
      };

      // 2. Parse file locally
      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          worker: false, // Disable worker to allow parser.pause/resume during async uploads
          chunkSize: 1024 * 1024 * 8, // 8MB chunks
          chunk: async (results, parser) => {
            parser.pause(); 

            for (const row of results.data as any[]) {
              // Try to find columns if it's a single-string row (delimiter issue)
              let dataRow = row;
              if (row.length === 1 && (row[0].includes(';') || row[0].includes('\t'))) {
                const sep = row[0].includes(';') ? ';' : '\t';
                dataRow = row[0].split(sep);
              }

              if (dataRow.length < 5) continue;
              
              let ts: number | null = null;
              let o: number, h: number, l: number, c: number;
              let oa: number | undefined, ha: number | undefined, la: number | undefined, ca: number | undefined;
              let v: number = 0;

              try {
                if (selectedSource === 'exness') {
                  // New Format: "Exness","Symbol","Timestamp","Bid","Ask"
                  // Header: "Exness","Symbol","Timestamp","Bid","Ask"
                  // Example: "exness","EURUSDm","2026-05-01 00:00:00.070Z",1.17286,1.17294
                  
                  // Skip header
                  if (dataRow[0]?.toLowerCase() === 'exness' && dataRow[2]?.toLowerCase() === 'timestamp') continue;
                  
                  const [sourceName, symbol, timestampStr, bid, ask] = dataRow;
                  if (!timestampStr || !bid) continue;
                  
                  const d = new Date(timestampStr);
                  if (isNaN(d.getTime())) continue;
                  
                  ts = d.getTime();
                  o = h = l = c = parseFloat(bid);
                  oa = ha = la = ca = parseFloat(ask);
                  v = 1; // Tick count
                } else if (selectedSource === 'axiory') {
                  // Format: Date,Time,Open,High,Low,Close,TickVolume
                  // Example: 2026.01.02,00:00,1.17416,1.17416,1.17416,1.17416,0
                  const [dPart, tPart, op, hi, lo, cl, tickV] = dataRow;
                  if (!dPart || !tPart) continue;
                  const dSplit = dPart.includes('.') ? '.' : (dPart.includes('/') ? '/' : '-');
                  const dParts = dPart.split(dSplit);
                  const tParts = tPart.split(':');
                  if (dParts.length < 3 || tParts.length < 2) continue;

                  let y = parseInt(dParts[0]), m = parseInt(dParts[1]), d = parseInt(dParts[2]);
                  if (y < 100 && parseInt(dParts[2]) > 100) { y = parseInt(dParts[2]); d = parseInt(dParts[0]); }

                  ts = Date.UTC(y, m - 1, d, parseInt(tParts[0]), parseInt(tParts[1]), 0);
                  o = parseFloat(op); h = parseFloat(hi); l = parseFloat(lo); c = parseFloat(cl);
                  oa = o; ha = h; la = l; ca = c; // Bid only, set Ask = Bid
                  v = parseFloat(tickV);
                } else {
                  // Existing general parsing logic for histdata and others
                  const datePart = dataRow[0];
                  if (!datePart) continue;

                  // Handle various formats seen in histdata or common CSVs
                  if (datePart.includes('.') && datePart.includes(' ') && datePart.includes(':')) {
                    const [dStr, tStr] = datePart.split(' ');
                    const [y, m, d] = dStr.split('.').map(Number);
                    const tParts = tStr.split(':').map(Number);
                    ts = Date.UTC(y, m - 1, d, tParts[0], tParts[1], tParts[2] || 0);
                  } else if (datePart.includes('.') && datePart.includes(',') && datePart.includes(':')) {
                    const [dStr, tStr] = datePart.split(',');
                    const [y, m, d] = dStr.split('.').map(Number);
                    const tParts = tStr.split(':').map(Number);
                    ts = Date.UTC(y, m - 1, d, tParts[0], tParts[1], tParts[2] || 0);
                  } else if (datePart.includes('/') && datePart.includes(' ')) {
                    const [dStr, tStr] = datePart.split(' ');
                    const [y, m, d] = dStr.split('/').map(Number);
                    const tParts = tStr.split(':').map(Number);
                    ts = Date.UTC(y, m - 1, d, tParts[0], tParts[1], tParts[2] || 0);
                  } else if (datePart.includes('/') && datePart.includes(',') && datePart.includes(':')) {
                    const [dStr, tStr] = datePart.split(',');
                    const [y, m, d] = dStr.split('/').map(Number);
                    const tParts = tStr.split(':').map(Number);
                    ts = Date.UTC(y, m - 1, d, tParts[0], tParts[1], tParts[2] || 0);
                  } else if (datePart.includes('-') && datePart.includes(' ')) {
                    const [dStr, tStr] = datePart.split(' ');
                    const [y, m, d] = dStr.split('-').map(Number);
                    const tParts = tStr.split(':').map(Number);
                    ts = Date.UTC(y, m - 1, d, tParts[0], tParts[1], tParts[2] || 0);
                  } else if (datePart.length >= 14 && !isNaN(Number(datePart.substring(0, 14)))) {
                    const year = parseInt(datePart.substring(0, 4));
                    const month = parseInt(datePart.substring(4, 6));
                    const day = parseInt(datePart.substring(6, 8));
                    const h = parseInt(datePart.substring(8, 10));
                    const mi = parseInt(datePart.substring(10, 12));
                    const s = parseInt(datePart.substring(12, 14));
                    ts = Date.UTC(year, month - 1, day, h, mi, s);
                  } else if (datePart.length >= 8 && !isNaN(Number(datePart.substring(0, 8))) && datePart.includes(' ')) {
                    const year = parseInt(datePart.substring(0, 4));
                    const month = parseInt(datePart.substring(4, 6));
                    const day = parseInt(datePart.substring(6, 8));
                    const rest = datePart.split(' ')[1] || '';
                    const h = parseInt(rest.substring(0, 2) || '0');
                    const mi = parseInt(rest.substring(2, 4) || '0');
                    const s = parseInt(rest.substring(4, 6) || '0');
                    ts = Date.UTC(year, month - 1, day, h, mi, s);
                  } else {
                    const d = new Date(datePart);
                    if (!isNaN(d.getTime())) {
                      ts = d.getTime();
                    } else continue;
                  }

                  if (ts === null || isNaN(ts)) continue;

                  let oIdx = 1, hIdx = 2, lIdx = 3, cIdx = 4;
                  let oaIdx = -1, haIdx = -1, laIdx = -1, caIdx = -1, vIdx = -1;

                  if (isNaN(parseFloat(dataRow[1])) && !isNaN(parseFloat(dataRow[2]))) {
                    oIdx = 2; hIdx = 3; lIdx = 4; cIdx = 5;
                    if (dataRow.length >= 10) { 
                      oaIdx = 6; haIdx = 7; laIdx = 8; caIdx = 9; vIdx = 10;
                    } else if (dataRow.length >= 7) {
                      vIdx = 6;
                    }
                  } else if (dataRow.length >= 9) {
                    oaIdx = 5; haIdx = 6; laIdx = 7; caIdx = 8; 
                    if (dataRow.length >= 10) vIdx = 9;
                  } else if (dataRow.length >= 6) {
                    vIdx = 5;
                  }

                  o = parseFloat(dataRow[oIdx]);
                  h = parseFloat(dataRow[hIdx]);
                  l = parseFloat(dataRow[lIdx]);
                  c = parseFloat(dataRow[cIdx]);
                  if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) continue;

                  oa = oaIdx !== -1 ? parseFloat(dataRow[oaIdx]) : o;
                  ha = haIdx !== -1 ? parseFloat(dataRow[haIdx]) : h;
                  la = laIdx !== -1 ? parseFloat(dataRow[laIdx]) : l;
                  ca = caIdx !== -1 ? parseFloat(dataRow[caIdx]) : c;
                  v = vIdx !== -1 ? parseFloat(dataRow[vIdx]) : 0;
                }
              } catch(e) { continue; }

              
              if (ts === null || isNaN(ts)) continue;
              
              // Force strictly 1-minute interval for non-exness sources to remove milliseconds/duplicates
              if (selectedSource !== 'exness') {
                const tempD = new Date(ts);
                tempD.setUTCSeconds(0, 0);
                ts = tempD.getTime();
              }

              if (isWeekend(ts)) continue;
              if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) continue;

              batch.push({ ts, o, h, l, c, oa, ha, la, ca, v });
              totalProcessed++;
              
              if (batch.length >= BATCH_SIZE) {
                await sendBatch(batch);
                setActiveUploads(prev => ({
                  ...prev,
                  [uploadKey]: { ...prev[uploadKey], processed: totalProcessed }
                }));
                batch = [];
              }
            }
            
            parser.resume();
          },
          complete: async () => {
            try {
              if (batch.length > 0) {
                await sendBatch(batch);
                setActiveUploads(prev => ({
                  ...prev,
                  [uploadKey]: { ...prev[uploadKey], processed: totalProcessed }
                }));
              }
              if (totalProcessed === 0) {
                reject(new Error("No valid data rows found in CSV."));
              } else resolve();
            } catch (e) { reject(e); }
          },
          error: reject
        });
      });

      // 3. Notify server we are done
      try {
        await fetch('/api/batch-store-candles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: pairInfo.nodeId,
            pair: pairInfo.name,
            source: selectedSource,
            isEnd: true
          })
        });
      } catch (err) {}

      fetchStatus(selectedSource);
    } catch (e: any) {
      console.error(e);
      if (pairInfo) {
        await fetch('/api/batch-store-candles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: pairInfo.nodeId,
            pair: pairInfo.name,
            source: selectedSource,
            isEnd: true 
          })
        }).catch(() => {});
      }
      alert(`Local processing failed for ${pairInfo.name}: ${e.message}`);
    } finally {
      setActiveUploads(prev => {
        const next = { ...prev };
        delete next[uploadKey];
        return next;
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const calculateCurrentWeek = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const oneJan = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now.getTime() - oneJan.getTime()) / 86400000);
    const week = Math.ceil((dayOfYear + oneJan.getDay() + 1) / 7);
    return { year, week, month };
  };

  const { year: curYear, week: curWeek, month: curMonth } = calculateCurrentWeek();

  const formatTimeRange = (pair: any) => {
    if (!pair.startYear || !pair.endYear) return null;
    const totalWeeks = (pair.endYear - pair.startYear) * 52 + (pair.endWeek - pair.startWeek) + 1;
    
    if (totalWeeks >= 52) {
      const years = (totalWeeks / 52).toFixed(1);
      return `${years} ${parseFloat(years) === 1 ? 'Year' : 'Years'}`;
    }
    
    const months = Math.floor(totalWeeks / 4.33);
    if (months >= 1) {
      return `${months} ${months === 1 ? 'Month' : 'Months'}`;
    }
    
    return `${totalWeeks} ${totalWeeks === 1 ? 'Week' : 'Weeks'}`;
  };

  const toggleExpansion = (key: string) => {
    setExpandedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectSource = (source: 'histdata' | 'dukascopy' | 'exness' | 'axiory') => {
    if (source === selectedSource) return;
    currentSourceRef.current = source;
    setSelectedSource(source);
    setDbStatus([]);
    setLoading(true);
    setFetchError(null);
  };

  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const fetchStatus = async (sourceOverride?: 'histdata' | 'dukascopy' | 'exness' | 'axiory', force?: boolean) => {
    const targetSource = sourceOverride || selectedSource;
    if (fetching && !sourceOverride) return;
    setFetching(true);
    
    try {
      const res = await fetch(`/api/db-status?source=${targetSource}${force ? '&force=true' : ''}`);
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      
      // Update only if this is still the selected source
      if (targetSource === currentSourceRef.current) {
        setDbStatus(data.status || []);
        // data.isGlobalSyncing is specifically for the Master Sync
        // data.isSyncing is for individual pair syncs
        setIsGlobalSyncing(data.isGlobalSyncing || false);
        setFetchError(null);
        setConsecutiveFailures(0);
        setLoading(false);
      }
      return data;
    } catch (e: any) {
      console.error('Failed to fetch DB status', e);
      if (targetSource === currentSourceRef.current) {
        setConsecutiveFailures(prev => {
          const next = prev + 1;
          if (next >= 2) setFetchError(e.message);
          return next;
        });
        setLoading(false);
      }
    } finally {
      setFetching(false);
    }
  };

  const [isWipingAll, setIsWipingAll] = useState(false);
  const [wipeConfirmVisible, setWipeConfirmVisible] = useState(false);

  const handleWipeAll = async () => {
    if (!wipeConfirmVisible) {
      setWipeConfirmVisible(true);
      setTimeout(() => setWipeConfirmVisible(false), 3000); // Reset after 3 seconds
      return;
    }
    
    setFetching(true);
    setIsWipingAll(true);
    setWipeConfirmVisible(false);
    try {
      const res = await fetch('/api/wipe-all-databases', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        console.log('All databases wiped successfully.');
        alert('All databases wiped successfully.');
        fetchStatus(selectedSource);
      } else {
        console.error('Wipe failed:', data.error);
        alert('Wipe failed: ' + data.error);
      }
    } catch (e) {
      console.error('Wipe error:', e);
      alert('Network error during wipe.');
    } finally {
      setFetching(false);
      setIsWipingAll(false);
    }
  };

  const fetchGlobalSyncStatus = async () => {
    try {
      const res = await fetch('/api/global-sync-status');
      if (res.ok) {
        const data = await res.json();
        setGlobalSyncStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch global sync status', e);
    }
  };



  useEffect(() => {
    setDbStatus([]);
    setLoading(true);
    
    let timeoutId: NodeJS.Timeout;
    const fetchLoop = async () => {
      const data = await fetchStatus(selectedSource);
      await fetchGlobalSyncStatus();
      // Fast poll (2s) if syncing, slow poll (5s) if idle
      const nextInterval = (data?.isGlobalSyncing || globalSyncStatus?.isGlobalSyncing) ? 2000 : 5000;
      timeoutId = setTimeout(fetchLoop, nextInterval);
    };
    
    fetchLoop();
    return () => clearTimeout(timeoutId);
  }, [selectedSource]);

  const [pairSettings, setPairSettings] = useState<Record<string, { startYear: number }>>({});

  const getStartYear = (pairName: string) => {
    if (pairSettings[pairName]?.startYear) return pairSettings[pairName].startYear;
    return (selectedSource === 'axiory' || selectedSource === 'exness') ? 2015 : 2020;
  };

  const setStartYear = (pairName: string, year: number) => {
    setPairSettings(prev => ({
      ...prev,
      [pairName]: { ...prev[pairName], startYear: year }
    }));
  };



  const handleUpdate = async (nodeId: number, pair: string) => {
    try {
      const startYear = getStartYear(pair);
      await fetch('/api/trigger-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, pair, startYear, source: selectedSource })
      });
      fetchStatus();
    } catch (e) {
      console.error('Failed to trigger update', e);
    }
  };

  const handleResyncMissing = async (nodeId: number, pair: string) => {
    try {
      await fetch('/api/resync-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, pair, source: selectedSource })
      });
      fetchStatus();
    } catch (e) {
      console.error('Failed to trigger resync', e);
    }
  };

  const handleStopUpdate = async () => {
    try {
      setStoppingPair('global');
      await fetch('/api/stop-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      fetchStatus();
    } catch (e) {
      console.error('Failed to stop update', e);
    } finally {
      setTimeout(() => setStoppingPair(null), 1000);
    }
  };

  const handleWipeNode = async (nodeId: number) => {
    if (!window.confirm(`WARNING: Are you sure you want to wipe ALL data in Node ${nodeId}? This action is irreversible.`)) {
      return;
    }

    try {
      setWipingNode(nodeId);
      const res = await fetch('/api/wipe-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wipe failed');
      
      alert(data.message);
      fetchStatus(selectedSource, true);
    } catch (e: any) {
      console.error('Failed to wipe node', e);
      alert('Failed to wipe node data: ' + e.message);
    } finally {
      setWipingNode(null);
    }
  };

  const handleUnpatchGap = async (nodeId: number, pair: string, source: string, gapId: number) => {
    if (!window.confirm('Are you sure you want to unpatch this gap? This will delete the repaired data.')) {
      return;
    }
    try {
      const res = await fetch('/api/unpatch-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, pair, source, gapId })
      });
      if (!res.ok) throw new Error('Failed to unpatch gap');
      await fetchDbStatus();
    } catch (e: any) {
      alert('Error unpatching: ' + e.message);
    }
  };

  const handlePatchGaps = async (nodeId: number, pair: string, sourceOverride?: string) => {
    const targetSource = sourceOverride || selectedSource;
    if (!window.confirm(`Attempt to patch missing minutes in ${pair} using Dukascopy source? This will only fill gaps if Dukascopy data is available in the DB.`)) {
      return;
    }
    
    try {
      setIsPatching(true);
      const res = await fetch('/api/patch-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, pair, source: targetSource })
      });
      if (!res.ok) throw new Error('Failed to start gap patching');
      const data = await res.json();
      alert(data.message);
      await fetchDbStatus();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsPatching(false);
    }
  };

  const [pairDeleteConfirm, setPairDeleteConfirm] = useState<string | null>(null);
  const [sourceDeleteConfirm, setSourceDeleteConfirm] = useState<{nodeId: number, pair: string, source: string} | null>(null);
  const [deletingSource, setDeletingSource] = useState<{nodeId: number, pair: string, source: string} | null>(null);

  const handleClearPair = async (nodeId: number, pair: string) => {
    const key = `${nodeId}-${pair}`;
    if (pairDeleteConfirm !== key) {
      setPairDeleteConfirm(key);
      setTimeout(() => setPairDeleteConfirm(null), 3000);
      return;
    }

    try {
      setDeletingPair(key);
      setPairDeleteConfirm(null);
      const res = await fetch('/api/clear-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, pair })
      });
      if (!res.ok) throw new Error(await res.text());
      fetchStatus(selectedSource, true);
    } catch (e: any) {
      alert(`Clear failed: ${e.message}`);
    } finally {
      setDeletingPair(null);
    }
  };

  const handleClearSource = async (nodeId: number, pair: string, source: string) => {
    const key = `${nodeId}-${pair}-${source}`;
    const confirmKey = { nodeId, pair, source };
    if (sourceDeleteConfirm?.nodeId !== nodeId || sourceDeleteConfirm?.pair !== pair || sourceDeleteConfirm?.source !== source) {
      setSourceDeleteConfirm(confirmKey);
      setTimeout(() => setSourceDeleteConfirm(null), 3000);
      return;
    }

    try {
      setDeletingSource(confirmKey);
      setSourceDeleteConfirm(null);
      const res = await fetch('/api/clear-pair-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, pair, source })
      });
      if (!res.ok) throw new Error(await res.text());
      fetchStatus(selectedSource, true);
    } catch (e: any) {
      alert(`Clear failed: ${e.message}`);
    } finally {
      setDeletingSource(null);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col p-4 sm:p-6 text-slate-900 overflow-x-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".csv"
        onChange={handleFileUpload}
      />
      <div className="max-w-7xl mx-auto w-full pb-32">
        <div className="flex items-center gap-4 mb-8">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-200 rounded-xl transition-colors group"
            >
              <ArrowLeft size={20} className="text-slate-500 group-hover:text-slate-900" />
            </button>
          )}
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                <Database size={24} className="text-white" />
             </div>
             <div>
                <h1 className="text-2xl font-black tracking-tight leading-none">DATABASE PAGE</h1>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precision Infrastructure</span>
             </div>
          </div>
        </div>
        {fetchError && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-500"
          >
            <AlertCircle size={20} />
            <div>
              <p className="text-xs font-black uppercase tracking-tight">System Sync Error</p>
              <p className="text-[10px] font-bold opacity-80">{fetchError}</p>
            </div>
            <button 
              onClick={() => fetchStatus()}
              className="ml-auto px-4 py-1.5 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all"
            >
              Retry
            </button>
          </motion.div>
        )}

        <div className="sticky top-0 z-30 -mt-8 pt-8 pb-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/60 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 sm:gap-6"
          >
            {/* Top Bar: Back, Status, Mobile Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Data Warehouse</h1>
                  <div className="flex items-center gap-1.5 mt-1 sm:hidden">
                     <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">System Active</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-0.5 sm:hidden">
                  <span className="text-[12px] font-black text-slate-900 leading-none">{curYear}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none text-slate-400/80">Wk {curWeek}</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-100 bg-emerald-50/30">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70">Secure</span>
                </div>
                {storageStats && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50/50">
                    <Database size={12} className="text-indigo-500" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      <span className="text-slate-900">{storageStats.totalSize}</span> / {dbStatus[0]?.total_bytes ? (dbStatus[0].total_bytes / (1024*1024*1024)).toFixed(0) : '10'}GB
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Bar: Wipe, Logs, Source */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={handleWipeAll}
                  disabled={isGlobalSyncing || globalSyncStatus?.isGlobalSyncing || isWipingAll}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                    wipeConfirmVisible 
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse shadow-lg shadow-rose-200' 
                      : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-100'
                  } disabled:opacity-30 active:scale-95`}
                >
                  {isWipingAll ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {wipeConfirmVisible ? 'Confirm Wipe?' : 'Wipe All'}
                </button>
                <button 
                  onClick={() => { setShowLogs(true); fetchLogs(); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  <RefreshCw size={12} className={fetchingLogs ? 'animate-spin' : ''} />
                  View Logs
                </button>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                <div className="hidden sm:flex flex-col items-end border-r border-slate-200 pr-6 gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-black text-slate-900 leading-none">{curYear}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none text-slate-400/80">
                      Week {curWeek}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 sm:flex-none overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
                  <div className="flex p-1 bg-slate-100/50 rounded-2xl border border-slate-200/50 min-w-max sm:min-w-0">
                    <button 
                      onClick={() => selectSource('histdata')}
                      className={`px-4 sm:px-6 py-2.5 sm:py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        selectedSource === 'histdata' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      HistData
                    </button>
                    <button 
                      onClick={() => selectSource('dukascopy')}
                      className={`px-4 sm:px-6 py-2.5 sm:py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        selectedSource === 'dukascopy' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Dukascopy
                    </button>
                    <button 
                      onClick={() => selectSource('exness')}
                      className={`px-4 sm:px-6 py-2.5 sm:py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        selectedSource === 'exness' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Exness
                    </button>
                    <button 
                      onClick={() => selectSource('axiory')}
                      className={`px-4 sm:px-6 py-2.5 sm:py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        selectedSource === 'axiory' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Axiory
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={selectedSource}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {loading && dbStatus.length === 0 ? (
            <div className="col-span-full h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
              <RefreshCw size={32} className="animate-spin opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Connecting to Database Nodes...</p>
            </div>
          ) : dbStatus.length === 0 ? (
            <div className="col-span-full h-96 flex flex-col items-center justify-center gap-4 text-slate-400 bg-white/50 rounded-3xl border border-dashed border-slate-200">
              <Database size={40} className="opacity-20" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">No nodes detected</p>
                <p className="text-[9px] font-bold opacity-30 mt-1">Make sure your database nodes are configured correctly</p>
              </div>
            </div>
          ) : (
            <>
              {dbStatus.map((db) => (
                <motion.div 
                  key={db.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`bg-white rounded-3xl border transition-all duration-500 p-6 flex flex-col shadow-xl ${
                    db.pairs.some(p => p.isSyncing) 
                      ? 'border-indigo-200 shadow-indigo-100/50 ring-1 ring-indigo-50' 
                      : 'border-slate-100 shadow-slate-200/40'
                  }`}
                >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center ${
                      db.status === 'connected' ? 'bg-slate-900' : 'bg-slate-100'
                    }`}>
                      <Database size={20} className={db.status === 'connected' ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-tight">Node {db.id}</h3>
                        {!nodes.find(n => n.id === db.id) && (
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">System</span>
                        )}
                        {nodes.find(n => n.id === db.id && db.id > 15) && (
                          <button 
                            onClick={() => deleteNode(db.id)}
                            className="p-1 hover:bg-rose-50 text-rose-300 hover:text-rose-500 rounded-md transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          db.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                        }`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {db.status === 'connected' ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
              
              {db.status === 'connected' && (
                <div className="flex items-center gap-4 ml-auto sm:ml-0">
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-slate-400">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                          <HardDrive size={10} className="text-indigo-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                            {db.source_size} <span className="text-slate-300 font-medium">({selectedSource})</span>
                          </span>
                        </div>
                        <div className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Total Node: {db.db_size}</div>
                      </div>
                    </div>
                    {db.total_bytes > 0 && (
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            (db.used_bytes / db.total_bytes) > 0.9 ? 'bg-rose-500' : 
                            (db.used_bytes / db.total_bytes) > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, (db.used_bytes / db.total_bytes) * 100)}%` }}
                        />
                      </div>
                    )}
                    <div className="text-[8px] font-bold uppercase tracking-widest text-slate-300 leading-none">
                      / {(db.total_bytes / (1024 * 1024 * 1024)).toFixed(1)}GB LIMIT
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleWipeNode(db.id); }}
                    disabled={wipingNode === db.id || globalSyncStatus?.isGlobalSyncing}
                    className="p-2.5 hover:bg-rose-50 hover:text-rose-500 text-slate-300 rounded-2xl transition-all z-10 disabled:opacity-50 border border-transparent hover:border-rose-100"
                    title="Wipe Database"
                  >
                    <Trash2 size={16} className={wipingNode === db.id ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}
            </div>

            {db.status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-rose-500 bg-rose-50/50 rounded-2xl border border-rose-100 mb-4 px-4">
                <AlertCircle size={32} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Connection Failed</p>
                <p className="text-[9px] text-rose-400 font-bold max-w-[200px] leading-tight mt-1">{db.error}</p>
              </div>
            )}

            {db.status === 'not_configured' && (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100 mb-4">
                <Clock size={32} className="mb-2 opacity-50" />
                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Configuration</p>
                <p className="text-[9px] text-slate-300 font-bold max-w-[150px] leading-tight mt-1">Set DATABASE_URL_{db.id} in settings</p>
              </div>
            )}

            <div className="space-y-3">
              {db.pairs.map((pair) => (
                <div 
                  key={pair.name} 
                  className="group relative bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm">
                        <Layers size={14} className="text-slate-900" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-black uppercase tracking-tight truncate">
                              {pair.name}
                            </div>
                            {pair.size_str && (
                              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                                {pair.size_str}
                              </span>
                            )}
                          </div>
                          {formatTimeRange(pair) && (
                            <span className="flex-shrink-0 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-blue-100/50 shadow-sm whitespace-nowrap">
                              {formatTimeRange(pair)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                            {pair.weeks} Weeks Total
                          </span>
                          {/* Multi-source indicator */}
                          {pair.sources && pair.sources.length > 0 && (
                            <div className="flex items-center gap-1.5 border-l border-slate-200 ml-1 pl-2">
                              {['dukascopy', 'histdata', 'exness', 'axiory'].map(s => {
                                  const sInfo = pair.sources.find((src: any) => src.source === s);
                                  const sWeeks = sInfo?.weeks || 0;
                                  
                                  let sSize = '0 B';
                                  if (sWeeks > 0 && db.used_bytes > 0 && db.total_weeks > 0) {
                                    const raw = (sWeeks / db.total_weeks) * db.used_bytes;
                                    if (raw >= 1048576) sSize = `~${(raw / 1048576).toFixed(1)} MB`;
                                    else if (raw >= 1024) sSize = `~${(raw / 1024).toFixed(0)} KB`;
                                    else sSize = `~${raw.toFixed(0)} B`;
                                  }

                                  const isVerifying = sourceDeleteConfirm?.nodeId === db.id && sourceDeleteConfirm?.pair === pair.name && sourceDeleteConfirm?.source === s;
                                  const isDeleting = deletingSource?.nodeId === db.id && deletingSource?.pair === pair.name && deletingSource?.source === s;

                                  return (
                                    <div 
                                      key={s} 
                                      className={`flex items-center gap-1 group/src relative transition-all ${isVerifying ? 'animate-pulse' : ''}`} 
                                      title={`${s.toUpperCase()}: ${sWeeks} weeks (${sSize})${sWeeks > 0 ? ' - Click to delete source' : ''}`}
                                    >
                                      <div className={`w-1 h-1 rounded-full ${sWeeks > 0 ? (isVerifying ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]') : 'bg-slate-200'}`} />
                                      <span className={`text-[7px] font-black uppercase tracking-tighter ${s === selectedSource ? 'text-indigo-600' : 'text-slate-400'} ${isVerifying ? 'text-rose-600' : ''}`}>
                                        {s[0]}
                                      </span>
                                      
                                      {sWeeks > 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleClearSource(db.id, pair.name, s);
                                          }}
                                          disabled={pair.isSyncing || isDeleting}
                                          className={`absolute -top-3 -right-1 p-0.5 rounded-full shadow-sm transition-all scale-0 group-hover/src:scale-100 ${
                                            isVerifying ? 'bg-rose-600 text-white' : 'bg-white text-slate-400 hover:text-rose-500'
                                          }`}
                                        >
                                          {isDeleting ? <RefreshCw size={6} className="animate-spin" /> : isVerifying ? <ShieldCheck size={6} /> : <X size={6} />}
                                        </button>
                                      )}
                                    </div>
                                  );
                              })}
                            </div>
                          )}
                          {pair.missingCount > 0 && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-rose-400 whitespace-nowrap">
                              {pair.missingCount} Missing
                            </span>
                          )}
                          {pair.gapCount && pair.gapCount > 0 && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 whitespace-nowrap flex items-center gap-1">
                              <Zap size={10} />
                              {pair.gapCount} Gaps
                            </span>
                          )}
                          {pair.startYear && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-1">
                              <Clock size={8} className="flex-shrink-0" />
                              <span className="truncate">
                                {pair.startYear}wk{pair.startWeek} - {pair.endYear}wk{pair.endWeek}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 z-50">
                      {(selectedSource === 'dukascopy' || selectedSource === 'axiory' || selectedSource === 'exness') && (
                        <div className="flex flex-col items-end gap-1 mr-1">
                          <label className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400">Start Year</label>
                          <select 
                            value={getStartYear(pair.name)}
                            onChange={(e) => setStartYear(pair.name, parseInt(e.target.value))}
                            disabled={pair.isSyncing || globalSyncStatus?.isGlobalSyncing}
                            className="text-[9px] font-bold bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-slate-400 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
                              .filter(y => !(pair.completeYears || []).includes(y))
                              .map(y => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                          </select>
                        </div>
                      )}
                      <button 
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          handleClearPair(db.id, pair.name); 
                        }}
                        disabled={db.status !== 'connected' || pair.isSyncing || deletingPair === `${db.id}-${pair.name}` || globalSyncStatus?.isGlobalSyncing}
                        className={`p-2.5 rounded-xl transition-all disabled:opacity-30 cursor-pointer active:scale-95 border ${
                          pairDeleteConfirm === `${db.id}-${pair.name}`
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'hover:bg-rose-50 hover:text-rose-600 text-slate-400 border-transparent'
                        }`}
                        title={pairDeleteConfirm === `${db.id}-${pair.name}` ? "Confirm?" : `Clear ${pair.name} Data`}
                      >
                        {deletingPair === `${db.id}-${pair.name}` ? (
                          <RefreshCw size={14} className="animate-spin text-rose-500" />
                        ) : pairDeleteConfirm === `${db.id}-${pair.name}` ? (
                          <ShieldCheck size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                      {/* Upload Button Part (Manual) - Show for all except Dukascopy and Axiory/Exness (automated sync centers) */}
                      {selectedSource !== 'dukascopy' && selectedSource !== 'axiory' && selectedSource !== 'exness' && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => {
                              if (pair.isSyncing) {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStopUpdate();
                              } else {
                                setCurrentSelectingPair({ name: pair.name, nodeId: db.id });
                                setTimeout(() => fileInputRef.current?.click(), 10);
                              }
                            }}
                            disabled={db.status !== 'connected' || deletingPair === `${db.id}-${pair.name}` || stoppingPair !== null || globalSyncStatus?.isGlobalSyncing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-md transform active:scale-95 disabled:opacity-30 ${
                              (pair.isSyncing || activeUploads[`${db.id}-${pair.name}`])
                                ? 'bg-indigo-500 text-white border-indigo-600 ring-4 ring-indigo-100 animate-pulse' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200'
                            }`}
                            title={pair.isSyncing ? "Stop Sync" : "Manual CSV Upload"}
                          >
                            {(pair.isSyncing || activeUploads[`${db.id}-${pair.name}`]) ? (
                              <div className="flex items-center gap-2">
                                <RefreshCw size={12} className="animate-spin" />
                                <span className="flex items-center gap-1">
                                  {activeUploads[`${db.id}-${pair.name}`] ? (
                                    <span className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                      {activeUploads[`${db.id}-${pair.name}`].week 
                                        ? `${activeUploads[`${db.id}-${pair.name}`].week.year}wk${activeUploads[`${db.id}-${pair.name}`].week.week}` 
                                        : `Stored ${activeUploads[`${db.id}-${pair.name}`].processed}...`}
                                    </span>
                                  ) : pair.progress ? (
                                    <>
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                      {pair.progress.year}wk{pair.progress.week}{pair.progress.day ? ` D${pair.progress.day}` : ''}
                                    </>
                                  ) : 'Syncing...'}
                                </span>
                              </div>
                            ) : (
                              <>
                                <Upload size={14} />
                                Upload CSV
                              </>
                            )}
                          </button>
                          
                          {pair.isSyncing && !activeUploads[`${db.id}-${pair.name}`] && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStopUpdate();
                              }}
                              className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all"
                              title="Reset Stuck Sync"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Sync Button Part (Automatic) - Show for Dukascopy, Axiory and Exness */}
                      {(selectedSource === 'dukascopy' || selectedSource === 'axiory' || selectedSource === 'exness') && (
                        <button 
                          onClick={() => pair.isSyncing ? handleStopUpdate() : handleUpdate(db.id, pair.name)}
                          disabled={db.status !== 'connected' || globalSyncStatus?.isGlobalSyncing || deletingPair === `${db.id}-${pair.name}` || stoppingPair !== null}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 ${
                            pair.isSyncing 
                              ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white' 
                              : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          {pair.isSyncing ? (
                            <div className="flex items-center gap-2">
                              {stoppingPair ? (
                                <RefreshCw size={10} className="animate-spin" />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  <span className={stoppingPair ? '' : 'text-rose-600'}>
                                    {pair.progress 
                                      ? `${pair.progress.year}wk${pair.progress.week}${pair.progress.day ? ` D${pair.progress.day}` : ''}` 
                                      : 'Starting...'}
                                  </span>
                                </div>
                              )}
                              <span>{stoppingPair ? 'Stopping...' : 'Stop'}</span>
                            </div>
                          ) : (
                            <>
                              <Save size={10} />
                              Sync
                            </>
                          )}
                        </button>
                      )}

                    </div>
                  </div>
                  
                  {pair.lastUpdate && (
                    <div className="mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-1 text-[8px] font-bold uppercase tracking-widest text-slate-300">
                      <span>Last Ingest:</span>
                      <span>{new Date(pair.lastUpdate).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Missing Weeks Section */}
                  {pair.missingCount > 0 && (
                    <div className="mt-2 border-t border-slate-200/50 pt-2">
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => toggleExpansion(`${db.id}-${pair.name}`)}
                          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-500 transition-colors"
                        >
                          <AlertCircle size={10} />
                          {expandedKeys.includes(`${db.id}-${pair.name}`) ? 'Hide' : 'View'} Missing ({pair.missingCount})
                        </button>
                        {expandedKeys.includes(`${db.id}-${pair.name}`) && selectedSource === 'dukascopy' && (
                          <button 
                            onClick={() => handleResyncMissing(db.id, pair.name)}
                            disabled={isGlobalSyncing || stoppingPair !== null}
                            className="flex items-center gap-1 px-2 py-1 bg-rose-500 text-white rounded text-[8px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-30"
                          >
                            <RefreshCw size={8} />
                            Resync All
                          </button>
                        )}
                      </div>
                      
                      <AnimatePresence>
                        {expandedKeys.includes(`${db.id}-${pair.name}`) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-1 overflow-hidden"
                          >
                            {pair.missingDetails.map((details, i) => (
                              <button 
                                key={i} 
                                disabled={selectedSource === 'dukascopy'}
                                className={`text-[8px] font-black p-1 rounded text-center transition-all ${
                                  selectedSource !== 'dukascopy' 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                    : 'bg-rose-50/50 text-rose-400/50'
                                }`}
                              >
                                {details.year} W{details.week}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Missing Minutes (Gaps) Section */}
                  {pair.gapDetails && (pair.gapCount > 0 || (pair.gapDetails && pair.gapDetails.length > 0)) && (
                    <div className="mt-2 border-t border-slate-200/50 pt-2">
                       <div className="flex items-center justify-between">
                         <button 
                            onClick={() => toggleExpansion(`${db.id}-${pair.name}-gaps`)}
                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-600 transition-colors"
                         >
                            <Zap size={10} />
                            {expandedKeys.includes(`${db.id}-${pair.name}-gaps`) ? 'Hide' : 'View'} Gaps ({pair.gapDetails.length})
                         </button>
                         {pair.gapCount > 0 && (
                           <button 
                              onClick={() => handlePatchGaps(db.id, pair.name, selectedSource)}
                              disabled={isPatching || pair.isSyncing || globalSyncStatus?.isGlobalSyncing}
                              className={`flex items-center gap-1 px-3 py-1 text-white rounded text-[8px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-30 ${
                                isPatching ? 'bg-amber-400' : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                           >
                             <Zap size={8} className={isPatching ? 'animate-pulse' : ''} />
                             {isPatching ? 'Patching...' : 'Patch All'}
                           </button>
                         )}
                       </div>

                       <AnimatePresence>
                        {expandedKeys.includes(`${db.id}-${pair.name}-gaps`) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 space-y-1 overflow-hidden"
                          >
                            {pair.gapDetails.map((gap: any) => (
                              <div key={gap.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                                    {new Date(Number(gap.start)).toLocaleString()} - {new Date(Number(gap.end)).toLocaleString()}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <div className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase ${
                                      gap.status === 'patched' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-600'
                                    }`}>
                                      {gap.status}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400">{gap.minutes}m missing</span>
                                  </div>
                                </div>
                                {gap.status === 'patched' ? (
                                  <button 
                                    onClick={() => handleUnpatchGap(db.id, pair.name, selectedSource, gap.id)}
                                    className="p-1 px-2 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white text-[8px] font-black uppercase transition-all"
                                  >
                                    Unpatch
                                  </button>
                                ) : (
                                  <span className="text-[7px] font-black text-slate-300 uppercase italic">Awaiting Patch</span>
                                )}
                              </div>
                            ))}
                          </motion.div>
                        )}
                       </AnimatePresence>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
          ))}

          {/* Add Node Card */}
          <motion.div 
            layout
            className="bg-slate-50/50 rounded-3xl border border-dashed border-slate-300 p-6 flex flex-col items-center justify-center gap-4 hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer group min-h-[300px]"
            onClick={() => !showAddNode && setShowAddNode(true)}
          >
            {showAddNode ? (
              <div className="w-full flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Add Custom Node</h3>
                  <button onClick={() => setShowAddNode(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                    <XCircle size={16} className="text-slate-400" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Database URL</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="postgres://user:pass@host:port/db"
                      value={newNodeUrl}
                      onChange={e => setNewNodeUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Pair Name (e.g. BTCUSD)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. GBPUSD"
                      value={newNodePair}
                      onChange={e => setNewNodePair(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-100 transition-all uppercase"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddNode}
                  disabled={addingNode}
                  className="w-full mt-2 bg-indigo-600 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  {addingNode ? <Loader2 size={12} className="animate-spin" /> : <HardDrive size={12} />}
                  Connect Node
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all shadow-sm">
                  <HardDrive size={24} />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Connect External Node</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">Scale your warehouse dynamically</p>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  </AnimatePresence>





      {/* Sync Logs Modal */}
      <AnimatePresence>
        {showLogs && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tighter">System Sync Logs</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live diagnostic stream</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleClearLogs}
                    disabled={clearingLogs || syncLogs.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={12} className={clearingLogs ? 'animate-spin' : ''} />
                    <span>Clear Logs</span>
                  </button>
                  <button 
                    onClick={fetchLogs}
                    disabled={fetchingLogs}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <RefreshCw size={16} className={fetchingLogs ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setShowLogs(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <ArrowLeft size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 font-mono">
                {syncLogs.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    No logs found. Start a sync to see data.
                  </div>
                ) : syncLogs.map((log, i) => (
                  <div key={i} className="text-[10px] p-2 rounded border bg-white border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        log.level === 'ERROR' ? 'bg-rose-100 text-rose-600' : 
                        log.level === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-slate-900">Node {log.node_id}</span>
                      <span className="text-slate-500">{log.pair}</span>
                      <span className="text-slate-400">({log.source})</span>
                    </div>
                    <div className="text-slate-600 font-bold">{log.message}</div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="mt-1 p-1 bg-slate-100 rounded text-[9px] text-slate-500 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowLogs(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
