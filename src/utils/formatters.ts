const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

export function formatINR(value: number, withSign = false): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const formatted = inrFormatter.format(Math.round(abs));
  if (value < 0) return `−${formatted}`;
  if (withSign && value > 0) return `+${formatted}`;
  return formatted;
}

export function formatINRDecimals(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return inrDecimalFormatter.format(value);
}

/**
 * Compact Indian rupee notation (Lakhs / Crores) for chart axes & tight badges.
 */
export function formatINRCompact(value: number, withSign = false): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : withSign && value > 0 ? '+' : '';
  const abs = Math.abs(value);
  if (abs >= 1e7) {
    return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  }
  if (abs >= 1e5) {
    return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  }
  if (abs >= 1e3) {
    return `${sign}₹${(abs / 1e3).toFixed(1)} K`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

export function formatPct(decimalValue: number | null, withSign = false, decimals = 2): string {
  if (decimalValue === null || !Number.isFinite(decimalValue)) return '—';
  const pct = decimalValue * 100;
  const abs = Math.abs(pct).toFixed(decimals);
  if (pct < 0) return `−${abs}%`;
  if (withSign && pct > 0) return `+${abs}%`;
  return `${abs}%`;
}

export function formatBps(decimalValue: number | null, withSign = true): string {
  if (decimalValue === null || !Number.isFinite(decimalValue)) return '—';
  const bps = Math.round(decimalValue * 10000);
  const abs = Math.abs(bps).toLocaleString('en-IN');
  if (bps < 0) return `−${abs} bps`;
  if (withSign && bps > 0) return `+${abs} bps`;
  return `${abs} bps`;
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumberAuto(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return isoDate;
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

export function formatMonthYear(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const [y, m] = isoDate.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return isoDate;
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`;
}
