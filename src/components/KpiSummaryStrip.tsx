import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { CalculationResult, FeeConfig, ValuationSnapshot } from '../types/finance';
import { formatBps, formatINR, formatINRCompact, formatPct } from '../utils/formatters';

interface KpiSummaryStripProps {
  result: CalculationResult;
  valuation: ValuationSnapshot;
  feeConfig: FeeConfig;
}

export function KpiSummaryStrip({
  result,
  valuation,
  feeConfig,
}: KpiSummaryStripProps) {
  const feeActive = feeConfig.enabled && feeConfig.annualRatePct > 0;
  const activePortfolioXirr = feeActive
    ? result.netPortfolioXirr
    : result.grossPortfolioXirr;
  const activeAlpha = feeActive ? result.netAlpha : result.grossAlpha;
  const activeRupeeDelta = feeActive
    ? result.rupeeDeltaNet
    : result.rupeeDeltaGross;

  const alphaPositive = activeAlpha !== null && activeAlpha > 0.00005;
  const alphaNegative = activeAlpha !== null && activeAlpha < -0.00005;

  const deltaPositive = activeRupeeDelta > 1;
  const deltaNegative = activeRupeeDelta < -1;

  return (
    <section
      aria-label="Key Performance Summary"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-slate-200 bg-white rounded-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
    >
      {/* 1. Portfolio Manager XIRR */}
      <div className="p-5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            {feeActive ? 'Portfolio XIRR (Net of Fee)' : 'Portfolio Manager XIRR'}
          </span>
          <span className="text-xs text-slate-400 font-tabular">
            {result.holdingYears > 0 ? `${result.holdingYears.toFixed(2)} yrs` : '—'}
          </span>
        </div>
        <div className="font-tabular text-2xl font-semibold tracking-tight text-slate-900">
          {formatPct(activePortfolioXirr, false)}
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {feeActive ? (
            <>
              <span>Gross</span>
              <span className="font-tabular font-medium text-slate-700">
                {formatPct(result.grossPortfolioXirr)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-tabular text-[#B91C1C]">
                Fee drag {result.feeDragPctPoints !== null ? formatBps(-result.feeDragPctPoints) : '—'}
              </span>
            </>
          ) : (
            <>
              <span>Ending value</span>
              <span className="font-tabular font-medium text-slate-700">
                {formatINRCompact(valuation.marketValue)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Gain</span>
              <span className="font-tabular font-medium text-slate-700">
                {formatINRCompact(result.absoluteGainGross, true)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Nifty 50 TRI XIRR */}
      <div className="p-5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            Nifty 50 TRI Benchmark XIRR
          </span>
          <span className="text-xs text-slate-400">Dividend Reinvested</span>
        </div>
        <div className="font-tabular text-2xl font-semibold tracking-tight text-slate-900">
          {formatPct(result.niftyXirr, false)}
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>Simulated corpus</span>
          <span className="font-tabular font-medium text-slate-700">
            {formatINRCompact(result.niftySimulatedValue)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-tabular text-slate-600">
            {result.niftyTotalUnits.toFixed(2)} units
          </span>
        </div>
      </div>

      {/* 3. Alpha Generated */}
      <div className="p-5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            {feeActive ? 'Net Alpha Generated' : 'Alpha Generated'}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              alphaPositive
                ? 'text-[#15803D]'
                : alphaNegative
                ? 'text-[#B91C1C]'
                : 'text-slate-500'
            }`}
          >
            {alphaPositive ? (
              <>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                Outperformed
              </>
            ) : alphaNegative ? (
              <>
                <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                Underperformed
              </>
            ) : (
              <>
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                Inline
              </>
            )}
          </span>
        </div>
        <div
          className={`font-tabular text-2xl font-semibold tracking-tight ${
            alphaPositive
              ? 'text-[#15803D]'
              : alphaNegative
              ? 'text-[#B91C1C]'
              : 'text-slate-900'
          }`}
        >
          {formatPct(activeAlpha, true)}
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-tabular font-medium text-slate-700">
            {formatBps(activeAlpha)}
          </span>
          {feeActive && (
            <>
              <span aria-hidden="true">·</span>
              <span>Gross alpha</span>
              <span className="font-tabular font-medium text-slate-700">
                {formatPct(result.grossAlpha, true)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 4. Rupee Wealth Delta */}
      <div className="p-5 flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            {feeActive ? 'Net Wealth Delta vs. Nifty' : 'Wealth Delta vs. Nifty'}
          </span>
          <span
            className={`text-xs font-medium ${
              deltaPositive
                ? 'text-[#15803D]'
                : deltaNegative
                ? 'text-[#B91C1C]'
                : 'text-slate-500'
            }`}
          >
            {deltaPositive ? 'Value Added' : deltaNegative ? 'Value Lag' : 'Parity'}
          </span>
        </div>
        <div
          className={`font-tabular text-2xl font-semibold tracking-tight ${
            deltaPositive
              ? 'text-[#15803D]'
              : deltaNegative
              ? 'text-[#B91C1C]'
              : 'text-slate-900'
          }`}
          title={formatINR(activeRupeeDelta, true)}
        >
          {formatINRCompact(activeRupeeDelta, true)}
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {feeActive ? (
            <>
              <span>Compounding fee drag</span>
              <span className="font-tabular font-medium text-[#B91C1C]">
                {formatINRCompact(-result.compoundingFeeDragRupees)}
              </span>
            </>
          ) : (
            <>
              <span>Exact</span>
              <span className="font-tabular font-medium text-slate-700">
                {formatINR(activeRupeeDelta, true)}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
