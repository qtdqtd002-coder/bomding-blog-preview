<!-- 이 앱(쓰담 PWA)은 상위 BlogPreview/PRODUCT.md를 상속한다(사이트와 동일 제품). 이 DESIGN.md는 앱의 모바일 전용 시각 시스템만 기록한다. -->
---
name: 쓰담 앱 (Sseudam PWA)
description: 쓰담 운영 허브의 설치형 모바일 앱 — 작성자별 글·트렌드·발행 큐를 손안에서
colors:
  brand: "#4C6FFF"
  brand-2: "#7C5CD1"
  brand-weak: "#EEF1FF"
  on-brand: "#FFFFFF"
  warm: "#FF8A5B"
  warm-2: "#FFB089"
  warm-weak: "#FFF1EA"
  bg: "#F5F6F9"
  bg-soft: "#EEF0F5"
  surface: "#FFFFFF"
  surface-2: "#FBFBFD"
  ink: "#15171C"
  sub: "#545A66"
  muted: "#8A909C"
  line: "#EAECF2"
  line-2: "#DCE0E8"
  ok: "#0A8A44"
  warn: "#9A6A12"
  danger: "#DC2626"
  author-bomding: "#E06C49"
  author-yeongdo: "#2F8F7F"
  author-gemdeokku: "#7C5CD1"
typography:
  section:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  hero:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  xs: "8px"
  sm: "11px"
  md: "16px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "13px"
  lg: "16px"
  xl: "22px"
components:
  button-install:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "36px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.sub}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "38px"
  chip-on:
    backgroundColor: "{colors.author-gemdeokku}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "15px 16px"
---

# Design System: 쓰담 앱 (Sseudam PWA)

## 1. Overview

**Creative North Star: "손안의 곁 (The Companion in Your Pocket)"**

쓰담 앱은 운영 허브(사이트)와 같은 제품의 모바일 얼굴이다. 같은 브랜드·같은 다정한 동료 정체성을 공유하되, 폰 화면의 물리(한 손 조작, 가로 스크롤, 하단 탭, 안전영역)에 맞춰 재단됐다. 골격은 코발트(`#4C6FFF`)→바이올렛(`#7C5CD1`) 브랜드 그라데이션이고, 코랄(`#FF8A5B`) 웜 액센트가 온기를 더한다. 사이트보다 약간 더 부드러운 회색 배경(`#F5F6F9`)과 큰 라운드(16px)로 '앱다운' 촉감을 낸다.

명시적으로 거부하는 것은 상위 PRODUCT.md와 동일하다 — 전형적 SaaS 템플릿, 차갑고 기술적인 툴, 유치한·장난스러움. 모바일이라고 장난스러워지지 않는다.

> ⚠️ **브랜드 정합 메모:** 앱의 브랜드 primary `#4C6FFF`(코발트)는 브랜드 정본과 일치한다. 반면 사이트(BlogPreview)는 `#5A4FE6`로 드리프트해 있다. 단일화 시 **앱 값(`#4C6FFF`)이 기준**이다.

**Key Characteristics:**
- 사이트와 단일 토큰 언어 지향(현재 brand 값만 드리프트 — 앱이 정본)
- 모바일 셸: 스티키 앱바 + 하단 탭(`--tab-h` 62px) + `env(safe-area-inset-*)` 대응
- 가로 스크롤 칩, 세그먼트 컨트롤, 설치 CTA 등 터치 제스처 컴포넌트
- `:active{transform:scale(.96)}` 같은 촉각 피드백
- 라이트/다크 토큰 양면, WCAG AA

## 2. Colors

코발트→바이올렛 브랜드 그라데이션이 정체성을 짊어지고, 코랄이 온기를, 부드러운 회색 램프가 면을 나눈다. 사이트보다 배경이 살짝 더 차분한 회색(`#F5F6F9`)이다.

