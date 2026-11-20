import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type * as XLSX from 'xlsx';
import type {
  CashflowEntry,
  ColumnMapping,
  ParsedExcelSheet,
  ValuationSnapshot,
} from '../types/finance';
import {
  applyColumnMapping,
  downloadSampleTemplate,
  extractSheetData,
  parseExcelFile,
} from '../utils/excelHelper';
import { formatDisplayDate, formatINR } from '../utils/formatters';

interface ExcelUploadPanelProps {
  onImportConfirm: (
    cashflows: CashflowEntry[],
    detectedValuation: ValuationSnapshot | null,
    mode: 'replace' | 'append'
  ) => void;
}

export function ExcelUploadPanel({ onImportConfirm }: ExcelUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [parsed, setParsed] = useState<ParsedExcelSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);

  const handleFile = async (file: File) => {
    setParseError(null);
    try {
      const { workbook: wb, parsed: p } = await parseExcelFile(file);
      if (p.headers.length === 0 || p.rawRows.length === 0) {
        setParseError(
          'No tabular rows were detected in this sheet. Verify the file has a header row and transaction rows.'
        );
        return;
      }
      setWorkbook(wb);
      setParsed(p);
      setMapping(p.suggestedMapping);
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : 'Could not read the uploaded spreadsheet. Please use .xlsx, .xls, or .csv.'
      );
    }
  };

  const handleSheetSwitch = (sheetName: string) => {
    if (!workbook || !parsed) return;
    const next = extractSheetData(workbook, parsed.fileName, sheetName);
    setParsed(next);
    setMapping(next.suggestedMapping);
  };

  const previewResult = useMemo(() => {
    if (!parsed || !mapping) return null;
    return applyColumnMapping(parsed.rawRows, mapping);
  }, [parsed, mapping]);

  const handleResetUploader = () => {
    setWorkbook(null);
    setParsed(null);
    setMapping(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header & Template Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Excel & CSV Cashflow Importer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload any PMS statement, broker cashflow ledger, or Excel XIRR sheet. Columns are auto-detected and can be remapped before importing.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Download Sample Template (.xlsx)
          </button>
        </div>

        {/* Dropzone when no file active */}
        {!parsed && (
          <div className="mt-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                isDragging
                  ? 'border-[#1E3A8A] bg-blue-50/40'
                  : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
              }`}
            >
              <FileSpreadsheet
                className="w-9 h-9 text-slate-400 mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-900">
                Drop your Excel (.xlsx, .xls) or CSV cashflow file here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports DD/MM/YYYY, DD-MMM-YYYY, YYYY-MM-DD, Excel date serials, and Indian Rupee formatting. All parsing stays locally in your browser.
              </p>
              <div className="mt-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  Select Spreadsheet File
                </button>
              </div>
            </div>

            {parseError && (
              <div className="mt-4 p-3.5 rounded-md bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#B91C1C]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* Interactive Column Mapper */}
        {parsed && mapping && previewResult && (
          <div className="mt-5 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700">
                <span className="font-semibold text-slate-900">{parsed.fileName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-tabular">{parsed.rawRows.length} rows detected</span>
                {parsed.sheetNames.length > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <label className="inline-flex items-center gap-1.5">
                      <span>Worksheet:</span>
                      <select
                        value={parsed.activeSheet}
                        onChange={(e) => handleSheetSwitch(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                      >
                        {parsed.sheetNames.map((sn) => (
                          <option key={sn} value={sn}>
                            {sn}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleResetUploader}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Choose Another File
              </button>
            </div>

            {/* Mapping Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Date Column *
                </label>
                <select
                  value={mapping.dateCol}
                  onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="">-- Select column --</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Amount Column (INR) *
                </label>
                <select
                  value={mapping.amountCol}
                  onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="">-- Select column --</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Transaction Type Column
                </label>
                <select
                  value={mapping.typeCol}
                  onChange={(e) => setMapping({ ...mapping, typeCol: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="">None (infer from +/- sign)</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Remarks / Notes Column
                </label>
                <select
                  value={mapping.noteCol}
                  onChange={(e) => setMapping({ ...mapping, noteCol: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="">None</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parsing Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Sign Convention (when Type is absent)
                </label>
                <select
                  value={mapping.signConvention}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      signConvention: e.target.value as ColumnMapping['signConvention'],
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="auto">Auto-detect from column signs</option>
                  <option value="positive_investment">Positive (+) = Investment, Negative (−) = Withdrawal</option>
                  <option value="negative_investment">Negative (−) = Investment (Excel XIRR style)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Date Format Preference
                </label>
                <select
                  value={mapping.dateFormatHint}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      dateFormatHint: e.target.value as ColumnMapping['dateFormatHint'],
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="auto">Auto (Prefer DD/MM/YYYY)</option>
                  <option value="DMY">DD/MM/YYYY (Indian Standard)</option>
                  <option value="MDY">MM/DD/YYYY (US Format)</option>
                  <option value="YMD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>

              <div className="flex items-end pb-1.5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={mapping.extractLastRowAsValuation}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        extractLastRowAsValuation: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                  />
                  Treat final row as Closing Portfolio Valuation
                </label>
              </div>
            </div>

            {/* Mapping Status Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-[#15803D] font-medium">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span className="font-tabular">{previewResult.cashflows.length}</span> cashflows ready
                </span>
                {previewResult.detectedValuation && (
                  <span className="text-slate-700">
                    Closing Valuation detected:{' '}
                    <strong className="font-tabular text-slate-900">
                      {formatINR(previewResult.detectedValuation.marketValue)}
                    </strong>{' '}
                    on{' '}
                    <span className="font-tabular">
                      {formatDisplayDate(previewResult.detectedValuation.date)}
                    </span>
                  </span>
                )}
                {previewResult.errorCount > 0 && (
                  <span className="text-[#B45309] font-medium">
                    {previewResult.errorCount} row(s) skipped due to parsing errors
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={previewResult.cashflows.length === 0}
                  onClick={() =>
                    onImportConfirm(
                      previewResult.cashflows,
                      previewResult.detectedValuation,
                      'append'
                    )
                  }
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Append to Ledger
                </button>
                <button
                  type="button"
                  disabled={previewResult.cashflows.length === 0}
                  onClick={() =>
                    onImportConfirm(
                      previewResult.cashflows,
                      previewResult.detectedValuation,
                      'replace'
                    )
                  }
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E40AF] disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Replace Ledger & Calculate
                </button>
              </div>
            </div>

            {/* Live Validation Preview Table */}
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600 flex items-center justify-between">
                <span>Parsed Preview (showing first {Math.min(12, previewResult.previews.length)} of {previewResult.previews.length} rows)</span>
                <span className="text-slate-400">Verify dates & direction before importing</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500">
                      <th className="text-left py-2 px-3">Row</th>
                      <th className="text-left py-2 px-3">Parsed Date</th>
                      <th className="text-left py-2 px-3">Classified Type</th>
                      <th className="text-right py-2 px-3">Amount (INR)</th>
                      <th className="text-left py-2 px-3">Remarks</th>
                      <th className="text-left py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.previews.slice(0, 12).map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.error ? 'bg-red-50/40' : 'bg-white'}
                      >
                        <td className="py-2 px-3 font-tabular text-slate-400">
                          {row.rowIndex}
                        </td>
                        <td className="py-2 px-3 font-tabular text-slate-900">
                          {row.parsedDate ? formatDisplayDate(row.parsedDate) : row.rawDate || '—'}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          {row.type === 'valuation' ? (
                            <span className="text-[#1E3A8A]">Closing Valuation</span>
                          ) : row.type === 'withdrawal' ? (
                            <span className="text-[#B45309]">Withdrawal</span>
                          ) : (
                            <span className="text-slate-800">Investment</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-tabular text-slate-900">
                          {row.parsedAmount !== null
                            ? formatINR(row.parsedAmount)
                            : row.rawAmount || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate">
                          {row.note || '—'}
                        </td>
                        <td className="py-2 px-3">
                          {row.error ? (
                            <span className="text-[#B91C1C] font-medium">{row.error}</span>
                          ) : (
                            <span className="text-[#15803D]">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
