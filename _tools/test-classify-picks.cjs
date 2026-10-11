#!/usr/bin/env node
/* =============================================================================
   test-classify-picks.cjs — classify-picks.ps1 «데스크 모드» 회귀 게이트 (2026-09-12 신설)

   왜 만들었나
   -----------
   09-11 판 «이미 다룬 글» 경고 12건 중 11건이 무관한 글을 가리켰는데, 빌드·test-desk 는 전부 초록이었다.
   원인 셋은 코드를 읽어서는 안 보인다.
     ⑴ PowerShell 은 빈 배열을 return 하면 호출부에서 $null 로 풀고, `@($null) -contains $null` 은 참이다
        → «키워드 0개인 후보»와 «키워드 0개인 글»이 «공유 키워드 1개»로 잡혀 🟡review.
     ⑵ 후보 «게임 | 제목» 을 통째로 제목으로 읽어 게임명이 늘 게임 앵커를 채웠다.
     ⑶ «—» 뒤를 버려 진짜 관련 글(「무릉도장 총정리」)의 핵심어가 사라졌다.
   그래서 «결과»를 못 박는다 — 고정 데이터로 실제 스크립트를 돌려 상태와 가리키는 글을 확인한다.

   ★2026-10-11 v3 — «관련 글» 표시(🟡review) 기준 상향. 10-11 판 21건 중 10건에 표시가 붙어 사용자가
     «발주해도 되는지 헷갈린다»고 했다. 낱말 하나가 뒤쪽 나열에서 겹친 것 · 서술어 꼬리(있나) · 날짜 조각(일부터) ·
     일반어(조건)로는 달지 않고, 주제 자리(앞머리)가 겹칠 때만 단다. 아래 «v3» 줄이 그 결과를 못 박는다.

   방법   임시 폴더에 작은 published.json·posts.json·_live-titles.json·trend.json·_aliases.json 을 만들고 실행(네트워크 0).
   실행   node _tools/test-classify-picks.cjs          (실패 시 exit 1)
          CLASSIFY_PICKS=<다른 경로> 로 사본을 시험할 수 있다.
============================================================================= */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = process.env.CLASSIFY_PICKS || path.join(__dirname, 'classify-picks.ps1');
const W = '봄딩';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-picks-test-'));
const base = path.join(tmp, 'BlogPreview');
fs.mkdirSync(path.join(base, '_trend'), { recursive: true });
fs.mkdirSync(path.join(tmp, '_glossary'), { recursive: true });

/* [폴더 게임, 폴더 주제, 실제 글 제목] */
const posts = [
  ['메이플플래닛', '소림사의 구원자 칭호', '메이플플래닛 소림사의 구원자 칭호 얻는 법 — 요괴 대사 처치 퀘스트 완전 정리'],
  ['메이플플래닛', '무릉도장 총정리', '메이플플래닛 무릉도장 총정리 - 입장 레벨, 층별 제한시간, 랭킹 보상까지'],
  ['메이플플래닛', '카오스 자쿰 카오스 혼테일 총정리', '메이플플래닛 카오스 자쿰, 혼테일 총정리 - 카자쿰 카테일 입장조건부터 드롭·방어율무시 계산까지'],
  ['메이플플래닛', 'AP초기화권 사용조건 변경', '메이플플래닛 AP초기화권 사용조건 변경 정리'],
  ['배틀그라운드 모바일', '나루토 질풍전 콜라보 공략', '배틀그라운드 모바일 나루토 질풍전 콜라보 공략'],
  ['우마무스메', '4주년오르페브르픽업', '우마무스메 4주년 신규 우마무스메 오르페브르 픽업 정보'],
  ['데이브 더 다이버', '모바일 출시', '데이브더다이버모바일 9월17일 출시 확정, 과금 구조는?'],
  ['팰월드', '1.0 정식출시 사양 체크리스트', '팰월드 1.0 정식출시 D-3, 내 PC로 돌아갈까 사양·최적화 체크리스트'],
  /* v3 — 지난 판에서 실제로 걸리던 모양 그대로 */
  ['도깨비의세계', '직업 없는 도술 조합', '도깨비의세계 직업 없다? 도술 스타일 12가지 4계열로 조합하는 법, 신식 개방 조건까지'],
  ['도깨비의세계', 'PC 플레이', '도깨비의세계 PC로도 할 수 있나 — 앱플레이어는 막힌다'],
  ['포켓몬 GO', '가을 소풍', '포켓몬 GO 가을 소풍 10월 13일부터 열린다, 입장 조건 정리'],
  ['애니모', 'CBT 권장 사양', '애니모 CBT 권장 사양 체크, 테스트 참여 조건까지'],
  ['컨트롤 레조넌트', '출시일 PC사양', '컨트롤 레조넌트 출시일 PC사양 정리, 사전예약 스팀 위시리스트까지'],
  ['롤토체스', '세트18 수호령 등장규칙', '롤토체스 세트18 신비의숲 수호령 등장규칙 7가지 분류 정리'],
  ['승리의 여신 니케', '티어표', '승리의여신 니케 티어표 최신순위, 드레이크 그레이트빌런 티어까지 총정리'],
];
const rel = p => `${W}/${p[0]}/${p[1]}/${W}_미리보기.html`;
const live = posts.map(p => p[2]).concat([
  '아기놀이방 매트 추천, 두께 인증 층간소음 기준으로 고른 5종 비교',
  '아기방 제습기 추천, 제습용량·소음·KC인증까지 5종 비교해봤어요',
  '팬티형 아기기저귀 5종 비교, 하기스·팸퍼스·마미포코·보솜이·킨도 뭘 골라야 할까',
  '인텍스 에어매트 여행용 아기침대 돌아기 내 돈 내산 후기',
]);
const put = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
put(path.join(base, 'published.json'), { publishedRels: posts.map(rel) });
put(path.join(base, 'posts.json'), posts.map(p => ({ rel: rel(p), author: W, group: p[0], title: p[2], published: true })));
put(path.join(base, '_trend', '_live-titles.json'), { byAuthor: { [W]: live } });
put(path.join(base, '_trend', 'trend.json'), { schema: 2, editions: [] });
put(path.join(base, '_trend', '_failed-requests.json'), { failed: [] });
put(path.join(tmp, '_glossary', '_aliases.json'), { games: [{ canon: '메이플플래닛', aliases: ['메이플 플래닛'], folders: ['메이플플래닛'] }] });

