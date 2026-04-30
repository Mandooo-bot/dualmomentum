# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 명

**Dualmomentum** — 듀얼모멘텀 전략 기반 포트폴리오 시그널 대시보드

---

## 현재 진행 상황 (2026-04-30 기준)

### 완료된 작업

| 항목 | 상태 | 비고 |
|------|------|------|
| 전략 문서화 (CLAUDE.md) | ✅ 완료 | 상대/절대모멘텀 로직 전체 기록 |
| UI 목업 (draft.html) | ✅ 완료 | 다크테마 정적 HTML, 참고용 |
| Next.js 프론트엔드 설정 | ✅ 완료 | TypeScript + Tailwind |
| 대시보드 UI 구현 | ✅ 완료 | Dashboard.tsx — 전략 소개, 포트폴리오 입력, 분석 결과 표시 |
| FastAPI 백엔드 구조 | ✅ 완료 | main.py, services/ |
| 데이터 수집 | ✅ 완료 | services/yfinance_client.py — Tiingo 우선, 429 시 Yahoo Finance v8 API 폴백 |
| 지표 계산 로직 | ✅ 완료 | MA200, Donchian 55D/20D, 252거래일 수익률 |
| 듀얼모멘텀 시그널 계산 | ✅ 완료 | services/momentum.py — BIL 비교 + 기술적 필터 |
| Supabase → Neon 마이그레이션 | ✅ 완료 | psycopg2-binary, DATABASE_URL 환경변수 |
| 분석 결과 이메일 발송 | ✅ 완료 | "결과를 이메일로 받기" 버튼, /api/notify/report, Resend API 사용 |
| Vercel 배포 (프론트엔드) | ✅ 완료 | GitHub 연동 자동 배포 |
| Railway 배포 (백엔드) | ✅ 완료 | FastAPI, dualmomentum-production.up.railway.app |

### 남은 작업

| 항목 | 우선순위 | 비고 |
|------|----------|------|
| 카카오 OAuth 2.0 구현 | 🟡 중간 | 개발자 콘솔 앱 등록 → 로그인 플로우 |
| 시그널 변화 알림 기능 | 🟢 낮음 | 카카오 메시지 API 활용 |

---

## 작업 규칙

- **어조**: 친근하고 정확하고 명확하게 (과장 금지)
- **출처가 없는 통계/수치 사용 금지**

## 절대 하지 말 것

- 출처 없는 통계 인용
- 검증 안 된 정보를 사실처럼 기술. 검증이 안 된 추론인 경우 반드시 추론임을 밝히고, 정확한 출처는 직접 확인해보기를 권유할 것

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js (React) |
| 백엔드 | Python FastAPI |
| 데이터 수집 | Tiingo API (primary) → Yahoo Finance v8 API (fallback, 429 시 자동 전환) |
| 이메일 발송 | Resend API (HTTP 기반, Railway SMTP 차단 우회) |
| 데이터베이스 | Neon (PostgreSQL, psycopg2 직접 연결, 자동 절전/자동 재개) |
| 인증 | 카카오 OAuth 2.0 (미구현) |
| 배포 | Vercel (프론트) + Railway (백엔드) |

## 개발 명령어

> 프로젝트 셋업 완료 후 아래 명령어로 개발 서버를 실행한다.

```bash
# 프론트엔드
cd frontend
npm install
npm run dev          # http://localhost:3000

# 백엔드 (venv 사용)
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload  # http://localhost:8000
```

## Railway 환경변수 (필수)

| 변수명 | 설명 |
|--------|------|
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열 (`postgresql://...@...neon.tech/neondb?sslmode=require`) |
| `TIINGO_TOKEN` | Tiingo API 토큰 (데이터 수집 primary) |
| `RESEND_API_KEY` | Resend 이메일 API 키 (`re_...`) |

## Vercel 환경변수 (필수)

| 변수명 | 설명 |
|--------|------|
| `NEXT_PUBLIC_API_URL` | Railway 백엔드 URL (`https://dualmomentum-production.up.railway.app`) |

## 데이터 수집 구조

- **primary**: Tiingo API (`TIINGO_TOKEN` 필요, 무료 1000 req/day, 2GB/월)
- **fallback**: Yahoo Finance v8 JSON API (헤더 우회, Tiingo 429 초과 시 자동 전환)
- Tiingo 월간 한도: 매월 1일 자정 리셋

## 아키텍처 구조

