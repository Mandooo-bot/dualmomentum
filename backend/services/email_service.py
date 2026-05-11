import resend
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
NOTIFY_TO = "aksen159@gmail.com"
FROM_EMAIL = "dualmmt@resend.dev"


def _send(subject: str, html: str) -> None:
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY 환경변수가 설정되지 않았습니다.")
    resend.api_key = RESEND_API_KEY
    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": NOTIFY_TO,
        "subject": subject,
        "html": html,
    })


_CATEGORY_ORDER = ["인덱스 코어", "시스템/인프라섹터", "모멘텀/고베타", "알파 후보"]
_CATEGORY_COLOR = {
    "인덱스 코어":      "#4f8ef7",
    "시스템/인프라섹터": "#a78bfa",
    "모멘텀/고베타":    "#f59e0b",
    "알파 후보":        "#34d399",
}


def _asset_rows(assets: list[dict]) -> str:
    rows = ""
    for a in sorted(assets, key=lambda x: x.get("return_252d", 0), reverse=True):
        sig = a.get("signal", "—")
        sig_color = {"매수": "#22c55e", "유지": "#94a3b8", "1차매도": "#f97316"}.get(sig, "#ef4444")
        ret = a.get("return_252d", 0)
        ret_color = "#22c55e" if ret >= 0 else "#ef4444"
        ret_str = f"+{ret:.2f}%" if ret >= 0 else f"{ret:.2f}%"
        excess = a.get("excess_return", 0)
        excess_label, excess_color = ("통과", "#22c55e") if excess >= 0 else ("미통과", "#ef4444")
        rows += f"""
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:9px 14px;font-weight:700;font-size:13px;">{a.get("ticker","—")}</td>
          <td style="padding:9px 14px;text-align:right;color:{ret_color};font-weight:600;">{ret_str}</td>
          <td style="padding:9px 14px;text-align:center;color:{excess_color};font-weight:600;">{excess_label}</td>
          <td style="padding:9px 14px;text-align:center;color:{sig_color};font-weight:700;">{sig}</td>
        </tr>"""
    return rows


def send_analysis_report_email(bil_return: float, market_pass: bool, assets: list[dict]) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    market_color = "#22c55e" if market_pass else "#ef4444"
    market_label = "통과 — 투자 유효 구간" if market_pass else "미통과 — BIL 대피"

    grouped: dict[str, list] = {}
    for a in assets:
        cat = a.get("category") or "알파 후보"
        grouped.setdefault(cat, []).append(a)

    known = [c for c in _CATEGORY_ORDER if c in grouped]
    extra = sorted(c for c in grouped if c not in _CATEGORY_ORDER)
    render_order = known + extra

    sections = ""
    for cat in render_order:
        cat_assets = grouped.get(cat, [])
        if not cat_assets:
            continue
        color = _CATEGORY_COLOR.get(cat, "#94a3b8")
        sections += f"""
        <tr>
          <td colspan="4" style="padding:10px 14px 6px;background:#f8fafc;border-top:2px solid {color};">
            <span style="font-size:11px;font-weight:700;color:{color};text-transform:uppercase;letter-spacing:0.05em;">{cat}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:8px;">{len(cat_assets)}종목</span>
          </td>
        </tr>"""
        sections += _asset_rows(cat_assets)

    html = f"""
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;padding:24px;">
      <div style="background:#1e2030;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">듀얼모멘텀 분석 리포트</h2>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">{now} 기준 분석 결과</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:20px 24px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;">시장 절대모멘텀 판정 (VOO vs BIL)</div>
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="font-size:16px;font-weight:700;color:{market_color};">{market_label}</span>
          <span style="font-size:12px;color:#94a3b8;">BIL 기준수익률: +{bil_return:.2f}%</span>
        </div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;background:#fff;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:9px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">티커</th>
              <th style="padding:9px 14px;text-align:right;font-size:11px;color:#64748b;font-weight:600;">252거래일 수익률</th>
              <th style="padding:9px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:600;">절대모멘텀</th>
              <th style="padding:9px 14px;text-align:center;font-size:11px;color:#64748b;font-weight:600;">시그널</th>
            </tr>
          </thead>
          <tbody>{sections}</tbody>
        </table>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center;">
        듀얼모멘텀 대시보드 자동 알림 · 투자 결정은 본인 판단 하에 이루어져야 합니다.
      </p>
    </div>"""

    _send(f"[듀얼모멘텀] 분석 리포트 — {now}", html)


def send_sell_signal_email(signals: list[dict]) -> None:
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

    _send(f"[듀얼모멘텀] 매도 시그널 {len(signals)}건 발생 — {now}", html)
