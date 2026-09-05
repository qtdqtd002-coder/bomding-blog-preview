---
name: 쓰담 운영 허브 (Sseudam Ops Hub)
description: 게임·IT 블로그 작성·검수·발행을 한눈에 관리하는 쓰담의 내부 운영 대시보드
colors:
  paper: "#F2F0EC"
  paper-2: "#E9E6E0"
  surface: "#FFFFFF"
  surface-2: "#F6F4F1"
  surface-3: "#EDEAE5"
  ink: "#1A1815"
  ink-2: "#514B44"
  ink-3: "#6F6961"
  line: "#E2DED7"
  line-2: "#CFC9C0"
  line-3: "#B6AFA4"
  accent: "#C4482A"
  accent-hover: "#A93A20"
  accent-soft: "#FBEAE4"
  on-accent: "#FFFFFF"
  ok: "#15703C"
  warn: "#8A5D08"
  bad: "#B3261E"
  info: "#1B5FA8"
  author-bomding: "#D9603C"
  author-yeongdo: "#2A8574"
  author-gemdeokku: "#7355C9"
  author-yeonbom: "#3F7EC0"
  author-harusari: "#BC3D73"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  panel:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "16.5px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.022em"
  row:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "15.5px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  metric:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
components:
  panel:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 18px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    borderColor: "{colors.line-2}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 14px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 15px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  kpi-card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.md}"
    padding: "15px 18px 16px"
  row:
    backgroundColor: "{colors.surface}"
    minHeight: "58px"
    padding: "0 20px 0 0"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    borderColor: "{colors.line}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
---

# Design System: 쓰담 운영 허브 (Sseudam Ops Hub) — v4 「작업실 (The Studio)」

> **버전 이력** — v2 「따뜻한 관제탑」(인디고) → v3 「편집국」(세리프·신문 조판, 2026-08-03) →
> **v4 「작업실」(2026-08-04)** → **★v5 「Signal」(2026-09-03, 현행)** → **v5.1 모션 계층(2026-09-04)**.
> v3는 하루 만에 폐기됐다. 그 이유가 이 문서의 §1에 있다.
> 토큰 실제값 정본은 `index.html`의 `:root` 블록이며, 이 문서는 그와 동기화된 설계 근거다.
>
> **★stale 고지(2026-09-04)** — v5 「Signal」은 탭 2개(작성 글·트렌드)·무채색 크롬(색은 작성자·데스크 «정체성»에만)·이중 베젤로 전면 개편되며
> **다크모드·관리자·앱 설치·스플래시·따뜻한 종이톤·테라코타 브랜드색을 폐기**했다. 따라서 위 frontmatter 토큰과 §1~§5 의 색·다크모드·
> 세그먼트·KPI·스플래시·SFX 서술은 v4 기준으로 **낡았다** — 현행 색·반경·그림자는 `index.html` 상단 주석 + `:root` 가 정본이고,
> v4 의 **원칙 5(면으로 나눔·라벨 ≥12.5px·1920×1080·버튼 36~38px·여백)와 Named Rules·Do/Don't 는 v5 에도 그대로 유효**하다.
> 모션은 §5 Motion 이 v5.1 로 갱신돼 현행이다. 전면 재작성은 별건.

## 1. Overview

**Creative North Star: "잘 정돈된 작업실 (The Studio)"**

쓰담 운영 허브는 봄딩·영도·겜더쿠·연봄·하루살이 다섯 작성자의 글이 지금 어디쯤 있는지 —
확인 대기인지, 발행됐는지, 큐에 밀려 있는지 — 를 열자마자 파악하고 곧장 다음 행동으로 넘어가는 도구다.
매일 여러 번 여는 화면이므로 **눈이 편하고, 경계가 분명하고, 누를 것이 눌러 보이는 것**이 미학보다 앞선다.

**v3에서 무엇이 틀렸나 (이 시스템의 존재 이유)**

v3는 "편집국"이라는 은유를 택해 세리프 헤드라인 + 1px 룰/점선 + 10px 모노 마이크로라벨로 신문 조판을 흉내 냈다.
제안서와 시안 단계에서는 독창적이고 브랜드에 맞아 보였다. 그러나 실제로 매일 쓰자 세 가지가 무너졌다.

