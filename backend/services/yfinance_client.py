import pandas as pd
import pandas_datareader.data as web
from datetime import datetime, timedelta


def fetch_ohlc(ticker: str, period_days: int = 320) -> pd.DataFrame:
    end = datetime.today()
    start = end - timedelta(days=period_days)
    # stooq uses .US suffix for US stocks/ETFs
    df = web.DataReader(f"{ticker}.US", "stooq", start, end)
    if df.empty:
        raise ValueError(f"데이터 없음: {ticker}")
    df.index = pd.to_datetime(df.index).tz_localize(None)
    df = df.sort_index()  # stooq returns newest-first
    return df[["Open", "High", "Low", "Close"]].dropna()


def fetch_close(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Close"]


def fetch_high(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["High"]


def fetch_low(ticker: str, period_days: int = 320) -> pd.Series:
    return fetch_ohlc(ticker, period_days)["Low"]
