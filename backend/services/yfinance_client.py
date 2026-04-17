import yfinance as yf
import pandas as pd


def fetch_ohlc(ticker: str, period_days: int = 320) -> pd.DataFrame:
    """
    최근 period_days 캘린더일 치 OHLC 데이터를 가져온다.
    yfinance 는 캘린더일 기준이므로 300 거래일을 확보하려면 약 430 캘린더일이 필요하다.
    """
    df = yf.download(ticker, period=f"{period_days}d", auto_adjust=True, progress=False)
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