1. **영역 경계가 안 보였다** — 얇은 선과 점선만으로 나누니 블록이 서로 흘러 붙었다.
2. **버튼이 버튼으로 안 보였다** — 텍스트에 가까운 링크형 컨트롤이라 클릭 대상이 불분명했다.
3. **글씨가 눈에 안 들어왔다** — 10~12px 모노 라벨과 세리프 본문이 한국어 UI에서 읽히지 않았다.

사용자의 표현 그대로 **"지저분한 신문기사"** 였다. 교훈은 하나다 —
**컨셉이 강할수록 "이 은유가 사용자의 실제 과업을 돕는가"를 따로 검증해야 한다. 시안 승인 ≠ 사용성 검증.**

**v4의 다섯 원칙**

1. **영역은 '선'이 아니라 '면'으로 나눈다** — 모든 블록이 패널(배경 + 테두리 + 여백 + 미세 그림자)을 갖는다.
2. **읽히는 게 먼저다** — Pretendard 단일, 라벨은 12.5px 이상, 모노는 숫자 전용.
3. **1920×1080이 기준 해상도다** — `--maxw:1560px`. 2컬럼을 장식이 아니라 실제로 쓴다.
4. **버튼은 버튼처럼** — 높이 36~38px 고정, 면·테두리·상태 전환이 분명하게.
5. **밀도는 낮추고 여백을 준다** — 정보를 줄이지 않되 숨 쉴 자리를 만든다.

**Key Characteristics**
- 라이트/다크 양면, WCAG AA 대비 보장
- 따뜻한 뉴트럴 배경(`#F2F0EC`) 위에 **순백 패널**을 띄워 계층을 만든다
- 작성자 색은 출처 표시 전용 — 행 좌측 4px 바, 아바타 링, 칩 채움
- 테라코타 액센트(`#C4482A`) 하나로 브랜드 온기를 유지
- 진입 스태거·KPI 카운트업 등 최소한의 동적 UI (전부 `prefers-reduced-motion` 대체 경로 보유)

## 2. Colors

배경과 패널의 **밝기 차이**가 이 시스템의 첫 번째 도구다. 배경(`#F2F0EC`)이 패널(`#FFFFFF`)보다 어둡기 때문에
패널이 떠 보이고, 그것만으로 영역이 나뉜다. 선은 보조일 뿐이다.

### Surface (면 램프)
- **Paper** (`#F2F0EC`): 앱 배경. 패널보다 반드시 어둡다.
- **Paper Deep** (`#E9E6E0`): 더 깊은 구분 띠.
- **Surface** (`#FFFFFF`): 패널·행·카드.
- **Surface Inset** (`#F6F4F1`) / **Inset Hover** (`#EDEAE5`): 칩·인셋·행 hover.

### Ink (텍스트 램프)
- **Ink** (`#1A1815`): 제목·행 제목·본문 기본.
- **Ink 2** (`#514B44`): 보조 텍스트·칩 텍스트.
- **Ink 3** (`#6F6961`): 메타·라벨·비활성. *종이 위 4.8:1로 AA 통과.*

### Line
- **Line** (`#E2DED7`) 기본 구획 / **Line 2** (`#CFC9C0`) 버튼·입력 / **Line 3** (`#B6AFA4`) hover 강조.

### Accent — 쓰담 테라코타
- **Accent** (`#C4482A`): 브랜드 온기의 유일한 운반체. 종이 위 **4.9:1**, 흰 글자 위 **5.2:1** — 텍스트·채움 양쪽 AA.
- **Accent Hover** (`#A93A20`) / **Accent Soft** (`#FBEAE4`): 눌림·옅은 강조면.

### Status
- **OK** (`#15703C`) 발행 완료 / **Warn** (`#8A5D08`) 검수·진행 / **Bad** (`#B3261E`) 실패·삭제 / **Info** (`#1B5FA8`) 신규·대기.

### Author Identity (출처 전용)
- 봄딩 **테라코타** `#D9603C` · 영도 **틸** `#2A8574` · 겜더쿠 **바이올렛** `#7355C9` ·
  연봄 **블루** `#3F7EC0` · 하루살이 **마젠타** `#BC3D73`

### Topic Desk Category (주제 분류 전용 — 2026-08-14 신설 · 08-15 5분류로 확장)
트렌드 탭의 일간 토픽 데스크가 쓰는 **네 번째 색 축**이다. 작성자 색과 목적이 다르다 —
저건 "누가 썼나", 이건 "무슨 종류의 소식인가".

