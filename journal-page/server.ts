import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Supabase client for health check
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  // API Health Check Endpoint
  app.get("/api/health", async (req, res) => {
    const status: any = {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "unknown"
    };

    if (supabase) {
      try {
        // Simple query to check database connection
        const { error } = await supabase.from('accounts').select('id').limit(1);
        if (error) throw error;
        status.database = "connected";
      } catch (err: any) {
        status.database = "error";
        status.error = err.message;
        return res.status(500).json(status);
      }
    } else {
      status.database = "not_configured";
    }

    res.json(status);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
  });
}

startServer();
