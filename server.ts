import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  EMBEDDED_NIFTY_TRI_ANCHORS,
  expandAnchorPointsToDaily,
} from './src/data/niftyTriFallback.ts';
import type { NiftyTriDataset, NiftyTriPoint } from './src/types/finance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cachedDataset: { data: NiftyTriDataset; expiresAt: number } | null = null;

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function parseNseDate(raw: string): string | null {
  // Formats like "01 Jan 2024" or "01-Jan-2024"
  const cleaned = raw.trim().replace(/-/g, ' ');
  const parts = cleaned.split(/\s+/);
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, '0');
  const mon = MONTH_MAP[parts[1].toLowerCase().slice(0, 3)];
  const year = parts[2];
  if (!mon || !/^\d{4}$/.test(year) || !/^\d{2}$/.test(day)) return null;
  return `${year}-${mon}-${day}`;
}

function parseMfapiDate(raw: string): string | null {
  // Format "DD-MM-YYYY"
  const parts = raw.trim().split('-');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function formatNseRequestDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mmm = months[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}

async function fetchNseOfficialTri(): Promise<NiftyTriPoint[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const endDate = formatNseRequestDate(new Date());
    const payload = {
      cinfo: JSON.stringify({
        name: 'NIFTY 50',
        startDate: '01-Jan-2005',
        endDate,
        indexName: 'NIFTY 50',
      }),
    };

    const res = await fetch(
      'https://www.niftyindices.com/Backpage.aspx/getTotalReturnIndexString',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: 'https://www.niftyindices.com/reports/historical-data',
          Origin: 'https://www.niftyindices.com',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!res.ok) return null;
    const json = (await res.json()) as { d?: string };
    if (!json || typeof json.d !== 'string') return null;

    const rows = JSON.parse(json.d) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length < 100) return null;

    const points: NiftyTriPoint[] = [];
    for (const row of rows) {
      const rawDate = String(row.Date ?? row.HistoricalDate ?? '');
      const rawVal = Number(row.TotalReturnsIndex ?? row.CLOSE ?? row.IndexValue);
      const iso = parseNseDate(rawDate);
      if (iso && Number.isFinite(rawVal) && rawVal > 0) {
        points.push({ date: iso, value: Number(rawVal.toFixed(2)) });
      }
    }

    if (points.length < 100) return null;
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAmfiNifty50DirectProxy(): Promise<NiftyTriPoint[] | null> {
  // UTI Nifty 50 Index Fund - Direct Plan - Growth (AMFI Scheme Code 120716)
  // Closely tracks Nifty 50 Total Return Index daily since Jan 2013
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('https://api.mfapi.in/mf/120716', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      data?: Array<{ date: string; nav: string }>;
    };
    if (!json || !Array.isArray(json.data) || json.data.length < 200) return null;

    const livePoints: NiftyTriPoint[] = [];
    for (const item of json.data) {
      const iso = parseMfapiDate(item.date);
      const nav = Number(item.nav);
      if (iso && Number.isFinite(nav) && nav > 0) {
        livePoints.push({ date: iso, value: nav });
      }
    }
    if (livePoints.length < 200) return null;
    livePoints.sort((a, b) => a.date.localeCompare(b.date));

    // Scale AMFI Direct NAV to match Nifty 50 TRI index level scale (~7,400 on 2013-01-01)
    // Note: Constant scalar cancels out completely in XIRR ratios, and gives intuitive TRI magnitudes.
    const firstLive = livePoints[0];
    const embeddedDaily = expandAnchorPointsToDaily(EMBEDDED_NIFTY_TRI_ANCHORS);
    const anchorMatch =
      embeddedDaily.find((p) => p.date >= firstLive.date) ?? embeddedDaily[0];
    const scaleFactor = anchorMatch ? anchorMatch.value / firstLive.value : 195;

    const preLive = embeddedDaily.filter((p) => p.date < firstLive.date);
    const scaledLive = livePoints.map((p) => ({
      date: p.date,
      value: Number((p.value * scaleFactor).toFixed(2)),
    }));

    return [...preLive, ...scaledLive];
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getNiftyTriDataset(forceRefresh = false): Promise<NiftyTriDataset> {
  const now = Date.now();
  if (!forceRefresh && cachedDataset && cachedDataset.expiresAt > now) {
    return cachedDataset.data;
  }

  // 1. Try Official NSE Nifty 50 TRI
  const nsePoints = await fetchNseOfficialTri();
  if (nsePoints && nsePoints.length > 0) {
    const dataset: NiftyTriDataset = {
      source: 'nse_live',
      sourceLabel: 'NSE Nifty 50 TRI (Live)',
      asOfDate: nsePoints[nsePoints.length - 1].date,
      fetchedAt: new Date().toISOString(),
      points: nsePoints,
    };
    cachedDataset = { data: dataset, expiresAt: now + CACHE_TTL_MS };
    return dataset;
  }

  // 2. Fallback to Live AMFI Direct Index TRI Proxy
  const amfiPoints = await fetchAmfiNifty50DirectProxy();
  if (amfiPoints && amfiPoints.length > 0) {
    const dataset: NiftyTriDataset = {
      source: 'amfi_proxy',
      sourceLabel: 'AMFI Nifty 50 TRI Direct Proxy (Live)',
      asOfDate: amfiPoints[amfiPoints.length - 1].date,
      fetchedAt: new Date().toISOString(),
      points: amfiPoints,
    };
    cachedDataset = { data: dataset, expiresAt: now + CACHE_TTL_MS };
    return dataset;
  }

  // 3. Resilient Built-in Historical Nifty 50 TRI Fallback
  const fallbackPoints = expandAnchorPointsToDaily(EMBEDDED_NIFTY_TRI_ANCHORS);
  const dataset: NiftyTriDataset = {
    source: 'embedded_historical',
    sourceLabel: 'Built-in Historical Nifty 50 TRI Dataset',
    asOfDate: fallbackPoints[fallbackPoints.length - 1].date,
    fetchedAt: new Date().toISOString(),
    points: fallbackPoints,
  };
  cachedDataset = { data: dataset, expiresAt: now + 15 * 60 * 1000 }; // Retry live in 15 mins
  return dataset;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/nifty-tri', async (req, res) => {
    try {
      const refresh = req.query.refresh === '1';
      const dataset = await getNiftyTriDataset(refresh);
      res.json(dataset);
    } catch {
      const fallbackPoints = expandAnchorPointsToDaily(EMBEDDED_NIFTY_TRI_ANCHORS);
      const fallback: NiftyTriDataset = {
        source: 'embedded_historical',
        sourceLabel: 'Built-in Historical Nifty 50 TRI Dataset',
        asOfDate: fallbackPoints[fallbackPoints.length - 1].date,
        fetchedAt: new Date().toISOString(),
        points: fallbackPoints,
      };
      res.json(fallback);
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`XIRR Calculator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
