"use client";

import React, { useState, useEffect, useRef } from "react";
import { analyzePortfolio, sendSellNotification, sendAnalysisReport, loadPortfolio, savePortfolio } from "@/app/lib/api";
import type {
  AssetConfig,
  AssetResult,
  AnalyzeResponse,
  Category,
  Signal,
} from "@/app/lib/types";
import { CATEGORIES, CATEGORY_COLOR, MANUAL_CATEGORIES } from "@/app/lib/types";

/* ── 기본 포트폴리오 ── */
const DEFAULT_ASSETS: AssetConfig[] = [
  { ticker: "VOO", currentWeight: "100", targetWeight: "100", monthlyBuy: "0", accountType: "ISA", rebalancingPeriod: "월별", category: "인덱스 코어" },
];

/* ── 시그널 → 스타일 ── */
function signalClass(sig: Signal) {
  if (sig === "매수")    return "sig-buy";
  if (sig === "유지")    return "sig-hold";
  if (sig === "1차매도") return "sig-sell1";
  return "sig-sell";
}

function signalDotColor(sig: Signal) {
  if (sig === "매수")    return "var(--buy)";
  if (sig === "유지")    return "var(--hold)";
  if (sig === "1차매도") return "var(--sell1)";
  return "var(--sell)";
}

/* ── MA200 판정 ── */
function ma200Pill(asset: AssetResult) {
  const above = asset.price > asset.ma200;
  return (
    <span className={`pill ${above ? "pill-pass" : "pill-fail"}`} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
      {above ? "↑ 위" : "↓ 아래"}
    </span>
  );
}

/* ── Donchian 판정 ── */
function donchianPill(asset: AssetResult) {
  const p = asset.price;
  if (p >= asset.donchian_55d_high)
    return <span className="pill pill-pass" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>55D↑</span>;
  if (p >= asset.donchian_20d_low)
    return <span className="pill pill-pass" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>20D↑</span>;
  return <span className="pill pill-fail" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>20D↓</span>;
}

/* ── 티커 종목명 맵 ── */
const TICKER_NAME: Record<string, string> = {
  VOO:"Vanguard S&P 500", SPY:"SPDR S&P 500", QQQ:"Invesco QQQ (NASDAQ-100)", VTI:"Vanguard Total Market",
  IVV:"iShares Core S&P 500", ITOT:"iShares Core Total Market", SCHB:"Schwab US Broad Market",
  VEA:"Vanguard Dev Markets", VWO:"Vanguard EM", ACWI:"iShares MSCI ACWI", IXUS:"iShares Intl ex-US",
  EFA:"iShares MSCI EAFE", EEM:"iShares MSCI EM", AGG:"iShares Core US Aggregate Bond",
  BND:"Vanguard Total Bond", TLT:"iShares 20+ Year Treasury", IEF:"iShares 7-10Y Treasury",
  SHY:"iShares 1-3Y Treasury", VGLT:"Vanguard Long-Term Treasury", VCIT:"Vanguard Corp Bond",
  GLD:"SPDR Gold Shares", IAU:"iShares Gold Trust", SLV:"iShares Silver Trust",
  BIL:"SPDR 1-3M T-Bill",
  XLU:"Utilities Select Sector", VPU:"Vanguard Utilities", XLP:"Consumer Staples SPDR",
  VDC:"Vanguard Consumer Staples", XLF:"Financials Select Sector", VFH:"Vanguard Financials",
  VNQ:"Vanguard Real Estate", XLRE:"Real Estate Select Sector", IYR:"iShares US Real Estate",
  XLC:"Comm Services SPDR", VOX:"Vanguard Comm Services",
  XLI:"Industrials Select Sector", VIS:"Vanguard Industrials",
  XLV:"Health Care Select Sector", VHT:"Vanguard Health Care", IBB:"iShares Biotech", XBI:"SPDR Biotech",
  XLE:"Energy Select Sector", VDE:"Vanguard Energy", IYE:"iShares US Energy",
  XLB:"Materials Select Sector", VAW:"Vanguard Materials",
  TQQQ:"ProShares UltraPro QQQ 3x", UPRO:"ProShares UltraPro S&P 500 3x", SPXL:"Direxion Daily S&P 500 Bull 3x",
  SOXL:"Direxion Daily Semicon Bull 3x", TECL:"Direxion Daily Technology Bull 3x", LABU:"Direxion Daily Biotech Bull 3x",
  UDOW:"ProShares UltraPro Dow30 3x", SOXX:"iShares Semiconductor", SMH:"VanEck Semiconductor",
  MTUM:"iShares MSCI USA Momentum", QMOM:"Alpha Architect US Quantitative Momentum",
  VUG:"Vanguard Growth", MGK:"Vanguard Mega Cap Growth", IWF:"iShares Russell 1000 Growth",
  SCHG:"Schwab US Large-Cap Growth", IWM:"iShares Russell 2000", VBR:"Vanguard Small-Cap Value",
  SCHA:"Schwab US Small-Cap", VIOG:"Vanguard S&P Small-Cap 600 Growth", SPMD:"SPDR S&P 400 Mid Cap",
  ARKK:"ARK Innovation", ARKG:"ARK Genomic Revolution", ARKW:"ARK Next Generation Internet",
  ARKF:"ARK Fintech Innovation", ARKQ:"ARK Autonomous Tech & Robotics",
  BOTZ:"Global X Robotics & AI", ROBO:"ROBO Global Robotics & Automation",
  CLOU:"Global X Cloud Computing", WCLD:"WisdomTree Cloud Computing", AIQ:"Global X AI & Technology",
  LIT:"Global X Lithium & Battery Tech", DRIV:"Global X Autonomous & EV",
  HERO:"Global X Video Games & Esports", FINX:"Global X FinTech",
  HACK:"ETFMG Prime Cyber Security", CIBR:"First Trust NASDAQ Cybersecurity",
  PDBC:"Invesco Optimum Yield Diversified Commodity", DJP:"iPath Bloomberg Commodity",
  QUAL:"iShares MSCI USA Quality Factor", VLUE:"iShares MSCI USA Value Factor",
  USMV:"iShares MSCI USA Min Vol", BETZ:"Roundhill Sports Betting & iGaming",
};

