# QA round1 — 겜더쿠 POE2 소용돌이 강타 마셜 아티스트 빌드 (사실/공식명칭 차원)
검수자: 검수1(사실/공식명칭) · 2026-06-27

## 차원 요약
- 항목1~5 대체로 사실 일치(OK). 핵심 결함은 항목6(0.5.4 패치 귀속 오류) + 시즌명 비정식 표기.

## 발견
- 🔴 [시점/버전 귀속 오류] 본문: "0.5.4 패치에서 소용돌이 강타가 손질됐는데요. 스킬 퀄리티가 주던 공격속도 보너스가 예전의 '더해지는(more)' 방식에서 '증가(increased)' 방식으로 바뀌면서… 근접 광역의 추가 타격(스플래시)이 한 영역당 한 번만 적용되도록 조정됐고요."
  → 실제: 이 두 변경(Quality 0-15% more→0-20% increased AS, Melee Splash 1회/영역)은 **0.5.0 패치노트에 명기된 것**. 0.5.4(2026-06-24)는 Expedition 개선·유니크 리스케일·부패화폐가 골자. 0.5.4의 마셜 아티스트 관련 변경은 Runic Meridians 룬 카운트 버그수정 1건뿐.
  근거: 공식 0.5.0 패치노트 pathofexile.com/forum/view-thread/3932540 ("Quality now grants 0-20% increased Attack Speed (previously 0-15% more)"·"Melee Attacks can now only apply Splash Damage once per damaging area"); Game8 0.5.4(606723); sportskeeda 0.5.4
  ※ 재발 시그니처: lessons/qa "연도/시점 혼입"(hits:2) — 패치 스니펫을 본문 패치노트로 재확인하는 규칙 적용해 발견.

- 🔴 [0.5.4 방어 버프 주장 근거 없음] 본문: "마셜 아티스트는 같은 패치에서 방어 쪽이 버프됐는데요. 추가 룬 슬롯과 굴절·회피 강화가 들어가면서…"(7절·한눈에·한줄정리)
  → 0.5.4에 마셜 아티스트 방어 버프 없음. 룬 슬롯 5개는 Runic Meridians 노드 본래 기능(0.5.0부터). 0.5.4는 그 룬이 카운트 안 되던 버그를 고친 것. '굴절·회피 강화가 0.5.4에 들어갔다'는 확인 불가/근거 없음.
  근거: Game8 0.5.4; sportskeeda 0.5.4; fextralife Runic Meridians wiki(0.5.4 bugfix)

- 🟡 [시즌 공식명 비정식 표기] 본문 반복: "알두르의 유산 시즌"
  → 0.5 리그 정식명은 **Runes of Aldur = 알두르의 룬**(룬스미싱/룬포징 테마). 'Aldur의 유산'이 아니라 'Aldur의 룬'. '유산'은 비정식.
  근거: maxroll Runes of Aldur Overview; mobalytics Runes of Aldur; fextralife Runes of Aldur

## OK 판정(교차확인됨)
1. OK — 마셜 아티스트=몽크 3번째(신규) 어센던시, 헌트리스 Spirit Walker(스피릿워커)와 함께 0.5.0 추가. (단 패치명=Return of the Ancients/고대의 귀환, 리그명=Runes of Aldur 별개)
2. 대체로 OK — Hollow Focus(종+공격시 충격파), Way of the Stonefist(장갑→Fists of Stone 변환), Runic Meridians(룬 슬롯 5개 추가), Way of the Mountain(이동불가 적 시 스택→피해감소+공격증가). 추천순서 Hollow Focus→Stonefist→Runic Meridians→Mountain도 maxroll과 일치. ※번역명(공허의집중/돌주먹의도/룬자오선/산의도)은 국내 정식명 미확인=비정식 의역일 수 있음(인게임 확인 권장 박스로 일부 커버됨).
3. OK — Whirling Assault=화면 거의 전체 광역 근접(maxroll "covers nearly the whole screen"), 보스 Tempest Bell(폭풍의 종) 충격파 단일딜.
4. OK — 쿼터스태프, 초반 Hollow Palm 맨손, ES+Evasion 방어, 0.5에서 회피·Deflect 버프(0.5 변경 맞음).
5. OK — Don't Get Hit 플레이 전제(maxroll 명시). 단 "레벨 30 전후 물몸"의 정확한 레벨 수치는 전문가 가이드에서 직접 확인 못함=무난한 일반론 수준(과장 아님).

## 근거 URL
- 공식 0.5.0 패치노트: https://www.pathofexile.com/forum/view-thread/3932540
- maxroll Whirling Assault MA 빌드(0.5.4): https://maxroll.gg/poe2/build-guides/whirling-assault-martial-artist-build-guide
- iggm 어센던시 노드 리뷰: https://www.iggm.com/news/poe-2-patch-0-5-0-martial-artist-ascendacy-review-way-of-the-stonefist-outrageous-glove-mechanic
- maxroll Runes of Aldur Overview: https://maxroll.gg/poe2/resources/runes-of-aldur-overview
- Game8 0.5.4: https://game8.co/games/Path-of-Exile-2/archives/606723
- sportskeeda 0.5.4: https://www.sportskeeda.com/mmo/path-exile-2-0-5-4-patch-notes
- fextralife Runic Meridians / Return of the Ancients
