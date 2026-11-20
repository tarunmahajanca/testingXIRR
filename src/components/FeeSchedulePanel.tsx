import { RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import type {
  CalculationResult,
  CashflowEntry,
  FeeConfig,
  NiftyTriDataset,
  ValuationSnapshot,
} from '../types/finance';
import {
  formatBps,
  formatDisplayDate,
  formatINR,
  formatPct,
} from '../utils/formatters';
import { computeBenchmarkAnalysis } from '../utils/xirrEngine';

interface FeeSchedulePanelProps {
  cashflows: CashflowEntry[];
  valuation: ValuationSnapshot;
  niftyDataset: NiftyTriDataset;
  feeConfig: FeeConfig;
  result: CalculationResult;
  onUpdateFeeConfig: (patch: Partial<FeeConfig>) => void;
  onSetOverride: (feeDate: string, value: number | null) => void;
  onClearAllOverrides: () => void;
}

const SENSITIVITY_RATES = [0, 1.0, 1.5, 2.0, 2.5, 3.0];

export function FeeSchedulePanel({
  cashflows,
  valuation,
  niftyDataset,
  feeConfig,
  result,
  onUpdateFeeConfig,
  onSetOverride,
  onClearAllOverrides,
}: FeeSchedulePanelProps) {
  const feeActive = feeConfig.enabled && feeConfig.annualRatePct > 0;
  const overrideCount = Object.keys(feeConfig.valueOverrides).length;

  // Live fee sensitivity matrix across standard PMS fee tiers
  const sensitivityRows = useMemo(() => {
    if (!result.isValid || cashflows.length === 0) return [];
    return SENSITIVITY_RATES.map((rate) => {
      const simConfig: FeeConfig = {
        ...feeConfig,
        enabled: rate > 0,
        annualRatePct: rate,
      };
      const sim = computeBenchmarkAnalysis(
        cashflows,
        valuation,
        niftyDataset,
        simConfig
      );
      return {
        rate,
        netXirr: sim.netPortfolioXirr,
        netAlpha: sim.netAlpha,
        totalFees: sim.totalFeesCharged,
        compoundingDrag: sim.compoundingFeeDragRupees,
        endingValue:
          simConfig.mode === 'out_of_pocket'
            ? valuation.marketValue - sim.totalFeesCharged
            : sim.postFeeMarketValue,
      };
    });
  }, [cashflows, valuation, niftyDataset, feeConfig, result.isValid]);

  const cycleLabel =
    feeConfig.cycle === 'fy_apr'
      ? 'Financial Year (1 April)'
      : feeConfig.cycle === 'cal_jan'
      ? 'Calendar Year (1 January)'
      : 'Investment Anniversary';

  return (
    <div className="space-y-6">
      {/* Fee Engine Summary Card */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Beginning-of-Year PM Management Fee Impact
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Models an annual fee charged on portfolio market value at the start of each {cycleLabel.toLowerCase()} and computes its exact effect on investor XIRR and Alpha.
            </p>
          </div>
          {!feeActive ? (
            <button
              type="button"
              onClick={() =>
                onUpdateFeeConfig({
                  enabled: true,
                  annualRatePct: feeConfig.annualRatePct > 0 ? feeConfig.annualRatePct : 2.0,
                })
              }
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Enable {feeConfig.annualRatePct > 0 ? feeConfig.annualRatePct : 2.0}% Annual PM Fee
            </button>
          ) : (
            <div className="flex items-center gap-3 text-xs text-slate-600 shrink-0">
              <span>
                Active Rate:{' '}
                <strong className="font-tabular text-slate-900">
                  {feeConfig.annualRatePct.toFixed(2)}% p.a.
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {feeConfig.mode === 'corpus_deducted'
                  ? 'Deducted from Corpus'
                  : 'Paid Out-of-Pocket'}
              </span>
            </div>
          )}
        </div>

        {/* 3-Column Fee Metrics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200">
          <div className="p-5">
            <div className="text-xs text-slate-500">XIRR Erosion (Gross → Net)</div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="font-tabular text-xl font-semibold text-slate-900">
                {formatPct(result.grossPortfolioXirr)}
              </span>
              <span className="text-slate-400 text-xs">→</span>
              <span className="font-tabular text-xl font-semibold text-[#1E3A8A]">
                {formatPct(result.netPortfolioXirr)}
              </span>
            </div>
            <div className="mt-1 text-xs text-[#B91C1C] font-tabular">
              {feeActive && result.feeDragPctPoints !== null
                ? `IRR Drag: ${formatBps(-result.feeDragPctPoints)} per year`
                : 'No management fee applied'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-slate-500">Direct Management Fees Charged</div>
            <div className="mt-1.5 font-tabular text-xl font-semibold text-slate-900">
              {formatINR(result.totalFeesCharged)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Across{' '}
              <span className="font-tabular font-medium text-slate-700">
                {result.annualFeeRows.length}
              </span>{' '}
              beginning-of-year billing date(s)
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-slate-500">
              {feeConfig.mode === 'corpus_deducted'
                ? 'Total Compounding Wealth Drag'
                : 'Net Ending Value (After Out-of-Pocket Fees)'}
            </div>
            <div className="mt-1.5 font-tabular text-xl font-semibold text-[#B91C1C]">
              {feeConfig.mode === 'corpus_deducted'
                ? formatINR(-result.compoundingFeeDragRupees)
                : formatINR(valuation.marketValue - result.totalFeesCharged)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {feeConfig.mode === 'corpus_deducted' ? (
                <>
                  Post-Fee Corpus:{' '}
                  <span className="font-tabular font-medium text-slate-700">
                    {formatINR(result.postFeeMarketValue)}
                  </span>
                </>
              ) : (
                'Fee outflows added directly to XIRR schedule'
              )}
            </div>
          </div>
        </div>

        {/* Year-by-Year Beginning-of-Year Fee Table */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-700">
            Year-by-Year Beginning-of-Year Market Value & Fee Schedule
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Opening values are auto-estimated from portfolio XIRR; edit any year to match your actual PMS statement.
            </span>
            {overrideCount > 0 && (
              <button
                type="button"
                onClick={onClearAllOverrides}
                className="inline-flex items-center gap-1 text-[#1E3A8A] font-medium hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                Reset {overrideCount} Override(s)
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="text-left py-2.5 pl-6 pr-3">Billing Period</th>
                <th className="text-left py-2.5 px-3">Fee Date</th>
                <th className="text-right py-2.5 px-3">Implied Opening MV</th>
                <th className="text-right py-2.5 px-3 w-52">
                  Fee Base Opening MV (Editable)
                </th>
                <th className="text-right py-2.5 px-3">Rate</th>
                <th className="text-right py-2.5 px-3">Fee Charged (INR)</th>
                <th className="text-right py-2.5 pl-3 pr-6">Post-Fee Corpus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.annualFeeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    No beginning-of-year fee billing dates fall within the current holding window. Enable &quot;Charge Year-1 opening fee&quot; in the sidebar or extend the valuation period.
                  </td>
                </tr>
              ) : (
                result.annualFeeRows.map((row) => (
                  <tr key={row.feeDate} className="hover:bg-slate-50/50">
                    <td className="py-2.5 pl-6 pr-3 text-slate-800 font-medium text-xs">
                      {row.label}
                    </td>
                    <td className="py-2.5 px-3 font-tabular text-xs text-slate-600">
                      {formatDisplayDate(row.feeDate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-tabular text-xs text-slate-500">
                      {formatINR(row.impliedOpeningValue)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="relative w-36">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
                            ₹
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            value={Math.round(row.effectiveOpeningValue)}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (e.target.value === '') {
                                onSetOverride(row.feeDate, null);
                              } else if (Number.isFinite(val) && val >= 0) {
                                onSetOverride(row.feeDate, val);
                              }
                            }}
                            aria-label={`Opening market value for ${row.label}`}
                            className={`w-full pl-5 pr-2 py-1 text-xs font-tabular text-right border rounded focus:outline-none focus:border-[#1E3A8A] ${
                              row.isOverridden
                                ? 'bg-blue-50/50 border-[#1E3A8A]/50 font-semibold text-slate-900'
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                        {row.isOverridden && (
                          <button
                            type="button"
                            onClick={() => onSetOverride(row.feeDate, null)}
                            title="Revert to implied opening market value"
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-tabular text-xs text-slate-600">
                      {feeActive ? `${row.feeRatePct.toFixed(2)}%` : '0.00%'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-tabular text-xs font-medium text-[#B91C1C]">
                      {row.feeAmount > 0 ? formatINR(-row.feeAmount) : '₹0'}
                    </td>
                    <td className="py-2.5 pl-3 pr-6 text-right font-tabular text-xs text-slate-900">
                      {formatINR(row.postFeeBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fee Rate Sensitivity Table */}
      {sensitivityRows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Fee Rate Sensitivity Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare how different annual beginning-of-year PM fee tiers affect your Net XIRR, Net Alpha vs. Nifty 50 TRI, and ending wealth. Click any row to apply that rate.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="text-left py-2.5 pl-6 pr-3">Annual PM Fee</th>
                  <th className="text-right py-2.5 px-3">Net Portfolio XIRR</th>
                  <th className="text-right py-2.5 px-3">Net Alpha vs. Nifty 50 TRI</th>
                  <th className="text-right py-2.5 px-3">Direct Fees Paid</th>
                  <th className="text-right py-2.5 px-3">Total Wealth Drag</th>
                  <th className="text-right py-2.5 pl-3 pr-6">Net Ending Corpus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sensitivityRows.map((s) => {
                  const isCurrent =
                    (!feeConfig.enabled && s.rate === 0) ||
                    (feeConfig.enabled && Math.abs(feeConfig.annualRatePct - s.rate) < 0.001);
                  const alphaPos = (s.netAlpha ?? 0) >= 0;
                  return (
                    <tr
                      key={s.rate}
                      onClick={() =>
                        onUpdateFeeConfig({
                          enabled: s.rate > 0,
                          annualRatePct: s.rate > 0 ? s.rate : feeConfig.annualRatePct,
                        })
                      }
                      className={`cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/50 font-semibold'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-2.5 pl-6 pr-3 font-tabular text-slate-900">
                        {s.rate.toFixed(1)}% p.a.
                        {isCurrent && (
                          <span className="ml-2 font-sans text-[11px] text-[#1E3A8A]">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular text-slate-900">
                        {formatPct(s.netXirr)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-tabular ${
                          alphaPos ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {formatPct(s.netAlpha, true)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular text-slate-700">
                        {formatINR(s.totalFees)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular text-[#B91C1C]">
                        {s.compoundingDrag > 0 ? formatINR(-s.compoundingDrag) : '₹0'}
                      </td>
                      <td className="py-2.5 pl-3 pr-6 text-right font-tabular text-slate-900">
                        {formatINR(s.endingValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
