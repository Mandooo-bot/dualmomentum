import pandas as pd
import yfinance as yf
from curl_cffi import requests as cffi_requests
from datetime import datetime, timedelta


def _make_session():
    return cffi_requests.Session(impersonate="chrome")


def fetch_ohlc(ticker: str, period_days: int = 320) -> pd.DataFrame:
    end = datetime.today()
    start = end - timedelta(days=period_days)
    session = _make_session()
    t = yf.Ticker(ticker, session=session)
    df = t.history(
        start=start.strftime("%Y-%m-%d"),
        end=(end + timedelta(days=1)).strftime("%Y-%m-%d"),
        auto_adjust=True,
    )
    if df.empty:
        raise ValueError(f"데이터 없음: {ticker}")
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df[["Open", "High", "Low", "Close"]].dropna()


def fetch_close(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Close"]


def fetch_high(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["High"]


def fetch_low(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Low"]