- 주로 다루는 게임 `--c-core` `#9C3F6E` · 신작 게임 `--c-new` `#1B5FA8` · 최근 업데이트 `--c-upd` `#15703C` ·
  최근 화제 `--c-hot` `#C4482A` · 콘솔 게임 `--c-con` `#5B4B8A`

**왜 새 축을 허용했나.** 다섯 중 셋은 이미 대비 검증을 마친 기존 토큰(`info`·`ok`·`accent`)을 그대로 재사용하므로
실제로 늘어난 색은 **콘솔 바이올렛과 주력 마젠타 둘뿐**이다
(콘솔 종이 위 6.5:1 / 다크 `#A99AE0` 7.6:1 · 주력 종이 위 5.5:1 / 다크 `#E58AB4` 7.8:1 — 전부 AA).

**마젠타 주의.** `--c-core` `#9C3F6E` 는 하루살이 `#BC3D73` 과 계열이 가깝다. 지금은 충돌하지 않는다 —
`core` 는 `core-games.cjs` 가 **봄딩·영도만** 대상으로 산출하므로 하루살이가 이 분류의 레인으로 나올 수 없다.
★하루살이(또는 다른 마젠타 계열 작성자)를 `core` 대상에 넣게 되면 **이 색을 먼저 바꾼다.**

**The Category-Never-Alone Rule.** 분류는 **색만으로 전달하지 않는다.**
섹션 헤더는 항상 `아이콘 + 한글 라벨 + 건수`를 함께 띄우고, 행의 분류 정보도 목적 태그 텍스트로 중복 표기한다.
작성자 색에 적용한 규칙(색 옆에 항상 이름)을 그대로 따른다 — `core` 행의 레인 칩도 **아바타 + 작성자 이름**을 함께 둔다.

### Topic Desk List (목록 — 2026-08-15, 카드 그리드 폐기)
초판은 카드 그리드였다. 사용자 평가는 **"어떤 게임인지 한눈에 보기가 힘들다"** 였고, 원인이 명확했다 —
카드마다 게임명이 서로 다른 높이에 놓여 **세로로 훑을 축이 없었다.**
→ §Row(목록) 패턴을 따라 **게임명을 고정 열로 세웠다.** 눈이 한 축만 따라가면 되고, 스캔 대상이 곧 게임이 된다.

- 열 구성: `4px 색바 · 168px 게임명(+플랫폼·화제도·레인) · 1fr 주제+왜 · 148px 목적·시의성 · 122px 발주`
- **모든 셀에 `grid-row:1`** — 안 하면 메타가 2행으로 흘러 줄이 깨진다(§Row와 동일한 함정).
- 1240px에서 목적·시의성 열을 접어 본문 아래로 내리고, 960px에서 `grid-template-areas`로 3줄 카드 행이 된다.
- 교훈: **정보를 줄이지 않고 축을 세우는 것**이 스캔 가능성을 만든다. 카드는 정보를 담지만 축을 주지 않는다.

### Named Rules

**The Author-Color Rule.** 작성자 색은 출처 전용이다. 교차하거나 장식으로 전용하지 않는다. 색이 곧 출처다.
단, **색만으로 정보를 전달하지 않는다** — 아바타 옆에 항상 이름 텍스트를 같이 둔다.

**The Theme-Pair Rule.** 면과 글자는 **반드시 같은 테마 쌍**으로 쓴다 —
`background:var(--ink)`에는 `color:var(--paper)`, `background:var(--accent)`에는 `color:var(--on-brand)`.
`color:#fff`처럼 한쪽을 고정값으로 박으면 다크에서 `--ink`가 밝아지는 순간 **흰 배경 위 흰 글자**가 된다.
(v4 개발 중 실제로 처방 라벨이 이 방식으로 완전히 사라졌다.)

**The Surface-Gap Rule.** 배경과 패널은 항상 다른 밝기여야 한다. 같아지면 영역 구분이 즉시 무너진다.

## 3. Typography

**단일 폰트: Pretendard Variable** (fallback: Pretendard, -apple-system, "Apple SD Gothic Neo", system-ui)
**수치 전용: JetBrains Mono** — KPI·카운트·읽기 시간·날짜에만. 한글에는 절대 쓰지 않는다.

