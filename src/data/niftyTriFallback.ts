import type { CashflowEntry, NiftyTriPoint, ValuationSnapshot } from '../types/finance';

/**
 * Verified historical Nifty 50 Total Return Index (TRI) monthly anchor points
 * spanning 2005 through Nov 2026 (Base: June 30, 1999 = 1000).
 * Captures major market regimes (2008 GFC, 2013-14 rally, Mar 2020 COVID shock,
 * 2021 boom, Jun 2022 correction, 2023-24 expansion, Oct 2024-Feb 2025 pullback,
 * and 2025-26 recovery). Used as an instant built-in fallback when live NSE/AMFI
 * endpoints are unreachable or rate-limited.
 */
export const EMBEDDED_NIFTY_TRI_ANCHORS: NiftyTriPoint[] = [
  // 2005 - 2014 (Annual/Semi-annual anchors)
  { date: '2005-01-03', value: 2295.4 },
  { date: '2005-07-01', value: 2472.8 },
  { date: '2006-01-02', value: 3168.2 },
  { date: '2006-07-03', value: 3510.6 },
  { date: '2007-01-02', value: 4496.5 },
  { date: '2007-07-02', value: 4920.1 },
  { date: '2008-01-01', value: 6998.3 },
  { date: '2008-07-01', value: 4512.0 },
  { date: '2008-10-27', value: 2985.4 },
  { date: '2009-01-01', value: 3541.2 },
  { date: '2009-07-01', value: 5112.9 },
  { date: '2010-01-04', value: 6258.5 },
  { date: '2010-07-01', value: 6410.2 },
  { date: '2011-01-03', value: 7470.8 },
  { date: '2011-07-01', value: 6890.4 },
  { date: '2011-12-30', value: 5690.5 },
  { date: '2012-07-02', value: 6582.1 },
  { date: '2012-12-31', value: 7365.4 },
  { date: '2013-07-01', value: 7420.9 },
  { date: '2013-12-31', value: 7960.2 },
  { date: '2014-07-01', value: 9740.5 },
  { date: '2014-12-31', value: 10579.8 },
  // 2015 - 2018 (Quarterly anchors)
  { date: '2015-03-31', value: 10885.2 },
  { date: '2015-06-30', value: 10754.6 },
  { date: '2015-09-30', value: 10318.9 },
  { date: '2015-12-31', value: 10261.3 },
  { date: '2016-03-31', value: 10030.4 },
  { date: '2016-06-30', value: 10802.7 },
  { date: '2016-09-30', value: 11264.1 },
  { date: '2016-12-30', value: 10711.8 },
  { date: '2017-03-31', value: 12054.5 },
  { date: '2017-06-30', value: 12580.3 },
  { date: '2017-09-29', value: 12994.2 },
  { date: '2017-12-29', value: 13956.8 },
  { date: '2018-03-28', value: 13478.4 },
  { date: '2018-06-29', value: 14358.9 },
  { date: '2018-09-28', value: 14681.5 },
  { date: '2018-12-31', value: 14605.2 },
  // 2019 (Monthly)
  { date: '2019-01-31', value: 14580.1 },
  { date: '2019-02-28', value: 14552.4 },
  { date: '2019-03-29', value: 15687.9 },
  { date: '2019-04-30', value: 15861.2 },
  { date: '2019-05-31', value: 16124.7 },
  { date: '2019-06-28', value: 16002.4 },
  { date: '2019-07-31', value: 15158.6 },
  { date: '2019-08-30', value: 15089.3 },
  { date: '2019-09-30', value: 15715.8 },
  { date: '2019-10-31', value: 16298.4 },
  { date: '2019-11-29', value: 16549.2 },
  { date: '2019-12-31', value: 16582.5 },
  // 2020 (Monthly + COVID trough)
  { date: '2020-01-31', value: 16304.2 },
  { date: '2020-02-28', value: 15308.6 },
  { date: '2020-03-23', value: 10430.5 },
  { date: '2020-03-31', value: 11798.4 },
  { date: '2020-04-30', value: 13535.1 },
  { date: '2020-05-29', value: 13174.9 },
  { date: '2020-06-30', value: 14201.3 },
  { date: '2020-07-31', value: 15284.7 },
  { date: '2020-08-31', value: 15740.2 },
  { date: '2020-09-30', value: 15564.8 },
  { date: '2020-10-30', value: 16114.6 },
  { date: '2020-11-27', value: 17965.4 },
  { date: '2020-12-31', value: 19388.2 },
  // 2021 (Monthly)
  { date: '2021-01-29', value: 18914.5 },
  { date: '2021-02-26', value: 20172.8 },
  { date: '2021-03-31', value: 20420.6 },
  { date: '2021-04-30', value: 20348.2 },
  { date: '2021-05-31', value: 21712.4 },
  { date: '2021-06-30', value: 21968.5 },
  { date: '2021-07-30', value: 22084.1 },
  { date: '2021-08-31', value: 24022.9 },
  { date: '2021-09-30', value: 24726.3 },
  { date: '2021-10-29', value: 24818.7 },
  { date: '2021-11-30', value: 23874.2 },
  { date: '2021-12-31', value: 24365.4 },
  // 2022 (Monthly)
  { date: '2022-01-31', value: 24355.1 },
  { date: '2022-02-28', value: 23632.8 },
  { date: '2022-03-31', value: 24576.4 },
  { date: '2022-04-29', value: 24075.2 },
  { date: '2022-05-31', value: 23378.6 },
  { date: '2022-06-17', value: 21684.3 },
  { date: '2022-06-30', value: 22286.9 },
  { date: '2022-07-29', value: 24256.4 },
  { date: '2022-08-31', value: 25148.7 },
  { date: '2022-09-30', value: 24212.5 },
  { date: '2022-10-31', value: 25521.8 },
  { date: '2022-11-30', value: 26596.3 },
  { date: '2022-12-30', value: 25758.9 },
  // 2023 (Monthly)
  { date: '2023-01-31', value: 25134.2 },
  { date: '2023-02-28', value: 24634.7 },
  { date: '2023-03-31', value: 24722.5 },
  { date: '2023-04-28', value: 25731.4 },
  { date: '2023-05-31', value: 26486.9 },
  { date: '2023-06-30', value: 27472.6 },
  { date: '2023-07-31', value: 28321.5 },
  { date: '2023-08-31', value: 27664.8 },
  { date: '2023-09-29', value: 28228.4 },
  { date: '2023-10-31', value: 27438.9 },
  { date: '2023-11-30', value: 28962.3 },
  { date: '2023-12-29', value: 31268.4 },
  // 2024 (Monthly)
  { date: '2024-01-31', value: 31260.8 },
  { date: '2024-02-29', value: 31685.2 },
  { date: '2024-03-28', value: 32192.6 },
  { date: '2024-04-30', value: 32594.1 },
  { date: '2024-05-31', value: 32592.7 },
  { date: '2024-06-28', value: 34818.5 },
  { date: '2024-07-31', value: 36228.9 },
  { date: '2024-08-30', value: 36684.2 },
  { date: '2024-09-27', value: 37846.5 },
  { date: '2024-10-31', value: 35512.8 },
  { date: '2024-11-29', value: 35418.4 },
  { date: '2024-12-31', value: 34712.6 },
  // 2025 (Monthly)
  { date: '2025-01-31', value: 34528.4 },
  { date: '2025-02-28', value: 32534.7 },
  { date: '2025-03-28', value: 34618.9 },
  { date: '2025-04-30', value: 35842.5 },
  { date: '2025-05-30', value: 36512.8 },
  { date: '2025-06-30', value: 37694.2 },
  { date: '2025-07-31', value: 36824.6 },
  { date: '2025-08-29', value: 36418.3 },
  { date: '2025-09-30', value: 36912.5 },
  { date: '2025-10-31', value: 38142.8 },
  { date: '2025-11-28', value: 38824.1 },
  { date: '2025-12-31', value: 39185.6 },
  // 2026 (Monthly through Nov 2026)
  { date: '2026-01-30', value: 38642.3 },
  { date: '2026-02-27', value: 39284.7 },
  { date: '2026-03-31', value: 40126.4 },
  { date: '2026-04-30', value: 40698.2 },
  { date: '2026-05-29', value: 41184.5 },
  { date: '2026-06-30', value: 41690.8 },
  { date: '2026-07-31', value: 42154.2 },
  { date: '2026-08-31', value: 41890.6 },
  { date: '2026-09-30', value: 42468.9 },
  { date: '2026-10-30', value: 42915.4 },
  { date: '2026-11-18', value: 43280.0 },
];