### Primary
- **쓰담 코발트 (Sseudam Cobalt)** (`#4C6FFF`): 브랜드 골격. 설치 CTA, 활성 칩 기본, 허브 아이콘, 강조 수치. 브랜드 정본 일치값.
- **쓰담 바이올렛 (Sseudam Violet)** (`#7C5CD1`): 그라데이션 짝(스플래시·앱바 설치·히어로). 코발트와 묶여 브랜드 마크를 이룸.
- **코발트 위크 (Cobalt Wash)** (`#EEF1FF`): 액션 칩(`.ab-act`) 배경 등 옅은 강조 면.

### Secondary
- **쓰담 코랄 (Sseudam Coral)** (`#FF8A5B`) / **피치 (Peach)** (`#FFB089`): 따뜻함 액센트. 포인트로만.
- **코랄 위크 (Coral Wash)** (`#FFF1EA`).

### Tertiary — 작성자 액센트
- **봄딩 테라코타** (`#E06C49`) · **영도 틸-그린** (`#2F8F7F`) · **겜더쿠 바이올렛** (`#7C5CD1`): 칩 dot·`.on` 채움·작성자 라벨에 사용. 색이 곧 출처.

### Neutral
- **잉크** (`#15171C`) · **서브** (`#545A66`) · **뮤트** (`#8A909C`): 텍스트 3단.
- **배경** (`#F5F6F9`) · **소프트** (`#EEF0F5`) · **서피스** (`#FFFFFF`) · **서피스2** (`#FBFBFD`): 면 4단.
- **라인** (`#EAECF2`) · **라인2** (`#DCE0E8`): 보더.
- **상태:** ok `#0A8A44` · warn `#9A6A12` · danger `#DC2626`.

### Named Rules
**The Author-Color Rule.** 작성자 액센트는 출처 전용. 칩 dot·`.on` 채움·작성자 배지가 모두 같은 색 체계를 따른다.

**The Cobalt-Is-Canon Rule.** 앱의 코발트 `#4C6FFF`가 쓰담 브랜드 primary의 기준값이다. 사이트가 이 값으로 수렴한다.

## 3. Typography

**Font:** Pretendard Variable (fallback: Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui)

**Character:** 사이트와 같은 단일 가족, 웨이트로만 위계. 모바일이라 본문 16px 유지(가독·터치 타깃), 섹션 헤더는 800으로 묵직하게.

### Hierarchy
- **Section** (800, 21px, ls -0.02em): 섹션 머리(`.sec-h .t`).
- **Hero** (800, 22px, lh 1.3): 히어로 배너 제목(흰 글자).
- **Title** (700, 16px, lh 1.45): 글 카드 제목(`.p-title`), 허브 카드.
- **Body** (400, 16px, lh 1.6): 본문·리드. 보조 13–13.5px / sub.
- **Label** (700, 11–12.5px): 카테고리 칩·메타·배지·카운트.

### Named Rules
**The Touch-Body Rule.** 모바일 본문은 16px 아래로 내리지 않는다 — 가독성과 iOS 자동 줌 방지.

## 4. Elevation

앱은 사이트보다 그림자를 적극적으로 쓴다 — 카드가 기본적으로 `sh-1`로 살짝 떠 있어 '앱 카드' 촉감을 낸다. 단 무겁지 않고 두 겹의 옅은 그림자다. 브랜드 요소(설치 CTA)는 `sh-brand`(코발트 글로우)로 떠오른다.

### Shadow Vocabulary
- **sh-1** (`0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06)`): 카드·칩·메뉴 기본 부양.
- **sh-2** (`0 6px 16px rgba(16,24,40,.10), 0 12px 32px rgba(16,24,40,.10)`): 팝오버·시트 등 떠오른 레이어.
- **sh-brand** (`0 8px 22px rgba(76,111,255,.30)`): 설치 CTA·스플래시 마크의 코발트 글로우.

### Named Rules
**The Light-Lift Rule.** 카드는 옅게 떠 있되 그림자는 두 겹 저대비. 짙고 큰 그림자(2014년 앱 룩)는 금지.

## 5. Components

