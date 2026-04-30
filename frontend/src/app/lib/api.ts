import type { AnalyzeResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function analyzePortfolio(
  tickers: string[]
): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `API 오류 (${res.status})`);
  }
  return res.json();
}

export async function sendAnalysisReport(
  bil_return: number,
  market_pass: boolean,
  assets: object[]
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notify/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bil_return, market_pass, assets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `메일 발송 실패 (${res.status})`);
  }
}

export async function sendSellNotification(signals: object[]): Promise<void> {
  await fetch(`${API_BASE}/api/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signals }),
  });
}

export async function loadPortfolio(): Promise<{ assets: object[]; currency: string; signal_history: object[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/portfolio`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function savePortfolio(assets: object[], currency: string, signal_history: object[] = []): Promise<void> {
  await fetch(`${API_BASE}/api/portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets, currency, signal_history }),
  }).catch(() => {});
}
