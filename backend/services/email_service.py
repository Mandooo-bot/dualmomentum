import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
NOTIFY_TO = "aksen159@gmail.com"


def send_sell_signal_email(signals: list[dict]) -> None:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise ValueError("GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.")

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    rows = ""
    for s in signals:
        color = "#ef4444" if s["signal"] == "전체매도" else "#f97316"
        rows += f"""
        <tr>
          <td style="padding:10px 16px;font-weight:700;">{s["ticker"]}</td>
          <td style="padding:10px 16px;color:{color};font-weight:700;">{s["signal"]}</td>
          <td style="padding:10px 16px;">{s.get("return_252d","—")}%</td>
          <td style="padding:10px 16px;">{s.get("excess_return","—")}%</td>
        </tr>"""

    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e2030;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">⚠️ 듀얼모멘텀 매도 시그널 발생</h2>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">{now} 기준 분석 결과</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;">티커</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;">시그널</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;">252일 수익률</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;">BIL 초과수익</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <p style="color:#64748b;font-size:11px;margin-top:16px;">
        * 듀얼모멘텀 대시보드 자동 알림 | 투자 결정은 본인 판단 하에 이루어져야 합니다.
      </p>
    </div>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[듀얼모멘텀] 매도 시그널 {len(signals)}건 발생 — {now}"
    msg["From"] = GMAIL_USER
    msg["To"] = NOTIFY_TO
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        smtp.send_message(msg)
