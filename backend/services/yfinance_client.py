import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta


def fetch_ohlc(ticker: str, period_days: int = 320) -> pd.DataFrame:
    end = datetime.today()
    start = end - timedelta(days=period_days)
    t = yf.Ticker(ticker)
    df = t.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), auto_adjust=True)
    if df.empty:
        # fallback: period 방식
        df = t.history(period="2y", auto_adjust=True)
    if df.empty:
        raise ValueError(f"데이터 없음: {ticker}")
    df = df[["Open", "High", "Low", "Close"]].dropna()
    return df


def fetch_close(ticker: str, period_days: int = 320) -> pd.Series:
    df = fetch_ohlc(ticker, period_days)
    return df["Close"]


def fetch_high(ticker: str, period_days: int = 320) -> pd.Series:
    df = fetch_ohlc(ticker, period_days)
    return df["High"]


def fetch_low(ticker: str, period_days: int = 320) -> pd.Series:
    df = fetch_ohlc(ticker, period_days)
    return df["Low"]
