import time
from services.yfinance_client import fetch_ohlc
from services.indicators import ma200, donchian_upper, donchian_lower, return_252d
from typing import List, Dict, Any


BIL_TICKER = "BIL"


def _signal(
    price: float,
    ret_252: float,
    bil_ret_252: float,
    sma200: float,
    dc55_high: float,
    dc20_low: float,
) -> str:
    # 절대모멘텀 기준1 — 대전제
    if ret_252 - bil_ret_252 < 0:
        return "전체매도"

    # 절대모멘텀 기준2 — 기술적 필터
    if price > sma200 and price >= dc55_high:
        return "매수"
    elif price > sma200 and price >= dc20_low:
        return "유지"
    elif price < dc20_low:
        return "1차매도"
    elif price < sma200:
        return "전체매도"

    return "유지"


def _analyze_ticker(ticker: str, bil_ret_252: float) -> Dict[str, Any]:
    df = fetch_ohlc(ticker, period_days=430)
    close = df["Close"]
    high = df["High"]
    low = df["Low"]

    price = float(close.iloc[-1])
    ret = return_252d(close)
    sma = ma200(close)
    dc55 = donchian_upper(high, 55)
    dc20 = donchian_lower(low, 20)
    sig = _signal(price, ret, bil_ret_252, sma, dc55, dc20)

    return {
        "ticker": ticker,
        "price": round(price, 4),
        "return_252d": round(ret * 100, 2),       # %
        "excess_return": round((ret - bil_ret_252) * 100, 2),  # %
        "ma200": round(sma, 4),
        "donchian_55d_high": round(dc55, 4),
        "donchian_20d_low": round(dc20, 4),
        "signal": sig,
    }


def analyze_portfolio(tickers: List[str]) -> Dict[str, Any]:
    # BIL 데이터 먼저 수집
    bil_df = fetch_ohlc(BIL_TICKER, period_days=430)
    bil_ret = return_252d(bil_df["Close"])

    results = []
    errors = []
    for t in tickers:
        t = t.strip().upper()
        if t == BIL_TICKER:
            continue
        try:
            results.append(_analyze_ticker(t, bil_ret))
        except Exception as e:
            errors.append({"ticker": t, "error": str(e)})
        time.sleep(1.0)

    # 상대모멘텀: 252일 수익률 내림차순 순위
    results.sort(key=lambda x: x["return_252d"], reverse=True)
    for i, r in enumerate(results):
        r["relative_rank"] = i + 1

    return {
        "bil_return_252d": round(bil_ret * 100, 2),
        "assets": results,
        "errors": errors,
    }
