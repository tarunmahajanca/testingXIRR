import type {
  AnnualFeeRow,
  CalculationResult,
  CashflowEntry,
  FeeBillingCycle,
  FeeConfig,
  NiftyTriDataset,
  NiftyTriPoint,
  TimelinePoint,
  UnitSimulationRow,
  ValidationIssue,
  ValuationSnapshot,
} from '../types/finance';
import { formatMonthYear } from './formatters';

const MS_PER_DAY = 86400000;

export function parseUtcMs(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return NaN;
  const [y, m, d] = isoDate.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  // Verify valid calendar date (e.g. reject 2024-02-31)
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return NaN;
  }
  return ms;
}

export function daysBetween(startIso: string, endIso: string): number {
  return (parseUtcMs(endIso) - parseUtcMs(startIso)) / MS_PER_DAY;
}

interface RawFlow {
  ms: number;
  amount: number;
}

function xnpv(rate: number, flows: RawFlow[], t0: number): number {
  let sum = 0;
  const base = 1 + rate;
  if (base <= 0) return Number.NaN;
  for (let i = 0; i < flows.length; i++) {
    const years = (flows[i].ms - t0) / (365 * MS_PER_DAY);
    sum += flows[i].amount / Math.pow(base, years);
  }
  return sum;
}

function dxnpv(rate: number, flows: RawFlow[], t0: number): number {
  let sum = 0;
  const base = 1 + rate;
  if (base <= 0) return Number.NaN;
  for (let i = 0; i < flows.length; i++) {
    const years = (flows[i].ms - t0) / (365 * MS_PER_DAY);
    if (years === 0) continue;
    sum += (-years * flows[i].amount) / Math.pow(base, years + 1);
  }
  return sum;
}

/**
 * Exact ACT/365 Excel-compatible XIRR solver.
 * Combines multi-seed Newton-Raphson with bracketed bisection fallback
 * so irregular cashflows, negative returns, or short tenures converge reliably.
 */
export function calculateXIRR(
  entries: Array<{ date: string; amount: number }>
): number | null {
  const flows: RawFlow[] = [];
  let hasPositive = false;
  let hasNegative = false;

  for (const e of entries) {
    const ms = parseUtcMs(e.date);
    if (!Number.isFinite(ms) || !Number.isFinite(e.amount) || e.amount === 0) {
      continue;
    }
    if (e.amount > 0) hasPositive = true;
    if (e.amount < 0) hasNegative = true;
    flows.push({ ms, amount: e.amount });
  }

  if (flows.length < 2 || !hasPositive || !hasNegative) return null;

  flows.sort((a, b) => a.ms - b.ms);
  const t0 = flows[0].ms;
  const tLast = flows[flows.length - 1].ms;
  if (tLast <= t0) return null;

  const TOL = 1e-8;
  const MAX_ITER = 100;

  // 1. Try Newton-Raphson from multiple well-spaced seeds
  const seeds = [0.12, 0.0, 0.25, -0.2, 0.5, -0.5, 1.0, -0.8];
  for (const seed of seeds) {
    let r = seed;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      if (r <= -0.999999 || r > 100) break;
      const f = xnpv(r, flows, t0);
      if (!Number.isFinite(f)) break;
      if (Math.abs(f) < 1e-6) {
        return r;
      }
      const df = dxnpv(r, flows, t0);
      if (!Number.isFinite(df) || Math.abs(df) < 1e-12) break;
      const nextR = r - f / df;
      if (!Number.isFinite(nextR)) break;
      if (Math.abs(nextR - r) < TOL) {
        const check = xnpv(nextR, flows, t0);
        if (Number.isFinite(check) && Math.abs(check) < 1e-3) {
          return nextR;
        }
        break;
      }
      r = nextR;
    }
  }

  // 2. Guaranteed bracket scan + bisection fallback
  const grid = [
    -0.999, -0.99, -0.95, -0.9, -0.8, -0.6, -0.4, -0.2, -0.1, 0.0, 0.05, 0.1,
    0.15, 0.2, 0.3, 0.5, 0.8, 1.2, 2.0, 4.0, 8.0, 20.0, 50.0,
  ];

  for (let i = 0; i < grid.length - 1; i++) {
    let low = grid[i];
    let high = grid[i + 1];
    let fLow = xnpv(low, flows, t0);
    let fHigh = xnpv(high, flows, t0);
    if (!Number.isFinite(fLow) || !Number.isFinite(fHigh)) continue;
    if (Math.abs(fLow) < 1e-6) return low;
    if (Math.abs(fHigh) < 1e-6) return high;

    if ((fLow > 0 && fHigh < 0) || (fLow < 0 && fHigh > 0)) {
      for (let iter = 0; iter < 120; iter++) {
        const mid = (low + high) / 2;
        const fMid = xnpv(mid, flows, t0);
        if (!Number.isFinite(fMid)) break;
        if (Math.abs(fMid) < 1e-6 || high - low < 1e-9) {
          return mid;
        }
        if ((fLow > 0 && fMid > 0) || (fLow < 0 && fMid < 0)) {
          low = mid;
          fLow = fMid;
        } else {
          high = mid;
          fHigh = fMid;
        }
      }
    }
  }

  return null;
}

