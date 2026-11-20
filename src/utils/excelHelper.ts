import * as XLSX from 'xlsx';
import type {
  CalculationResult,
  CashflowEntry,
  CashflowType,
  ColumnMapping,
  FeeConfig,
  NiftyTriDataset,
  ParsedExcelSheet,
  ValuationSnapshot,
} from '../types/finance';
import { formatDisplayDate } from './formatters';

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseFlexibleDate(
  raw: unknown,
  hint: 'auto' | 'DMY' | 'MDY' | 'YMD' = 'auto'
): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Excel serial number (e.g. 44682)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return toIso(parsed.y, parsed.m, parsed.d);
    }
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toIso(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Numeric string representing Excel serial
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    if (serial > 20000 && serial < 80000) {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return toIso(parsed.y, parsed.m, parsed.d);
      }
    }
  }

  // ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return toIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // DD-MMM-YYYY or DD MMM YYYY (common in Indian PMS statements e.g. 15-Apr-2022)
  const dMonY = str.match(/^(\d{1,2})[\s-/]+([A-Za-z]{3,9})[\s,-/]+(\d{2,4})$/);
  if (dMonY) {
    const mon = MONTH_NAME_MAP[dMonY[2].toLowerCase()];
    if (mon) {
      return toIso(Number(dMonY[3]), mon, Number(dMonY[1]));
    }
  }

  // MMM DD, YYYY
  const monDY = str.match(/^([A-Za-z]{3,9})[\s-]+(\d{1,2})[\s,-]+(\d{2,4})$/);
  if (monDY) {
    const mon = MONTH_NAME_MAP[monDY[1].toLowerCase()];
    if (mon) {
      return toIso(Number(monDY[3]), mon, Number(monDY[2]));
    }
  }

  // Numeric DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    if (hint === 'MDY') return toIso(y, a, b);
    if (hint === 'DMY') return toIso(y, b, a);
    // Auto: prefer Indian DMY unless a <= 12 && b > 12
    if (a <= 12 && b > 12) return toIso(y, a, b);
    return toIso(y, b, a);
  }

  return null;
}

export function parseFlexibleAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (raw === null || raw === undefined) return null;
  let str = String(raw).trim();
  if (!str) return null;

  let isNeg = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNeg = true;
    str = str.slice(1, -1);
  }
  str = str.replace(/[₹$,\s]/g, '').replace(/^INR/i, '').replace(/^Rs\.?/i, '');
  if (str.startsWith('−')) {
    isNeg = true;
    str = str.slice(1);
  }
  const num = Number(str);
  if (!Number.isFinite(num)) return null;
  return isNeg ? -Math.abs(num) : num;
}

function scoreHeader(header: string, patterns: RegExp[]): number {
  const h = header.trim().toLowerCase();
  let score = 0;
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(h)) {
      score += patterns.length - i + 1;
    }
  }
  return score;
}