```
my-project/
├── frontend/          # Next.js — 대시보드 UI
│   └── app/
│       ├── page.tsx           # 메인 대시보드
│       ├── api/auth/          # 카카오 OAuth 콜백
│       └── components/
├── backend/           # FastAPI — 데이터 처리
│   ├── main.py                # 라우터 진입점
│   ├── services/
│   │   ├── momentum.py        # 252거래일 수익률, 초과수익 계산
│   │   ├── indicators.py      # MA200, Donchian 55D/20D 계산
│   │   └── yfinance_client.py # OHLC 데이터 수집 (최근 300거래일)
│   └── models/
│       └── portfolio.py       # 포트폴리오 데이터 스키마
├── draft.html         # UI 목업 (정적 HTML, 참고용)
└── CLAUDE.md
```

## 핵심 데이터 흐름

1. 티커 입력 → Tiingo API(primary) / Yahoo Finance v8(fallback)로 OHLC 430거래일치 수집
2. 서버에서 직접 계산: 252거래일 수익률, BIL 초과수익, MA200, Donchian 55D 상단/20D 하단
3. 절대모멘텀(BIL 비교) → 상대모멘텀(순위) → 기술적 필터(MA200·Donchian) 순으로 판정
4. 결과를 Neon(PostgreSQL)에 저장, 프론트엔드로 반환

## 시그널 판정 로직

```python
# 절대모멘텀 기준1 (대전제)
if return_252d - bil_return_252d < 0:
    signal = "전체매도"

# 절대모멘텀 기준2 (기술적 필터)
elif price > ma200 and price >= donchian_55d_high:
    signal = "매수"
elif price > ma200 and price >= donchian_20d_low:
    signal = "유지"
elif price < donchian_20d_low:
    signal = "1차매도"
elif price < ma200:
    signal = "전체매도"
```

---

# 듀얼모멘텀 장기 주식 투자 전략

## 작업 규칙

- **어조**: 친근하고 정확하고 명확하게 (과장 금지)
- **출처가 없는 통계/수치 사용 금지**

## 절대 하지 말 것

- 출처 없는 통계 인용
- 검증 안 된 정보를 사실처럼 기술. 검증이 안 된 추론인 경우 반드시 추론임을 밝히고, 정확한 출처는 직접 확인해보기를 권유할 것

---

## 개요

장기 투자 관점에서 **상대모멘텀**과 **절대모멘텀**을 결합한 듀얼모멘텀 전략을 사용한다.

---

## 1. 상대모멘텀 (Relative Momentum)

- **기준**: 252 거래일(약 1년) 수익률
- **종목 선별**: 252 거래일 수익률 기준 상위 종목 선별
- **비중**: 선별된 종목에 **동일가중(Equal Weight)** 투자

---

## 2. 절대모멘텀 (Absolute Momentum)

### 기준 1 — 대전제 (전체 매도 조건)

- 각 자산의 **252 거래일 수익률 - BIL의 252 거래일 수익률**이 **마이너스(음수)** 인 경우 해당 자산 전체 매도
- 즉, 자산의 1년 수익률이 BIL(단기국채)보다 낮아 초과수익이 발생하지 않으면 시장 대피

### 기준 2 — 매수 / 유지 / 매도 조건 (기술적 필터)

| 상태 | 조건 |
|------|------|
| **매수** | 종가가 200일 이동평균선 **위** & Donchian Channel **55일 상단** 돌파 |
| **유지** | 종가가 200일 이동평균선 **위** & Donchian Channel **20일 하단** 미이탈 |
| **1차 매도** | 종가가 Donchian Channel **20일 하단** 이탈 |
| **전체 매도** | 종가가 200일 이동평균선 **아래**로 하락 |

---

## 3. 의사결정 흐름

```
[매 리밸런싱 시점]
       │
       ▼
252일 수익률 < BIL 수익률?
  YES → 전체 매도 (현금/BIL 보유)
  NO  ↓
       ▼
상대모멘텀 상위 종목 선별 (252일 수익률 순위)
       │
       ▼
종목별 절대모멘텀 필터 적용
  - 200MA 위 & Donchian 55d 상단 돌파 → 매수
  - 200MA 위 & Donchian 20d 하단 유지 → 보유 유지
  - Donchian 20d 하단 이탈 → 1차 매도
  - 200MA 아래 → 전체 매도
       │
       ▼
선택된 종목 동일가중 편입
```

---

## 4. 주요 지표 정의

| 지표 | 설명 |
|------|------|
| **252 거래일 수익률** | 약 1년치 일별 거래일 기준 가격 변화율 |
| **BIL** | SPDR Bloomberg 1-3 Month T-Bill ETF (단기국채, 무위험 수익률 기준) |
| **200일 이동평균선** | 200거래일 종가 단순 이동평균 (SMA 200) |
| **Donchian 55d 상단** | 최근 55거래일 최고가 |
| **Donchian 20d 하단** | 최근 20거래일 최저가 |

