=== QA 결과 ===
차원: qa-image
대상 파일: C:\Users\qtdqt\Desktop\Claude\BlogPreview\봄딩\메이플스토리\메이플스토리_홍대_방탈출카페\봄딩_메이플스토리_홍대_방탈출카페_미리보기.html
판정: FAIL
🔴 0건 / 🟡 4건

이미지 현황:
- A형 img: 2장 (도입부 키비주얼, 테마 소개)
- B형 .ss 자리: 2곳 (위치 외관, 크리에이터 투표)

지적 목록:

🟡 1. A형 self-host 미완 — 넥슨 CDN 직접 핫링크 상태
src에 maplestory.nexon.com 원본 URL을 직접 박음. self-host(img/ 폴더 + GitHub Pages URL) 절차 필요.

🟡 2. A형 이미지 URL 실재 미확인 — 200 응답이나 text/html 리다이렉트
event02_visual.jpg, escape_themes.jpg 둘 다 text/html로 리다이렉트됨. 실제 이미지 바이너리 없음. self-host 전환 시 실재 URL로 교체 필요.

🟡 3. 스샷3(.ss) B형 지정 부적절 — 크리에이터 투표 공식 이미지는 A형 처리 대상
공식 이벤트 페이지 공개 이미지를 B형으로 둔 것은 image-sourcing.md §12-4 위반.

🟡 4. B형 스샷2 캡처 가이드 부실 — 위치 외관 촬영 지침 미흡
"직접 촬영 권장(9/21 오픈 이후)" 안내만. 구체 촬영 포인트 없음.