### Hierarchy
- **Display** (800, 24px, ls -0.03em): 뷰 제목(`.viewhead h1`).
- **Panel** (700, 16.5px, ls -0.022em): 패널 제목(`.panel-h h2`).
- **Row** (600, 15.5px, ls -0.018em): 목록 행 제목(`.c-title`) — 이 화면에서 가장 많이 읽는 텍스트.
- **Body** (400, 15.5px, lh 1.72): 본문·설명.
- **Label** (600, 13px): 칩·버튼·메타 라벨.
- **Metric** (Mono 700, 30px): KPI 숫자. 서고 카운트는 38px.

### Named Rules

**The Readable-Floor Rule.** UI 라벨의 하한은 **12.5px**이다. 그 아래로 내려가면 한국어에서 읽히지 않는다.
v3는 10~11px 모노 라벨을 썼고 그게 "눈에 안 들어온다"의 직접 원인이었다.

**The Mono-For-Numbers-Only Rule.** 모노스페이스는 숫자에만. JetBrains Mono에는 한글 글리프가 없어
한글이 섞이면 시스템 폰트로 폴백해 굴림체처럼 깨진다. 숫자는 `font-feature-settings:"tnum"`으로 자릿수 정렬.

**The One-Family Rule.** 폰트는 Pretendard 하나. 위계는 웨이트(400–800)와 크기로만. 세리프를 다시 들이지 않는다.

## 4. Elevation

깊이는 **면의 밝기 차 → 1px 테두리 → 미세 그림자** 순으로 만든다. 그림자는 마지막 보조 수단이다.

### Shadow Vocabulary
- **xs** (`0 1px 2px rgba(52,42,30,.05)`): 패널·카드 기본. 거의 안 보이지만 종이가 떠 있다는 신호.
- **sm** (`0 1px 3px + 0 1px 2px`): 세그먼트의 선택된 탭, hover한 행 카드.
- **md** (`0 4px 14px + 0 2px 5px`): hover로 들어올려진 KPI·클러스터·갤러리 카드.
- **lg** (`0 16px 40px rgba(40,30,18,.16)`): FAB·서고 블록 등 떠 있는 요소.
- **ring** (`0 0 0 3px accent-soft`): 입력 포커스.

그림자 색은 회색이 아니라 **따뜻한 갈색 계열**(`rgba(52,42,30,…)`)이다. 종이 온도를 유지하기 위해서다.

## 5. Components

### Panel (시그니처)
- 흰 면 + 1px `line` + 16px 라운드 + `sh-xs`. 헤더(`.panel-h`)·본문(`.panel-b`)·푸터(`.panel-f`) 3부 구조.
- 헤더: 제목(16.5px/700) + 카운트 칩 + 우측 액션 버튼, 하단 1px 구분선.
- 본문이 목록일 때는 `.panel-b.flush`로 패딩을 없애 행이 패널 가장자리까지 닿게 한다.

### KPI Card
- `flex:1 1 160px`으로 가로를 균등 분할. **`auto-fit` 그리드를 쓰지 않는다** — 숨긴 셀이 섞이면 폭을 못 채운다.
- 숫자(Mono 30px) 위, 라벨(13px/600) 아래. hover 시 하단 3px 바가 좌→우로 자란다.
- **실측값만 표시한다.** 백엔드가 주지 않는 수치는 셀을 숨기고 "미연결"이라 적는다. 0으로 위장하지 않는다.

### Buttons
- **Default** (`.btn`/`.sbtn`): 높이 36px, 흰 면 + `line-2` 테두리. hover 시 `surface-2` + `line-3`.
- **Primary** (`.app-cta`/`.rf-submit`/`.fab`): `ink` 면 + `paper` 글자. hover 시 **accent로 전환** + 1~3px 상승.
- **Icon** (`.icon-btn`): 38×38 정사각, 테두리 유지.
- **Segment** (`.nav-seg`): 인셋 트랙 안에서 선택된 탭만 흰 면 + `sh-sm`으로 떠오른다.
- **Chip** (`.wchip`/`.rf-chip`): 알약, 선택 시 작성자색 채움(`--ac-fill`) + 흰 글자.

섹션 이동은 **세그먼트**, 작성자 필터는 **칩** — 선택의 성격이 다르므로 형태를 다르게 한다.

