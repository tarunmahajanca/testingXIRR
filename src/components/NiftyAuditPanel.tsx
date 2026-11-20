import { AlertTriangle, RefreshCw } from 'lucide-react';
import type {
  CalculationResult,
  NiftyTriDataset,
  ValuationSnapshot,
} from '../types/finance';
import {
  formatDisplayDate,
  formatINR,
  formatNumber,
  formatPct,
} from '../utils/formatters';

interface NiftyAuditPanelProps {
  result: CalculationResult;
  valuation: ValuationSnapshot;
  niftyDataset: NiftyTriDataset;
  isLoadingNifty: boolean;
  onRefreshNifty: () => void;
}

export function NiftyAuditPanel({
  result,
  valuation,
  niftyDataset,
  isLoadingNifty,
  onRefreshNifty,
}: NiftyAuditPanelProps) {
  const firstPointDate = niftyDataset.points[0]?.date ?? '2005-01-03';

  return (
    <div className="space-y-5">
      {/* Benchmark Data Provenance Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Nifty 50 Total Return Index (TRI) Simulation Audit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every investor inflow purchases virtual Nifty 50 TRI units at that date&apos;s dividend-reinvested index level; withdrawals redeem units at the matched trading day&apos;s level.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
              <span>
                Source:{' '}
                <strong className="text-slate-900 font-medium">
                  {niftyDataset.sourceLabel}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Series range:{' '}
                <span className="font-tabular text-slate-800">
                  {formatDisplayDate(firstPointDate)} – {formatDisplayDate(niftyDataset.asOfDate)}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Data points:{' '}
                <span className="font-tabular text-slate-800">
                  {niftyDataset.points.length.toLocaleString('en-IN')}
                </span>
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoadingNifty}
            onClick={onRefreshNifty}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingNifty ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isLoadingNifty ? 'Refreshing TRI...' : 'Refresh Live Data'}
          </button>
        </div>

        {result.hadUnitShortfall && (
          <div className="mt-4 p-3.5 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-[#B45309]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              One or more withdrawals exceeded the accumulated simulated Nifty 50 TRI corpus at that date (running units dipped below zero). This happens when your PM outperformed strongly prior to a large withdrawal.
            </span>
          </div>
        )}
      </div>

      {/* Date-by-Date Unit Allocation Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <th className="text-left py-2.5 pl-6 pr-3">Cashflow Date</th>
                <th className="text-left py-2.5 px-3">Matched Trading Date</th>
                <th className="text-left py-2.5 px-3">Direction</th>
                <th className="text-right py-2.5 px-3">Cashflow (INR)</th>
                <th className="text-right py-2.5 px-3">Nifty 50 TRI Level</th>
                <th className="text-right py-2.5 px-3">Units Bought / Redeemed</th>
                <th className="text-right py-2.5 pl-3 pr-6">Cumulative Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.unitSimulationRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Add cashflows to inspect date-by-date Nifty 50 TRI unit allocations.
                  </td>
                </tr>
              ) : (
                <>
                  {result.unitSimulationRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.unitShortfall
                          ? 'bg-amber-50/40'
                          : 'hover:bg-slate-50/50'
                      }
                    >
                      <td className="py-2.5 pl-6 pr-3 font-tabular text-slate-900">
                        {formatDisplayDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3 font-tabular text-slate-600">
                        {formatDisplayDate(row.matchedTriDate)}
                        {!row.isExactDateMatch && (
                          <span className="ml-1.5 font-sans text-[11px] text-slate-400">
                            (prev trading day)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {row.type === 'investment' ? (
                          <span className="text-[#1E3A8A]">Investment</span>
                        ) : (
                          <span className="text-[#B45309]">Withdrawal</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular text-slate-900">
                        {formatINR(row.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular text-slate-700">
                        {formatNumber(row.triValue, 2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-tabular font-medium ${
                          row.unitsDelta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {row.unitsDelta >= 0 ? '+' : ''}
                        {formatNumber(row.unitsDelta, 4)}
                      </td>
                      <td className="py-2.5 pl-3 pr-6 text-right font-tabular text-slate-900">
                        {formatNumber(row.cumulativeUnits, 4)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Valuation Row */}
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-900">
                    <td className="py-3 pl-6 pr-3 font-tabular">
                      {formatDisplayDate(valuation.date)}
                    </td>
                    <td className="py-3 px-3 font-tabular text-slate-600 font-normal">
                      {formatDisplayDate(result.niftyEndMatchedDate)}
                    </td>
                    <td className="py-3 px-3">Closing Benchmark Valuation</td>
                    <td className="py-3 px-3 text-right font-tabular text-[#1E3A8A]">
                      {formatINR(result.niftySimulatedValue)}
                    </td>
                    <td className="py-3 px-3 text-right font-tabular">
                      {formatNumber(result.niftyEndIndex, 2)}
                    </td>
                    <td className="py-3 px-3 text-right font-tabular text-slate-500 font-normal">
                      Nifty XIRR: {formatPct(result.niftyXirr)}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right font-tabular">
                      {formatNumber(result.niftyTotalUnits, 4)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