/**
 * Binary search in sorted Nifty 50 TRI daily series.
 * Returns exact date match or nearest preceding trading day (or earliest point if before dataset start).
 */
export function lookupNiftyTri(
  points: NiftyTriPoint[],
  targetIso: string
): { value: number; matchedDate: string; exact: boolean } {
  if (points.length === 0) {
    return { value: 1000, matchedDate: targetIso, exact: false };
  }

  let lo = 0;
  let hi = points.length - 1;
  let bestIdx = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cmp = points[mid].date.localeCompare(targetIso);
    if (cmp === 0) {
      return {
        value: points[mid].value,
        matchedDate: points[mid].date,
        exact: true,
      };
    }
    if (cmp < 0) {
      bestIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestIdx >= 0) {
    return {
      value: points[bestIdx].value,
      matchedDate: points[bestIdx].date,
      exact: false,
    };
  }

  // Target is earlier than first available point
  return {
    value: points[0].value,
    matchedDate: points[0].date,
    exact: false,
  };
}

interface FeeBoundary {
  date: string;
  label: string;
  isInitial: boolean;
}

function generateFeeBoundaries(
  firstIso: string,
  endIso: string,
  cycle: FeeBillingCycle,
  chargeOnInitialDay: boolean
): FeeBoundary[] {
  const boundaries: FeeBoundary[] = [];
  const [startY, startM, startD] = firstIso.split('-').map(Number);
  const [endY] = endIso.split('-').map(Number);

  if (chargeOnInitialDay) {
    let initLabel = 'Year 1 Opening';
    if (cycle === 'fy_apr') {
      const fyStart = startM >= 4 ? startY : startY - 1;
      initLabel = `FY ${fyStart}–${String((fyStart + 1) % 100).padStart(2, '0')} Opening (Initial)`;
    } else if (cycle === 'cal_jan') {
      initLabel = `CY ${startY} Opening (Initial)`;
    } else {
      initLabel = 'Year 1 Anniversary (Initial)';
    }
    boundaries.push({ date: firstIso, label: initLabel, isInitial: true });
  }

  if (cycle === 'fy_apr') {
    for (let y = startY; y <= endY; y++) {
      const candidate = `${y}-04-01`;
      if (candidate > firstIso && candidate < endIso) {
        boundaries.push({
          date: candidate,
          label: `FY ${y}–${String((y + 1) % 100).padStart(2, '0')} Opening (1 Apr)`,
          isInitial: false,
        });
      }
    }
  } else if (cycle === 'cal_jan') {
    for (let y = startY + 1; y <= endY; y++) {
      const candidate = `${y}-01-01`;
      if (candidate > firstIso && candidate < endIso) {
        boundaries.push({
          date: candidate,
          label: `CY ${y} Opening (1 Jan)`,
          isInitial: false,
        });
      }
    }
  } else {
    // Anniversary cycle: +1 year from initial investment date
    let yearIdx = 2;
    for (let y = startY + 1; y <= endY + 1; y++) {
      // Handle Feb 29 safely
      const daysInMonth = new Date(Date.UTC(y, startM, 0)).getUTCDate();
      const safeDay = Math.min(startD, daysInMonth);
      const candidate = `${y}-${String(startM).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
      if (candidate > firstIso && candidate < endIso) {
        boundaries.push({
          date: candidate,
          label: `Year ${yearIdx} Anniversary`,
          isInitial: false,
        });
        yearIdx++;
      }
    }
  }

  return boundaries;
}

function generateMonthCheckpoints(startIso: string, endIso: string): string[] {
  const dates: string[] = [startIso];
  const [sy, sm] = startIso.split('-').map(Number);
  const [ey, em] = endIso.split('-').map(Number);

  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    // Month end date
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    if (iso > startIso && iso < endIso) {
      dates.push(iso);
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  if (dates[dates.length - 1] !== endIso) {
    dates.push(endIso);
  }
  return dates;
}

/**
 * Full portfolio XIRR, Nifty 50 TRI simulation, Alpha, and Beginning-of-Year PM Management Fee engine.
 */
export function computeBenchmarkAnalysis(
  cashflows: CashflowEntry[],
  valuation: ValuationSnapshot,
  niftyDataset: NiftyTriDataset,
  feeConfig: FeeConfig
): CalculationResult {
  const issues: ValidationIssue[] = [];

  const valMs = parseUtcMs(valuation.date);
  if (!Number.isFinite(valMs)) {
    issues.push({
      field: 'valuation.date',
      message: 'Enter a valid Valuation Date.',
    });
  }
  if (!Number.isFinite(valuation.marketValue) || valuation.marketValue < 0) {
    issues.push({
      field: 'valuation.marketValue',
      message: 'Portfolio Market Value must be zero or positive.',
    });
  }

  const validCashflows: CashflowEntry[] = [];
  for (const cf of cashflows) {
    const ms = parseUtcMs(cf.date);
    if (!Number.isFinite(ms)) {
      issues.push({
        rowId: cf.id,
        field: 'date',
        message: 'Invalid cashflow date.',
      });
      continue;
    }
    if (!Number.isFinite(cf.amount) || cf.amount <= 0) {
      issues.push({
        rowId: cf.id,
        field: 'amount',
        message: 'Amount must be greater than ₹0.',
      });
      continue;
    }
    if (Number.isFinite(valMs) && ms > valMs) {
      issues.push({
        rowId: cf.id,
        field: 'date',
        message: `Cashflow date (${cf.date}) cannot be after Valuation Date (${valuation.date}).`,
      });
      continue;
    }
    validCashflows.push(cf);
  }

  if (validCashflows.length === 0) {
    issues.push({
      field: 'cashflows',
      message: 'Add at least one valid investment cashflow to calculate XIRR.',
    });
  }

  const sortedFlows = [...validCashflows].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    // Investments before withdrawals on the same date
    if (a.type === b.type) return 0;
    return a.type === 'investment' ? -1 : 1;
  });

  if (sortedFlows.length === 0 || !Number.isFinite(valMs)) {
    return {
      isValid: false,
      issues,
      holdingYears: 0,
      totalInvested: 0,
      totalWithdrawn: 0,
      netCapitalInvested: 0,
      absoluteGainGross: 0,
      absoluteGainNet: 0,
      grossPortfolioXirr: null,
      netPortfolioXirr: null,
      postFeeMarketValue: valuation.marketValue || 0,
      totalFeesCharged: 0,
      compoundingFeeDragRupees: 0,
      feeDragPctPoints: null,
      niftySimulatedValue: 0,
      niftyXirr: null,
      niftyTotalUnits: 0,
      niftyEndIndex: 0,
      niftyEndMatchedDate: valuation.date,
      niftyAbsoluteGain: 0,
      hadUnitShortfall: false,
      grossAlpha: null,
      netAlpha: null,
      rupeeDeltaGross: 0,
      rupeeDeltaNet: 0,
      unitSimulationRows: [],
      annualFeeRows: [],
      timelineSeries: [],
    };
  }

  const firstDate = sortedFlows[0].date;
  const holdingDays = Math.max(0, daysBetween(firstDate, valuation.date));
  const holdingYears = holdingDays / 365;

  if (holdingDays === 0) {
    issues.push({
      field: 'valuation.date',
      message: 'Valuation Date must be later than the earliest cashflow date to annualize XIRR.',
    });
  }

  let totalInvested = 0;
  let totalWithdrawn = 0;

  const xirrInvestorFlows: Array<{ date: string; amount: number }> = [];
  const unitSimulationRows: UnitSimulationRow[] = [];
  let runningUnits = 0;
  let hadUnitShortfall = false;

  for (const cf of sortedFlows) {
    const signedInvestorFlow = cf.type === 'investment' ? -cf.amount : cf.amount;
    if (cf.type === 'investment') {
      totalInvested += cf.amount;
    } else {
      totalWithdrawn += cf.amount;
    }

    xirrInvestorFlows.push({ date: cf.date, amount: signedInvestorFlow });

    const triLookup = lookupNiftyTri(niftyDataset.points, cf.date);
    const unitsDelta =
      cf.type === 'investment'
        ? cf.amount / triLookup.value
        : -(cf.amount / triLookup.value);

    runningUnits += unitsDelta;
    let unitShortfall = false;
    if (runningUnits < -1e-6) {
      unitShortfall = true;
      hadUnitShortfall = true;
    }

    unitSimulationRows.push({
      id: cf.id,
      date: cf.date,
      matchedTriDate: triLookup.matchedDate,
      type: cf.type,
      amount: cf.amount,
      signedInvestorFlow,
      triValue: triLookup.value,
      unitsDelta,
      cumulativeUnits: runningUnits,
      note: cf.note,
      isExactDateMatch: triLookup.exact,
      unitShortfall,
    });
  }

  const netCapitalInvested = totalInvested - totalWithdrawn;

  // 1. Gross Portfolio XIRR
  const grossPortfolioXirr =
    holdingDays > 0
      ? calculateXIRR([
          ...xirrInvestorFlows,
          { date: valuation.date, amount: valuation.marketValue },
        ])
      : null;

  // 2. Nifty 50 TRI Benchmark Terminal Value & XIRR
  const endTriLookup = lookupNiftyTri(niftyDataset.points, valuation.date);
  const niftySimulatedValue = Math.max(0, runningUnits * endTriLookup.value);
  const niftyXirr =
    holdingDays > 0
      ? calculateXIRR([
          ...xirrInvestorFlows,
          { date: valuation.date, amount: niftySimulatedValue },
        ])
      : null;

  // 3. Beginning-of-Year PM Annual Management Fee Simulation
  const feeRate = Math.max(0, Math.min(25, feeConfig.annualRatePct || 0));
  const feeBoundaries = generateFeeBoundaries(
    firstDate,
    valuation.date,
    feeConfig.cycle,
    feeConfig.chargeOnInitialDay
  );

  const growthRate = grossPortfolioXirr !== null ? grossPortfolioXirr : 0;

  // Build unified event timeline (cashflows + fee boundaries + valuation end)
  type SimEvent =
    | { kind: 'cashflow'; date: string; deltaPortfolio: number }
    | { kind: 'fee'; date: string; label: string; isInitial: boolean }
    | { kind: 'end'; date: string };

  const events: SimEvent[] = [];
  for (const cf of sortedFlows) {
    events.push({
      kind: 'cashflow',
      date: cf.date,
      deltaPortfolio: cf.type === 'investment' ? cf.amount : -cf.amount,
    });
  }
  for (const fb of feeBoundaries) {
    events.push({
      kind: 'fee',
      date: fb.date,
      label: fb.label,
      isInitial: fb.isInitial,
    });
  }
  events.push({ kind: 'end', date: valuation.date });

  // Order on identical date: cashflows first (so Day-1 investment is inside opening balance before Year-1 fee), then fee, then end
  const kindOrder = (k: SimEvent['kind']) =>
    k === 'cashflow' ? 0 : k === 'fee' ? 1 : 2;
  events.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return kindOrder(a.kind) - kindOrder(b.kind);
  });

  let grossBal = 0;
  let netBal = 0;
  let prevDate = firstDate;
  const annualFeeRows: AnnualFeeRow[] = [];
  let totalFeesCharged = 0;
  const outOfPocketFeeFlows: Array<{ date: string; amount: number }> = [];

  for (const ev of events) {
    const dtDays = Math.max(0, daysBetween(prevDate, ev.date));
    if (dtDays > 0) {
      const factor = Math.pow(1 + growthRate, dtDays / 365);
      grossBal *= factor;
      netBal *= factor;
    }
    prevDate = ev.date;

    if (ev.kind === 'cashflow') {
      grossBal += ev.deltaPortfolio;
      netBal += ev.deltaPortfolio;
    } else if (ev.kind === 'fee') {
      const impliedOpening =
        feeConfig.mode === 'corpus_deducted'
          ? Math.max(0, netBal)
          : Math.max(0, grossBal);
      const overrideVal = feeConfig.valueOverrides[ev.date];
      const hasOverride =
        typeof overrideVal === 'number' &&
        Number.isFinite(overrideVal) &&
        overrideVal >= 0;
      const effectiveOpening = hasOverride ? overrideVal : impliedOpening;
      const feeAmount =
        feeConfig.enabled && feeRate > 0
          ? effectiveOpening * (feeRate / 100)
          : 0;

      if (feeConfig.enabled && feeAmount > 0) {
        totalFeesCharged += feeAmount;
        if (feeConfig.mode === 'corpus_deducted') {
          netBal = Math.max(0, netBal - feeAmount);
        } else {
          outOfPocketFeeFlows.push({ date: ev.date, amount: -feeAmount });
        }
      }

      annualFeeRows.push({
        feeDate: ev.date,
        label: ev.label,
        impliedOpeningValue: impliedOpening,
        effectiveOpeningValue: effectiveOpening,
        isOverridden: hasOverride,
        feeRatePct: feeRate,
        feeAmount,
        postFeeBalance:
          feeConfig.mode === 'corpus_deducted'
            ? Math.max(0, netBal)
            : Math.max(0, grossBal),
      });
    }
  }

  const postFeeMarketValue =
    feeConfig.enabled && feeRate > 0
      ? feeConfig.mode === 'corpus_deducted'
        ? Math.max(0, netBal)
        : valuation.marketValue
      : valuation.marketValue;

  let netPortfolioXirr = grossPortfolioXirr;
  if (feeConfig.enabled && feeRate > 0 && holdingDays > 0) {
    if (feeConfig.mode === 'corpus_deducted') {
      netPortfolioXirr = calculateXIRR([
        ...xirrInvestorFlows,
        { date: valuation.date, amount: postFeeMarketValue },
      ]);
    } else {
      netPortfolioXirr = calculateXIRR([
        ...xirrInvestorFlows,
        ...outOfPocketFeeFlows,
        { date: valuation.date, amount: valuation.marketValue },
      ]);
    }
  }

  const compoundingFeeDragRupees =
    feeConfig.enabled && feeRate > 0
      ? feeConfig.mode === 'corpus_deducted'
        ? Math.max(0, valuation.marketValue - postFeeMarketValue)
        : totalFeesCharged
      : 0;

  const feeDragPctPoints =
    grossPortfolioXirr !== null && netPortfolioXirr !== null
      ? grossPortfolioXirr - netPortfolioXirr
      : null;

  const grossAlpha =
    grossPortfolioXirr !== null && niftyXirr !== null
      ? grossPortfolioXirr - niftyXirr
      : null;

  const netAlpha =
    netPortfolioXirr !== null && niftyXirr !== null
      ? netPortfolioXirr - niftyXirr
      : null;

  const rupeeDeltaGross = valuation.marketValue - niftySimulatedValue;
  const rupeeDeltaNet =
    feeConfig.mode === 'out_of_pocket'
      ? valuation.marketValue - totalFeesCharged - niftySimulatedValue
      : postFeeMarketValue - niftySimulatedValue;

  const absoluteGainGross = valuation.marketValue - netCapitalInvested;
  const absoluteGainNet =
    feeConfig.mode === 'out_of_pocket'
      ? valuation.marketValue - totalFeesCharged - netCapitalInvested
      : postFeeMarketValue - netCapitalInvested;

  const niftyAbsoluteGain = niftySimulatedValue - netCapitalInvested;

  // 4. Generate Monthly Growth Timeline Series (Portfolio Gross vs Net vs Actual Historical Nifty 50 TRI Corpus)
  const checkpoints = generateMonthCheckpoints(firstDate, valuation.date);
  const feeLookupByDate = new Map<string, number>();
  for (const r of annualFeeRows) {
    if (feeConfig.enabled && feeConfig.mode === 'corpus_deducted') {
      feeLookupByDate.set(r.feeDate, r.feeAmount);
    }
  }

  const timelineSeries: TimelinePoint[] = [];
  let tGross = 0;
  let tNet = 0;
  let tInvested = 0;
  let tUnits = 0;
  let cursorDate = firstDate;
  let cfIdx = 0;
  const appliedFees = new Set<string>();

  for (const cp of checkpoints) {
    // Advance step-by-step through any cashflows or fee dates <= cp
    const subDates = new Set<string>([cp]);
    for (let i = cfIdx; i < sortedFlows.length; i++) {
      if (sortedFlows[i].date <= cp) subDates.add(sortedFlows[i].date);
      else break;
    }
    for (const r of annualFeeRows) {
      if (r.feeDate <= cp && !appliedFees.has(r.feeDate)) {
        subDates.add(r.feeDate);
      }
    }

    const orderedSubDates = Array.from(subDates).sort();
    for (const sd of orderedSubDates) {
      const dt = Math.max(0, daysBetween(cursorDate, sd));
      if (dt > 0) {
        const f = Math.pow(1 + growthRate, dt / 365);
        tGross *= f;
        tNet *= f;
      }
      cursorDate = sd;

      while (cfIdx < sortedFlows.length && sortedFlows[cfIdx].date === sd) {
        const cf = sortedFlows[cfIdx];
        const delta = cf.type === 'investment' ? cf.amount : -cf.amount;
        tGross += delta;
        tNet += delta;
        tInvested += delta;
        const unitRow = unitSimulationRows[cfIdx];
        tUnits += unitRow.unitsDelta;
        cfIdx++;
      }

      if (feeLookupByDate.has(sd) && !appliedFees.has(sd)) {
        tNet = Math.max(0, tNet - (feeLookupByDate.get(sd) ?? 0));
        appliedFees.add(sd);
      }
    }

    const triAtCp = lookupNiftyTri(niftyDataset.points, cp);
    const isFinal = cp === valuation.date;
    timelineSeries.push({
      date: cp,
      label: formatMonthYear(cp),
      netInvested: Math.round(tInvested),
      portfolioGross: Math.round(isFinal ? valuation.marketValue : Math.max(0, tGross)),
      portfolioNet: Math.round(
        isFinal
          ? feeConfig.mode === 'out_of_pocket'
            ? Math.max(0, valuation.marketValue - totalFeesCharged)
            : postFeeMarketValue
          : Math.max(0, tNet)
      ),
      niftyTriCorpus: Math.round(
        isFinal ? niftySimulatedValue : Math.max(0, tUnits * triAtCp.value)
      ),
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    holdingYears,
    totalInvested,
    totalWithdrawn,
    netCapitalInvested,
    absoluteGainGross,
    absoluteGainNet,
    grossPortfolioXirr,
    netPortfolioXirr,
    postFeeMarketValue,
    totalFeesCharged,
    compoundingFeeDragRupees,
    feeDragPctPoints,
    niftySimulatedValue,
    niftyXirr,
    niftyTotalUnits: runningUnits,
    niftyEndIndex: endTriLookup.value,
    niftyEndMatchedDate: endTriLookup.matchedDate,
    niftyAbsoluteGain,
    hadUnitShortfall,
    grossAlpha,
    netAlpha,
    rupeeDeltaGross,
    rupeeDeltaNet,
    unitSimulationRows,
    annualFeeRows,
    timelineSeries,
  };
}
