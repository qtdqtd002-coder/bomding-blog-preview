#!/usr/bin/env node
/* ============================================================================
   test-game-sources.cjs — 지정 우선 출처(원장 `_trend/_game-sources.json`) 회귀 게이트 (2026-10-08 신설 · LLM 0)

   고정하는 것
     ⑴ 도깨비의세계 → 깨비지지(kkaebigg.com)가 원장에 있고, 띄어쓰기·영문 별칭으로도 찾힌다
     ⑵ desk-candidates merge: 도깨비의세계 후보엔 prioritySources 가 붙고, 도술·빌드 주제인데 깨비지지 미참조면 경고 + gate FLAG
     ⑶ 쿠폰·일정처럼 주제가 안 걸리면 경고 없음 · 다른 게임은 손대지 않음 · KEEP/DROP 은 바뀌지 않음

   사용: node _tools/test-game-sources.cjs     (exit 0 = 통과)
   ========================================================================== */
'use strict';
const G = require('./game-sources.cjs');
const C = require('./desk-candidates.cjs');

let n = 0, bad = 0;
const ok = (cond, msg) => { n++; if (cond) console.log('ok   ' + msg); else { bad++; console.log('FAIL ' + msg); } };

console.log('[1] 원장');
const g = G.sourcesFor('도깨비의세계');
ok(!!g, '도깨비의세계 등재');
ok(g && g.priority[0].host === 'kkaebigg.com' && g.priority[0].label === '깨비지지', '1순위 = 깨비지지 kkaebigg.com');
ok(G.sourcesFor('도깨비의 세계') === g && G.sourcesFor('World of Dokkaebi') === g, '띄어쓰기·영문 별칭으로도 찾힌다');
ok(G.sourcesFor('도깨비') === null, '«도깨비»만으로는 안 찾힌다(펄어비스 DokeV 등 혼동 방지)');
ok(G.sourcesFor('애니모') === null, '미등재 게임 = null');
ok(G.citesPriority(['https://kkaebigg.com/database?s=1'], g), 'URL 문자열 인용 인식');
ok(G.citesPriority([{ label: '깨비지지', url: 'https://www.kkaebigg.com/builder' }], g), '{url} 객체·www 인용 인식');
ok(!G.citesPriority([{ url: 'https://forum.kakaogames.com/dokkaebi/' }], g), '공식 포럼만 있으면 미인용');
ok(!G.citesPriority([{ url: 'https://kkaebigg.com.evil.example/' }], g), '도메인 꼬리 위장은 인용 아님');

console.log('\n[2] desk-candidates merge/gate');
const files = [{ file: 'cand-core.json', data: [
  { game: '도깨비의세계', title: '도깨비의세계 도술 조합 추천', angleType: 'howto', keywords: ['도깨비의세계 도술 조합'], sources: [{ url: 'https://forum.kakaogames.com/dokkaebi/' }] },
  { game: '도깨비의 세계', title: '도깨비의세계 탈것 얻는 법', angleType: 'howto', keywords: ['도깨비의세계 탈것'], sources: [{ url: 'https://kkaebigg.com/database' }] },
  { game: '도깨비의세계', title: '도깨비의세계 쿠폰 입력 방법', angleType: 'howto', keywords: ['도깨비의세계 쿠폰'], sources: [{ url: 'https://forum.kakaogames.com/dokkaebi/' }] },
  { game: '애니모', title: '애니모 포획 확률 정리', angleType: 'info', keywords: ['애니모 포획'], sources: [{ url: 'https://questlog.gg/aniimo' }] },
] }];
const { items, warnings } = C.mergeCands(files);
const by = (t) => items.find((x) => x.title.includes(t));
ok(by('도술').prioritySources && by('도술').prioritySources[0].host === 'kkaebigg.com', '도깨비 후보에 prioritySources 첨부');
ok(by('도술').prioritySourceMissing === true, '도술 주제 + 깨비지지 미참조 → prioritySourceMissing');
ok(warnings.some((w) => w.includes('core-1') && w.includes('깨비지지')), 'merge 경고에 깨비지지가 나온다');
ok(!by('탈것').prioritySourceMissing && by('탈것').prioritySources, '깨비지지 참조한 후보는 경고 없음(별칭 «도깨비의 세계»도)');
ok(!by('쿠폰').prioritySourceMissing && by('쿠폰').prioritySources, '쿠폰 주제는 경고 없음(우선 출처는 첨부)');
ok(!by('애니모').prioritySources, '미등재 게임은 손대지 않음');
const r = C.gateItems(items, null, [], null);
ok(r.kept.length === 4 && r.dropped.length === 0, 'gate KEEP/DROP 불변(4/0)');
ok(r.kept.find((x) => x.title.includes('도술')).flags.includes('source:지정출처미참조'), 'gate FLAG source:지정출처미참조');
ok(!r.kept.find((x) => x.title.includes('쿠폰')).flags.includes('source:지정출처미참조'), '쿠폰 후보엔 FLAG 없음');

console.log('\n' + (n - bad) + '/' + n + ' 통과');
process.exit(bad ? 1 : 0);
