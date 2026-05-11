import os
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from services.momentum import analyze_portfolio
from services.email_service import send_sell_signal_email, send_analysis_report_email
from services.scheduler import run_weekly_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")
USER_ID = "aksen159"
SCHEDULER_SECRET = os.getenv("SCHEDULER_SECRET", "")

app = FastAPI(title="Dual Momentum Dashboard API")
scheduler = BackgroundScheduler(timezone="Asia/Seoul")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL 미설정")
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
def init_db():
    if not DATABASE_URL:
        return
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS portfolios (
                    user_id TEXT PRIMARY KEY,
                    assets JSONB,
                    currency TEXT,
                    signal_history JSONB
                )
            """)
        conn.commit()
    finally:
        conn.close()

    # 매주 월요일 09:00 KST 자동 분석 스케줄 등록
    scheduler.add_job(
        run_weekly_report,
        CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="weekly_report",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[scheduler] 주간 리포트 스케줄 등록 완료 (매주 월요일 09:00 KST)")


@app.on_event("shutdown")
def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)


class PortfolioRequest(BaseModel):
    tickers: List[str]


class NotifyRequest(BaseModel):
    signals: List[dict]


class ReportRequest(BaseModel):
    bil_return: float
    market_pass: bool
    assets: List[dict]


class PortfolioSaveRequest(BaseModel):
    assets: List[dict]
    currency: str
    signal_history: List[dict] = []


@app.get("/api/portfolio")
def portfolio_load():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT assets, currency, signal_history FROM portfolios WHERE user_id = %s",
                (USER_ID,)
            )
            row = cur.fetchone()
    if row:
        return {
            "assets": row["assets"] or [],
            "currency": row["currency"] or "KRW",
            "signal_history": row["signal_history"] or [],
        }
    return {"assets": [], "currency": "KRW", "signal_history": []}


@app.post("/api/portfolio")
def portfolio_save(req: PortfolioSaveRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO portfolios (user_id, assets, currency, signal_history)
                VALUES (%s, %s::jsonb, %s, %s::jsonb)
                ON CONFLICT (user_id) DO UPDATE SET
                    assets = EXCLUDED.assets,
                    currency = EXCLUDED.currency,
                    signal_history = EXCLUDED.signal_history
            """, (USER_ID, json.dumps(req.assets), req.currency, json.dumps(req.signal_history)))
    return {"ok": True}


@app.post("/api/notify/report")
def notify_report(req: ReportRequest):
    try:
        send_analysis_report_email(req.bil_return, req.market_pass, req.assets)
        return {"sent": True}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메일 발송 실패: {str(e)}")


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


@app.post("/api/weekly-report")
def trigger_weekly_report(x_scheduler_secret: Optional[str] = Header(default=None)):
    if SCHEDULER_SECRET and x_scheduler_secret != SCHEDULER_SECRET:
        raise HTTPException(status_code=401, detail="인증 실패")
    try:
        result = run_weekly_report()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/debug/ticker/{ticker}")
def debug_ticker(ticker: str):
    import traceback
    try:
        from services.yfinance_client import fetch_ohlc
        df = fetch_ohlc(ticker, period_days=30)
        return {"ticker": ticker, "rows": len(df), "latest_close": float(df["Close"].iloc[-1])}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "trace": traceback.format_exc()}


@app.post("/api/analyze")
def analyze(req: PortfolioRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="티커 목록이 비어 있습니다.")
    try:
        result = analyze_portfolio(req.tickers)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
