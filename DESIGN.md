---
name: 쓰담 운영 허브 (Sseudam Ops Hub)
description: 게임 블로그 작성·검수·발행을 한눈에 관리하는 쓰담의 내부 운영 대시보드
colors:
  brand: "#5A4FE6"
  brand-hover: "#4A3FD4"
  brand-weak: "#EDEBFC"
  on-brand: "#FFFFFF"
  warm: "#FF6F52"
  warm-weak: "#FFEEE9"
  bg: "#FFFFFF"
  bg-subtle: "#F7F8FA"
  surface: "#FFFFFF"
  surface-2: "#F2F4F7"
  ink: "#16181D"
  sub: "#4A4F58"
  muted: "#6B7280"
  line: "#E5E7EB"
  line-strong: "#D1D5DB"
  danger: "#DC2626"
  author-bomding: "#E06C49"
  author-yeongdo: "#2F8F7F"
  author-gemdeokku: "#7C5CD1"
  author-yeonbom: "#4A86C5"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, system-ui, sans-serif"
    fontSize: "clamp(22px, 5.2vw, 28px)"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  feature:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "clamp(20px, 4.6vw, 23px)"
    fontWeight: 700
    lineHeight: 1.36
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "0.06em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.on-brand}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "18px 20px 18px 22px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.sub}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
---

# Design System: 쓰담 운영 허브 (Sseudam Ops Hub)

## 1. Overview

**Creative North Star: "곁을 지키는 관제탑 (The Warm Control Room)"**

쓰담 운영 허브는 차가운 관제 화면이 아니다. 봄딩·영도·겜더쿠·연봄 네 작성자의 글이 지금 어디쯤 있는지 — 발행됐는지, 검수 중인지, 대기 중인지 — 를 열자마자 한눈에 읽히게 하는 도구이되, '다정한 동료'라는 쓰담의 정체성대로 온기가 흐른다. 인디고-바이올렛(`#5A4FE6`)의 차분한 전문성이 골격을 잡고, 코랄(`#FF6F52`) 웜 액센트가 사람 냄새를 더한다. 밀도는 높지만 빽빽하지 않다. 흰 surface 위에 절제된 1px 보더와 옅은 그림자로 정보를 구획하고, 위계(무엇이 먼저 읽혀야 하는가)가 장식보다 항상 우선한다.

이 시스템이 명시적으로 거부하는 것: **전형적 SaaS 템플릿**(보라→파랑 그라데이션, 히어로 메트릭 카드, 끝없이 반복되는 동일 아이콘 카드 그리드), **차갑고 기술적인 개발자 대시보드**(데이터만 빽빽하고 온기 없는 화면), **유치하고 장난스러운 톤**(이모지 범벅·캐주얼 과잉). 따뜻하되 가볍지 않고, 또렷하되 차갑지 않다.

작성자 정체성은 색으로 흐른다. 각 작성자에게 고정 액센트 컬러(`--ac`)를 부여해, 카드·탭·라벨이 누구의 글인지 색만으로 구분되게 한다. 이것이 이 시스템의 시그니처다.

**Key Characteristics:**
- 라이트/다크 양면, WCAG AA 대비 보장
- 단일 폰트(Pretendard) 다중 웨이트(400–800)로 위계 구성 — 폰트 페어링 없음
- 흰 surface + 1px 보더 + 옅은 그림자, hover 시에만 살짝 떠오르는 flat-by-default 깊이
- 작성자별 고정 액센트 컬러가 정보 구조를 관통
- 코발트→바이올렛 + 코랄 웜 액센트의 쓰담 브랜드 팔레트

## 2. Colors

인디고-바이올렛 한 줄기가 브랜드를 짊어지고, 코랄 웜 액센트가 온기를, 회색 중립 램프가 정보 위계를 만든다. 채도는 절제돼 있고 따뜻함은 액센트와 타이포로 옮긴다.

### Primary
- **쓰담 인디고 (Sseudam Indigo)** (`#5A4FE6`): 브랜드 골격. 주요 CTA(`.app-cta`·`.fab`), 활성 탭, 링크 hover 시 제목 색, 강조 라벨. 화면을 지배하지 않고 '동료의 손길'처럼 요소요소에 등장.
- **인디고 호버 (Indigo Pressed)** (`#4A3FD4`): primary 버튼 hover/active의 더 깊은 톤.
- **인디고 위크 (Indigo Wash)** (`#EDEBFC`): 활성 배경·옅은 강조 면. 텍스트가 아닌 면을 칠할 때.

### Secondary
- **쓰담 코랄 (Sseudam Coral)** (`#FF6F52`): 따뜻함의 운반체. 신규·온기·인간적 강조. 차가운 툴이 되지 않게 막는 액센트로, 절제해서 쓴다.
- **코랄 위크 (Coral Wash)** (`#FFEEE9`): 코랄 강조의 옅은 배경.

