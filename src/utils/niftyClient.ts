import {
  EMBEDDED_NIFTY_TRI_ANCHORS,
  expandAnchorPointsToDaily,
} from '../data/niftyTriFallback';
import type { NiftyTriDataset, NiftyTriPoint } from '../types/finance';

export function createEmbeddedNiftyDataset(): NiftyTriDataset {
  const points = expandAnchorPointsToDaily(EMBEDDED_NIFTY_TRI_ANCHORS);
  return {
    source: 'embedded_historical',
    sourceLabel: 'Built-in Historical Nifty 50 TRI Dataset',
    asOfDate: points[points.length - 1]?.date ?? '2026-11-18',
    fetchedAt: new Date().toISOString(),
    points,
  };
}

function parseMfapiDate(raw: string): string | null {
  const parts = raw.trim().split('-');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchDirectAmfiProxy(): Promise<NiftyTriDataset | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://api.mfapi.in/mf/120716', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ date: string; nav: string }>;
    };
    if (!json || !Array.isArray(json.data) || json.data.length < 200) {
      return null;
    }

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
    const merged = [...preLive, ...scaledLive];

    return {
      source: 'amfi_proxy',
      sourceLabel: 'AMFI Nifty 50 TRI Direct Proxy (Live)',
      asOfDate: merged[merged.length - 1].date,
      fetchedAt: new Date().toISOString(),
      points: merged,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads Nifty 50 TRI data with full compatibility across both full-stack Node servers
 * and static hosting platforms (Firebase Hosting, Netlify, Vercel static):
 * 1. Tries backend proxy (/api/nifty-tri) when available (checks JSON content-type).
 * 2. Falls back to CORS-enabled AMFI Nifty 50 Direct Index TRI proxy directly from browser.
 * 3. Falls back to embedded multi-year historical Nifty 50 TRI dataset if offline.
 */
export async function loadNiftyTriDataset(
  forceRefresh = false
): Promise<{ dataset: NiftyTriDataset; usedLive: boolean }> {
  // 1. Try server proxy if running full-stack
  try {
    const res = await fetch(
      `/api/nifty-tri${forceRefresh ? '?refresh=1' : ''}`
    );
    const contentType = res.headers.get('content-type') ?? '';
    if (res.ok && contentType.includes('application/json')) {
      const data = (await res.json()) as NiftyTriDataset;
      if (data && Array.isArray(data.points) && data.points.length > 0) {
        return {
          dataset: data,
          usedLive: data.source !== 'embedded_historical',
        };
      }
    }
  } catch {
    // Static host (e.g., Firebase Hosting) without /api backend — proceed to browser live fetch
  }

  // 2. Direct CORS-enabled live fetch for static hosting deployments
  const directLive = await fetchDirectAmfiProxy();
  if (directLive) {
    return { dataset: directLive, usedLive: true };
  }

  // 3. Offline / sandbox resilient fallback
  return { dataset: createEmbeddedNiftyDataset(), usedLive: false };
}