/* ── 티커 자동 분류 ── */
function classifyTicker(ticker: string): Category {
  const t = ticker.toUpperCase();
  const INDEX_CORE = new Set([
    "VOO","SPY","QQQ","VTI","IVV","ITOT","SCHB","VEA","VWO","ACWI","IXUS","EFA","EEM",
    "AGG","BND","TLT","IEF","SHY","VGLT","VCIT","GLD","IAU","SLV","BIL",
  ]);
  const INFRA = new Set([
    "XLU","VPU","XLP","VDC","XLF","VFH","VNQ","XLRE","IYR","XLC","VOX",
    "XLI","VIS","XLV","VHT","IBB","XBI","XLE","VDE","IYE","XLB","VAW",
  ]);
  const MOMENTUM = new Set([
    "TQQQ","UPRO","SPXL","SOXL","TECL","LABU","UDOW","SOXX","SMH","MTUM","QMOM",
    "VUG","MGK","IWF","SCHG","IWM","VBR","SCHA","VIOG","SPMD",
  ]);
  const ALPHA = new Set([
    "ARKK","ARKG","ARKW","ARKF","ARKQ","BOTZ","ROBO","CLOU","WCLD","AIQ",
    "LIT","DRIV","HERO","FINX","HACK","CIBR","PDBC","DJP","QUAL","VLUE","USMV","BETZ",
  ]);
  if (INDEX_CORE.has(t)) return "인덱스 코어";
  if (INFRA.has(t))      return "시스템/인프라섹터";
  if (MOMENTUM.has(t))   return "모멘텀/고베타";
  return "알파 후보";
}

/* ── 순위 배지 ── */
function rankBadge(rank: number) {
  const cls = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "rank-n";
  const styles: Record<string, React.CSSProperties> = {
    "rank-1": { background: "rgba(245,158,11,0.2)",  color: "#f59e0b" },
    "rank-2": { background: "rgba(148,163,184,0.15)", color: "#94a3b8" },
    "rank-3": { background: "rgba(180,120,60,0.15)",  color: "#b47c3c" },
    "rank-n": { background: "var(--surface2)",         color: "var(--muted)" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, fontSize: 12, fontWeight: 700, ...styles[cls] }}>
      {rank}
    </span>
  );
}

const STORAGE_KEY = "dm_portfolio";
const HISTORY_KEY = "dm_signal_history";
const MAX_HISTORY = 30;

type HistoryEntry = {
  date: string;
  assets: { ticker: string; signal: string; return_252d: number; excess_return: number }[];
};

