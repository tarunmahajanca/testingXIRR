import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Menu,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CashflowLedger } from './components/CashflowLedger';
import { ExcelUploadPanel } from './components/ExcelUploadPanel';
import { FeeSchedulePanel } from './components/FeeSchedulePanel';
import { KpiSummaryStrip } from './components/KpiSummaryStrip';
import { NiftyAuditPanel } from './components/NiftyAuditPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { SidebarControls, type WorkspaceTab } from './components/SidebarControls';
import {
  SAMPLE_CASHFLOWS,
  SAMPLE_VALUATION,
} from './data/niftyTriFallback';
import type {
  CashflowEntry,
  FeeConfig,
  NiftyTriDataset,
  ValuationSnapshot,
} from './types/finance';
import { exportAuditReport } from './utils/excelHelper';
import {
  createEmbeddedNiftyDataset,
  loadNiftyTriDataset,
} from './utils/niftyClient';
import { computeBenchmarkAnalysis } from './utils/xirrEngine';

const TAB_TITLES: Record<WorkspaceTab, string> = {
  overview: 'Overview & Growth',
  cashflows: 'Cashflows Ledger',
  upload: 'Excel Upload',
  fees: 'PM Fee Schedule',
  audit: 'Nifty 50 TRI Audit',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [cashflows, setCashflows] = useState<CashflowEntry[]>(SAMPLE_CASHFLOWS);
  const [valuation, setValuation] = useState<ValuationSnapshot>(SAMPLE_VALUATION);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({
    enabled: true,
    annualRatePct: 2.0,
    cycle: 'fy_apr',
    mode: 'corpus_deducted',
    chargeOnInitialDay: true,
    valueOverrides: {},
  });

  const [niftyDataset, setNiftyDataset] = useState<NiftyTriDataset>(() =>
    createEmbeddedNiftyDataset()
  );
  const [isLoadingNifty, setIsLoadingNifty] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchNiftyTri = useCallback(
    async (forceRefresh = false) => {
      setIsLoadingNifty(true);
      try {
        const { dataset, usedLive } = await loadNiftyTriDataset(forceRefresh);
        setNiftyDataset(dataset);
        if (forceRefresh) {
          showToast(
            usedLive
              ? `Refreshed benchmark: ${dataset.sourceLabel}`
              : 'Live Nifty endpoint unreachable — using built-in historical TRI dataset.'
          );
        }
      } finally {
        setIsLoadingNifty(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void fetchNiftyTri(false);
  }, [fetchNiftyTri]);

  // Memoized core finance calculation
  const result = useMemo(
    () => computeBenchmarkAnalysis(cashflows, valuation, niftyDataset, feeConfig),
    [cashflows, valuation, niftyDataset, feeConfig]
  );

  // Handlers
  const handleAddRow = () => {
    const lastDate =
      cashflows.length > 0
        ? cashflows[cashflows.length - 1].date
        : '2024-01-15';
    const newRow: CashflowEntry = {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: lastDate <= valuation.date ? lastDate : valuation.date,
      type: 'investment',
      amount: 500000,
      note: '',
    };
    setCashflows((prev) => [...prev, newRow]);
  };

  const handleUpdateRow = (id: string, patch: Partial<CashflowEntry>) => {
    setCashflows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleDeleteRow = (id: string) => {
    setCashflows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSortByDate = () => {
    setCashflows((prev) =>
      [...prev].sort((a, b) => a.date.localeCompare(b.date))
    );
    showToast('Sorted cashflows chronologically.');
  };

  const handleUpdateValuation = (patch: Partial<ValuationSnapshot>) => {
    setValuation((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateFeeConfig = (patch: Partial<FeeConfig>) => {
    setFeeConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleSetFeeOverride = (feeDate: string, value: number | null) => {
    setFeeConfig((prev) => {
      const nextOverrides = { ...prev.valueOverrides };
      if (value === null) {
        delete nextOverrides[feeDate];
      } else {
        nextOverrides[feeDate] = value;
      }
      return { ...prev, valueOverrides: nextOverrides };
    });
  };

  const handleClearFeeOverrides = () => {
    setFeeConfig((prev) => ({ ...prev, valueOverrides: {} }));
    showToast('Reverted opening market values to XIRR-implied estimates.');
  };

  const handleImportConfirm = (
    importedFlows: CashflowEntry[],
    detectedVal: ValuationSnapshot | null,
    mode: 'replace' | 'append'
  ) => {
    setCashflows((prev) =>
      mode === 'replace' ? importedFlows : [...prev, ...importedFlows]
    );
    if (detectedVal) {
      setValuation(detectedVal);
    }
    setFeeConfig((prev) => ({ ...prev, valueOverrides: {} }));
    setActiveTab('overview');
    showToast(
      `Imported ${importedFlows.length} cashflow${importedFlows.length === 1 ? '' : 's'}${
        detectedVal ? ' and closing valuation' : ''
      }.`
    );
  };

  const handleLoadSample = () => {
    setCashflows(SAMPLE_CASHFLOWS);
    setValuation(SAMPLE_VALUATION);
    setFeeConfig({
      enabled: true,
      annualRatePct: 2.0,
      cycle: 'fy_apr',
      mode: 'corpus_deducted',
      chargeOnInitialDay: true,
      valueOverrides: {},
    });
    setActiveTab('overview');
    showToast('Loaded sample multi-year Indian PMS portfolio.');
  };

  const handleClearAll = () => {
    setCashflows([]);
    setFeeConfig((prev) => ({ ...prev, valueOverrides: {} }));
    setActiveTab('cashflows');
    showToast('Cleared cashflow ledger.');
  };

  const handleExportReport = () => {
    if (cashflows.length === 0) {
      showToast('Add cashflows before exporting an audit report.');
      return;
    }
    exportAuditReport(valuation, feeConfig, result, niftyDataset);
    showToast('Downloaded Excel benchmark audit report.');
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      {/* Persistent Left Institutional Rail */}
      <SidebarControls
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        cashflowCount={cashflows.length}
        valuation={valuation}
        onUpdateValuation={handleUpdateValuation}
        feeConfig={feeConfig}
        onUpdateFeeConfig={handleUpdateFeeConfig}
        onLoadSample={handleLoadSample}
        onClearAll={handleClearAll}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract (Breadcrumbs Left · Primary Actions Right) */}
        <header className="h-14 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation and fee controls"
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                XIRR Calculator
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate whitespace-nowrap">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>

            <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500 pl-3 border-l border-slate-200">
              <span className="whitespace-nowrap">{niftyDataset.sourceLabel}</span>
              <button
                type="button"
                disabled={isLoadingNifty}
                onClick={() => void fetchNiftyTri(true)}
                title="Refresh live Nifty 50 TRI data"
                aria-label="Refresh live Nifty 50 TRI data"
                className="p-1 text-slate-400 hover:text-slate-800 rounded cursor-pointer disabled:opacity-40"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingNifty ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Upload Excel</span>
              <span className="sm:hidden">Upload</span>
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              disabled={cashflows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Export Audit (.xlsx)</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto space-y-6">
          {/* Validation Issues Banner (if any) */}
          {result.issues.length > 0 && cashflows.length > 0 && (
            <div
              role="alert"
              className="p-3.5 rounded-md bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#B91C1C]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <div className="font-semibold">
                  {result.issues.length} validation issue(s) need attention
                </div>
                <div>{result.issues[0].message}</div>
              </div>
            </div>
          )}

          {/* Persistent KPI Verdict Strip (when portfolio has cashflows) */}
          {cashflows.length > 0 && (
            <KpiSummaryStrip
              result={result}
              valuation={valuation}
              feeConfig={feeConfig}
            />
          )}

          {/* Active View */}
          {activeTab === 'overview' &&
            (cashflows.length === 0 ? (
              <CashflowLedger
                cashflows={cashflows}
                valuation={valuation}
                result={result}
                onAddRow={handleAddRow}
                onUpdateRow={handleUpdateRow}
                onDeleteRow={handleDeleteRow}
                onSortByDate={handleSortByDate}
                onUpdateValuation={handleUpdateValuation}
                onOpenUpload={() => setActiveTab('upload')}
                onLoadSample={handleLoadSample}
              />
            ) : (
              <OverviewPanel
                result={result}
                valuation={valuation}
                feeConfig={feeConfig}
                niftyDataset={niftyDataset}
                onNavigateTab={setActiveTab}
              />
            ))}

          {activeTab === 'cashflows' && (
            <CashflowLedger
              cashflows={cashflows}
              valuation={valuation}
              result={result}
              onAddRow={handleAddRow}
              onUpdateRow={handleUpdateRow}
              onDeleteRow={handleDeleteRow}
              onSortByDate={handleSortByDate}
              onUpdateValuation={handleUpdateValuation}
              onOpenUpload={() => setActiveTab('upload')}
              onLoadSample={handleLoadSample}
            />
          )}

          {activeTab === 'upload' && (
            <ExcelUploadPanel onImportConfirm={handleImportConfirm} />
          )}

          {activeTab === 'fees' && (
            <FeeSchedulePanel
              cashflows={cashflows}
              valuation={valuation}
              niftyDataset={niftyDataset}
              feeConfig={feeConfig}
              result={result}
              onUpdateFeeConfig={handleUpdateFeeConfig}
              onSetOverride={handleSetFeeOverride}
              onClearAllOverrides={handleClearFeeOverrides}
            />
          )}

          {activeTab === 'audit' && (
            <NiftyAuditPanel
              result={result}
              valuation={valuation}
              niftyDataset={niftyDataset}
              isLoadingNifty={isLoadingNifty}
              onRefreshNifty={() => void fetchNiftyTri(true)}
            />
          )}
        </main>
      </div>

      {/* Non-blocking Confirmation Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-md shadow-lg text-xs font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