/* [후보 줄, 허용 상태, matchedTitle 에 있어야 할 말(null = 가리키는 글 없음), 무엇을 막나] */
const cases = [
  ['메이플플래닛 | 상하이 예원 신규 지역 추가 — 140레벨부터 갈 수 있는 새 필드 13곳', ['new'], null, '⑴ 키워드 0개끼리 «공유 1개» — 09-11 경고 12건의 뿌리'],
  ['메이플플래닛 | 파티 없이도 혼테일 간다 — 노말 혼테일 최소 입장 인원 3인에서 1인으로', ['review'], '혼테일', '⑶ «—» 뒤 핵심어로 진짜 관련 글을 찾는다'],
  ['메이플플래닛 | 무릉도장 비기 스킬, 이제 종류당 한 번씩만 — 9월 10일 패치로 바뀐 규칙', ['review'], '무릉도장', '고유 이름 겹침 → 그 글을 가리킨다'],
  ['배틀그라운드 | 주술회전 콜라보 — 시작섬에 고죠 사토루 석상', ['new'], null, '⑵ 배틀그라운드 ≠ 배틀그라운드 모바일(머리어로 묶지 않는다)'],
  ['우마무스메 프리티 더비 | 오늘 낮 12시부터 러브즈 온리 유 픽업 — 9월 18일까지', ['review'], '픽업', '데스크의 긴 표기 ↔ 폴더의 짧은 표기는 같은 게임'],
  ['데이브 더 다이버 | 9월 17일 모바일로 온다 — 9.99달러 한 번이면 끝, 광고도 P2W도 없다', ['published'], '데이브더다이버모바일', '긴 부제가 붙어도 라이브의 거의 같은 글은 잡는다(«—» 앞도 대조)'],
  ['아기 놀이방매트 | 아기 놀이방매트 8종 비교공감 결과', ['review', 'published'], '놀이방', '육아: 띄어쓰기만 다른 같은 제품군(데스크 L072)'],
  ['아기 헤어드라이어 | 어제 나온 신제품까지 넣어 보는 저소음 드라이기 — 소음과 온도 범위로 갈린다', ['new'], null, '육아: 속성어(소음)만 겹치면 경고하지 않는다'],
  ['아기 기저귀 가방 | 추석 귀성길 아기 짐 — 기저귀가방 백팩형과 크로스백형 뭐가 나을까', ['new'], null, '육아: 제품군 핵심(「기저귀가방」)이 통째로 있어야 같은 밭 — 「아기기저귀」 글에 걸리지 않는다'],
  ['아기 침대가드 | 아기 침대가드 고르기 — 80cm·120cm·145cm, 슬라이딩형과 폴딩형은 뭐가 다를까', ['new'], null, '육아: 더 넓은 말(「아기침대」)이 들어 있다고 같은 제품이 아니다'],
  ['팰월드 | 정식 출시 뒤 가장 큰 패치 1.0.4 — 낚시와 팰 인공지능이 함께 바뀌었다', ['new'], null, '흔한 말 둘을 붙여 쓴 말(「정식출시」)은 내용어가 아니다'],
  ['도깨비의세계 | 도깨비의세계 가호 세트 효과 뭐가 다른가, 토끼 도술 피해 감소·연꽃 관통률·나비 치명타 피해 증가', ['new'], null, 'v3 뒤쪽 나열에서 낱말 하나(「도술」) 겹친 것은 달지 않는다'],
  ['도깨비의세계 | 도깨비의세계 도전! 문파 전투 이벤트, 도전의 도술 조각 선택 상자 최대 8개 받는 조건', ['new'], null, 'v3 일반어(「조건」 = 세 게임 글에 나오는 말)는 «공유어 2개»에 안 든다'],
  ['도깨비의세계 | 도깨비의세계 무과금도 최종 콘텐츠까지 갈 수 있나, 과금은 시간을 사는 구조', ['new'], null, 'v3 서술어 꼬리(「있나」)는 양쪽 앞머리에 있어도 근거가 아니다'],
  ['포켓몬 GO | 포켓몬 GO 리틀컵 10월 13일부터, 500CP 이하만 나간다', ['new'], null, 'v3 날짜 조각(「13일부터」의 「일부터」)은 근거가 아니다'],
  ['승리의 여신: 니케 | 니케 벨로타 픽업은 10월 28일까지, 확률 2%이고 상시 편입', ['new'], null, 'v3 「픽업」 소식 ↔ 「티어표」는 같은 단일유형이 아니다'],
  ['롤토체스 | 새로 생긴 0골드 수호령, 언제 뜨고 뭘 주는지', ['review'], '수호령', 'v3 낱말 하나라도 양쪽 앞머리(주제 자리)에 있으면 단다'],
  ['컨트롤 레조넌트 | 컨트롤 레조넌트 PC 사양, 저장공간 120GB와 SSD가 필수', ['review'], '사양', 'v3 일반어라도 «게임당 한 편» 유형(「사양」)이 양쪽 앞머리에 있으면 단다'],
];
fs.writeFileSync(path.join(tmp, 'cand.txt'), cases.map(c => c[0]).join('\n') + '\n', 'utf8');