### Row (목록)
- `grid-template-columns: 4px 132px 1fr 172px 66px 78px` — 색바·작성자·제목·분류·읽기·상태.
- 높이 58px. **모든 셀에 `grid-row:1`을 명시한다** — 안 하면 메타가 2행으로 흘러 줄이 깨진다.
- 좌측 4px 작성자 색 바는 평소 `opacity:.55`, hover 시 1.0.
- 1100px 이하에서 분류 칩을 접고, 720px 이하에서 2줄 카드 행(`grid-template-areas`)으로 재배치한다.

### Inputs
- 흰 면 + `line-2` 테두리 + 8px 라운드, 패딩 11×13. focus 시 accent 테두리 + `sh-ring`.
- 검색 입력은 focus 시 250→290px로 넓어진다.

### Home — 「홈」 탭 벤토 (2026-09-04 신설 · 사이트의 대문)
탭 순서 **홈 · 작성 글 · 트렌드**, 기본 진입은 홈. 12열 비대칭 벤토(7+5 / 7+5), 860px 이하 단일 열. 타일은 전부 이중 베젤(`.tray > .core`)이며 같은 줄의 타일은 코어가 트레이를 채워 키를 맞춘다.

| 타일 | 출처 | 형태(dataviz 규칙) |
|---|---|---|
| **작업 중** (7) | 백엔드 `/requests` received·processing | 목록 행(작성자 점·주제·상태 펄스·경과). 푸터=오늘 발행·실패·마지막 발행. 1분마다 재조회, 탭 복귀 시 재조회. 빈 배열≠미연결(`REQS_OK`) |
| **잔여 사용량** (5) | `_trend/_quota.json`(`_tools/quota.cjs`, 이 PC 계정 Max 한도 창) | 링 게이지 2개(5시간 창·7일 전체, 남음 %)+모델별 7일 바. 남음 ≤15% 면 경고색+라벨. «n분 전 기준» 표시, 없으면 «스냅샷 없음» |
| **주간 사용량** (7) | `_trend/_usage.json` 최근 7일 | 일별 스택 막대(작성자 정체성 5색+기타 회색, 고정 순서), ≤24px 두께·2px 표면 간격·헤어라인 그리드, 캡 라벨은 최대일·오늘만, 범례(이름+7일 합), 툴팁(hover·focus), 표 뷰(sr) |
| **일간 발행** (5) | `/requests` 종결 상태 14일 | 발행(회색)+실패·건너뜀(경고색) 스택 막대, 머리 스탯=오늘 실패율·7일 실패율, 범례·툴팁·표 뷰 |

- **색 검증(dataviz validator)**: 작성자 5색은 정체성 정본이라 바꾸지 않는다. 검증기 결과 인접쌍 CVD ΔE 4.4(연봄↔하루살이)·회색 채도 미달 → **2차 인코딩으로 보완**(2px 간격·항상 범례·툴팁·표 뷰). 텍스트는 절대 시리즈 색을 입지 않는다.
- **차트 모션**: 막대는 기준선에서 자라고(scaleY), 게이지 호는 그려지고, 숫자는 굴러간다 — 전부 `MO.chart`. 마크업에 최종값이 있어 GSAP 없이도 정적 완성. 새 데이터가 오면 타일 코어만 제자리 교체(전체 재애니메이션 금지).
- 스냅샷 생산 = 데스크 [E](06:00) + 드레이너(발행마다). 토큰 만료면 `quota.cjs` 는 보류(exit 0)하고 사이트는 마지막 값을 «n시간 전 기준»으로 보여 준다 — 0으로 위장하지 않는다.

### Motion — v5.1 모션 계층 (2026-09-04 · GSAP 3.15 + Flip, `_vendor/gsap/` 로컬 벤더)

**원칙 5** — ①상태가 바뀌면 반드시 보간한다(뷰·행·제목·메타 숫자·탭 알약·모달·토스트·알림판) ②이동에는 방향이 있다(탭 순서·날짜 순서: 최신이 오른쪽)
③나갈 땐 ≤180ms `power2.in`, 들어올 땐 ≤500ms `expo.out` ④살아남는 요소는 다시 그리지 않고 제자리에서 움직인다(FLIP)
⑤GSAP 이 없거나 모션이 꺼지면 전부 CSS 폴백(`html.gs` 없음)으로 즉시 확정된다. 바운스·엘라스틱 이징은 쓰지 않는다.

