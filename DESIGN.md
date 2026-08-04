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
> **v4 「작업실」(2026-08-04, 현행 확정)**. v3는 하루 만에 폐기됐다. 그 이유가 이 문서의 §1에 있다.
> 토큰 실제값 정본은 `index.html`의 `:root` 블록이며, 이 문서는 그와 동기화된 설계 근거다.

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

### Motion
- **진입 스태거**: `.reveal` + `--i` 인덱스로 55ms 간격 fade-up.
- **KPI 카운트업**: 0에서 실제값까지 ease-out cubic, 항목당 45ms 지연.
- **hover 상승**: 카드 -2~3px + 그림자 승급.
- 전부 `prefers-reduced-motion: reduce`에서 즉시 확정값·정지로 대체된다.

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
