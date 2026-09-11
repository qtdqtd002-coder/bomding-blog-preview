=== QA 결과 ===
차원: qa-structure
대상 파일: 봄딩_메이플스토리_홍대_방탈출카페_미리보기.html
판정: FAIL
🔴 1건 / 🟡 2건
한글 본문 글자수: 2,074자 (전체 공백제외: 2,653자)
이미지: A형 2장 / B형(.ss 자리) 2개 / h2 섹션 6개
첨부제약: 없음

[지적 목록]

🔴 G-3 · 이미지 src URL 파일 미존재 (A형 img 2장 모두)
현재:
  img1: https://maplestory.nexon.com/img/promotion/event/2026/20260910/event02_visual.jpg
  img2: https://maplestory.nexon.com/img/promotion/event/2026/20260910/escape_themes.jpg
문제: 두 URL 모두 HTTP 200 반환하나 Content-Type=text/html 이며
  최종 리다이렉트 대상이 https://maplestory.nexon.com/promotion/event/2026/20260618/intro
  (8월 업데이트 HTML 페이지)임. 실제 JPG 바이너리가 아니라 HTML 문서가 반환됨.
  이벤트 이미지 파일이 서버에 아직 없거나 경로가 잘못된 상태.
  발행 시 img 태그가 HTML을 참조해 이미지 깨짐으로 노출됨.
처리: 오픈일(9/21) 이후 실제 업로드된 이미지 URL 확인 후 교체,
  또는 A형 자리를 B형(.ss 스크린샷 자리)으로 전환 권장.
근거: Content-Type 직접 확인 (urllib.request HEAD, 2026-09-11)

🟡 K장 · 목적 필수정보 — 투표 참여 직접 링크 없음
현재: 방탈출 대결 투표 이벤트(9/17~) 본문 서술 있으나
  투표 직접 참여 URL 이 본문 및 버튼 어디에도 없고
  공식 이벤트 페이지(event02) 링크만 반복됨.
처리: 공식 이벤트 페이지에서 투표 전용 URL 확인 후 버튼 추가.
  확인 불가 시 동선 한 줄 안내로 보강.
근거: post-purpose-guide.md §6 / qa-checklist.md K장

🟡 L장 · 봄딩 SEO — 소제목 키워드 부재
현재: h2.sub '자주 묻는 질문' — 검색 키워드 없는 일반형.
처리: '메이플스토리 이스케이프 자주 묻는 질문' 등 키워드 포함형으로 보강.
근거: qa-checklist.md L장 봄딩 SEO 소제목 키워드 구조화

[PASS 항목]
- 분량: 한글 2,074자 · 봄딩 게이트 2,000~2,500자 충족 OK
- 제목 SEO: 게임명+장소+핵심 키워드 앞배치 구조 OK
- 소제목 구조: h2.sub 6개 전원 존재, 주제 일관성 OK
- 표 구조: 테마 5종 표 (오픈일·테마명·장르) 정합성 OK
- 하단 버튼: YES24 예약 + 공식 이벤트 페이지 2개 버튼 OK
- 금지 컴포넌트: 같이보면좋은글 박스 없음 / href=# 없음 / 퍼플콜아웃 없음 / 풀쿼트 없음 OK
- 정본 스켈레톤: topbar / bomding-imagebox.js / naver-npaste.js 전원 포함 OK
- 마무리 정리 헤더: '메이플스토리 이스케이프 정리' h2.sub 존재 OK
- YES24 예약 링크: ticket.yes24.com 본문+버튼 복수 존재, 도메인 생존 OK
- 이벤트 본문 서술: 이벤트명·기간·보상·예약방법·위치·운영기간 전부 포함 OK