- **뷰·본문 교체 `MO.swap`**: 나가기(0.16s, 방향 반대로 18px) → 내용 교체(+맨 위로) → 들어오기(0.5s). 탭 전환은 `#view`, 트렌드 날짜·검색은 `#tbody` 만(검색줄은 셸로 남아 타자 중 유지).
- **목록 행 FLIP** (`paintRows`·`archive`): 이전 자리 기록 → DOM 재배치(기존 노드 이동) → 새 자리로 0.42s. 새 행은 떠오르고(stagger ≤0.28s), 빠지는 행은 `absoluteOnLeave` 로 접힌다. 아카이브 행은 오른쪽으로 28px 밀려 나간다.
- **탭 알약**: 먼저 두 탭을 덮을 만큼 늘고(0.17s) 목적지로 수축(0.46s). 숫자가 바뀌어 폭만 달라지면 폭만 0.3s.
- **제목·메타·숫자**: 제목은 위로 빠지고 아래에서 들어온다. 메타는 구조가 같으면 숫자만 제자리에서 굴리고(0.55s), 다르면 크로스페이드 후 이전 값에서 이어 굴린다.
- **모달**: 배경(0.24s) → 판(0.5s, y18·scale.975) → 본문 항목 스태거(총 0.22s). 닫기는 0.16s. **토스트**는 flex 래퍼가 가로 중앙을 잡고 본체는 y·scale 만 움직인다(GSAP 이 `translate` 를 덮어써도 중앙이 깨지지 않게).
- **SVG 부품**: 아카이브 뚜껑(hover 들림)·검색 돋보기(focus 기울기)·페이저 화살촉(가는 방향)·종(unread 증가 시 1회 울림)·핀(추가 시 꽂힘)·섹션 아이콘 스트로크 드로잉(리빌 시)·발주 완료 체크 드로잉·로고 두 줄 쓰기(로드 1회 0.5s).
- **진입 `.rise`**: 가시성을 클래스에 묶지 않는다 — 기본이 «보임», GSAP 이 있을 때만 그리는 프레임 안에서 감췄다가 떠오른다. 화면 밖은 IntersectionObserver, 6초 백스톱.
- **로딩**: 스피너 대신 스켈레톤 행(shimmer).
- **★모션은 항상 켜져 있다 — 끄는 토글·저장 설정 없음, OS `prefers-reduced-motion` 도 따르지 않는다(사용자 결정 09-04)**: 이 PC 는 Windows 「애니메이션 효과」가 꺼져 있어 크롬이 reduce 를 보고했고, 사이트가 그걸 그대로 따라 모든 전환을 0.01ms 로 만들던 것이 «틱»의 원인이었다(09-04 실측: `SPI_GETCLIENTAREAANIMATION=false`). 처음엔 «기본 ON + 종 왼쪽 토글»로 넣었으나 사용자가 «끄는 것 자체를 없애라»고 결정해 토글·`localStorage.sseudam_motion`·reduce 규칙을 전부 제거했다. `html.gs` 는 GSAP 파일을 받았는지만 뜻한다(못 받으면 CSS 폴백).
- 성능: transform·opacity 위주(알약 폭만 예외 — 38px 소형 요소), 스크롤 리스너 대신 IO, 헤드리스 실측 rAF 간격 최대 17ms(탭 전환)·FLIP 40행 첫 프레임 50ms 1회.