---

## 5. 전략 원칙

- 모멘텀은 **추세 추종** 기반 — 오르는 종목이 계속 오르는 경향 활용
- 절대모멘텀은 **하락장 방어** — BIL 대비 수익률로 시장 전체 리스크 판단
- 기술적 필터(200MA, Donchian)는 **진입/청산 타이밍** 정밀화
- 동일가중은 **특정 종목 쏠림 방지**

---

## 6. 웹사이트 기획

### 목적
DCA(정액 적립식)로 모아가는 자산들을 입력하면, 듀얼모멘텀 전략 기준에 따라 각 자산의 현재 상태(매수/유지/매도)를 자동으로 판단해주는 대시보드

### 자산 분류 체계

입력된 티커를 아래 4가지 카테고리로 자동 분류 (기타 없음):

| 카테고리 | 설명 | 예시 |
|----------|------|------|
| **인덱스 코어** | 시장 전체를 추종하는 광범위 지수 ETF | VOO, SPY, QQQ, VTI, GLD |
| **인프라/시스템 섹터** | 방어적 섹터 ETF (유틸리티, 부동산, 헬스케어, 산업재 등) | XLU, VNQ, XLV, XLE, XLI |
| **모멘텀/고베타** | 레버리지 ETF, 고베타·강한 모멘텀 자산 | TQQQ, UPRO, SOXL, SOXX, SMH |
| **알파 후보** | 테마·팩터·액티브 초과수익 추구 자산 (분류 불명 포함) | ARKK, BOTZ, CLOU, HACK |

- 분류 불명 티커는 **알파 후보**로 자동 배정
- 추가 시 드롭다운으로 수동 변경 가능

### 분석 플로우

```
[티커 입력]
     │
     ▼
자산 카테고리 분류
     │
     ▼
252 거래일 수익률 조회
  → stockcharts.com/freecharts/per.php?@{TICKER1,TICKER2,...} 활용
     │
     ▼
절대모멘텀 기준1 확인
  각 자산의 252거래일 수익률 - BIL 252거래일 수익률 < 0?
  YES → 매도 시그널
  NO  → 통과 → 다음 단계
     │
     ▼
절대모멘텀 기준2 확인 (기술적 필터)
  - 종가 > MA200 & Donchian 55D 상단 → 매수
  - 종가 > MA200 & Donchian 20D 상단 유지 → 유지
  - Donchian 20D 하단 이탈 → 1차 매도
  - 종가 < MA200 → 전체 매도
     │
     ▼
결과 대시보드 출력
```

### 입력 항목 (확정)

| 항목 | 설명 |
|------|------|
| 보유 자산 티커 | 쉼표 구분 입력 (예: VOO, QQQ, BIL) |
| 현재 비중 (%) | 각 자산의 현재 포트폴리오 내 비중 |
| 목표 비중 (%) | 각 자산의 목표 비중 — 현재 비중과 비교해 리밸런싱 우선순위 판단 |
| 월 전체 매수 금액 | 원 또는 달러 선택 |
| 매수/매도 주기 | 일별 / 주별 / 월별 등 |
| 리밸런싱 주기 | 월별 / 분기별 / 반기별 등 |
| 계좌 종류 | ISA / 연금저축 / 일반 계좌 (세금 처리 방식 구분) |
| 기준 통화 | 원(KRW) / 달러(USD) 선택 |
| 시그널 변화 알림 | 매수→유지, 유지→매도 등 상태 변화 시 알림 수신 여부 |
| 리포트 출력 형식 | 화면 표시 / PDF 다운로드 / 이메일 중 선택 |

---

## 7. 서비스 방향 및 사용자 설정

### 대상 사용자
- **1차**: 본인 전용 포트폴리오 관리 도구
- **2차**: 일반 공개 — 동일한 전략을 사용하는 누구나 가입 후 사용 가능

### 회원가입 / 로그인
- **카카오톡 소셜 로그인** 으로 회원가입 (카카오 OAuth 2.0 활용)
- 로그인 후 포트폴리오 정보(티커, 비중, 설정 등)가 **계정에 저장**되어 재방문 시 유지
- 별도 아이디/비밀번호 없이 카카오 계정으로만 인증

### 데이터 저장 범위 (로그인 사용자 기준)
- 보유 자산 목록 및 비중
- 목표 비중
- 매수/리밸런싱 주기 설정
- 계좌 종류 및 기준 통화
- 알림 수신 설정
- 과거 시그널 이력 (선택적으로 저장)