const run = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT,
  '-Writer', W, '-Base', base, '-CandidatesFile', path.join(tmp, 'cand.txt'), '-PrevIssues', '14'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fail++; };
console.log('[test-classify-picks] ' + SCRIPT);
let out = null;
try { out = JSON.parse(String(run.stdout || '').replace(/^\uFEFF/, '')); } catch (e) { /* 아래에서 실패 처리 */ }
ok(run.status === 0 && out && out.results, `스크립트 실행·JSON 출력 (exit ${run.status})`);
if (!out || !out.results) {
  console.log(String(run.stderr || '').slice(0, 2000));
} else {
  const results = [].concat(out.results);
  ok(results.length === cases.length, `결과 ${results.length}건 = 후보 ${cases.length}건`);
  cases.forEach(([line, allowed, mustContain, why], i) => {
    const r = results[i] || {};
    const title = r.matchedTitle || '';
    const statusOk = allowed.includes(r.status);
    const titleOk = mustContain === null ? !['review', 'published'].includes(r.status) || !title : title.includes(mustContain);
    ok(statusOk && titleOk && r.raw === line.trim(), `${why}\n        → ${r.status} ${title ? '「' + title + '」' : ''}${[].concat(r.sharedWords || []).length ? ' [' + [].concat(r.sharedWords).join('·') + ']' : ''}`);
  });
  ok(results.every(r => r.mode && r.mode.startsWith('desk')), '«게임 | 제목» 줄은 전부 데스크 모드로 돈다');
  ok(results.filter(r => r.status === 'review').every(r => [].concat(r.sharedWords || []).filter(Boolean).length >= 1), 'v3 🟡review 는 «겹친 말»(sharedWords)을 하나 이상 싣는다 — 화면이 그 말을 보여 준다');
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 임시 폴더 정리 실패는 무시 */ }
console.log(fail ? `\n✗ ${fail}건 실패` : '\n✓ ALL PASS');
process.exit(fail ? 1 : 0);