### Tertiary — 작성자 액센트 (Author Identity)
- **봄딩 테라코타** (`#E06C49`): 봄딩(네이버) 글·탭·라벨.
- **영도 틸-그린** (`#2F8F7F`): 영도(네이버) 글.
- **겜더쿠 바이올렛** (`#7C5CD1`): 겜더쿠(티스토리) 글.
- **연봄 블루** (`#4A86C5`): 연봄(티스토리) 글.

### Neutral
- **잉크 (Ink)** (`#16181D`): 본문·제목 기본 텍스트.
- **서브 (Sub)** (`#4A4F58`): 보조 텍스트·설명.
- **뮤트 (Muted)** (`#6B7280`): 메타·카운트·비활성 라벨.
- **배경 (Page BG)** (`#FFFFFF`) / **서브틀 (Subtle BG)** (`#F7F8FA`) / **서피스2 (Inset)** (`#F2F4F7`): 페이지·칩·인셋 면.
- **라인 (Line)** (`#E5E7EB`) / **강한 라인 (Line Strong)** (`#D1D5DB`): 보더·디바이더.

### Named Rules
**The Author-Color Rule.** 작성자 액센트 컬러는 작성자 정체성 전용이다. 봄딩=테라코타, 영도=틸, 겜더쿠=바이올렛, 연봄=블루를 절대 교차하거나 장식용으로 전용하지 않는다. 색이 곧 출처다.

**The Warm-Restraint Rule.** 코랄은 온기의 마지막 한 방울이다. 면적이 아니라 포인트로 쓴다. 코랄이 화면을 덮으면 '다정함'이 아니라 '소란함'이 된다.

> ⚠️ **리뷰 항목(현행 코드 기준):** 사이트 브랜드 primary가 `#5A4FE6`인데 브랜드 정본·앱(PWA)은 코발트 `#4C6FFF`를 쓴다. 사이트↔앱 브랜드색이 갈린 상태 — `/impeccable critique` 또는 별도 정렬에서 단일화 결정 필요.

## 3. Typography

**Display/Body Font:** Pretendard Variable (fallback: Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui)

**Character:** 한글에 최적화된 단일 휴머니스트 산세리프 하나를, 웨이트(400→800)와 크기로만 위계를 만든다. 서로 비슷한 두 산세리프를 섞는 흔한 실수를 피하고, 한 가족의 굵기 대비로 또렷함을 낸다. 한국어 본문은 `word-break: keep-all`로 어절 단위 줄바꿈.

### Hierarchy
- **Display** (700, `clamp(22px, 5.2vw, 28px)`, lh 1.3, ls -0.02em): 뷰 제목(`.viewhead h1`). 각 탭/화면의 머리.
- **Feature** (700, `clamp(20px, 4.6vw, 23px)`, lh 1.36, ls -0.015em): 피처 카드 제목(`.f-title`). 상단 강조 글.
- **Title** (600, 18px, lh 1.4, ls -0.01em): 일반 카드 제목(`.c-title`). 목록의 주력 텍스트.
- **Body** (400, 16px, lh 1.65): 본문 기본. 설명·요약은 14.5–15.5px / sub 색.
- **Label** (700, 11px, ls 0.06em): 키커·플래그(`.f-k`), 통계 라벨, 작성자 칩. 카운트는 `font-feature-settings:"tnum"`로 자릿수 정렬.

### Named Rules
**The One-Family Rule.** 폰트는 Pretendard 하나뿐. 위계는 웨이트와 크기로만. 두 번째 폰트를 들이지 않는다.

**The Tabular-Number Rule.** 카운트·통계 수치는 항상 `tnum`. 숫자가 흔들리면 관제탑이 아니다.

## 4. Elevation

기본은 평평하다. surface는 흰 면 + 1px 보더로 구획되고, 깊이는 상태(state)에 대한 반응으로만 나타난다 — 카드 hover 시 `translateY(-2px)`로 살짝 떠오르며 중간 그림자가 붙는다. 어둡고 무거운 그림자는 없다. 그림자 색은 차가운 회색이 아니라 살짝 보랏빛이 도는 `rgba(40,32,90,...)`(큰 그림자)을 써서 브랜드 온도를 유지한다.

### Shadow Vocabulary
- **sm** (`box-shadow: 0 1px 2px rgba(16,24,40,.05)`): 칩·작은 인셋의 미세한 분리.
- **md** (`box-shadow: 0 6px 16px rgba(16,24,40,.07)`): 카드 hover 시 떠오름.
- **lg** (`box-shadow: 0 14px 34px rgba(40,32,90,.14)`): FAB·플로팅 요소. 유일하게 보랏빛 그림자.

### Named Rules
**The Flat-By-Default Rule.** 면은 쉴 때 평평하다. 그림자는 hover·focus·플로팅 같은 상태의 응답으로만 등장한다. 정적 화면에 그림자를 깔지 않는다.

## 5. Components

