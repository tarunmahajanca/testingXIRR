export type CashflowType = 'investment' | 'withdrawal';

export interface CashflowEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: CashflowType;
  amount: number; // Always positive INR amount
  note?: string;
}

export interface ValuationSnapshot {
  date: string; // YYYY-MM-DD
  marketValue: number; // Positive INR amount
}

export type FeeBillingCycle = 'fy_apr' | 'cal_jan' | 'anniversary';
export type FeeTreatmentMode = 'corpus_deducted' | 'out_of_pocket';

export interface FeeConfig {
  enabled: boolean;
  annualRatePct: number; // e.g., 2.0 for 2%
  cycle: FeeBillingCycle;
  mode: FeeTreatmentMode;
  chargeOnInitialDay: boolean;
  /** Optional user-entered actual beginning-of-year market values keyed by YYYY-MM-DD */
  valueOverrides: Record<string, number>;
}

export type NiftyDataSource = 'nse_live' | 'amfi_proxy' | 'embedded_historical';

export interface NiftyTriPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface NiftyTriDataset {
  source: NiftyDataSource;
  sourceLabel: string;
  asOfDate: string;
  fetchedAt: string;
  points: NiftyTriPoint[];
}

export interface UnitSimulationRow {
  id: string;
  date: string;
  matchedTriDate: string;
  type: CashflowType;
  amount: number;
  signedInvestorFlow: number; // Negative for investment, positive for withdrawal
  triValue: number;
  unitsDelta: number; // Positive for buy, negative for redeem
  cumulativeUnits: number;
  note?: string;
  isExactDateMatch: boolean;
  unitShortfall?: boolean;
}

export interface AnnualFeeRow {
  feeDate: string; // YYYY-MM-DD
  label: string; // e.g. "FY 2022–23 Opening" or "Year 1 Opening"
  impliedOpeningValue: number;
  effectiveOpeningValue: number;
  isOverridden: boolean;
  feeRatePct: number;
  feeAmount: number;
  postFeeBalance: number;
}

export interface TimelinePoint {
  date: string;
  label: string;
  netInvested: number;
  portfolioGross: number;
  portfolioNet: number;
  niftyTriCorpus: number;
}

export interface ValidationIssue {
  rowId?: string;
  field: string;
  message: string;
}

export interface CalculationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  holdingYears: number;
  totalInvested: number;
  totalWithdrawn: number;
  netCapitalInvested: number;
  absoluteGainGross: number;
  absoluteGainNet: number;

  // Portfolio metrics
  grossPortfolioXirr: number | null; // decimal e.g. 0.1842 for 18.42%
  netPortfolioXirr: number | null; // decimal
  postFeeMarketValue: number;
  totalFeesCharged: number;
  compoundingFeeDragRupees: number; // Gross MV - Net MV (includes lost compounding)
  feeDragPctPoints: number | null; // grossXirr - netXirr (in decimal)

  // Nifty 50 TRI Benchmark metrics
  niftySimulatedValue: number;
  niftyXirr: number | null;
  niftyTotalUnits: number;
  niftyEndIndex: number;
  niftyEndMatchedDate: string;
  niftyAbsoluteGain: number;
  hadUnitShortfall: boolean;

  // Alpha & Rupee Outperformance
  grossAlpha: number | null; // decimal e.g. 0.0315 = +3.15%
  netAlpha: number | null; // decimal
  rupeeDeltaGross: number; // portfolioGrossMV - niftySimulatedValue
  rupeeDeltaNet: number; // postFeeMarketValue - niftySimulatedValue

  // Detailed Audit Tables & Charts
  unitSimulationRows: UnitSimulationRow[];
  annualFeeRows: AnnualFeeRow[];
  timelineSeries: TimelinePoint[];
}

export type SignConvention = 'auto' | 'positive_investment' | 'negative_investment';

export interface ColumnMapping {
  dateCol: string;
  amountCol: string;
  typeCol: string; // '' if none
  noteCol: string; // '' if none
  signConvention: SignConvention;
  dateFormatHint: 'auto' | 'DMY' | 'MDY' | 'YMD';
  extractLastRowAsValuation: boolean;
}

export interface ParsedExcelSheet {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  suggestedMapping: ColumnMapping;
}
