# QA 사실/공식명칭 검수 — 애프터러브 EP 콘솔발매 (봄딩)

- 검수자: 검수1 · 사실/공식명칭 차원
- 검수일: 2026-09-06
- 대상 파일: BlogPreview/봄딩/애프터러브EP/콘솔발매/봄딩_애프터러브EP_콘솔발매_미리보기.html
- 게임: Afterlove EP (애프터러브 EP)
- 작성자: 봄딩
- 글 목적: 출시·첫인상 (콘솔 물리판 발매 D-4 소재)

---

## 판정 요약

| 심각도 | 건수 |
|--------|------|
| 🔴 치명 | 2 |
| 🟡 주의 | 4 |
| 🟢 참고 | 2 |

**판정: FAIL** (🔴 2건)

---

## 🔴 치명 — 반드시 수정

### [🔴-1] "콘솔 최초 이식" 서술 — 사실오류

- **글 서술**: "이번 콘솔판이 최초 이식이에요", "패키지 정식 발매 (콘솔 최초)", "PC판 먼저, 콘솔은 이번이 처음!"
- **실제**: Afterlove EP는 **2025년 2월 14일에 PC(Steam)·Nintendo Switch·PS5·Xbox Series X/S 동시 디지털 출시**됨. 콘솔 자체가 처음이 아니라, **물리(패키지)판 한국/아시아 출시가 처음**인 것.
- **수정 방향**: "콘솔 최초" → "콘솔 패키지(실물) 한국 첫 발매" 또는 "아시아 물리판 최초 발매"로 정정. 표 비고란의 "(콘솔 최초)"도 같이 수정.
- **근거**:
  - https://www.vgchartz.com/article/463490/afterlove-ep-releases-february-14-2025-for-ps5-xbox-series-xs-switch-and-pc/
  - https://game8.co/articles/release-dates/afterlove-ep-release-date-and-time
  - https://gonintendo.com/contents/44130-afterlove-ep-comes-to-switch-feb-14th-2025-trailer-added

---

### [🔴-2] PC 발매 시점 서술 — "올해 초"는 2026년 초로 오독 유발

- **글 서술**: "PC로는 이미 올해 초에 나왔던 작품인데"
- **실제**: PC 발매는 **2025년 2월 14일**. 글 작성일 기준 '올해(2026)'가 아니라 작년(2025). 독자가 "2026년 초에 나왔다"로 오독할 수 있음.
- **수정 방향**: "PC로는 이미 작년(2025년 2월) 발매된 작품인데"로 명시. 표에 2025년 2월 14일이 있으므로 표와 일치.
- **근거**: https://store.steampowered.com/app/1599780/Afterlove_EP/ (Steam 공식, Release Date: 14 February 2025)

---

## 🟡 주의 — 수정 권고

### [🟡-1] 개발사 표기 — 한글 표기 근거 부재

- **글 서술**: "픽셀네시아(Pikselnesia)"
- **확인**: 영문 공식 표기는 **Pikselnesia**로 확인됨(Steam·Wikipedia). 한글 표기 "픽셀네시아"는 공식 한국어 표기가 아닌 음차. 게임피아 공식 공지에서 사용하는 한글 표기를 별도 확인해야 하나, 현재 확인 가능한 출처(Invenglobal)에서 'Pikselnesia'를 한글로 표기하지 않음.
- **수정 방향**: "(Pikselnesia)"를 병기하고 있으므로 독자는 오해 없음. 단, 게임피아 공식 공지에서 한글 표기가 다를 경우를 대비해 "Pikselnesia(픽셀네시아)" 또는 "Pikselnesia" 단독 표기 권고.
- **근거**: https://store.steampowered.com/app/1599780/Afterlove_EP/

---

### [🟡-2] PC Steam 이미지 App ID 불일치 — 타이틀 이미지 URL