### Buttons
- **Shape:** 부드럽게 굴린 모서리(`--radius-sm` 8px). FAB·칩 라벨은 알약(999px).
- **Primary (`.app-cta`):** 브랜드 인디고 면 + 흰 텍스트, 13.5px / 700, 높이 고정, 좌측 아이콘 슬롯.
- **Hover / Focus:** 인디고 호버(`#4A3FD4`)로 깊어짐, 0.13s 전환. focus-visible은 브랜드 윤곽.
- **FAB (`.fab`):** 우하단 고정 알약, 브랜드 면 + `sh-lg`(보랏빛 그림자). 모바일에서 축소.
- **Ghost/탭 버튼:** 투명 배경 + sub 색, hover 시 `bg-subtle`. 활성(`.on`)은 해당 작성자 액센트 면 + 흰 텍스트.

### Chips
- **Style:** `surface-2` 배경 + sub 텍스트, 11.5px / 600, 작은 라운드. 보더 없음.
- **State:** 작성자 칩(`.who`)은 해당 `--ac` 색 텍스트로 출처 표시.

### Cards / Containers
- **Corner Style:** 12px(`--radius`).
- **Background:** 흰 `surface`, pub(발행완료) 상태는 opacity .5로 딤드(hover 시 .85).
- **Shadow Strategy:** 평소 그림자 없음, hover 시 `sh-md` + `translateY(-2px)` (Elevation 참조).
- **Border:** 1px `line`, hover 시 `line-strong`.
- **Signature:** 좌측에 3px 작성자 액센트 바(`.card::before`, `width:3px;background:var(--ac)`) — 출처를 색으로 표시하는 시그니처. hover 시 제목이 브랜드 색으로.
- **Internal Padding:** 18–22px.

### Inputs / Fields
- **Style:** `surface` 배경 + 1px 보더, `--radius-sm`, 좌측 아이콘 패딩(38px). 13.5px.
- **Focus:** 0.13s 전환으로 보더/링 강조.

### Navigation
- **Style:** 상단 nav(`.topnav`) + 팀 메뉴(`.teammenu`). 버튼은 투명·sub 색·14px/600.
- **States:** hover=`bg-subtle`; 활성(`.nav-corner.on`)=작성자/섹션 액센트 면 + 흰 텍스트·아이콘. 카운트는 `tnum` 뮤트.
- **Mobile:** 560px 이하에서 패딩·폰트 축소, 핵심 탭 우선.

### Badge (Signature)
- **badge-new:** 신규 표시, 10.5px / 800 / ls .05em.
- **badge-pub:** 발행됨 표시, 10.5px / 700, 발행 상태 카드에 부착.

## 6. Do's and Don'ts

### Do:
- **Do** 단일 폰트 Pretendard에 웨이트(400–800)로만 위계를 만든다.
- **Do** 작성자 액센트(봄딩 `#E06C49`·영도 `#2F8F7F`·겜더쿠 `#7C5CD1`·연봄 `#4A86C5`)를 출처 표시 전용으로만 쓴다.
- **Do** 면은 평평하게 두고, 그림자는 hover·focus 같은 상태 응답으로만 붙인다.
- **Do** 코랄(`#FF6F52`)을 면이 아니라 포인트로, 절제해서 온기 전달에만 쓴다.
- **Do** 수치·카운트는 `tnum`으로 자릿수를 정렬한다.
- **Do** 본문 대비 ≥4.5:1, 큰 텍스트 ≥3:1을 라이트/다크 양쪽에서 지킨다(WCAG AA).
- **Do** 한국어 본문에 `word-break: keep-all`로 어절 줄바꿈을 유지한다.
- **Do** `prefers-reduced-motion`에서 hover 떠오름·전환을 크로스페이드/즉시로 대체한다.

### Don't:
- **Don't** 전형적 SaaS 템플릿을 답습한다 — 보라→파랑 그라데이션, 히어로 메트릭 카드, 끝없이 반복되는 동일 아이콘 카드 그리드 금지.
- **Don't** 차갑고 기술적인 개발자 대시보드처럼 데이터만 빽빽이 깐다 — 쓰담은 온기 있는 동료다.
- **Don't** 유치하거나 장난스럽게 간다 — 이모지 범벅·캐주얼 과잉 금지. 따뜻하되 전문성 유지.
- **Don't** `background-clip:text` 그라데이션 텍스트를 쓴다 — 강조는 웨이트·크기·단색으로.
- **Don't** 글래스모피즘(블러 유리 카드)을 기본값으로 깐다 — 드물고 목적이 분명할 때만.
- **Don't** 작성자 액센트 색을 장식용으로 전용하거나 작성자끼리 교차한다 — 색이 곧 출처다.
- **Don't** 999/9999 같은 임의 z-index를 쓴다 — 시맨틱 스케일을 따른다.

> ⚠️ **리뷰 항목:** 현재 카드 좌측 3px 액센트 바(`.card::before`)는 impeccable의 "side-stripe border >1px" 금지와 충돌한다. 출처 표시라는 기능은 유효하므로, `/impeccable critique`/`polish`에서 (a) 전체 보더 틴트, (b) 선두 색 도트/칩, (c) 1px로 축소 중 하나로 재설계할지 결정한다. 지금은 시그니처로 문서화하되 검토 대상으로 표시.