### Cheer Splash — 축하 스플래시 (2026-09-04 · v2 «빵빠레» 09-05 · v2.1 «5초 판» 09-05 · 한시 운영, `_design/cheer/`)
봄딩의 네이버 메이트 선정(2026-09)을 축하하는 진입 화면. v5 가 폐기한 «부팅 스플래시»의 부활이 아니라 **한시 이벤트 레이어**다 — `index.html` 은 `<body>` 첫 줄의 `<script src="_design/cheer/cheer-splash.js">` 한 줄만 알고, 파일 하나가 스타일·마크업·모션·FX 를 스스로 넣는다(걷어낼 땐 그 한 줄 삭제).
- **길이(사용자 결정 09-05)**: 진입 ≈0.15s + `hold` 4.0s + 퇴장 0.85s ≈ **5.0초**. 데이터가 늦으면 `maxWait` 5.8s 까지 기다렸다가 걷힌다(최대 ≈6.7s). 바닥 3px 핑크 바 = hold 의 실제 경과(가짜 진행률이 아니라 최소 노출 타이머 그 자체).
- **구성**: 이중 베젤 플라크(트레이 24/코어 18) 위에 봄딩 스티커(나노바나나, 아바타 -Ref → 배경 키잉)가 위쪽 가장자리에 걸쳐 얹히고, 네이버 그린 점 키커 «네이버 메이트 · 2026년 9월» → 44px/800 헤드라인(«봄딩» 만 `--w-bomding`) → «당신의 글쓰기 동료, 쓰담 드림». 영도(비행 포즈 2장)가 플라크 옆 타원 궤도를 돈다. 색은 정체성에만(봄딩 핑크·영도 틸·네이버 그린) — v5 원칙 그대로.
- **안무(GSAP, 없으면 같은 CSS 키프레임)**: 0.0 플라크·봄딩 떠오름 → 0.3 헤드라인 글자 슬램(어절 단위 keep-all, 1.22→1 + blur 8→0) → **★0.95 빅 비트**(헤드라인이 다 앉은 순간: 화면 플래시 .55 · 플라크 뒤 블룸 · 충격파 링 핑크 280/그린 200 · 방사 버스트 · 코너 캐논 2발+스트리머+머즐 플래시 · 플라크 킥 1.04→1) → 1.15 영도 진입(궤도 2.9s/바퀴, 앞 z3·scale 1 / 뒤 z0·.78, 진행 방향 기울기, 방향 전환은 얇아졌다 펴지는 2D 턴, 0.4s 포즈 교대, 꼬리 틸 반짝이) → 1.5 봄딩 «기뻐서 뛰기» 루프(스쿼시 → 점프+점프 포즈 → 착지 스쿼시+하트) → 1.45~3.75 불꽃 7발(잔상 스파크+화이트 코어+링 2) → 1.8 «축하해요!» / 3.3 «정말 멋져요!» 말풍선(말꼬리는 영도 쪽) → 2.55 영도 배럴롤 → 2.7 2차 볼리 → 3.0 광택 2 → 4.0 퇴장. 바운스·엘라스틱 없음 — 펀치는 «크게서 작게 expo.out», 탄성은 스쿼시·스트레치로.
- **FX**: 의존성 0 의 Canvas 2D 파티클 2겹(뒤/앞 — 앞 겹은 플라크 위로도 떨어지며 **먹색은 뒤 겹에만**, 흰 판 위에선 때처럼 보인다). 컨페티는 뒤집힐 때 어두운 뒷면(양면). 종류 6: 컨페티(리본·원·하트·별)·스파크·스트리머·링·트윙클·플래시선. 상한 데스크톱 1100·모바일 550, 모바일은 수량 ≈55%.
- **퇴장**: 영도가 오른쪽 위로 이탈(0.38s) → 판이 카메라 쪽으로 밀리며 흐려짐(scale 1.04·blur 6, 0.36s) → 조리개(mask radial-gradient, 36px 페더) 0.62s. 클릭·Esc·Enter·Space·우하단 «건너뛰기» 로 즉시 종료.
- **반드시 걷힌다**: 데이터 준비(#view 스켈레톤 소멸 **+380ms** — 데이터 도착 직후 사이트 첫 렌더 버스트가 rAF 를 ~0.4s 붙들어 퇴장이 끊기는 것을 피한다) 뒤 종료 + maxWait 5.8s 백스톱 + JS 가 죽어도 CSS `cheerDead` 가 7.5s 에 강제 숨김. 가짜 진행률 없음.
- **빈도·수명**: 세션당 1회(`sessionStorage.sseudam_cheer_202609`) · `?cheer=1` 재생 · `?cheer=0` 끔 · **`CFG.until` 2026-10-04 지나면 자동 종료** — 연장·단축은 상수 하나. `window.SseudamCheer.skip()/state()`.
- 모션은 항상 켬(§Motion 결정과 동일). 검증=헤드리스 CDP **실시간** 프레임·프로브(데스크톱·390 모바일·GSAP 차단 폴백·클릭 스킵·세션 1회) — `--virtual-time-budget` 캡처는 GSAP 안무를 진행시키지 못해 쓰지 않는다.

### Boot Sequence (부팅 스플래시)
"프로그램이 켜지는 느낌" — 로고가 **그려지고**(쓴다) → **하트가 얹히고**(마음을 담는다) → 화면이 원형으로 **열린다**.

- **로고 마크**: 노트 아웃라인 드로잉(`stroke-dashoffset`) → 면 채움 → 본문 두 줄 긋기 → 하트 팝. 총 2.4초.
  마크는 스플래시 전용이며, 헤더는 워드마크만 쓴다(`.logo .mark{display:none}`).
- **빈도**: 세션당 1회(`sessionStorage.sseudam_booted`). 재방문·새로고침은 0.3초 페이드.
  `?boot=1`로 언제든 재생(모션 설정·세션 기록 무시).
- **진행 표시**: 실제 fetch 5종(posts/trend/published/hidden/mpub) 완료에 연동한다.
  **연출용 가짜 진행을 만들지 않는다** — 수치를 지어내지 않는다는 원칙의 연장.
- **★반드시 걷힌다**: 데이터가 영영 안 와도 `MAX_WAIT`(7초) 백스톱이 강제 종료한다.
  스플래시는 화면을 통째로 가리므로, 걷히지 않는 실패 모드는 곧 서비스 중단이다.

### Sound (SFX)
- Web Audio **합성**으로만 만든다 — 오디오 파일 0바이트. 부팅음(패드 + 획 노이즈 스윕 ×2 + 하트 팝 + 착지 화음), 탭 틱, 글 진입 스위시. 마스터 게인 0.14로 절제.
- **★브라우저 자동재생 정책**: 사용자 제스처 전에는 소리를 낼 수 없다. `resume()`을 시도하고 막히면 첫 포인터/키 입력에 해제하며, **실패해도 조용히 넘어간다**(에러·모달 금지).
- 우측 상단 토글 제공, 선호는 `localStorage.sseudam_sfx`에 저장.

## 6. Do's and Don'ts

### Do
- **Do** 모든 블록을 패널로 감싸 배경·테두리·여백으로 영역을 나눈다.
- **Do** 배경(`paper`)을 패널(`surface`)보다 어둡게 유지한다.
- **Do** 면과 글자를 같은 테마 쌍(`--ink`/`--paper`, `--accent`/`--on-brand`)으로 지정한다.
- **Do** UI 라벨을 12.5px 이상으로 둔다.
- **Do** 모노스페이스를 숫자에만 쓰고 `tnum`으로 자릿수를 맞춘다.
- **Do** 버튼 높이를 36~38px로 고정하고 hover/active/on 상태를 눈에 보이게 한다.
- **Do** 작성자 색 옆에 항상 이름 텍스트를 같이 둔다(색만으로 정보 전달 금지).
- **Do** 1920×1080에서 먼저 확인하고, 1366·720·390에서 되짚는다.
- **Do** 본문 대비 ≥4.5:1을 라이트/다크 양쪽에서 지킨다.
- **Do** 한국어 본문에 `word-break: keep-all`을 유지한다.
- **Do** 모든 모션에 `prefers-reduced-motion` 대체 경로를 둔다.

### Don't
- **Don't** 은유를 위해 명료함을 희생한다 — v3가 정확히 그렇게 실패했다.
- **Don't** 세리프를 본문·UI에 들인다. Pretendard 하나로 간다.
- **Don't** 10~12px 마이크로 라벨을 쓴다.
- **Don't** 얇은 선·점선만으로 영역을 나눈다.
- **Don't** `color:#fff` 같은 고정 색을 테마 토큰 면 위에 올린다(다크에서 소실된다).
- **Don't** hover에서만 나타나는 컨트롤을 만든다 — **터치 기기엔 hover가 없어 기능이 사라진다.**
  꼭 흐리게 하려면 `@media (hover:hover) and (pointer:fine)`로 가둔다.
- **Don't** 백엔드가 주지 않는 수치를 만들어 채운다. 모르면 모른다고 적는다.
- **Don't** 작성자 색을 장식으로 전용하거나 서로 교차한다.
- **Don't** 999/9999 같은 임의 z-index를 쓴다 — `--z-*` 시맨틱 스케일을 따른다.
- **Don't** 자동검증 발행글(`data-autopub="1"`)에 관리 메뉴를 노출한다 — 보호 규칙이다.