export function detectColumnMapping(
  headers: string[],
  rows: Record<string, unknown>[]
): ColumnMapping {
  let dateCol = '';
  let amountCol = '';
  let typeCol = '';
  let noteCol = '';

  const datePatterns = [/^date$/, /txn.*date|trans.*date|value.*date/, /date|day|dt/];
  const amountPatterns = [
    /^amount$/,
    /cash\s*flow|cashflow|inflow|value|corpus|principal/,
    /amt|inr|rs|rupee/,
  ];
  const typePatterns = [/^type$/, /txn.*type|trans.*type|action|direction|dr.?cr|nature|flow/];
  const notePatterns = [/^note|remark|narration|description|particular|comment|memo/];

  let bestDate = 0;
  let bestAmt = 0;
  let bestType = 0;
  let bestNote = 0;

  for (const h of headers) {
    const ds = scoreHeader(h, datePatterns);
    if (ds > bestDate) {
      bestDate = ds;
      dateCol = h;
    }
    const as = scoreHeader(h, amountPatterns);
    if (as > bestAmt) {
      bestAmt = as;
      amountCol = h;
    }
    const ts = scoreHeader(h, typePatterns);
    if (ts > bestType) {
      bestType = ts;
      typeCol = h;
    }
    const ns = scoreHeader(h, notePatterns);
    if (ns > bestNote) {
      bestNote = ns;
      noteCol = h;
    }
  }

  // Fallback by inspecting sample values if headers are generic
  const sample = rows.slice(0, 12);
  if (!dateCol) {
    for (const h of headers) {
      const validDates = sample.filter((r) => parseFlexibleDate(r[h]) !== null).length;
      if (validDates >= Math.max(1, Math.floor(sample.length * 0.5))) {
        dateCol = h;
        break;
      }
    }
  }
  if (!amountCol) {
    for (const h of headers) {
      if (h === dateCol) continue;
      const validNums = sample.filter((r) => parseFlexibleAmount(r[h]) !== null).length;
      if (validNums >= Math.max(1, Math.floor(sample.length * 0.5))) {
        amountCol = h;
        break;
      }
    }
  }

  // Detect sign convention and whether last row looks like a Market Valuation row
  let negCount = 0;
  let posCount = 0;
  if (amountCol) {
    for (const r of rows) {
      const n = parseFlexibleAmount(r[amountCol]);
      if (n !== null) {
        if (n < 0) negCount++;
        else if (n > 0) posCount++;
      }
    }
  }

  let extractLastRowAsValuation = false;
  if (rows.length >= 2) {
    const lastRow = rows[rows.length - 1];
    const lastText = [
      typeCol ? String(lastRow[typeCol] ?? '') : '',
      noteCol ? String(lastRow[noteCol] ?? '') : '',
      ...Object.values(lastRow).map((v) => String(v ?? '')),
    ]
      .join(' ')
      .toLowerCase();
    if (/market\s*value|current\s*value|valuation|closing\s*value|ending\s*value|portfolio\s*value/.test(lastText)) {
      extractLastRowAsValuation = true;
    }
  }

  const signConvention =
    negCount > 0 && posCount > 0 && !typeCol
      ? negCount >= posCount
        ? 'negative_investment'
        : 'auto'
      : 'auto';

  return {
    dateCol,
    amountCol,
    typeCol,
    noteCol,
    signConvention,
    dateFormatHint: 'auto',
    extractLastRowAsValuation,
  };
}

export async function parseExcelFile(
  file: File,
  preferredSheet?: string
): Promise<{ workbook: XLSX.WorkBook; parsed: ParsedExcelSheet }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('The uploaded file contains no readable worksheets.');
  }
  const activeSheet =
    preferredSheet && sheetNames.includes(preferredSheet)
      ? preferredSheet
      : sheetNames[0];

  const parsed = extractSheetData(workbook, file.name, activeSheet);
  return { workbook, parsed };
}

export function extractSheetData(
  workbook: XLSX.WorkBook,
  fileName: string,
  sheetName: string
): ParsedExcelSheet {
  const sheet = workbook.Sheets[sheetName];
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawMatrix.length < 2) {
    return {
      fileName,
      sheetNames: workbook.SheetNames,
      activeSheet: sheetName,
      headers: [],
      rawRows: [],
      suggestedMapping: {
        dateCol: '',
        amountCol: '',
        typeCol: '',
        noteCol: '',
        signConvention: 'auto',
        dateFormatHint: 'auto',
        extractLastRowAsValuation: false,
      },
    };
  }

  // Locate header row (first row with >= 2 non-empty cells)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
    const nonEmpty = rawMatrix[i].filter((c) => String(c ?? '').trim() !== '').length;
    if (nonEmpty >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const rawHeaders = rawMatrix[headerRowIdx].map((cell, idx) => {
    const label = String(cell ?? '').trim();
    return label || `Column ${idx + 1}`;
  });

  // Ensure unique header names
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });

  const rawRows: Record<string, unknown>[] = [];
  for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
    const arr = rawMatrix[r];
    const hasAny = arr.some((c) => String(c ?? '').trim() !== '');
    if (!hasAny) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = arr[c] ?? '';
    }
    rawRows.push(obj);
  }

  const suggestedMapping = detectColumnMapping(headers, rawRows);

  return {
    fileName,
    sheetNames: workbook.SheetNames,
    activeSheet: sheetName,
    headers,
    rawRows,
    suggestedMapping,
  };
}

