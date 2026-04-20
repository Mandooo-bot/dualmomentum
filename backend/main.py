import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from services.momentum import analyze_portfolio
from services.email_service import send_sell_signal_email
from supabase import create_client

app = FastAPI(title="Dual Momentum Dashboard API")

_sb = None
def get_supabase():
    global _sb
    if _sb is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_KEY", "")
        if url and key:
            _sb = create_client(url, key)
    return _sb

USER_ID = "aksen159"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PortfolioRequest(BaseModel):
    tickers: List[str]


class NotifyRequest(BaseModel):
    signals: List[dict]


@app.post("/api/notify")
def notify(req: NotifyRequest):
    if not req.signals:
        return {"sent": False, "reason": "매도 시그널 없음"}
    try:
        send_sell_signal_email(req.signals)
        return {"sent": True}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메일 발송 실패: {str(e)}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/debug/ticker/{ticker}")
def debug_ticker(ticker: str):
    import traceback
    from datetime import datetime, timedelta
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        end = datetime.today()
        start = end - timedelta(days=30)
        df_date = t.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), auto_adjust=True)
        df_period = t.history(period="1mo", auto_adjust=True)
        df_2y = t.history(period="2y", auto_adjust=True)
        return {
            "ticker": ticker,
            "date_range_rows": len(df_date),
            "period_1mo_rows": len(df_period),
            "period_2y_rows": len(df_2y),
            "today": end.strftime("%Y-%m-%d"),
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "trace": traceback.format_exc()}


class PortfolioSaveRequest(BaseModel):
    assets: List[dict]
    currency: str


@app.get("/api/portfolio")
def portfolio_load():
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase 미설정")
    res = sb.table("portfolios").select("assets, currency").eq("user_id", USER_ID).single().execute()
    if res.data:
        return res.data
    return {"assets": [], "currency": "KRW"}


@app.post("/api/portfolio")
def portfolio_save(req: PortfolioSaveRequest):
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase 미설정")
    sb.table("portfolios").upsert(
        {"user_id": USER_ID, "assets": req.assets, "currency": req.currency},
        on_conflict="user_id"
    ).execute()
    return {"ok": True}


@app.post("/api/analyze")
def analyze(req: PortfolioRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="티커 목록이 비어 있습니다.")
    try:
        result = analyze_portfolio(req.tickers)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
