export type Signal = "매수" | "유지" | "1차매도" | "전체매도";

export interface AssetResult {
  ticker: string;
  price: number;
  return_252d: number;      // %
  excess_return: number;    // % (vs BIL)
  ma200: number;
  donchian_55d_high: number;
  donchian_20d_low: number;
  signal: Signal;
  relative_rank: number;
}

export interface AnalyzeResponse {
  bil_return_252d: number;  // %
  assets: AssetResult[];
  errors: { ticker: string; error: string }[];
}

export interface AssetConfig {
  ticker: string;
  currentWeight: string;  // % string for input
  targetWeight: string;
  monthlyBuy: string;
  accountType: "ISA" | "연금저축" | "일반";
  rebalancingPeriod: "월별" | "분기" | "반기";
  category: Category;
}

export type Category =
  | "인덱스 코어"
  | "시스템/인프라섹터"
  | "모멘텀/고베타"
  | "알파 후보";

export const CATEGORY_COLOR: Record<Category, string> = {
  "인덱스 코어":    "#4f8ef7",
  "시스템/인프라섹터": "#a78bfa",
  "모멘텀/고베타":  "#f59e0b",
  "알파 후보":     "#34d399",
};

export const CATEGORIES: Category[] = [
  "인덱스 코어",
  "시스템/인프라섹터",
  "모멘텀/고베타",
  "알파 후보",
];
