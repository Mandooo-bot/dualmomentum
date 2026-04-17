from pydantic import BaseModel
from typing import Optional


class AssetConfig(BaseModel):
    ticker: str
    current_weight: Optional[float] = None   # %
    target_weight: Optional[float] = None    # %
    monthly_buy: Optional[float] = None      # 원 또는 달러
    account_type: Optional[str] = None       # ISA / 연금저축 / 일반
    rebalancing_period: Optional[str] = None # 월별 / 분기별 / 반기별


class PortfolioConfig(BaseModel):
    assets: list[AssetConfig]
    currency: str = "KRW"   # KRW | USD
    kakao_notify: bool = False
