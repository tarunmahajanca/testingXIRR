import { ArrowUpDown, FileSpreadsheet, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  CalculationResult,
  CashflowEntry,
  CashflowType,
  ValuationSnapshot,
} from '../types/finance';
import { formatDisplayDate, formatINR } from '../utils/formatters';

interface CashflowLedgerProps {
  cashflows: CashflowEntry[];
  valuation: ValuationSnapshot;
  result: CalculationResult;
  onAddRow: () => void;
  onUpdateRow: (id: string, patch: Partial<CashflowEntry>) => void;
  onDeleteRow: (id: string) => void;
  onSortByDate: () => void;
  onUpdateValuation: (patch: Partial<ValuationSnapshot>) => void;
  onOpenUpload: () => void;
  onLoadSample: () => void;
}

export function CashflowLedger({
  cashflows,
  valuation,
  result,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onSortByDate,
  onUpdateValuation,
  onOpenUpload,
  onLoadSample,
}: CashflowLedgerProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | CashflowType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const issueByRow = useMemo(() => {
    const map = new Map<string, string>();
    for (const iss of result.issues) {
      if (iss.rowId && !map.has(iss.rowId)) {
        map.set(iss.rowId, iss.message);
      }
    }
    return map;
  }, [result.issues]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cashflows.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) return false;
      if (!q) return true;
      return (
        row.date.toLowerCase().includes(q) ||
        (row.note ?? '').toLowerCase().includes(q) ||
        String(row.amount).includes(q)
      );
    });
  }, [cashflows, typeFilter, searchQuery]);

  if (cashflows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          No cashflow entries recorded
        </h2>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
          Add the dates and amounts you transferred to (or withdrew from) your portfolio manager manually, or upload an Excel statement directly.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add First Cashflow
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            Upload Excel File
          </button>
          <button
            type="button"
            onClick={onLoadSample}
            className="px-4 py-2 text-sm font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Load Sample PMS Scenario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Manual Cashflow Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter every capital transfer to your portfolio manager and any withdrawals received. All figures update XIRR and Nifty 50 TRI live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented filter */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'investment', label: 'Investments' },
                { id: 'withdrawal', label: 'Withdrawals' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  typeFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter date or note..."
              aria-label="Filter cashflow rows"
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A8A] w-44"
            />
          </div>

          <button
            type="button"
            onClick={onSortByDate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
            Sort by Date
          </button>

          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add Cashflow
          </button>
        </div>
      </div>

      {/* Editable Ledger Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
              <th className="text-left py-2.5 pl-6 pr-3 w-10">#</th>
              <th className="text-left py-2.5 px-3 w-44">Transaction Date</th>
              <th className="text-left py-2.5 px-3 w-52">Cashflow Direction</th>
              <th className="text-right py-2.5 px-3 w-48">Amount (INR)</th>
              <th className="text-left py-2.5 px-3">Remarks / Tranche</th>
              <th className="text-right py-2.5 pl-3 pr-6 w-14">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row, idx) => {
              const rowError = issueByRow.get(row.id);
              return (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    rowError ? 'bg-red-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="py-2 pl-6 pr-3 text-xs font-tabular text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => onUpdateRow(row.id, { date: e.target.value })}
                      aria-label={`Transaction date row ${idx + 1}`}
                      className={`w-full px-2.5 py-1.5 text-xs font-tabular bg-white border rounded focus:outline-none focus:border-[#1E3A8A] ${
                        rowError ? 'border-red-400' : 'border-slate-200'
                      }`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <div className="inline-flex p-0.5 bg-slate-100 rounded border border-slate-200 w-full">
                      <button
                        type="button"
                        onClick={() => onUpdateRow(row.id, { type: 'investment' })}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          row.type === 'investment'
                            ? 'bg-white text-[#1E3A8A] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Investment
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateRow(row.id, { type: 'withdrawal' })}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          row.type === 'withdrawal'
                            ? 'bg-white text-[#B45309] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Withdrawal
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={row.amount === 0 ? '' : row.amount}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : Number(e.target.value);
                          onUpdateRow(row.id, { amount: Number.isFinite(v) ? Math.max(0, v) : 0 });
                        }}
                        aria-label={`Amount in INR row ${idx + 1}`}
                        className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-tabular text-right bg-white border rounded focus:outline-none focus:border-[#1E3A8A] ${
                          rowError ? 'border-red-400' : 'border-slate-200'
                        }`}
                      />
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.note ?? ''}
                      onChange={(e) => onUpdateRow(row.id, { note: e.target.value })}
                      placeholder="Optional note..."
                      aria-label={`Remarks row ${idx + 1}`}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-[#1E3A8A] placeholder:text-slate-400"
                    />
                    {rowError && (
                      <p className="text-[11px] text-[#B91C1C] mt-1">{rowError}</p>
                    )}
                  </td>
                  <td className="py-2 pl-3 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteRow(row.id)}
                      aria-label={`Delete cashflow row ${idx + 1}`}
                      className="p-1.5 text-slate-400 hover:text-[#B91C1C] rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Anchored Terminal Valuation Row */}
            <tr className="bg-slate-50/90 border-t-2 border-slate-200">
              <td className="py-3 pl-6 pr-3 text-xs font-medium text-slate-500">End</td>
              <td className="py-3 px-3">
                <input
                  type="date"
                  value={valuation.date}
                  onChange={(e) => onUpdateValuation({ date: e.target.value })}
                  aria-label="Closing valuation date"
                  className="w-full px-2.5 py-1.5 text-xs font-tabular bg-white border border-slate-300 rounded font-medium focus:outline-none focus:border-[#1E3A8A]"
                />
              </td>
              <td className="py-3 px-3">
                <span className="text-xs font-semibold text-slate-900">
                  Closing Portfolio Market Value
                </span>
              </td>
              <td className="py-3 px-3">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={valuation.marketValue === 0 ? '' : valuation.marketValue}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value);
                      onUpdateValuation({
                        marketValue: Number.isFinite(v) ? Math.max(0, v) : 0,
                      });
                    }}
                    aria-label="Closing portfolio market value"
                    className="w-full pl-6 pr-2.5 py-1.5 text-xs font-tabular text-right font-semibold bg-white border border-slate-300 rounded focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>
              </td>
              <td colSpan={2} className="py-3 pl-3 pr-6 text-xs text-slate-500">
                Valuation as of{' '}
                <span className="font-tabular text-slate-700 font-medium">
                  {formatDisplayDate(valuation.date)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>
            Rows: <strong className="font-tabular text-slate-900">{cashflows.length}</strong>
          </span>
          <span>
            Total Invested:{' '}
            <strong className="font-tabular text-slate-900">
              {formatINR(result.totalInvested)}
            </strong>
          </span>
          <span>
            Total Withdrawn:{' '}
            <strong className="font-tabular text-slate-900">
              {formatINR(result.totalWithdrawn)}
            </strong>
          </span>
          <span>
            Net Deployed:{' '}
            <strong className="font-tabular text-slate-900">
              {formatINR(result.netCapitalInvested)}
            </strong>
          </span>
        </div>
        <button
          type="button"
          onClick={onAddRow}
          className="text-xs font-medium text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
        >
          + Add another transaction row
        </button>
      </div>
    </div>
  );
}
