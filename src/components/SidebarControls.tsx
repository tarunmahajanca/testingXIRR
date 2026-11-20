import {
  BarChart3,
  Calculator,
  FileSpreadsheet,
  Percent,
  RotateCcw,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import type {
  FeeBillingCycle,
  FeeConfig,
  FeeTreatmentMode,
  ValuationSnapshot,
} from '../types/finance';
import { formatINR } from '../utils/formatters';

export type WorkspaceTab = 'overview' | 'cashflows' | 'upload' | 'fees' | 'audit';

interface SidebarControlsProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  cashflowCount: number;
  valuation: ValuationSnapshot;
  onUpdateValuation: (patch: Partial<ValuationSnapshot>) => void;
  feeConfig: FeeConfig;
  onUpdateFeeConfig: (patch: Partial<FeeConfig>) => void;
  onLoadSample: () => void;
  onClearAll: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const FEE_PRESETS = [1.0, 1.5, 2.0, 2.5];

export function SidebarControls({
  activeTab,
  onSelectTab,
  cashflowCount,
  valuation,
  onUpdateValuation,
  feeConfig,
  onUpdateFeeConfig,
  onLoadSample,
  onClearAll,
  isOpenMobile,
  onCloseMobile,
}: SidebarControlsProps) {
  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: typeof BarChart3;
    meta?: string;
  }> = [
    { id: 'overview', label: 'Overview & Growth', icon: BarChart3 },
    {
      id: 'cashflows',
      label: 'Cashflows Ledger',
      icon: Table2,
      meta: String(cashflowCount),
    },
    { id: 'upload', label: 'Excel Upload', icon: FileSpreadsheet },
    {
      id: 'fees',
      label: 'PM Fee Schedule',
      icon: Percent,
      meta: feeConfig.enabled ? `${feeConfig.annualRatePct}%` : 'Off',
    },
    { id: 'audit', label: 'Nifty 50 TRI Audit', icon: Calculator },
  ];

  const sidebarInner = (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 select-none">
      {/* Brand Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <span
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          XIRR Calculator
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Rail Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Primary Navigation */}
        <nav aria-label="Workspace sections" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-100 text-[#1E3A8A] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap truncate">{item.label}</span>
                </span>
                {item.meta !== undefined && (
                  <span className="font-tabular text-[11px] text-slate-400 shrink-0 ml-2">
                    {item.meta}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 pt-5 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 px-1">
            Closing Portfolio Valuation
          </h3>
          <div className="space-y-3 px-1">
            <div>
              <label
                htmlFor="sidebar-val-date"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Valuation Date
              </label>
              <input
                id="sidebar-val-date"
                type="date"
                value={valuation.date}
                onChange={(e) => onUpdateValuation({ date: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs font-tabular bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label
                htmlFor="sidebar-val-mv"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Portfolio Market Value (INR)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  ₹
                </span>
                <input
                  id="sidebar-val-mv"
                  type="number"
                  min={0}
                  step={50000}
                  value={valuation.marketValue === 0 ? '' : valuation.marketValue}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : Number(e.target.value);
                    onUpdateValuation({
                      marketValue: Number.isFinite(v) ? Math.max(0, v) : 0,
                    });
                  }}
                  className="w-full pl-6 pr-2.5 py-1.5 text-xs font-tabular text-right bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
              <div className="mt-1 text-[11px] font-tabular text-slate-500 text-right">
                {formatINR(valuation.marketValue)}
              </div>
            </div>
          </div>
        </div>

        {/* PM Beginning-of-Year Management Fee Engine */}
        <div className="border-t border-slate-200 pt-5 space-y-3.5 px-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-900">
              PM Annual Fee
            </h3>
            <button
              type="button"
              role="switch"
              aria-checked={feeConfig.enabled}
              onClick={() => onUpdateFeeConfig({ enabled: !feeConfig.enabled })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                feeConfig.enabled ? 'bg-[#1E3A8A]' : 'bg-slate-300'
              }`}
            >
              <span className="sr-only">Toggle PM annual management fee</span>
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  feeConfig.enabled ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Fee charged by portfolio manager on market value at the beginning of each year.
          </p>

          <div className={feeConfig.enabled ? 'space-y-3' : 'space-y-3 opacity-50 pointer-events-none'}>
            <div>
              <label
                htmlFor="sidebar-fee-rate"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Annual Fee Rate (% of Opening MV)
              </label>
              <div className="relative">
                <input
                  id="sidebar-fee-rate"
                  type="number"
                  min={0}
                  max={15}
                  step={0.1}
                  value={feeConfig.annualRatePct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onUpdateFeeConfig({
                      annualRatePct: Number.isFinite(v) ? Math.max(0, Math.min(15, v)) : 0,
                    });
                  }}
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs font-tabular bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  %
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {FEE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateFeeConfig({ annualRatePct: preset, enabled: true })}
                    className={`py-1 text-[11px] font-tabular rounded border transition-colors cursor-pointer ${
                      Math.abs(feeConfig.annualRatePct - preset) < 0.001
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="sidebar-fee-cycle"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Beginning-of-Year Cycle
              </label>
              <select
                id="sidebar-fee-cycle"
                value={feeConfig.cycle}
                onChange={(e) =>
                  onUpdateFeeConfig({ cycle: e.target.value as FeeBillingCycle })
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
              >
                <option value="fy_apr">Financial Year (1 Apr)</option>
                <option value="cal_jan">Calendar Year (1 Jan)</option>
                <option value="anniversary">Investment Anniversary</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sidebar-fee-mode"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                IRR Fee Treatment
              </label>
              <select
                id="sidebar-fee-mode"
                value={feeConfig.mode}
                onChange={(e) =>
                  onUpdateFeeConfig({ mode: e.target.value as FeeTreatmentMode })
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
              >
                <option value="corpus_deducted">Deducted from Portfolio Corpus</option>
                <option value="out_of_pocket">Paid Out-of-Pocket (Cashflow)</option>
              </select>
            </div>

            <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={feeConfig.chargeOnInitialDay}
                onChange={(e) =>
                  onUpdateFeeConfig({ chargeOnInitialDay: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <span>Include Year-1 opening fee on initial investment date</span>
            </label>
          </div>
        </div>
      </div>

      {/* Sidebar Bottom Data Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Sample PMS
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-[#B91C1C] hover:bg-red-50 rounded transition-colors whitespace-nowrap cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          Clear All
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Rail */}
      <aside className="hidden lg:block w-[272px] shrink-0 h-screen sticky top-0">
        {sidebarInner}
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-[288px] max-w-[85vw] h-full z-10 shadow-xl">
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  );
}
