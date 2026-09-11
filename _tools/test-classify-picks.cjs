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
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 임시 폴더 정리 실패는 무시 */ }
console.log(fail ? `\n✗ ${fail}건 실패` : '\n✓ ALL PASS');
process.exit(fail ? 1 : 0);
