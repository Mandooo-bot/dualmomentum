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


def _hex_to_rgb(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"{r},{g},{b}"


_CATEGORY_ORDER = [
    "인덱스 코어",
    "시스템/인프라섹터",
    "모멘텀/고베타",
    "알파 후보",
    "개별주1",
    "개별주2",
    "개별주3",
]
_CATEGORY_COLOR = {
    "인덱스 코어":      "#4f8ef7",
    "시스템/인프라섹터": "#a78bfa",
    "모멘텀/고베타":    "#f59e0b",
    "알파 후보":        "#34d399",
    "개별주1":          "#f87171",
    "개별주2":          "#fb923c",
    "개별주3":          "#e879f9",
}


def _sma200_label(a: dict) -> tuple[str, str]:
    price = a.get("price", 0)
    ma200 = a.get("ma200", 0)
    if ma200 and price > ma200:
        return "↑ 위", "#22c55e"
    return "↓ 아래", "#ef4444"


def _donchian_label(a: dict) -> tuple[str, str]:
    price = a.get("price", 0)
    d55h = a.get("donchian_55d_high", 0)
    d20l = a.get("donchian_20d_low", 0)
    if d55h and price >= d55h:
        return "55D↑", "#22c55e"
    if d20l and price >= d20l:
        return "20D↑", "#22c55e"
    return "20D↓", "#ef4444"


def _asset_rows(assets: list[dict]) -> str:
    rows = ""
    sorted_assets = sorted(assets, key=lambda x: x.get("return_252d", 0), reverse=True)
    rank_bg = {
        1: ("rgba(245,158,11,0.15)", "#f59e0b"),
        2: ("rgba(148,163,184,0.12)", "#94a3b8"),
        3: ("rgba(180,120,60,0.12)", "#b47c3c"),
    }
    for rank, a in enumerate(sorted_assets, 1):
        sig = a.get("signal", "—")
        sig_color = {"매수": "#22c55e", "유지": "#94a3b8", "1차매도": "#f97316"}.get(sig, "#ef4444")
        ret = a.get("return_252d", 0)
        ret_color = "#22c55e" if ret >= 0 else "#ef4444"
        ret_str = f"+{ret:.2f}%" if ret >= 0 else f"{ret:.2f}%"
        excess = a.get("excess_return", 0)
        excess_label, excess_color = ("통과", "#22c55e") if excess >= 0 else ("미통과", "#ef4444")
        sma_label, sma_color = _sma200_label(a)
        don_label, don_color = _donchian_label(a)
        ticker = a.get("ticker", "—")
        chart_url = f"https://finance.yahoo.com/chart/{ticker}"
        r_bg, r_color = rank_bg.get(rank, ("rgba(100,116,139,0.08)", "#64748b"))
        current_w = a.get("currentWeight", "")
        target_w = a.get("targetWeight", "")
        weight_str = f"{current_w}% / {target_w}%" if current_w else "—"

        rows += f"""
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:8px 10px;text-align:center;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;font-size:11px;font-weight:700;background:{r_bg};color:{r_color};">{rank}</span>
          </td>
          <td style="padding:8px 10px;font-weight:700;font-size:13px;">{ticker}</td>
          <td style="padding:8px 10px;text-align:right;color:{ret_color};font-weight:600;">{ret_str}</td>
          <td style="padding:8px 10px;text-align:center;">
            <span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:rgba({_hex_to_rgb(excess_color)},0.12);color:{excess_color};">{excess_label}</span>
          </td>
          <td style="padding:8px 10px;text-align:center;">
            <span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:rgba({_hex_to_rgb(sma_color)},0.12);color:{sma_color};">{sma_label}</span>
          </td>
          <td style="padding:8px 10px;text-align:center;">
            <span style="padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:rgba({_hex_to_rgb(don_color)},0.12);color:{don_color};">{don_label}</span>
          </td>
          <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;">{weight_str}</td>
          <td style="padding:8px 10px;text-align:center;">
            <span style="display:inline-flex;align-items:center;gap:4px;border-radius:5px;padding:3px 9px;font-size:11px;font-weight:700;color:{sig_color};background:rgba({_hex_to_rgb(sig_color)},0.1);">{sig}</span>
          </td>
          <td style="padding:8px 10px;text-align:center;">
            <a href="{chart_url}" style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:600;color:#4f8ef7;text-decoration:none;">차트 ↗</a>
          </td>
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
          <td colspan="9" style="padding:10px 14px 6px;background:#f8fafc;border-top:2px solid {color};">
            <span style="font-size:11px;font-weight:700;color:{color};text-transform:uppercase;letter-spacing:0.05em;">{cat}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:8px;">{len(cat_assets)}종목</span>
          </td>
        </tr>"""
        sections += _asset_rows(cat_assets)

    html = f"""
    <div style="font-family:sans-serif;max-width:820px;margin:0 auto;background:#f8fafc;padding:24px;">
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
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">순위</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">티커</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">252거래일 수익률</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">절대모멘텀</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">SMA200</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">Donchian</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">현재/목표 비중</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">시그널</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;">차트</th>
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
        <h2 style="margin:0;font-size:20px;">듀얼모멘텀 매도 시그널 발생</h2>
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
