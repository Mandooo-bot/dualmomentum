import logging
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone, timedelta

from services.momentum import analyze_portfolio
from services.email_service import send_analysis_report_email

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")
USER_ID = "aksen159"

KST = timezone(timedelta(hours=9))


def run_weekly_report() -> dict:
    """DB에 저장된 포트폴리오를 분석하고 이메일로 결과를 발송합니다."""
    now_kst = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    logger.info(f"[weekly-report] 시작 — {now_kst}")

    # 1. DB에서 포트폴리오 로드
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL 미설정")

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT assets, currency, signal_history FROM portfolios WHERE user_id = %s",
                (USER_ID,)
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row or not row["assets"]:
        logger.warning("[weekly-report] 저장된 포트폴리오 없음 — 종료")
        return {"ok": False, "reason": "저장된 포트폴리오 없음"}

    assets_config = row["assets"]
    tickers = [a["ticker"] for a in assets_config if a.get("ticker")]

    if not tickers:
        logger.warning("[weekly-report] 유효한 티커 없음 — 종료")
        return {"ok": False, "reason": "유효한 티커 없음"}

    logger.info(f"[weekly-report] 분석 대상 티커: {tickers}")

    # 2. 분석 실행
    result = analyze_portfolio(tickers)
    bil_return = result["bil_return_252d"]
    assets = result["assets"]

    market_pass = any(a.get("excess_return", -1) >= 0 for a in assets)

    # 3. 이메일 발송
    send_analysis_report_email(bil_return, market_pass, assets)
    logger.info("[weekly-report] 이메일 발송 완료")

    # 4. signal_history 업데이트
    history_entry = {
        "date": datetime.now(KST).strftime("%Y-%m-%d"),
        "bil_return": bil_return,
        "market_pass": market_pass,
        "signals": [{"ticker": a["ticker"], "signal": a["signal"]} for a in assets],
    }

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT signal_history FROM portfolios WHERE user_id = %s",
                (USER_ID,)
            )
            row = cur.fetchone()
            history = list(row["signal_history"] or []) if row else []
            history.insert(0, history_entry)
            history = history[:52]  # 최근 52주만 보관

            cur.execute(
                "UPDATE portfolios SET signal_history = %s::jsonb WHERE user_id = %s",
                (json.dumps(history), USER_ID)
            )
        conn.commit()
    finally:
        conn.close()

    logger.info(f"[weekly-report] 완료 — {len(assets)}개 종목 분석")
    return {"ok": True, "tickers": tickers, "assets": assets}