export interface MappedRowPreview {
  rowIndex: number;
  rawDate: string;
  parsedDate: string | null;
  rawAmount: string;
  parsedAmount: number | null;
  type: CashflowType | 'valuation';
  note: string;
  error?: string;
}

export interface MappingApplicationResult {
  cashflows: CashflowEntry[];
  detectedValuation: ValuationSnapshot | null;
  previews: MappedRowPreview[];
  validCount: number;
  errorCount: number;
}

function classifyRowType(
  rawTypeStr: string,
  signedAmt: number,
  signConvention: ColumnMapping['signConvention']
): CashflowType | 'valuation' {
  const t = rawTypeStr.trim().toLowerCase();
  if (/market\s*value|current\s*value|valuation|closing\s*value|ending\s*value|portfolio\s*value/.test(t)) {
    return 'valuation';
  }
  if (/withdraw|redemp|payout|credit|cr\b|sell|div|outflow\s*from\s*pm/.test(t)) {
    return 'withdrawal';
  }
  if (/invest|deposit|buy|inflow|add|top.?up|debit|dr\b|capital|corpus|sip|purchase/.test(t)) {
    return 'investment';
  }

  if (signConvention === 'negative_investment') {
    return signedAmt < 0 ? 'investment' : 'withdrawal';
  }
  if (signConvention === 'positive_investment') {
    return signedAmt >= 0 ? 'investment' : 'withdrawal';
  }

  // Auto: if negative, treat as investment if Excel XIRR convention or withdrawal if mixed
  return signedAmt < 0 ? 'withdrawal' : 'investment';
}

export function applyColumnMapping(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping
): MappingApplicationResult {
  const cashflows: CashflowEntry[] = [];
  let detectedValuation: ValuationSnapshot | null = null;
  const previews: MappedRowPreview[] = [];
  let validCount = 0;
  let errorCount = 0;

  // In 'auto' mode with no typeCol, check if majority of amounts are negative (standard Excel XIRR sheet)
  let effectiveConvention = mapping.signConvention;
  if (effectiveConvention === 'auto' && !mapping.typeCol && mapping.amountCol) {
    let negs = 0;
    let poss = 0;
    for (const r of rawRows) {
      const a = parseFlexibleAmount(r[mapping.amountCol]);
      if (a !== null) {
        if (a < 0) negs++;
        else if (a > 0) poss++;
      }
    }
    if (negs > poss) {
      effectiveConvention = 'negative_investment';
    } else {
      effectiveConvention = 'positive_investment';
    }
  }

  rawRows.forEach((row, idx) => {
    const rawDate = mapping.dateCol ? row[mapping.dateCol] : '';
    const rawAmount = mapping.amountCol ? row[mapping.amountCol] : '';
    const rawType = mapping.typeCol ? String(row[mapping.typeCol] ?? '') : '';
    const rawNote = mapping.noteCol ? String(row[mapping.noteCol] ?? '').trim() : '';

    const parsedDate = parseFlexibleDate(rawDate, mapping.dateFormatHint);
    const parsedAmount = parseFlexibleAmount(rawAmount);

    const isLast = idx === rawRows.length - 1;
    let kind: CashflowType | 'valuation' = classifyRowType(
      `${rawType} ${rawNote}`,
      parsedAmount ?? 0,
      effectiveConvention
    );

    if (isLast && mapping.extractLastRowAsValuation) {
      kind = 'valuation';
    }

    let error: string | undefined;
    if (!parsedDate) {
      error = 'Unrecognized date';
    } else if (parsedAmount === null || parsedAmount === 0) {
      error = 'Invalid or zero amount';
    }

    const absAmt = parsedAmount !== null ? Math.abs(parsedAmount) : null;

    previews.push({
      rowIndex: idx + 1,
      rawDate: String(rawDate ?? ''),
      parsedDate,
      rawAmount: String(rawAmount ?? ''),
      parsedAmount: absAmt,
      type: kind,
      note: rawNote,
      error,
    });

    if (error || !parsedDate || absAmt === null) {
      errorCount++;
      return;
    }

    validCount++;
    if (kind === 'valuation') {
      detectedValuation = {
        date: parsedDate,
        marketValue: absAmt,
      };
    } else {
      cashflows.push({
        id: `imp-${Date.now()}-${idx}`,
        date: parsedDate,
        type: kind,
        amount: absAmt,
        note: rawNote || undefined,
      });
    }
  });

  return {
    cashflows,
    detectedValuation,
    previews,
    validCount,
    errorCount,
  };
}

