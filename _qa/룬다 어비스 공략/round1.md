# 검수3 · 구조/완성도 — 연봄 「마비노기 모바일 룬다 어비스 공략」 round1

- 정본: yeonbom output-format.md / tistory-seo.md
- 분량: 2,647자(공백제외·표제외) 게이트 통과 — 재측정 생략(요청)
- 첨부제약: [외주 첨부 1회용 제약] 블록 없음 → 비대상

## 판정: PASS (조건부 — 발행 전 이미지 push 필수)

### 🔴 (1건 — 발행 순서 게이트)
- self-host 본문 이미지 4장(runda-bosses/abyss-ui/season2-roadmap/abyss-combat) GitHub Pages 전부 404.
  로컬 img\ 4개 존재하나 push/Pages 배포 전. 배너만 200.
  → output-format §1-1·§3: 티스토리 img는 push·빌드 완료 후 URL이어야. 지금 붙이면 본문 4장 깨짐.
  조치: img 경로 명시 add→push→Actions 배포→4 URL 200 확인 후 발행. HTML 결함 아님(경로·인코딩 정상).

### 🟡 0건

### 🟢 통과
1) 골격/구독배너 최하단 정합  2) 진짜 h2×5·키워드 앞배치·태그7 중복없음
3) 복사구간 메타누출 0(메모·req_는 마커 위 주석)  4) 복사구간 금지요소 0(SVG만)
5) 본문 img 4장 width/height·self-host 절대URL·표 word-break 전셀  6) 미↔티 본문 텍스트 차집합0
7) /56·/57 href 정상
- 보스-구역 매칭 팩트카드/카드/캡션/FAQ 전부 일치, 미확정은 쇼케이스 기준 회피(L장 적정)

## L5
- 분량 재발(qa.md hits:4) 비해당(생략). 신규후보: 티스토리 img push전 404=broken-live-images 계열, 발행전 4 URL 200 게이트 습관화.