### App Bar
- 스티키 상단(`--appbar-h` 58px + safe-area-inset-top). 좌측 원형 백버튼(38px), 로고, 타이틀(17px/800)+서브(11px), 우측 액션.
- **설치 CTA(`.ab-install`):** 코발트→바이올렛 그라데이션 알약, 흰 글자 12.5px/800, `sh-brand`.
- **액션 칩(`.ab-act`):** `brand-weak` 면 + 브랜드 텍스트, 알약, 22% 브랜드 보더.

### Chips (가로 스크롤 필터)
- **Style:** 알약(999px), 38px 높이, `surface` 면 + `line-2` 보더, sub 텍스트 13.5px/700. 좌측 작성자 dot(9px, `--ac`).
- **State:** `.on` = 작성자 액센트(`--ac`) 채움 + 흰 텍스트 + 보더 제거 + `sh-1`. `:active{scale(.96)}`.
- 가로 스크롤(`overflow-x:auto`), 스크롤바 숨김.

### Segmented Control
- `.seg`: `bg-soft` 트랙 + 알약, 내부 버튼 활성 시 surface로 떠오름. 13.5px/700.

### Cards / Post
- **Card:** `surface` + 1px line + `--r`(16px) + `sh-1`, 패딩 15–16px.
- **Post:** `--r-sm`(11px), 좌측 4px 작성자 바(`.post::before`, `width:4px;background:var(--ac)`). 제목 16px/700.
- **Hub Card:** 아이콘 타일(42px, radius 13px, 브랜드 색) + 제목 + 설명. 진입 메뉴.
- **상태 배지:** 발행됨(`.p-pub`)·숨김(`.p-hid`, 점선 보더) 알약 칩.

### Hero
- 그라데이션 배너(`color:#fff`), `--r`, 우상단 장식 원(`::after`, 반투명). 제목 22px/800 + 리드.

### Bottom Tab Bar
- 하단 고정(`--tab-h` 62px) + safe-area-inset-bottom. 주요 뷰 전환의 1차 내비.

### Buttons / Toggles
- 알약 토글(`.p-toggle`, 34px) — surface + line-2, sub 텍스트. `:active` 촉각 피드백.

## 6. Do's and Don'ts

### Do:
- **Do** 브랜드 primary는 코발트 `#4C6FFF`(정본값)를 쓴다.
- **Do** 본문 16px 이상 유지(터치 가독·iOS 줌 방지).
- **Do** 모든 고정 요소에 `env(safe-area-inset-*)`를 반영한다(노치·홈 인디케이터).
- **Do** 터치 요소에 `:active{transform:scale(.96)}` 같은 촉각 피드백을 준다.
- **Do** 작성자 액센트를 칩 dot·`.on` 채움·배지에 일관되게(출처 전용).
- **Do** 그림자는 두 겹 저대비로 가볍게(`sh-1`/`sh-2`).
- **Do** `prefers-reduced-motion`에서 스플래시·전환을 즉시/크로스페이드로.

### Don't:
- **Don't** 전형적 SaaS 템플릿(보라→파랑 그라데이션 남용, 히어로 메트릭 카드, 동일 카드 그리드)으로 흐른다.
- **Don't** 차갑고 기술적인 데이터 대시보드처럼 만든다 — 온기 유지.
- **Don't** 유치한·장난스러운 톤(이모지 범벅)으로 간다.
- **Don't** 짙고 큰 단일 그림자(2014 앱 룩)를 쓴다.
- **Don't** `background-clip:text` 그라데이션 텍스트·기본 글래스모피즘을 쓴다.
- **Don't** 작성자 색을 장식용으로 전용한다.

> ⚠️ **리뷰 항목:** (1) 글 카드 좌측 4px 작성자 바(`.post::before`)는 impeccable "side-stripe >1px" 금지와 충돌 — 출처 표시 기능은 유지하되 재설계 검토. (2) 허브 아이콘 타일(`.hub-ic`, 둥근 사각형 브랜드색 타일)이 "rounded-square icon tile" 텔에 근접 — 의도된 진입 메뉴인지 critique에서 점검.