/* ── 메인 컴포넌트 ── */
export default function Dashboard() {
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");
  const [assets, setAssets] = useState<AssetConfig[]>(DEFAULT_ASSETS);
  const [hydrated, setHydrated] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addCategory, setAddCategory] = useState<Category>("알파 후보");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"대시보드" | "시그널 이력" | "설정">("대시보드");
  const [signalHistory, setSignalHistory] = useState<HistoryEntry[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(0);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const supabaseLoaded = useRef(false);

  /* ── 불러오기: localStorage(즉시) → Supabase(비동기 덮어쓰기) ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { assets: a, currency: c } = JSON.parse(saved);
        if (Array.isArray(a) && a.length > 0) setAssets(a);
        if (c === "KRW" || c === "USD") setCurrency(c);
      }
      const hist = localStorage.getItem(HISTORY_KEY);
      if (hist) setSignalHistory(JSON.parse(hist));
    } catch {}
    setHydrated(true);

    loadPortfolio().then(data => {
      if (data) {
        if (Array.isArray(data.assets) && data.assets.length > 0) setAssets(data.assets as AssetConfig[]);
        if (data.currency === "KRW" || data.currency === "USD") setCurrency(data.currency);
        if (Array.isArray(data.signal_history) && data.signal_history.length > 0) setSignalHistory(data.signal_history as HistoryEntry[]);
      }
      supabaseLoaded.current = true;
    });
  }, []);

  /* ── 저장: localStorage(즉시) + Supabase(비동기) ── */
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ assets, currency }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(signalHistory));
    if (!supabaseLoaded.current) return;
    savePortfolio(assets, currency, signalHistory);
  }, [assets, currency, hydrated, signalHistory]);

  /* ── 포트폴리오 입력 핸들러 ── */
  function updateAsset(idx: number, field: keyof AssetConfig, value: string) {
    setAssets(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  function removeAsset(ticker: string) {
    setAssets(prev => prev.filter(a => a.ticker !== ticker));
  }

  function addAsset() {
    const t = addInput.trim().toUpperCase();
    if (!t || assets.some(a => a.ticker === t)) return;
    setAssets(prev => [...prev, {
      ticker: t, currentWeight: "0", targetWeight: "0",
      monthlyBuy: "0", accountType: "ISA", rebalancingPeriod: "월별", category: addCategory,
    }]);
    setAddInput("");
    setAddCategory("알파 후보");
  }

  /* ── category + 비중 정보를 AssetResult에 병합 ── */
  function enrichAssetsForEmail(resultAssets: AssetResult[]) {
    return resultAssets.map(ar => {
      const cfg = assets.find(a => a.ticker === ar.ticker);
      return {
        ...ar,
        category: cfg ? effectiveCategory(cfg) : "알파 후보",
        currentWeight: cfg?.currentWeight ?? "0",
        targetWeight: cfg?.targetWeight ?? "0",
      };
    });
  }

  /* ── 분석 결과 이메일 발송 ── */
  async function sendReport() {
    if (!result) return;
    setEmailSending(true);
    setEmailSent(false);
    const vooAsset = result.assets.find(a => a.ticker === "VOO");
    const market_pass = vooAsset ? (vooAsset.return_252d - result.bil_return_252d) >= 0 : false;
    try {
      await sendAnalysisReport(result.bil_return_252d, market_pass, enrichAssetsForEmail(result.assets));
      setEmailSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "메일 발송 실패");
    } finally {
      setEmailSending(false);
    }
  }

  /* ── 분석 실행 ── */
  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setResult(null);
    setEmailSent(false);
    try {
      const tickers = assets.map(a => a.ticker);
      const data = await analyzePortfolio(tickers);
      setResult(data);

      // 분석 실행 시 자동 이메일 발송
      setEmailSending(true);
      const vooAsset = data.assets.find(a => a.ticker === "VOO");
      const market_pass = vooAsset ? (vooAsset.return_252d - data.bil_return_252d) >= 0 : false;
      const enriched = data.assets.map(ar => {
        const cfg = assets.find(a => a.ticker === ar.ticker);
        return {
          ...ar,
          category: cfg ? effectiveCategory(cfg) : "알파 후보",
          currentWeight: cfg?.currentWeight ?? "0",
          targetWeight: cfg?.targetWeight ?? "0",
        };
      });
      sendAnalysisReport(data.bil_return_252d, market_pass, enriched)
        .then(() => setEmailSent(true))
        .catch(() => {})
        .finally(() => setEmailSending(false));

      // 매도 시그널 발생 시 이메일 발송 (분석 실행마다)
      const SELL_SIGNALS = new Set(["1차매도", "전체매도"]);
      const sells = data.assets.filter(a => SELL_SIGNALS.has(a.signal));
      if (sells.length > 0) {
        sendSellNotification(sells.map(a => ({
          ticker: a.ticker,
          signal: a.signal,
          return_252d: a.return_252d,
          excess_return: a.excess_return,
        }))).catch(() => {});
      }

      // 시그널 이력 저장
      const newEntry: HistoryEntry = {
        date: new Date().toISOString().slice(0, 16).replace("T", " "),
        assets: data.assets.map(a => ({
          ticker: a.ticker, signal: a.signal,
          return_252d: a.return_252d, excess_return: a.excess_return,
        })),
      };
      setSignalHistory(prev => [newEntry, ...prev].slice(0, MAX_HISTORY));

    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  /* ── 결과 맵 (ticker → AssetResult) ── */
  const resultMap = new Map<string, AssetResult>(
    result?.assets.map(a => [a.ticker, a]) ?? []
  );

  /* ── 유효 카테고리 (저장된 값 우선, 없으면 자동 분류) ── */
  function effectiveCategory(a: AssetConfig): Category {
    return a.category ?? classifyTicker(a.ticker);
  }

  /* ── 비중 합계 ── */
  const weightSum = assets.reduce((s, a) => s + (parseFloat(a.currentWeight) || 0), 0);

  /* ── 오늘 날짜 ── */
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 32px", height: 48, display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>기준 통화</span>
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {(["KRW", "USD"] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              style={{ background: currency === c ? "var(--accent)" : "none", border: "none", color: currency === c ? "#fff" : "var(--muted)", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
              {c === "KRW" ? "원 KRW" : "달러 USD"}
            </button>
          ))}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 56, borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          Dual<span style={{ color: "var(--accent)" }}>Momentum</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["대시보드", "시그널 이력", "설정"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: activeTab === tab ? "var(--surface2)" : "none", border: "none", color: activeTab === tab ? "var(--text)" : "var(--muted)", padding: "6px 14px", fontSize: 13, cursor: "pointer", borderRadius: 7 }}>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── 시그널 이력 탭 ── */}
        {activeTab === "시그널 이력" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>시그널 이력</h2>
              {signalHistory.length > 0 && (
                <button onClick={() => {
                  localStorage.removeItem(HISTORY_KEY);
                  setSignalHistory([]);
                }} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>
                  이력 초기화
                </button>
              )}
            </div>
            {signalHistory.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                아직 분석 이력이 없습니다. 대시보드에서 분석을 실행하면 여기에 기록됩니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {signalHistory.map((entry, ei) => {
                  const buy   = entry.assets.filter(a => a.signal === "매수").length;
                  const hold  = entry.assets.filter(a => a.signal === "유지").length;
                  const sell1 = entry.assets.filter(a => a.signal === "1차매도").length;
                  const sell  = entry.assets.filter(a => a.signal === "전체매도").length;
                  const total = entry.assets.length;
                  const isOpen = expandedHistory === ei;
                  return (
                    <div key={ei} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", borderBottom: isOpen ? "1px solid var(--border)" : "none" }}>
                        <button onClick={() => setExpandedHistory(isOpen ? null : ei)}
                          style={{ flex: 1, background: "none", border: "none", padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{entry.date}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>전체 {total}종목</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {buy   > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--buy)",   background: "rgba(34,197,94,0.12)",   borderRadius: 4, padding: "2px 8px" }}>매수 {buy}</span>}
                            {hold  > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--hold)",  background: "rgba(148,163,184,0.12)", borderRadius: 4, padding: "2px 8px" }}>유지 {hold}</span>}
                            {sell1 > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sell1)", background: "rgba(251,146,60,0.12)",  borderRadius: 4, padding: "2px 8px" }}>1차매도 {sell1}</span>}
                            {sell  > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sell)",  background: "rgba(239,68,68,0.12)",  borderRadius: 4, padding: "2px 8px" }}>전체매도 {sell}</span>}
                            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                          </div>
                        </button>
                        <button onClick={() => {
                          setSignalHistory(prev => prev.filter((_, i) => i !== ei));
                          if (expandedHistory === ei) setExpandedHistory(null);
                        }} style={{ background: "none", border: "none", color: "var(--muted)", padding: "12px 14px", cursor: "pointer", fontSize: 16, lineHeight: 1 }} title="삭제">×</button>
                      </div>
                      {isOpen && (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["티커", "252거래일 수익률", "절대모멘텀", "시그널"].map((h, i) => (
                                <th key={i} style={{ padding: "8px 14px", fontSize: 11, color: "var(--muted)", fontWeight: 600, textAlign: i === 0 ? "left" : "center", borderBottom: "1px solid var(--border)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...entry.assets].sort((a, b) => b.return_252d - a.return_252d).map((a, ai) => (
                              <tr key={ai} style={{ borderTop: ai > 0 ? "1px solid var(--border)" : "none" }}>
                                <td style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13 }}>{a.ticker}</td>
                                <td style={{ padding: "9px 14px", textAlign: "center", color: a.return_252d >= 0 ? "var(--buy)" : "var(--sell)", fontWeight: 600 }}>
                                  {a.return_252d >= 0 ? "+" : ""}{a.return_252d.toFixed(2)}%
                                </td>
                                <td style={{ padding: "9px 14px", textAlign: "center" }}>
                                  <span className={`pill ${a.excess_return >= 0 ? "pill-pass" : "pill-fail"}`} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
                                    {a.excess_return >= 0 ? "통과" : "미통과"}
                                  </span>
                                </td>
                                <td style={{ padding: "9px 14px", textAlign: "center" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700 }} className={signalClass(a.signal as Signal)}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: signalDotColor(a.signal as Signal), display: "inline-block" }} />
                                    {a.signal}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab !== "대시보드" ? null : <>

        {/* ① 전략 소개 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>
            듀얼<span style={{ color: "var(--accent)" }}>모멘텀</span> 전략이란?
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
            게리 안토나치(Gary Antonacci)가 체계화한 퀀트 투자 전략으로, <strong style={{ color: "var(--text)" }}>상대모멘텀</strong>과 <strong style={{ color: "var(--text)" }}>절대모멘텀</strong>을 결합해
            상승 추세의 자산에 집중 투자하고, 시장 전체가 위험 구간에 진입하면 현금으로 대피하는 방식입니다.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[
              { icon: "📈", title: "상대모멘텀 — 무엇을 살까?", body: "보유 자산들의 252거래일(약 1년) 수익률을 비교해 순위를 매깁니다. 수익률이 높은 자산일수록 투자 우선순위가 높아집니다." },
              { icon: "🛡️", title: "절대모멘텀 — 지금 시장에 들어가도 될까?", body: "각 자산의 252거래일 수익률이 BIL(단기국채 ETF)보다 낮으면 전체 매도. 초과수익이 마이너스면 위험을 감수할 이유가 없다는 신호입니다." },
              { icon: "📐", title: "기술적 필터 — 언제 사고 팔까?", body: "MA200(200일 이동평균)과 Donchian Channel(55D/20D)로 진입·청산 타이밍을 정밀화합니다. 55D 상단 돌파 시 매수 / 20D 하단 이탈 시 1차 매도." },
            ].map(card => (
              <div key={card.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px" }}>
                <div style={{ fontSize: 20, marginBottom: 10 }}>{card.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.75 }}>{card.body}</div>
              </div>
            ))}
          </div>

          {/* 분석 흐름 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 20px", fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            {[
              { dot: { background: "rgba(79,142,247,0.2)", color: "var(--accent)" }, label: "1", text: "티커 입력" },
              { dot: { background: "rgba(167,139,250,0.2)", color: "#a78bfa" },     label: "2", text: "절대모멘텀 확인 (vs BIL)" },
              { dot: { background: "rgba(167,139,250,0.2)", color: "#a78bfa" },     label: "3", text: "상대모멘텀 순위" },
              { dot: { background: "rgba(34,197,94,0.2)",  color: "var(--buy)" },  label: "4", text: "기술적 필터 (MA200 · Donchian)" },
            ].map((step, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, ...step.dot }}>{step.label}</span>
                  <span>{step.text}</span>
                </span>
                <span style={{ color: "var(--border)", fontSize: 14 }}>›</span>
              </span>
            ))}
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.2)", color: "var(--buy)" }}>✓</span>
              <span style={{ color: "var(--buy)", fontWeight: 600 }}>매수 / 유지</span>
            </span>
            <span style={{ color: "var(--border)", fontSize: 14, margin: "0 2px" }}>or</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.2)", color: "var(--sell)" }}>✕</span>
              <span style={{ color: "var(--sell)", fontWeight: 600 }}>매도 / 대피</span>
            </span>
          </div>
        </div>

        {/* 대시보드 안내 */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 22px", marginBottom: 24, fontSize: 12, color: "var(--muted)", lineHeight: 1.9 }}>
          <strong style={{ color: "var(--text)" }}>이 대시보드</strong>는 DCA(정액 적립식)로 모아가는 자산의 매수·유지·매도 시그널을 자동으로 판단해 드립니다.<br />
          <strong style={{ color: "var(--text)" }}>절대모멘텀</strong>: 각 자산의 252거래일 수익률이 BIL보다 낮으면 매도 시그널을 표시합니다.<br />
          <strong style={{ color: "var(--text)" }}>상대모멘텀</strong>: 보유 자산을 252거래일 수익률 기준으로 순위화하여 자본 배분 우선순위를 제안합니다.<br />
          <strong style={{ color: "var(--text)" }}>기술적 필터</strong>: MA200, Donchian 55D/20D를 적용해 매수 타이밍과 청산 시점을 구체적으로 안내합니다.<br />
          데이터 출처: Yahoo Finance (yfinance) · 매일 장 마감 후 자동 업데이트 · 이 도구는 참고용이며 투자 결정은 본인 판단 하에 이루어져야 합니다.
        </div>

        {/* ② 포트폴리오 입력 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>포트폴리오</h2>
            <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--muted)", padding: "2px 8px", borderRadius: 10 }}>{assets.length}종목</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>기준일: {today}</span>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["티커", "섹터", "현재 비중 (%)", "목표 비중 (%)", "월 매수 금액", "계좌 종류", "리밸런싱 주기", ""].map((h, i) => (
                  <th key={i} style={{ background: "var(--surface2)", padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textAlign: i >= 2 && i <= 6 ? "center" : "left", letterSpacing: "0.4px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, idx) => (
                <tr key={asset.ticker} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{asset.ticker}</span>
                      <span onClick={() => removeAsset(asset.ticker)} style={{ color: "var(--muted)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <select value={effectiveCategory(asset)} onChange={e => updateAsset(idx, "category", e.target.value)}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: CATEGORY_COLOR[effectiveCategory(asset)], padding: "5px 9px", fontSize: 11, outline: "none", fontWeight: 600 }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <input value={asset.currentWeight} onChange={e => updateAsset(idx, "currentWeight", e.target.value)}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "5px 9px", fontSize: 12, outline: "none", width: 70, textAlign: "center" }} />
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <input value={asset.targetWeight} onChange={e => updateAsset(idx, "targetWeight", e.target.value)}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "5px 9px", fontSize: 12, outline: "none", width: 70, textAlign: "center" }} />
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <input value={asset.monthlyBuy} onChange={e => updateAsset(idx, "monthlyBuy", e.target.value)}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "5px 9px", fontSize: 12, outline: "none", width: 110, textAlign: "right" }} />
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <select value={asset.accountType} onChange={e => updateAsset(idx, "accountType", e.target.value)}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "5px 9px", fontSize: 12, outline: "none", width: 100 }}>
                      {["ISA", "연금저축", "일반"].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <select value={asset.rebalancingPeriod} onChange={e => updateAsset(idx, "rebalancingPeriod", e.target.value)}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "5px 9px", fontSize: 12, outline: "none", width: 80 }}>
                      {["월별", "분기", "반기"].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 14px" }} />
                </tr>
              ))}
            </tbody>
          </table>

          {/* 티커 추가 행 */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.01)" }}>
            <input value={addInput}
              onChange={e => {
                setAddInput(e.target.value);
                setAddCategory(classifyTicker(e.target.value));
              }}
              onKeyDown={e => e.key === "Enter" && addAsset()}
              placeholder="티커 추가 (예: SCHD)"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 12, outline: "none", width: 160 }} />
            <button onClick={addAsset}
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              + 추가
            </button>
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              비중 합계: <strong style={{ color: weightSum === 100 ? "var(--buy)" : weightSum > 100 ? "var(--sell)" : "var(--text)" }}>{weightSum}%</strong>
            </span>
          </div>
        </div>

        <button onClick={runAnalysis} disabled={loading}
          style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", width: "100%", marginTop: 14, opacity: loading ? 0.7 : 1 }}>
          {loading ? "분석 중..." : "분석 실행"}
        </button>

        {result && (
          <button onClick={sendReport} disabled={emailSending}
            style={{ background: "none", border: "1px solid var(--border)", color: emailSent ? "var(--buy)" : "var(--text)", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: emailSending ? "not-allowed" : "pointer", width: "100%", marginTop: 8, opacity: emailSending ? 0.6 : 1 }}>
            {emailSending ? "발송 중..." : emailSent ? "✓ 이메일 발송 완료 — 다시 받기" : "결과를 이메일로 받기"}
          </button>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)", padding: "12px 18px", marginTop: 14, color: "var(--sell)", fontSize: 13 }}>
            오류: {error}
          </div>
        )}

        {/* ── 분석 결과 ── */}
        {result && (
          <>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "28px 0" }} />

            {/* ③ 시장 절대모멘텀 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>시장 절대모멘텀</h2>
              <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--muted)", padding: "2px 8px", borderRadius: 10 }}>VOO vs BIL</span>
            </div>

            {(() => {
              const voo = resultMap.get("VOO");
              const bilRet = result.bil_return_252d;
              const vooRet = voo?.return_252d ?? null;
              const excess = vooRet !== null ? vooRet - bilRet : null;
              const pass = excess !== null && excess >= 0;
              return (
                <>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "22px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 20, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>VOO 252거래일 수익률</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: vooRet !== null && vooRet >= 0 ? "var(--buy)" : "var(--sell)" }}>{vooRet !== null ? `${vooRet >= 0 ? "+" : ""}${vooRet.toFixed(2)}%` : "—"}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>S&amp;P 500 기준</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>BIL 252거래일 수익률</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--muted)" }}>+{bilRet.toFixed(2)}%</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>단기국채 기준 (무위험)</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>초과수익률 (VOO − BIL)</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: pass ? "var(--buy)" : "var(--sell)" }}>{excess !== null ? `${excess >= 0 ? "+" : ""}${excess.toFixed(2)}%` : "—"}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{pass ? "양수 → 시장 진입 유효" : "음수 → 대피 신호"}</span>
                    </div>
                    <div style={{ textAlign: "center", background: pass ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${pass ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "14px 22px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>시장 절대모멘텀 판정</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: pass ? "var(--buy)" : "var(--sell)" }}>{pass ? "통과 — 투자 유효 구간" : "미통과 — BIL 대피"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, lineHeight: 1.7 }}>
                    * 시장 절대모멘텀은 전략 대전제입니다. VOO − BIL 초과수익이 음수(마이너스)로 전환되면 전체 매도 시그널이 발생하며 BIL(현금성 자산)로 대피합니다.
                  </div>
                </>
              );
            })()}

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "28px 0" }} />

            {/* ④ 섹터별 상대모멘텀 + 개별 자산 상세 (통합) */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>포트폴리오 시그널</h2>
              <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--muted)", padding: "2px 8px", borderRadius: 10 }}>섹터별 상대모멘텀 · 듀얼모멘텀 시그널</span>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["순위", "섹터", "티커", "종목명", "252거래일 수익률", "절대모멘텀", "SMA200", "Donchian", "현재/목표 비중", "투자시그널", "차트"].map((h, i) => (
                      <th key={i} style={{
                        padding: "9px 12px", fontSize: 11, color: "var(--muted)", fontWeight: 600,
                        textAlign: i === 0 || (i >= 5 && i <= 9) ? "center" : i === 4 ? "right" : "left",
                        borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(cat => {
                    const catAssets = assets.filter(a => effectiveCategory(a) === cat);
                    if (!catAssets.length) return null;
                    const catPairs = catAssets
                      .map(a => ({ cfg: a, ar: resultMap.get(a.ticker) }))
                      .filter(x => x.ar) as { cfg: AssetConfig; ar: AssetResult }[];
                    catPairs.sort((a, b) => b.ar.return_252d - a.ar.return_252d);
                    if (!catPairs.length) return null;
                    return (
                      <React.Fragment key={cat}>
                        <tr style={{ background: `rgba(${cat === "인덱스 코어" ? "79,142,247" : cat === "시스템/인프라섹터" ? "167,139,250" : cat === "모멘텀/고베타" ? "245,158,11" : "52,211,153"},0.04)` }}>
                          <td colSpan={11} style={{ padding: "7px 14px", fontSize: "0.75em", color: "var(--muted)", letterSpacing: "0.5px", textAlign: "center" }}>
                            ── {cat} ──
                          </td>
                        </tr>
                        {catPairs.map(({ cfg, ar }, i) => (
                          <tr key={ar.ticker} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "11px 12px", textAlign: "center" }}>{rankBadge(i + 1)}</td>
                            <td style={{ padding: "11px 12px", fontSize: "0.72em", color: CATEGORY_COLOR[cat], fontWeight: 600, whiteSpace: "nowrap" }}>{cat}</td>
                            <td style={{ padding: "11px 12px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{ar.ticker}</td>
                            <td style={{ padding: "11px 12px", fontSize: 11, color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {TICKER_NAME[ar.ticker] ?? "—"}
                            </td>
                            <td style={{ padding: "11px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 600, color: ar.return_252d >= 0 ? "var(--buy)" : "var(--sell)" }}>
                                {ar.return_252d >= 0 ? "+" : ""}{ar.return_252d.toFixed(2)}%
                              </span>
                            </td>
                            <td style={{ padding: "11px 12px", textAlign: "center" }}>
                              <span className={`pill ${ar.excess_return >= 0 ? "pill-pass" : "pill-fail"}`} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
                                {ar.excess_return >= 0 ? "통과" : "미통과"}
                              </span>
                            </td>
                            <td style={{ padding: "11px 12px", textAlign: "center" }}>{ma200Pill(ar)}</td>
                            <td style={{ padding: "11px 12px", textAlign: "center" }}>{donchianPill(ar)}</td>
                            <td style={{ padding: "11px 12px", textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 600 }}>{cfg.currentWeight}%</span>
                              <span style={{ color: "var(--muted)", fontSize: 11 }}> / {cfg.targetWeight}%</span>
                            </td>
                            <td style={{ padding: "11px 12px", textAlign: "center" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700 }} className={signalClass(ar.signal as Signal)}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: signalDotColor(ar.signal as Signal), display: "inline-block" }} />
                                {ar.signal}
                              </span>
                            </td>
                            <td style={{ padding: "11px 12px", textAlign: "center" }}>
                              <a
                                href={`https://finance.yahoo.com/chart/${ar.ticker}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap" }}
                              >
                                차트 ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {/* BIL 기준선 */}
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "11px 12px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, fontSize: 12, fontWeight: 700, background: "var(--surface2)", color: "var(--muted)", opacity: 0.4 }}>—</span>
                    </td>
                    <td style={{ padding: "11px 12px", fontSize: "0.72em", color: "var(--muted)", fontWeight: 600 }}>기준선</td>
                    <td style={{ padding: "11px 12px", fontWeight: 700, color: "var(--muted)" }}>BIL</td>
                    <td style={{ padding: "11px 12px", fontSize: 11, color: "var(--muted)" }}>SPDR 1-3M T-Bill (무위험 기준)</td>
                    <td style={{ padding: "11px 12px", textAlign: "right", color: "var(--muted)" }}>+{result.bil_return_252d.toFixed(2)}%</td>
                    <td style={{ padding: "11px 12px", textAlign: "center" }}>
                      <span className="pill pill-na" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>기준</span>
                    </td>
                    <td colSpan={5} style={{ padding: "11px 12px", textAlign: "center", color: "var(--muted)" }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* API 오류 목록 */}
            {result.errors.length > 0 && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", padding: "12px 18px", marginBottom: 24, fontSize: 12, color: "var(--sell)" }}>
                <strong>데이터 수집 오류:</strong>
                {result.errors.map(e => (
                  <div key={e.ticker}>{e.ticker}: {e.error}</div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FOOTER */}
        <div style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid var(--border)", color: "var(--muted)", fontSize: 11, lineHeight: 1.9 }}>
          * 이 대시보드는 투자 판단의 참고 도구입니다. 최종 매매 결정은 본인의 판단과 책임 하에 이루어져야 합니다.<br />
          * 데이터 출처: Yahoo Finance (yfinance) | 지표 계산: 서버 자체 계산 | 업데이트: 매일 장 마감 후
        </div>

        </>}
      </div>
    </div>
  );
}