- **글 서술**: 도입부 이미지 src = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1599780/capsule_616x353.jpg`
- **확인**: Steam App ID 1599780은 Afterlove EP 공식 ID로 확인됨. 그러나 Steam 공식 header 이미지 URL은 `.../apps/1599780/header.jpg`이며 `capsule_616x353.jpg`도 Steam CDN 경로이므로 존재 가능. 직접 이미지 생사 확인 필요.
- **수정 방향**: 이미지 로드 확인 후 유효하면 유지. 발행 전 실제 이미지 노출 여부 확인 필수.
- **근거**: Steam App ID 1599780 확인 — https://store.steampowered.com/app/1599780/

---

### [🟡-3] PS5 물리판 한국 출시 여부 — 확인 미흡한 채 단정

- **글 서술**: "PS5 · 닌텐도 스위치" 모두 9월 10일 한국 발매처럼 서술
- **확인**: 복수 출처에서 "PS5 물리판은 동남아시아 한정(Southeast Asia exclusive)", Switch는 한국·일본·대만·홍콩·동남아 포함으로 나뉨. 한국 PS5 물리판 출시 여부가 명확하지 않음.
- **수정 방향**: "PS5"가 한국 발매 여부 불명확한 경우 "닌텐도 스위치 (한국 발매 확인) · PS5 (동남아시아 한정 — 한국 구매 가능 여부 확인 필요)"로 분리 서술. 또는 게임피아 공지 원문에서 PS5 한국 여부를 직접 확인 후 기재.
- **근거**:
  - https://onemoregame.ph/2026/04/afterlove-ep-physical-release-asia/ (PS5 exclusive to Southeast Asia)
  - https://www.invenglobal.com/articles/25139/ (한국 출시 확인하나 PS5 지역 제한 불명확)

---

### [🟡-4] Steam 리뷰 수치 — 조회 시점 병기 없음

- **글 서술**: "Steam 평가는 90%가 긍정적이라"
- **확인**: 2026-09-06 기준 Steam에서 90%(183개 리뷰)로 확인됨. 수치는 맞음. 단, 리뷰 수·퍼센트는 실시간 변동값이나 조회 시점 미병기.
- **수정 방향**: "스팀 기준 90% 긍정적(2025년 이후 기준)"처럼 대략적 시점을 붙이거나, 변동 가능함을 암시하는 구어체 표현 권고. 봄딩 글이라 엄격한 stat-stamp(패치·표본·조회시각)는 필수가 아니지만 변동 가능성 인식.
- **근거**: https://store.steampowered.com/app/1599780/Afterlove_EP/ (조회일 2026-09-06)

---

## 🟢 참고 — 비차단 (스타일 제안)

### [🟢-1] Coffee Talk 개발사 관계 서술 — 좀 더 정확한 맥락 가능

- **글 서술**: "커피 톡을 만든 픽셀네시아(Pikselnesia)에서 신작을..."
- **실제**: Coffee Talk 창작자 Mohammad Fahmi가 Pikselnesia를 설립했으나 2022년 3월에 별세. 게임은 팀이 완성. "커피 톡 제작진"이라고 표현하는 것이 더 정확하고, 글 제목("커피톡 제작진 신작")과 일치.
- **수정 방향**: 본문 첫 줄 "커피 톡을 만든 픽셀네시아" → "커피 톡 제작진이 세운 픽셀네시아" 또는 현재 제목처럼 "커피 톡 제작진"으로 통일. 현 서술이 오류는 아니나 뉘앙스 차이.
- **근거**: https://en.wikipedia.org/wiki/Afterlove_EP

---

### [🟢-2] Soyatu(아티스트)·L'alphalpha(밴드) 표기

- **글 서술**: "아트 스타일은 인도네시아 만화가 'Soyatu'가 맡았고, 사운드트랙은 인디 밴드 'L'alphalpha'가 참여했습니다."
- **확인**: 복수 리뷰·기사에서 Soyatu(아티스트)와 L'Alphalpha(밴드) 표기가 확인됨. 글에서 'L'alphalpha'는 대소문자가 'L'Alphalpha'로 돼야 정확(대문자 A). Steam 공식 상점 페이지에서 직접 확인은 불가.
- **수정 방향**: 'L'alphalpha' → 'L'Alphalpha'(대문자 A) 수정 권고. 단, 공식 표기 확정이 Steam 페이지에서 안 돼 강제 요구 수준은 아님.
- **근거**: https://www.rpgfan.com/2025/01/22/afterlove-ep-february-14th/

---

## 확인된 정확 항목

| 항목 | 글 내용 | 검증 결과 |
|------|---------|-----------|
| 여자친구 이름 | 친타(Cinta) | 공식 Steam·Wikipedia 일치 |
| 주인공 이름 | 라마(Rama) | 공식 일치 |
| 개발사 영문 | Pikselnesia | 공식 일치 |
| PC 발매일 | 2025년 2월 14일 | Steam 공식 일치 |
| 콘솔 물리판 발매일 | 2026년 9월 10일 | Invenglobal·Sakura Index 일치 |
| 국내 유통사 | 게임피아(Gamepia) | Invenglobal 일치 |
| 예약 기간 | 8.27~9.9 | Invenglobal 일치 |
| 패키지 4종 | 슬리브·8cm CD·디지털 아트북·OST 코드 | Invenglobal·Sakura Index 일치 |
| 심의등급 | 15세 이용가 | Invenglobal(15+) 일치 |
| Steam 리뷰 | 90% 긍정 | Steam 공식 일치(183개) |
| 지원 언어 | 영어·인도네시아어·일본어 (한국어 미지원) | Steam 공식 일치 |
| 배경 | 인도네시아 자카르타 | 공식 일치 |
| 기간 | 28일 | 공식 일치 |

---

## 검수 교훈 (lessons/qa.md 등록 대상)

- **신타 vs 친타(Cinta)**: Steam 공식 표기는 Cinta. 한글 음차 시 '신타'가 아닌 '친타'가 정확. 글 작성자가 사이드노트에서 이미 '신타→친타'로 수정 명시함 — 올바른 자기검증 사례.
- **디지털 콘솔 출시 vs 물리판 출시 혼동**: 인디 게임에서 PC·콘솔 동시 디지털 출시 후 나중에 아시아 물리판이 나오는 패턴 주의. "콘솔 최초" 서술 전 eShop 선출시 여부 반드시 확인.
- **"올해 초" 시제 함정**: 글 작성 연도와 발매 연도가 다를 때 "올해"는 오독 유발. 연도를 명시하는 것이 원칙.

---

## 검수 출처 목록

- Steam 공식 상점: https://store.steampowered.com/app/1599780/Afterlove_EP/
- Wikipedia: https://en.wikipedia.org/wiki/Afterlove_EP
- Invenglobal 기사: https://www.invenglobal.com/articles/25139/pre-orders-open-august-27-for-physical-edition-of-afterlove-ep-new-game-from-coffee-talk-developers
- Sakura Index 보도자료: https://www.sakuraindex.jp/press-releases/afterlove-ep-nintendo-switch-and-ps5-physical-edition-launching-in-asia/
- VGChartz 출시일 기사: https://www.vgchartz.com/article/463490/afterlove-ep-releases-february-14-2025-for-ps5-xbox-series-xs-switch-and-pc/
- GoNintendo 기사: https://gonintendo.com/contents/44130-afterlove-ep-comes-to-switch-feb-14th-2025-trailer-added
- Game8 출시일 정보: https://game8.co/articles/release-dates/afterlove-ep-release-date-and-time
- RPGFan 기사: https://www.rpgfan.com/2025/01/22/afterlove-ep-february-14th/
- One More Game: https://onemoregame.ph/2026/04/afterlove-ep-physical-release-asia/