export function downloadSampleTemplate(): void {
  const wb = XLSX.utils.book_new();

  const sampleData = [
    ['Date', 'Type', 'Amount (INR)', 'Remarks'],
    ['2021-04-12', 'Investment', 2500000, 'Initial PMS Allocation'],
    ['2021-11-18', 'Investment', 1000000, 'Top-up Tranche 1'],
    ['2022-06-20', 'Investment', 1500000, 'Correction Deployment'],
    ['2023-03-15', 'Investment', 1000000, 'FY23 Addition'],
    ['2024-02-12', 'Withdrawal', 750000, 'Partial Withdrawal'],
    ['2024-11-05', 'Investment', 1250000, 'Q3 Top-up'],
    ['2026-03-31', 'Market Value', 13850000, 'Portfolio Closing Valuation'],
  ];

  const wsCashflows = XLSX.utils.aoa_to_sheet(sampleData);
  wsCashflows['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsCashflows, 'Cashflows');

  const instructionsData = [
    ['XIRR Calculator — Excel Upload Guide'],
    [''],
    ['Column', 'Description'],
    ['Date', 'Transaction date in YYYY-MM-DD, DD/MM/YYYY, DD-MMM-YYYY, or standard Excel Date format.'],
    ['Type', 'Use "Investment" (capital given to PM), "Withdrawal" (money taken out), or "Market Value" for the closing valuation row.'],
    ['Amount (INR)', 'Positive rupee amount. You can also upload signed Excel XIRR sheets (negative for investments, positive for withdrawals) and map them in the uploader.'],
    ['Remarks', 'Optional transaction description or tranche label.'],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(instructionsData);
  wsHelp['!cols'] = [{ wch: 18 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Instructions');

  XLSX.writeFile(wb, 'XIRR_Calculator_Template.xlsx');
}

export function exportAuditReport(
  valuation: ValuationSnapshot,
  feeConfig: FeeConfig,
  result: CalculationResult,
  niftyDataset: NiftyTriDataset
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['XIRR Calculator — Portfolio Manager vs. Nifty 50 TRI Audit Report'],
    ['Generated On', formatDisplayDate(new Date().toISOString().slice(0, 10))],
    ['Valuation Date', formatDisplayDate(valuation.date)],
    ['Nifty 50 TRI Source', niftyDataset.sourceLabel],
    [''],
    ['Performance Metric', 'Gross (Pre-Fee)', 'Net (Post-Fee)', 'Nifty 50 TRI Benchmark'],
    [
      'Annualized XIRR (%)',
      result.grossPortfolioXirr !== null ? Number((result.grossPortfolioXirr * 100).toFixed(2)) : 'N/A',
      result.netPortfolioXirr !== null ? Number((result.netPortfolioXirr * 100).toFixed(2)) : 'N/A',
      result.niftyXirr !== null ? Number((result.niftyXirr * 100).toFixed(2)) : 'N/A',
    ],
    [
      'Alpha vs Nifty 50 TRI (% pts)',
      result.grossAlpha !== null ? Number((result.grossAlpha * 100).toFixed(2)) : 'N/A',
      result.netAlpha !== null ? Number((result.netAlpha * 100).toFixed(2)) : 'N/A',
      0,
    ],
    [
      'Ending Market Value (INR)',
      Math.round(valuation.marketValue),
      Math.round(result.postFeeMarketValue),
      Math.round(result.niftySimulatedValue),
    ],
    [
      'Rupee Outperformance vs Nifty (INR)',
      Math.round(result.rupeeDeltaGross),
      Math.round(result.rupeeDeltaNet),
      0,
    ],
    [''],
    ['Capital & Fee Summary', 'Value'],
    ['Total Capital Invested (INR)', Math.round(result.totalInvested)],
    ['Total Withdrawals (INR)', Math.round(result.totalWithdrawn)],
    ['Net Capital Deployed (INR)', Math.round(result.netCapitalInvested)],
    ['PM Annual Fee Enabled', feeConfig.enabled ? `Yes (${feeConfig.annualRatePct}% p.a.)` : 'No'],
    ['Fee Billing Cycle', feeConfig.cycle === 'fy_apr' ? 'Financial Year (1 Apr)' : feeConfig.cycle === 'cal_jan' ? 'Calendar Year (1 Jan)' : 'Anniversary Year'],
    ['Fee Treatment Mode', feeConfig.mode === 'corpus_deducted' ? 'Deducted from Portfolio Corpus' : 'Paid Out-of-Pocket'],
    ['Direct Fees Charged (INR)', Math.round(result.totalFeesCharged)],
    ['Total Compounding Fee Drag (INR)', Math.round(result.compoundingFeeDragRupees)],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 22 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // Sheet 2: Cashflows & Nifty 50 TRI Unit Simulation
  const simHeader = [
    'Cashflow Date',
    'Matched Nifty TRI Date',
    'Type',
    'Amount (INR)',
    'Investor XIRR Flow (INR)',
    'Nifty 50 TRI Level',
    'Nifty Units (+/-)',
    'Running Nifty Units',
    'Remarks',
  ];
  const simBody = result.unitSimulationRows.map((r) => [
    r.date,
    r.matchedTriDate,
    r.type === 'investment' ? 'Investment' : 'Withdrawal',
    Math.round(r.amount),
    Math.round(r.signedInvestorFlow),
    Number(r.triValue.toFixed(2)),
    Number(r.unitsDelta.toFixed(4)),
    Number(r.cumulativeUnits.toFixed(4)),
    r.note ?? '',
  ]);
  simBody.push([
    valuation.date,
    result.niftyEndMatchedDate,
    'Terminal Valuation',
    Math.round(valuation.marketValue),
    Math.round(valuation.marketValue),
    Number(result.niftyEndIndex.toFixed(2)),
    0,
    Number(result.niftyTotalUnits.toFixed(4)),
    `Simulated Nifty Value: ₹${Math.round(result.niftySimulatedValue).toLocaleString('en-IN')}`,
  ]);

  const wsSim = XLSX.utils.aoa_to_sheet([simHeader, ...simBody]);
  wsSim['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSim, 'Nifty TRI Simulation');

  // Sheet 3: PM Annual Fee Schedule
  const feeHeader = [
    'Fee Date',
    'Billing Period',
    'Implied Opening MV (INR)',
    'Effective Opening MV (INR)',
    'Overridden?',
    'Fee Rate (%)',
    'Fee Charged (INR)',
    'Post-Fee Corpus (INR)',
  ];
  const feeBody = result.annualFeeRows.map((r) => [
    r.feeDate,
    r.label,
    Math.round(r.impliedOpeningValue),
    Math.round(r.effectiveOpeningValue),
    r.isOverridden ? 'Yes' : 'No',
    r.feeRatePct,
    Math.round(r.feeAmount),
    Math.round(r.postFeeBalance),
  ]);
  const wsFee = XLSX.utils.aoa_to_sheet([feeHeader, ...feeBody]);
  wsFee['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 24 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFee, 'PM Fee Schedule');

  XLSX.writeFile(wb, `XIRR_Benchmark_Report_${valuation.date}.xlsx`);
}