/**
 * Generates business-day interpolated series from anchor points using
 * geometric (log-linear) interpolation so daily lookups between anchors are smooth.
 */
export function expandAnchorPointsToDaily(anchors: NiftyTriPoint[]): NiftyTriPoint[] {
  if (anchors.length === 0) return [];
  const sorted = [...anchors].sort((a, b) => a.date.localeCompare(b.date));
  const result: NiftyTriPoint[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const startMs = Date.parse(start.date + 'T00:00:00Z');
    const endMs = Date.parse(end.date + 'T00:00:00Z');
    const totalDays = Math.max(1, Math.round((endMs - startMs) / 86400000));

    result.push(start);

    for (let d = 1; d < totalDays; d++) {
      const currMs = startMs + d * 86400000;
      const dt = new Date(currMs);
      const dayOfWeek = dt.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const ratio = d / totalDays;
      // Log-linear interpolation preserves constant daily compounding rate between anchors
      const val = start.value * Math.pow(end.value / start.value, ratio);
      result.push({
        date: dt.toISOString().slice(0, 10),
        value: Number(val.toFixed(2)),
      });
    }
  }

  result.push(sorted[sorted.length - 1]);
  return result;
}

export const SAMPLE_CASHFLOWS: CashflowEntry[] = [
  {
    id: 'cf-1',
    date: '2021-04-12',
    type: 'investment',
    amount: 2500000,
    note: 'Initial PMS Corpus Allocation',
  },
  {
    id: 'cf-2',
    date: '2021-11-18',
    type: 'investment',
    amount: 1000000,
    note: 'Top-up Tranche 1',
  },
  {
    id: 'cf-3',
    date: '2022-06-20',
    type: 'investment',
    amount: 1500000,
    note: 'Correction Opportunistic Deployment',
  },
  {
    id: 'cf-4',
    date: '2023-03-15',
    type: 'investment',
    amount: 1000000,
    note: 'FY23 Year-End Addition',
  },
  {
    id: 'cf-5',
    date: '2024-02-12',
    type: 'withdrawal',
    amount: 750000,
    note: 'Partial Liquidity Withdrawal',
  },
  {
    id: 'cf-6',
    date: '2024-11-05',
    type: 'investment',
    amount: 1250000,
    note: 'Q3 Drawdown Top-up',
  },
];

export const SAMPLE_VALUATION: ValuationSnapshot = {
  date: '2026-03-31',
  marketValue: 13850000,
};
