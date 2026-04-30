import os
import time
import httpx
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta


def _fetch_tiingo(ticker: str, start: datetime, end: datetime) -> pd.DataFrame:
    token = os.getenv("TIINGO_TOKEN", "")
    if not token:
        raise ValueError("TIINGO_TOKEN 환경변수 미설정")
    url = f"https://api.tiingo.com/tiingo/daily/{ticker}/prices"
    params = {
        "startDate": start.strftime("%Y-%m-%d"),
        "endDate": end.strftime("%Y-%m-%d"),
        "token": token,
    }
    last_status = None
    for attempt in range(6):
        resp = httpx.get(url, params=params, timeout=20)
        last_status = resp.status_code
        if resp.status_code == 429:
            time.sleep(2 ** (attempt + 1))
            continue
        break

    if last_status == 429:
        raise ValueError(f"TIINGO_RATE_LIMIT:{ticker}")
    if resp.status_code != 200:
        raise ValueError(f"데이터 없음: {ticker} (HTTP {resp.status_code})")
    data = resp.json()
    if not data:
        raise ValueError(f"데이터 없음: {ticker}")
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
    df = df.set_index("date").sort_index()
    df = df.rename(columns={"adjOpen": "Open", "adjHigh": "High", "adjLow": "Low", "adjClose": "Close"})
    return df[["Open", "High", "Low", "Close"]].dropna()


def _fetch_yfinance(ticker: str, start: datetime, end: datetime) -> pd.DataFrame:
    df = yf.download(
        ticker,
        start=start.strftime("%Y-%m-%d"),
        end=(end + timedelta(days=1)).strftime("%Y-%m-%d"),
        auto_adjust=True,
        progress=False,
    )
    if df.empty:
        raise ValueError(f"데이터 없음: {ticker} (yfinance)")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df[["Open", "High", "Low", "Close"]].dropna()


def fetch_ohlc(ticker: str, period_days: int = 320) -> pd.DataFrame:
    end = datetime.today()
    start = end - timedelta(days=period_days)
    try:
        return _fetch_tiingo(ticker, start, end)
    except ValueError as e:
        if str(e).startswith("TIINGO_RATE_LIMIT:"):
            return _fetch_yfinance(ticker, start, end)
        raise


def fetch_close(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Close"]


def fetch_high(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["High"]


def fetch_low(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Low"]
