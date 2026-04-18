from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from services.momentum import analyze_portfolio
from services.email_service import send_sell_signal_email

app = FastAPI(title="Dual Momentum Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
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


@app.post("/api/analyze")
def analyze(req: PortfolioRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="티커 목록이 비어 있습니다.")
    try:
        result = analyze_portfolio(req.tickers)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
