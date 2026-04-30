import io
import os
import time
import httpx
import pandas as pd
from datetime import datetime, timedelta

_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
}


def _fetch_yahoo(ticker: str, start: datetime, end: datetime) -> pd.DataFrame:
    period1 = int(start.timestamp())
    period2 = int(end.timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    params = {"interval": "1d", "period1": period1, "period2": period2}
    resp = httpx.get(url, params=params, headers=_YF_HEADERS, timeout=20)
    if resp.status_code != 200:
        raise ValueError(f"데이터 없음: {ticker} (HTTP {resp.status_code})")
    data = resp.json()
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError(f"데이터 없음: {ticker}")
    r = result[0]
    timestamps = r.get("timestamp", [])
    quote = r["indicators"]["quote"][0]
    adjclose = r["indicators"].get("adjclose", [{}])[0].get("adjclose", quote["close"])
    df = pd.DataFrame({
        "Open":  quote["open"],
        "High":  quote["high"],
        "Low":   quote["low"],
        "Close": adjclose,
    }, index=pd.to_datetime(timestamps, unit="s").tz_localize("UTC").tz_convert(None))
    return df.sort_index().dropna()


def _fetch_tiingo(ticker: str, start: datetime, end: datetime) -> pd.DataFrame:
    token = os.getenv("TIINGO_TOKEN", "")
    if not token:
        raise ValueError("TIINGO_TOKEN 미설정")
    url = f"https://api.tiingo.com/tiingo/daily/{ticker}/prices"
    params = {
        "startDate": start.strftime("%Y-%m-%d"),
        "endDate": end.strftime("%Y-%m-%d"),
        "token": token,
    }
    for attempt in range(4):
        resp = httpx.get(url, params=params, timeout=20)
        if resp.status_code == 429:
            time.sleep(2 ** (attempt + 1))
            continue
        break
    if resp.status_code == 429:
        raise ValueError(f"TIINGO_429:{ticker}")
    if resp.status_code != 200:
        raise ValueError(f"데이터 없음: {ticker} (Tiingo HTTP {resp.status_code})")
    data = resp.json()
    if not data:
        raise ValueError(f"데이터 없음: {ticker}")
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
    df = df.set_index("date").sort_index()
    df = df.rename(columns={"adjOpen": "Open", "adjHigh": "High", "adjLow": "Low", "adjClose": "Close"})
    return df[["Open", "High", "Low", "Close"]].dropna()


def fetch_ohlc(ticker: str, period_days: int = 320) -> pd.DataFrame:
    end = datetime.today()
    start = end - timedelta(days=period_days)
    # Tiingo 우선, 429 시 Yahoo Finance v8 직접 호출로 폴백
    try:
        return _fetch_tiingo(ticker, start, end)
    except ValueError as e:
        if str(e).startswith("TIINGO_429:") or "TIINGO_TOKEN 미설정" in str(e):
            return _fetch_yahoo(ticker, start, end)
        raise


def fetch_close(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Close"]


def fetch_high(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["High"]


def fetch_low(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Low"]
