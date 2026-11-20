import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CalculationResult,
  FeeConfig,
  NiftyTriDataset,
  ValuationSnapshot,
} from '../types/finance';
import {
  formatBps,
  formatDisplayDate,
  formatINR,
  formatINRCompact,
  formatPct,
} from '../utils/formatters';

interface OverviewPanelProps {
  result: CalculationResult;
  valuation: ValuationSnapshot;
  feeConfig: FeeConfig;
  niftyDataset: NiftyTriDataset;
  onNavigateTab: (tab: 'cashflows' | 'upload' | 'fees' | 'audit') => void;
}

type SeriesKey = 'portfolioGross' | 'portfolioNet' | 'niftyTriCorpus' | 'netInvested';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
}

function CustomChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pointDate = (payload[0] as unknown as { payload?: { date?: string } })?.payload?.date;

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-sm p-3 text-xs min-w-[220px]">
      <div className="font-medium text-slate-900 pb-1.5 mb-1.5 border-b border-slate-100 font-tabular">
        {pointDate ? formatDisplayDate(pointDate) : ''}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="w-2.5 h-0.5 inline-block shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-tabular font-medium text-slate-900">
              {formatINR(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewPanel({
  result,
  valuation,
  feeConfig,
  niftyDataset,
  onNavigateTab,
}: OverviewPanelProps) {
  const feeActive = feeConfig.enabled && feeConfig.annualRatePct > 0;
  const activeAlpha = feeActive ? result.netAlpha : result.grossAlpha;
  const activePortfolioValue = feeActive
    ? feeConfig.mode === 'out_of_pocket'
      ? valuation.marketValue - result.totalFeesCharged
      : result.postFeeMarketValue
    : valuation.marketValue;

  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    portfolioGross: true,
    portfolioNet: true,
    niftyTriCorpus: true,
    netInvested: true,
  });

  const seriesOptions: Array<{
    key: SeriesKey;
    label: string;
    color: string;
    dashed?: boolean;
  }> = [
    { key: 'portfolioGross', label: 'Portfolio (Gross)', color: '#1E3A8A' },
    ...(feeActive
      ? [
          {
            key: 'portfolioNet' as const,
            label: `Portfolio (Net of ${feeConfig.annualRatePct}% Fee)`,
            color: '#0D9488',
          },
        ]
      : []),
    { key: 'niftyTriCorpus', label: 'Nifty 50 TRI Simulated', color: '#D97706' },
    {
      key: 'netInvested',
      label: 'Net Capital Invested',
      color: '#94A3B8',
      dashed: true,
    },
  ];

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showAllSeries = () => {
    setVisibleSeries({
      portfolioGross: true,
      portfolioNet: true,
      niftyTriCorpus: true,
      netInvested: true,
    });
  };

  const activeSeriesCount = seriesOptions.filter((s) => visibleSeries[s.key]).length;
  const allSeriesSelected = activeSeriesCount === seriesOptions.length;

  const comparisonRows = [
    {
      label: 'Total Capital Invested',
      gross: formatINR(result.totalInvested),
      net: feeActive ? formatINR(result.totalInvested) : null,
      nifty: formatINR(result.totalInvested),
    },
    {
      label: 'Total Withdrawals',
      gross: formatINR(result.totalWithdrawn),
      net: feeActive ? formatINR(result.totalWithdrawn) : null,
      nifty: formatINR(result.totalWithdrawn),
    },
    {
      label: 'Net Capital Deployed',
      gross: formatINR(result.netCapitalInvested),
      net: feeActive ? formatINR(result.netCapitalInvested) : null,
      nifty: formatINR(result.netCapitalInvested),
    },
    {
      label: `Ending Market Value (${formatDisplayDate(valuation.date)})`,
      gross: formatINR(valuation.marketValue),
      net: feeActive ? formatINR(activePortfolioValue) : null,
      nifty: formatINR(result.niftySimulatedValue),
      emphasize: true,
    },
    {
      label: 'Absolute Gain / Profit',
      gross: formatINR(result.absoluteGainGross, true),
      net: feeActive ? formatINR(result.absoluteGainNet, true) : null,
      nifty: formatINR(result.niftyAbsoluteGain, true),
    },
    {
      label: 'Annualized XIRR (ACT/365)',
      gross: formatPct(result.grossPortfolioXirr),
      net: feeActive ? formatPct(result.netPortfolioXirr) : null,
      nifty: formatPct(result.niftyXirr),
      emphasize: true,
    },
    {
      label: 'Alpha vs. Nifty 50 TRI',
      gross: `${formatPct(result.grossAlpha, true)} (${formatBps(result.grossAlpha)})`,
      net: feeActive
        ? `${formatPct(result.netAlpha, true)} (${formatBps(result.netAlpha)})`
        : null,
      nifty: '0.00% (Benchmark)',
      isAlphaRow: true,
    },
    {
      label: 'Rupee Wealth Delta vs. Nifty',
      gross: formatINR(result.rupeeDeltaGross, true),
      net: feeActive ? formatINR(result.rupeeDeltaNet, true) : null,
      nifty: '₹0',
      isDeltaRow: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Corpus Growth Trajectory Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col gap-3.5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Portfolio Trajectory vs. Simulated Nifty 50 TRI Corpus
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tick or untick any line below to compare specific trajectories side by side.
              </p>
            </div>
            {!allSeriesSelected && (
              <button
                type="button"
                onClick={showAllSeries}
                className="text-xs font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0 self-start cursor-pointer"
              >
                Show all lines
              </button>
            )}
          </div>

          {/* Interactive Series Checkboxes */}
          <div
            role="group"
            aria-label="Chart line visibility"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-slate-100"
          >
            {seriesOptions.map((opt) => {
              const checked = visibleSeries[opt.key];
              return (
                <label
                  key={opt.key}
                  className={`inline-flex items-center gap-2 text-xs select-none cursor-pointer transition-opacity whitespace-nowrap ${
                    checked
                      ? 'text-slate-800 font-medium'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSeries(opt.key)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                  />
                  {opt.dashed ? (
                    <span
                      className="w-3.5 h-0 border-t-2 border-dashed inline-block shrink-0"
                      style={{ borderColor: opt.color }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="w-3.5 h-0.5 inline-block shrink-0"
                      style={{ backgroundColor: opt.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="h-[320px] w-full">
          {activeSeriesCount === 0 ? (
            <div className="h-full border border-dashed border-slate-200 rounded-md bg-slate-50/50 flex flex-col items-center justify-center gap-2 text-center px-4">
              <p className="text-sm font-medium text-slate-700">
                No chart lines selected
              </p>
              <p className="text-xs text-slate-500">
                Tick one or more checkboxes above to plot your portfolio or benchmark trajectory.
              </p>
              <button
                type="button"
                onClick={showAllSeries}
                className="mt-1 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Show All Lines
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={result.timelineSeries}
                margin={{ top: 8, right: 16, left: 6, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  tickFormatter={(v) => formatINRCompact(Number(v))}
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={76}
                />
                <Tooltip content={<CustomChartTooltip />} />
                {visibleSeries.netInvested && (
                  <Line
                    type="stepAfter"
                    dataKey="netInvested"
                    name="Net Capital Invested"
                    stroke="#94A3B8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {visibleSeries.niftyTriCorpus && (
                  <Line
                    type="monotone"
                    dataKey="niftyTriCorpus"
                    name="Nifty 50 TRI Corpus"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#D97706' }}
                    isAnimationActive={false}
                  />
                )}
                {visibleSeries.portfolioGross && (
                  <Line
                    type="monotone"
                    dataKey="portfolioGross"
                    name="Portfolio (Gross)"
                    stroke="#1E3A8A"
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 4, fill: '#1E3A8A' }}
                    isAnimationActive={false}
                  />
                )}
                {feeActive && visibleSeries.portfolioNet && (
                  <Line
                    type="monotone"
                    dataKey="portfolioNet"
                    name={`Portfolio (Net of ${feeConfig.annualRatePct}% Fee)`}
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#0D9488' }}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Institutional Side-by-Side Comparison Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Head-to-Head Performance Attribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Benchmark data: {niftyDataset.sourceLabel} · Latest index date {formatDisplayDate(niftyDataset.asOfDate)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('audit')}
              className="inline-flex items-center gap-1 font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Inspect Nifty TRI Units
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('fees')}
              className="inline-flex items-center gap-1 font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              View Fee Schedule
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="text-left py-2.5 px-6">Performance Metric</th>
                <th className="text-right py-2.5 px-6">Portfolio (Gross)</th>
                {feeActive && (
                  <th className="text-right py-2.5 px-6">
                    Portfolio (Net · {feeConfig.annualRatePct}% Fee)
                  </th>
                )}
                <th className="text-right py-2.5 px-6">Nifty 50 TRI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonRows.map((row) => (
                <tr
                  key={row.label}
                  className={
                    row.emphasize
                      ? 'bg-slate-50/60 font-medium'
                      : 'hover:bg-slate-50/40'
                  }
                >
                  <td className="py-2.5 px-6 text-slate-700">{row.label}</td>
                  <td
                    className={`py-2.5 px-6 text-right font-tabular ${
                      row.isAlphaRow || row.isDeltaRow
                        ? (result.grossAlpha ?? 0) >= 0
                          ? 'text-[#15803D] font-medium'
                          : 'text-[#B91C1C] font-medium'
                        : 'text-slate-900'
                    }`}
                  >
                    {row.gross}
                  </td>
                  {feeActive && (
                    <td
                      className={`py-2.5 px-6 text-right font-tabular ${
                        row.isAlphaRow || row.isDeltaRow
                          ? (activeAlpha ?? 0) >= 0
                            ? 'text-[#15803D] font-semibold'
                            : 'text-[#B91C1C] font-semibold'
                          : 'text-slate-900'
                      }`}
                    >
                      {row.net}
                    </td>
                  )}
                  <td className="py-2.5 px-6 text-right font-tabular text-slate-700">
                    {row.nifty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Plain-language Verdict Summary Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            {activeAlpha !== null ? (
              activeAlpha >= 0 ? (
                <span>
                  <strong className="text-slate-900 font-semibold">Summary Verdict:</strong>{' '}
                  {feeActive ? 'Even after' : 'Before'} management fees, your portfolio manager outperformed Nifty 50 TRI by{' '}
                  <strong className="font-tabular text-[#15803D]">
                    {formatPct(activeAlpha, true)}
                  </strong>{' '}
                  annually, creating{' '}
                  <strong className="font-tabular text-[#15803D]">
                    {formatINR(feeActive ? result.rupeeDeltaNet : result.rupeeDeltaGross)}
                  </strong>{' '}
                  in additional investor wealth.
                </span>
              ) : (
                <span>
                  <strong className="text-slate-900 font-semibold">Summary Verdict:</strong>{' '}
                  {feeActive ? 'After' : 'Before'} management fees, your portfolio trailed the Nifty 50 TRI benchmark by{' '}
                  <strong className="font-tabular text-[#B91C1C]">
                    {formatPct(activeAlpha, true)}
                  </strong>{' '}
                  annually, resulting in{' '}
                  <strong className="font-tabular text-[#B91C1C]">
                    {formatINR(Math.abs(feeActive ? result.rupeeDeltaNet : result.rupeeDeltaGross))}
                  </strong>{' '}
                  less wealth than passive index deployment.
                </span>
              )
            ) : (
              <span>Add valid cashflows and a valuation date to compute benchmark attribution.</span>
            )}
          </div>
          {feeActive && (
            <div className="shrink-0 font-tabular text-slate-700">
              Direct Fees: <strong>{formatINR(result.totalFeesCharged)}</strong> · Total Drag:{' '}
              <strong className="text-[#B91C1C]">
                {formatINR(result.compoundingFeeDragRupees)}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
