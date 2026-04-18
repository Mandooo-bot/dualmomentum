import pandas as pd


def ma200(close: pd.Series) -> float:
    """200일 단순이동평균 (SMA 200)"""
    if len(close) < 200:
        raise ValueError("200일 이동평균 계산에 충분한 데이터가 없습니다.")
    return float(close.iloc[-200:].mean())


def donchian_upper(high: pd.Series, window: int = 55) -> float:
    """Donchian Channel 상단: 직전 window 거래일 최고가 (오늘 제외)"""
    if len(high) < window + 1:
        raise ValueError(f"Donchian {window}d 계산에 데이터가 부족합니다.")
    return float(high.iloc[-(window + 1):-1].max())


def donchian_lower(low: pd.Series, window: int = 20) -> float:
    """Donchian Channel 하단: 직전 window 거래일 최저가 (오늘 제외)"""
    if len(low) < window + 1:
        raise ValueError(f"Donchian {window}d 계산에 데이터가 부족합니다.")
    return float(low.iloc[-(window + 1):-1].min())


def return_252d(close: pd.Series) -> float:
    """252 거래일 수익률"""
    if len(close) < 253:
        raise ValueError("252 거래일 수익률 계산에 데이터가 부족합니다.")
    return float((close.iloc[-1] / close.iloc[-253]) - 1)
