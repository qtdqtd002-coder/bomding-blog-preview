// test-desk-signals.cjs — desk-signals.cjs 판정·정렬·수요 구간·서명 회귀 게이트 (2026-09-18 · 네트워크 0)
//   node _tools/test-desk-signals.cjs
//   ★desk-signals.cjs 를 고치면 반드시 돌린다. 규칙(R1~R5·W1·G·★09-23 X·B)은 사용자 승인 사항이라 조용히 바뀌면 안 된다.
//   ★09-23: [3] 질의 단위 tier(tierFromQuery) · [4] R4=tier 0(heat 제외) · [11] 크로스섹션 X · [12] 블록리스트 B · [13] desk-candidates merge/gate
'use strict';
const S = require('./desk-signals.cjs');

let bad = 0, n = 0;
const ok = (cond, msg) => { n++; if (cond) console.log('ok   ' + msg); else { bad++; console.log('FAIL ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' → ' + JSON.stringify(a) + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' (기대 ' + JSON.stringify(b) + ')'));

console.log('[1] 각도 사다리');
eq(S.angleOf('애니모 천휘 얻는 법, 지맥까지'), 'howto', '얻는 법 → howto');
eq(S.angleOf('쿠키런 크럼블 쿠폰 번호 모음'), 'howto', '쿠폰 → howto');
eq(S.angleOf('롤토체스 4코스트 챔피언 티어 순위'), 'rank', '티어 → rank');
eq(S.angleOf('사일런트 힐 타운폴 출시일과 사전예약 혜택 정리'), 'news', '출시일 → news(정리보다 먼저)');
eq(S.angleOf('귀무자 지금 해볼 만한가, 출시 열흘차 리뷰'), 'info', '리뷰 → info(출시보다 먼저)');
eq(S.angleTypeOf({ title: '롤토체스 티어표', angleType: 'news' }), 'news', '데스크가 적은 angleType 이 우선');
eq(S.angleTypeOf({ title: '롤토체스 티어표', angleType: '엉뚱' }), 'rank', '알 수 없는 angleType 은 제목으로 대체');

console.log('\n[2] 타깃 질의');
eq(S.deriveQuery({ q: '직접 질의', keywords: ['k'], title: 't' }), '직접 질의', 'q 우선');
eq(S.deriveQuery({ keywords: ['애니모 천휘', '천휘'], title: 'x' }), '애니모 천휘', 'keywords[0]');
eq(S.deriveQuery({ title: '애니모 천휘 얻는 법, 지맥 파밍 루트까지' }), '애니모 천휘 얻는 법', '제목 첫 절(쉼표 앞)');
eq(S.deriveQuery({ title: '롤토체스 18.2b 패치 — 무엇이 바뀌었나?' }), '롤토체스 18.2b 패치', '대시 앞 · 물음표 제거');

console.log('\n[3] 수요 구간');
eq([499, 500, 4999, 5000, 49999, 50000].map(S.tierFromMonthly), [0, 1, 1, 2, 2, 3], '월간 검색수 경계 500/5,000/50,000');
eq([null, 0, 1, 3, 4, 10].map(S.tierFromAc), [null, 0, 1, 1, 2, 2], '자동완성 경계 0/1~3/4+ (최대 2)');
const saOn = (entries) => ({ on: true, map: new Map(entries.map(([k, v]) => [S.saKey(k), v])) });
eq(S.demandOf({ n: 10 }, saOn([['애니모', { total: 60000 }], ['애니모 천휘', { total: 3200 }]]), '애니모', ['애니모 천휘']).tier, 1, '키워드 3,200 → 1 (게임량이 커도 키워드가 이긴다)');
eq(S.demandOf({ n: 10 }, saOn([['애니모', { total: 60000 }]]), '애니모', ['애니모 천휘']).tier, 1, '키워드 미확인이면 게임 단위 · 최대 1');
eq(S.demandOf({ n: 10 }, saOn([['애니모', { total: 300 }]]), '애니모', []).tier, 0, '게임 월 300 → 0');
eq(S.demandOf({ n: 0 }, null, '모노웨이브', []).tier, 0, '검색량 미연동 · 자동완성 0 → 0');
eq(S.demandOf({ n: 7 }, null, '뱀피르', []).tier, 2, '검색량 미연동 · 질의 못 잼 → 옛 게임 단위 표(자동완성 7 → 2)');
eq(S.demandOf(null, null, 'x', []).tier, null, '못 쟀으면 null(0 아님)');

console.log('\n[3-2] ★질의 단위 tier (2026-09-23 · 감사 E#1② — 게임 단위 측정은 77건 중 76건이 같은 값)');
const QA = (o) => Object.assign({ q: '애니모 천휘 얻는 법', rank: null, full: null, short: null }, o);
eq(S.tierFromQuery(0, QA({ rank: 1 })), 0, '게임 자동완성 0 이면 질의가 top 이어도 0(게임 자체 흔적 없음)');
eq(S.tierFromQuery(10, QA({ rank: 2, full: { n: 3 } })), 3, '게임 이름 top10 에 질의가 있다 → 3');
eq(S.tierFromQuery(10, QA({ full: { n: 2 } })), 2, '질의 원문이 자동완성에 있다 → 2');
eq(S.tierFromQuery(10, QA({ full: { n: 0 }, short: { q: '애니모 천휘 얻는', n: 1 } })), 1, '원문은 없고 축약 질의만 → 1');
eq(S.tierFromQuery(10, QA({ full: { n: 0 }, short: { q: '애니모 천휘 얻는', n: 0 } })), 0, '게임은 검색되지만 질의·축약 모두 없음 → 0(지어낸 질의)');
eq(S.tierFromQuery(10, QA({ full: { n: 0 } })), 0, '내용어 1개라 축약을 못 만들고 원문도 없음 → 0');
eq(S.tierFromQuery(10, QA({ noContent: true })), 1, '질의가 게임명뿐 → 게임 수요만(최대 1)');
eq(S.tierFromQuery(10, null), 2, '질의를 못 쟀으면(네트워크) 옛 게임 단위 표로 fail-open(7~10 → 2)');
eq(S.tierFromQuery(null, QA({ full: { n: 5 } })), null, '게임조차 못 쟀으면 null');
{
  const d = S.demandOf({ n: 9, top: [] }, null, '애니모', ['애니모 천휘 얻는 법'], QA({ rank: 3, full: { n: 2 } }));
  eq([d.tier, d.src, d.ac, d.q, d.acRank, d.qMode], [3, 'ac', 9, '애니모 천휘 얻는 법', 3, 'rank'], 'demand 에 q·acRank·qMode 가 실린다(stamp 계약)');
  const d2 = S.demandOf({ n: 9 }, null, '애니모', [], QA({ full: { n: 0 }, short: { q: '애니모 천휘 얻는', n: 4 } }));
  eq([d2.tier, d2.qMode, d2.qHit], [1, 'short', '애니모 천휘 얻는'], '축약 적중이면 qHit 에 축약 질의');
  const d3 = S.demandOf({ n: 9 }, saOn([['애니모 천휘 얻는 법', { total: 7000 }]]), '애니모', ['애니모 천휘 얻는 법'], QA({ full: { n: 0 } }));
  eq([d3.tier, d3.src], [2, 'searchad'], '검색광고 키가 있으면 그 경로가 우선(질의 자동완성 0 이어도 월 7,000 → 2)');
}
eq(S.contentTokens('애니모 천휘 얻는 법', '애니모'), ['천휘', '얻는'], '내용어 = 게임명 낱말을 뺀 2자 이상 토큰(1자 «법» 은 제외)');
eq(S.contentTokens('롤토체스 세트18 4코스트 티어', '롤토체스'), ['세트18', '4코스트', '티어'], '숫자 섞인 토큰도 내용어');
eq(S.queryWithGame('애니모', '천휘 얻는 법'), '애니모 천휘 얻는 법', '질의에 게임명이 없으면 앞에 붙인다');
eq(S.queryWithGame('애니모', '애니모 천휘 얻는 법'), '애니모 천휘 얻는 법', '이미 있으면 그대로');

console.log('\n[4] 거둬내기 판정');
const I = (o) => Object.assign({ keywords: [], heat: 2 }, o);
const D = (t, src) => ({ tier: t, src: src || 'ac' });
const it = {
  newNo: I({ sec: 'new', game: '모노웨이브', title: '모노웨이브 출시', angleType: 'news', demand: D(0) }),
  newOk: I({ sec: 'new', game: '하늘의 궤적', title: '하늘의 궤적 초반 공략', angleType: 'howto', demand: D(2) }),
  newN1: I({ sec: 'new', game: 'A', title: 'A 출시일', angleType: 'news', demand: D(2), heat: 3 }),
  newN2: I({ sec: 'new', game: 'B', title: 'B 출시일', angleType: 'news', demand: D(2), heat: 2 }),
  updN3: I({ sec: 'update', game: 'C', title: 'C 패치', angleType: 'news', demand: D(1), heat: 2 }),
  newHow2: I({ sec: 'new', game: 'E', title: 'E 초반 공략', angleType: 'howto', demand: D(1) }),
  newUnk: I({ sec: 'new', game: 'F', title: 'F 사전예약 보상 받는 법', angleType: 'howto', demand: D(null, 'none') }),
  hotNews: I({ sec: 'hot', game: '제우스', title: '매출 1위 비결', angleType: 'news', demand: D(2) }),
  hotHow: I({ sec: 'hot', game: '제우스', title: '제우스 보스 공략 순서', angleType: 'howto', demand: D(2) }),
  coreNews: I({ sec: 'core', game: '림버스', title: '10장 출시', angleType: 'news', demand: D(2) }),
  pin1: I({ sec: 'pinned', game: '롤토체스', title: '버그 수정', angleType: 'news', demand: D(2), heat: 1 }),
  pin2: I({ sec: 'pinned', game: '롤토체스', title: '특성 변경', angleType: 'news', demand: Object.assign(D(2), { acRank: 2 }), heat: 3 }),
  pin3: I({ sec: 'pinned', game: '롤토체스', title: '장갑 버그', angleType: 'news', demand: D(2), heat: 2 }),
  pinHow: I({ sec: 'pinned', game: '롤토체스', title: '초보 덱 추천', angleType: 'rank', demand: D(2), heat: 1 }),
  guideInfo: I({ sec: 'guide', game: '팰월드', title: '팰월드 정리', angleType: 'info', demand: D(2) }),
  guideZero: I({ sec: 'guide', game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank', demand: D(0) }),
  guideOk: I({ sec: 'guide', game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank', demand: D(1) }),
  updLow: I({ sec: 'update', game: 'G', title: 'G 신규 보스 공략', angleType: 'howto', demand: D(2), heat: 1 }),
  updZero: I({ sec: 'update', game: 'Z', title: 'Z 신규 보스 공략', angleType: 'howto', demand: D(0), heat: 3 }),
  par: I({ sec: 'parenting', game: '아기 가습기', title: '아기 가습기 추천', heat: 1 }),
};
const all = Object.values(it);
const r = S.judge(all, false);
const rule = (x) => { const d = r.drop.find((y) => y.it === x); return d ? d.rule : 'KEEP'; };
eq(rule(it.newNo), 'R1', 'R1 신작 검색 흔적 없음');
ok(rule(it.newUnk) !== 'R1', 'fail-open: 수요를 못 쟀으면 R1 을 적용하지 않는다(→ ' + rule(it.newUnk) + ' · 상한 탈락은 별개)');
eq(S.judge([it.newUnk], false).drop.length, 0, 'fail-open: 혼자 있으면 그대로 남는다');
eq(rule(it.hotNews), 'R2', 'R2 화제 논평형');
eq(rule(it.hotHow), 'KEEP', '화제라도 how-to 면 남긴다');

/* ★R5 — 진입형(설치·가입·하는 법·쿠폰 등록)은 신작이거나 진입 경로가 바뀐 때만 (2026-09-21 사용자 지적) */
const entryItem = (extra) => I(Object.assign({ sec: 'guide', game: '메이플스토리', title: '메이플스토리 하는법, 회원가입부터 설치까지', keywords: ['메이플스토리 하는법'], angleType: 'howto', demand: D(2) }, extra || {}));
const ruleOf = (item, ctx) => { const d = S.judge([item], false, ctx).drop[0]; return d ? d.rule : 'KEEP'; };
eq(ruleOf(entryItem()), 'R5', '자리 잡은 게임의 «하는법»은 거둬낸다');
eq(ruleOf(entryItem({ entryOk: '08-12 넥슨 이관으로 계정 연동 절차가 바뀜' })), 'KEEP', '진입 경로가 바뀐 근거(entryOk)가 있으면 싣는다');
eq(ruleOf(entryItem(), { newGames: new Set(['메이플스토리']) }), 'KEEP', '최근 14판 신작 칸에 오른 게임이면 싣는다');
eq(ruleOf(I({ sec: 'guide', game: '메이플스토리', title: '메이플스토리 주간보스 결정값 정리', keywords: ['메이플스토리 주간보스 결정값'], angleType: 'howto', demand: D(2) })), 'KEEP', '실전형 질의는 그대로 통과');
eq([S.depthOf({ keywords: ['오버워치 카운터픽'] }), S.depthOf({ keywords: ['오버워치 하는법'] }), S.depthOf({ keywords: ['EA FC27 출시일'], angleType: 'news' })], ['play', 'entry', 'news'], '깊이 3갈래');
eq(rule(it.coreNews), 'R2', 'R2 주력 게임 소식');
eq([it.pin1, it.pin2, it.pin3].map(rule).filter((x) => x === 'R3').length, 2, 'R3 지정 게임 news 는 게임당 1건');
eq(rule(it.pin2), 'KEEP', 'R3 는 약한 쪽부터 뺀다(질의 순위 acRank 2 생존 · heat 는 09-23 부터 무관)');
eq(rule(it.pinHow), 'KEEP', '지정 게임 how-to 는 R3 대상 아님');
eq(rule(it.guideInfo), 'G', 'G 공략 칸 각도 제한');
eq(rule(it.guideZero), 'G', 'G 공략 칸 수요 0');
eq(rule(it.guideOk), 'KEEP', 'G 통과');
eq(rule(it.updLow), 'KEEP', '★09-23 heat 1 은 더 이상 R4 사유가 아니다(조사원 주관값 — 판정 제외)');
eq(rule(it.updZero), 'R4', 'R4 = 수요 최저 구간(tier 0 · 자동완성 경로도 동일)');
eq(rule(it.par), 'KEEP', '육아는 건드리지 않는다');
const evNews = [it.newN1, it.newN2, it.updN3].filter((x) => rule(x) === 'KEEP');
eq(evNews.length, 2, 'W1 신작·업데이트·화제 news 합 2건');
eq(rule(it.updN3), 'W1', 'W1 은 수요 낮은 쪽부터(tier 1 탈락)');
const newKeep = all.filter((x) => x.sec === 'new' && rule(x) === 'KEEP');
ok(newKeep.length <= S.CAPS.new, 'W1 신작 칸 상한 ' + S.CAPS.new + ' (남은 ' + newKeep.length + ')');
const cap = S.judge([1, 2, 3, 4].map((k) => I({ sec: 'update', game: 'N' + k, title: 'N' + k + ' 공략', angleType: 'howto', demand: D([1, 2, 3, 1][k - 1]) })), false);
eq(cap.drop.map((d) => d.rule), ['W1'], '업데이트 4건 → 상한으로 1건 탈락');
eq(cap.drop[0].it.game, 'N4', '상한 탈락은 수요 최저(tier 1 · 같은 값이면 뒤 순서)');
const capHot = S.judge([1, 2, 3].map((k) => I({ sec: 'hot', game: 'H' + k, title: 'H' + k + ' 공략', angleType: 'howto', demand: D(2) })), false);
eq(capHot.drop.length, 1, '화제 칸 상한 2');
const saR4 = S.judge([I({ sec: 'update', game: 'X', title: 'X 공략', angleType: 'howto', demand: D(0, 'searchad'), heat: 3 })], true);
eq(saR4.drop.map((d) => d.rule), ['R4'], '검색량 연동이면 R4 = tier 0(heat 무관)');

console.log('\n[5] 칸 안 정렬');
const g = [I({ game: 'a', demand: D(1) }), I({ game: 'b', demand: D(3) }), I({ game: 'c', demand: D(2) })];
eq(S.sortSection('guide', g).map((x) => x.game), ['b', 'c', 'a'], '수요 tier 내림차순');
const ab = [I({ game: 'n', demand: D(2), aib: { s: 'none' } }), I({ game: 'c', demand: D(2), aib: { s: 'shown', bd: 1 } }),
  I({ game: 'o', demand: D(2), aib: { s: 'shown' } }), I({ game: 'as', demand: D(2), aib: { s: 'async' } })];
eq(S.sortSection('core', ab).map((x) => x.game), ['o', 'as', 'c', 'n'], '같은 수요면 브리핑: 뜸·미인용 → 미열람 → 이미 인용 → 안 뜸');
const pg = [I({ game: 'g1', title: 'a', demand: D(1) }), I({ game: 'g2', title: 'b', demand: D(3) }), I({ game: 'g1', title: 'c', demand: D(3) })];
eq(S.sortSection('pinned', pg).map((x) => x.title), ['c', 'a', 'b'], 'pinned 는 게임 묶음 순서 유지 · 묶음 안에서만 정렬');
const par = [I({ title: 'p1', heat: 1 }), I({ title: 'p2', heat: 3 })];
eq(S.sortSection('parenting', par).map((x) => x.title), ['p1', 'p2'], '육아 순서는 손대지 않는다');
const hz = [I({ game: 'h1', demand: D(2), heat: 1 }), I({ game: 'h3', demand: D(2), heat: 3 }), I({ game: 'h2', demand: Object.assign(D(2), { acRank: 4 }), heat: 2 })];
eq(S.sortSection('core', hz).map((x) => x.game), ['h2', 'h1', 'h3'], '★09-23 heat 는 정렬에 안 쓴다 — 질의 순위(acRank) → 원래 순서');

console.log('\n[6] 검색광고 서명 · 숫자');
eq(S.saSign('1700000000000', 'GET', '/keywordstool', 'test-secret-키'), '4/mUblhSQT1GJnaEQW9EGG203PGPMsiIQgyuH14+PzI=', '공식 signaturehelper.py 와 같은 값(파이썬으로 계산한 기대값)');
eq(S.saNum('< 10'), { n: 0, lt: true }, '«< 10» 은 0·lt');
eq(S.saNum(3870), { n: 3870, lt: false }, '숫자 그대로');
eq(S.saKey('동방홍마향: 뉴 클래식'), '동방홍마향뉴클래식', '키워드는 공백·기호 제거');

console.log('\n[7] 게임 변형 · 지난달 질의');
const v = S.gameVariants('동방홍마향: 뉴 클래식', ['동방홍마향 리메이크', '스위치 신작']);
ok(v.includes('동방홍마향 뉴 클래식') && v.includes('동방홍마향'), '긴 공식명 → 앞 낱말까지 줄여 본다 ' + JSON.stringify(v));
ok(v.includes('동방홍마향 리메이크'), 'keywords 첫 항목·게임 낱말 공유 표기 포함');
ok(!v.includes('스위치 신작'), '게임과 무관한 키워드는 빼다');
const mm = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1, other = mm === 12 ? 11 : mm + 1;
eq([S.staleMonth('쿠폰 ' + other + '월'), S.staleMonth('쿠폰 ' + mm + '월'), S.staleMonth('쿠폰 모음')], [true, false, false], '다른 달 질의만 제외');

console.log('\n[8] 브리핑 요약');
eq(S.aibSummary({ status: 'shown', sources: [{ rank: 1, blog: 'x' }, { rank: 2, blog: 'bomding' }], fetchedAt: 't' }), { s: 'shown', n: 2, bd: 2, yd: null, at: 't' }, '봄딩 인용 순위');
eq(S.aibSummary({ status: 'blocked' }).s, 'unknown', '차단·오류는 unknown');

console.log('\n[9] 글 → 발주 경로(칸)');
const RQ = [
  { postRel: '봄딩/애니모/전투 티어표/a.html', source: 'trend-desk', topic: '애니모 전투 티어표', createdAt: 1 },
  { postRel: '봄딩/애니모/전투 티어표/b.html', source: 'trend-desk', topic: '애니모  전투 티어표!', createdAt: 5 },
  { postRel: '영도/겜/글/x.html', source: 'site', topic: '아무거나', createdAt: 2 },
  { postRel: '봄딩/옛/글/y.html', source: 'briefing', topic: 'z', createdAt: 3 },
  { postRel: '봄딩/새/글/w.html', source: 'trend-desk', topic: '판에 없는 제목', createdAt: 4 },
  { postRel: '봄딩/앱/글/p.html', source: 'pwa', topic: 'q', createdAt: 6 },
  { topic: 'postRel 없는 요청', source: 'trend-desk', createdAt: 7 },
];
const IT = S.deskItems({ editions: [{ date: '2026-09-19', sections: [{ key: 'guide', items: [{ title: '애니모 전투 티어표' }] }, { key: 'hot', items: [{}] }] }] });
eq(IT, [{ date: '2026-09-19', sec: 'guide', title: '애니모 전투 티어표' }], '판 → 항목 평탄화(제목 없는 항목 제외)');
eq(['봄딩/애니모/전투 티어표', '영도/겜/글', '봄딩/옛/글', '봄딩/새/글', '봄딩/앱/글', '없는/폴더'].map((f) => S.secOfPost(f, RQ, IT)),
   ['guide', 'direct', 'briefing', 'desk?', 'direct', 'unknown'], 'trend-desk→칸(같은 폴더는 늦은 요청·공백·기호 무시) · site·pwa→direct · briefing · 판에 없음→desk? · 요청 없음→unknown');
eq(S.secOfPost('봄딩/애니모/전투 티어표', null, IT), 'unknown', '백엔드를 못 읽으면 unknown(추정 금지)');

console.log('\n[10] 발행 후 재검 요약(desk-mix followupSummary)');
const { followupSummary } = require('./desk-mix.cjs');
eq(followupSummary(null), null, '재검 파일이 없으면 null');
const FS = followupSummary({ updated: 'u', posts: {
  a: { title: '애니모 전투 티어표', sec: 'guide', d7: { res: [{ s: 'shown', bd: 2 }, { s: 'none' }] }, d14: { res: [{ s: 'shown', bd: 1 }, { s: 'shown' }] } },
  b: { title: '신작 출시일 확정', sec: 'new', d7: { skipped: true, at: null }, d14: { res: [{ s: 'async' }] } },
  c: { title: '쿠폰 코드 입력 방법', d7: { res: [{ s: 'shown', yd: 3 }] } },
  d: { title: '아직 기한 전' },
} });
eq([FS.posts, FS.d7.posts, FS.d7.queries, FS.d14.posts, FS.d14.cited], [4, 2, 3, 2, 1], 'd7·d14 전체(건너뛴 d7 제외)');
eq(FS.byAngle.rank, { posts: 1, queries: 2, shown: 2, cited: 1, shownRate: 100, citedRate: 50 }, '가장 늦은 재검(D+14)만 센다 — 티어');
eq(FS.byAngle.howto, { posts: 1, queries: 1, shown: 1, cited: 1, shownRate: 100, citedRate: 100 }, 'D+14 가 없으면 D+7 — 쿠폰(공략)');
eq([FS.byAngle.news.shownRate, FS.byAngle.news.citedRate], [100, 0], '소식 — async(출처 미확인)도 «뜸»으로 센다(타일·발주 모달과 같은 정의) · 인용 0');
eq(Object.keys(FS.bySec).sort(), ['guide', 'new', 'unknown'], '칸 없는 글은 unknown · 기한 전 글은 빠진다');
eq(FS.updated, 'u', '재검 파일 갱신 시각 전달');

console.log('\n[11] ★크로스섹션 X (2026-09-23 · L89 3회째 승격) — 같은 회차 다른 칸 · 같은 게임 · 같은 angleType · 주제 겹침 → 뒤 칸 DROP');
{
  const X = (o) => I(Object.assign({ demand: D(2) }, o));
  const xs = [
    X({ sec: 'update', game: '메이플스토리', title: '메이플스토리 아우룸 레기스 공략, 입장 조건부터', angleType: 'howto', keywords: ['메이플스토리 아우룸 레기스 공략'] }),
    X({ sec: 'guide', game: '메이플스토리', title: '메이플스토리 아우룸 레기스 입장 조건과 보상', angleType: 'howto', keywords: ['메이플스토리 아우룸 레기스'] }),
    X({ sec: 'guide', game: '메이플스토리', title: '메이플스토리 주간보스 결정값 정리', angleType: 'howto', keywords: ['메이플스토리 주간보스 결정값'] }),
    X({ sec: 'hot', game: '오버워치', title: '오버워치 9월 패치 대응 세팅', angleType: 'howto', keywords: ['오버워치 패치 세팅'] }),
    X({ sec: 'guide', game: '오버워치', title: '오버워치 카운터픽 정리', angleType: 'rank', keywords: ['오버워치 카운터픽'] }),
    X({ sec: 'core', game: '팰월드', title: '팰월드 교배 확률 정리', angleType: 'howto', keywords: ['팰월드 교배 확률'] }),
    X({ sec: 'new', game: '팰월드', title: '팰월드 신규 지역 초반 루트', angleType: 'howto', keywords: ['팰월드 신규 지역'] }),
  ];
  const rx = (list, ctx) => { const r = S.judge(list, false, ctx); return list.map((x) => { const d = r.drop.find((y) => y.it === x); return d ? d.rule : 'KEEP'; }); };
  eq(rx(xs), ['X', 'KEEP', 'KEEP', 'KEEP', 'KEEP', 'KEEP', 'KEEP'], '우선권 guide > update: 같은 게임·howto·주제 겹침이면 update 쪽이 X · 각도 다르면(howto vs rank)·주제 다르면 둘 다 KEEP');
  eq(rx(xs, { crossStrict: true }), ['X', 'KEEP', 'KEEP', 'KEEP', 'KEEP', 'KEEP', 'X'], '--cross-strict: 주제 겹침 조건 없이 게임+angleType 만으로(팰월드 new 도 X) · rank≠howto 는 여전히 KEEP');
  eq(S.judge(xs, false).drop.find((d) => d.rule === 'X').why.includes('guide 칸'), true, 'X 사유에 상위 칸·제목이 실린다');
  const same = [X({ sec: 'guide', game: '팰월드', title: '팰월드 거점 추천 1', angleType: 'rank' }), X({ sec: 'guide', game: '팰월드', title: '팰월드 거점 추천 2', angleType: 'rank' })];
  eq(rx(same), ['KEEP', 'KEEP'], '같은 칸끼리는 X 대상 아님(조사원·dedup 몫)');
  const upDropped = [X({ sec: 'core', game: '림버스', title: '림버스 10장 출시', angleType: 'news' }), X({ sec: 'update', game: '림버스', title: '림버스 10장 출시 일정', angleType: 'news' })];
  eq(rx(upDropped), ['R2', 'KEEP'], '상위 칸 항목이 이미 죽었으면(R2) 뒤 칸을 X 로 빼지 않는다');
  ok(S.crossOverlap({ game: '메이플스토리', title: '메이플스토리 아우룸 레기스 공략', sec: 'update' }, { game: '메이플스토리', title: '메이플스토리 아우룸 레기스 입장 조건' }), 'crossOverlap = desk-dedup 판정 ≠ OK');
  ok(!S.crossOverlap({ game: '메이플스토리', title: '메이플스토리 아우룸 레기스 공략', sec: 'update' }, { game: '메이플스토리', title: '메이플스토리 주간보스 결정값' }), '주제가 다르면 겹침 아님');
}

console.log('\n[12] ★블록리스트 B (2026-09-23 · L95) — _trend/_blocklist.json {game, angle, until}');
{
  const bl = [
    { game: '사일런트 힐 타운폴', angle: '얼리 액세스', until: '2099-01-01', reason: 't' },
    { game: '제우스: 오만의 신', angle: '*', until: '2000-01-01', reason: 'expired' },
    { game: '롤토체스', angle: 'news', until: '2099-01-01', reason: 'angleType 로 막기' },
    { game: '팰월드', angle: '*', until: '2099-01-01' },
  ];
  const ctxB = { blocklist: bl, today: '2026-09-23' };
  const bI = (o) => I(Object.assign({ demand: D(2) }, o));
  eq(ruleOf(bI({ sec: 'new', game: '사일런트힐 타운폴', title: '사일런트힐 타운폴 얼리액세스 하는 법', angleType: 'howto', keywords: ['사일런트힐 타운폴 얼리 액세스'] }), ctxB), 'B', '게임(띄어쓰기 무시)+각도 문자열(제목·질의 포함) 일치 → B');
  eq(ruleOf(bI({ sec: 'new', game: '사일런트힐 타운폴', title: '사일런트힐 타운폴 엔딩 분기 정리', angleType: 'howto', keywords: ['사일런트힐 타운폴 엔딩'] }), ctxB), 'KEEP', '각도가 다르면 통과');
  eq(ruleOf(bI({ sec: 'update', game: '제우스', title: '제우스 보스 시간표 대응', angleType: 'howto' }), ctxB), 'KEEP', 'until 이 지난 항목은 무시');
  eq(ruleOf(bI({ sec: 'pinned', game: '롤토체스', title: '롤토체스 패치 노트', angleType: 'news' }), ctxB), 'B', 'angle 이 angleType 이면 그 각도 전부');
  eq(ruleOf(bI({ sec: 'pinned', game: '롤토체스', title: '롤토체스 덱 추천', angleType: 'rank' }), ctxB), 'KEEP', 'angleType 이 다르면 통과');
  eq(ruleOf(bI({ sec: 'core', game: '팰월드', title: '팰월드 무엇이든', angleType: 'howto' }), ctxB), 'B', "angle '*' 는 그 게임 전부");
  eq(ruleOf(bI({ sec: 'core', game: '팰월드', title: '팰월드 무엇이든', angleType: 'howto' }), { blocklist: bl, today: '2099-01-02' }), 'KEEP', 'until 당일까지 포함 · 다음 날부터 해제');
  eq(S.blockHit({ game: '제우스: 오만의 신', title: 'x' }, [{ game: '제우스', angle: '*', until: '2099-01-01' }], '2026-09-23').game, '제우스', '게임명은 한쪽이 다른 쪽을 품어도 같은 게임');
  ok(Array.isArray(S.loadBlocklist()) && S.loadBlocklist().every((b) => b.game && b.until), '_trend/_blocklist.json 이 읽히고 항목마다 game·until 이 있다(' + S.loadBlocklist().length + '건)');
}

console.log('\n[13] ★desk-candidates merge · gate (2026-09-23 · [B-0] 접착제)');
{
  const C = require('./desk-candidates.cjs');
  const m = C.mergeCands([
    { file: '_tmp/cand-guide.json', data: [{ game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank', keywords: ['팰월드 거점'], sources: [{ url: 'https://e.com' }] }, { game: '', title: 'x' }] },
    { file: '_tmp/cand-new.json', data: { sec: 'new', items: [{ game: '모노웨이브', title: '모노웨이브 | 출시일', angleType: 'news', sources: [{ url: 'https://e.com' }] }] } },
    { file: '_tmp/cand-bad.json', data: { nope: 1 } },
  ]);
  eq(m.items.map((x) => [x.id, x.sec]), [['guide-1', 'guide'], ['new-1', 'new']], 'id = <sec>-<n> · sec 는 파일명/객체에서 · 깨진 항목·파일은 건너뛰고 경고');
  eq(C.toLine(m.items[1]), '모노웨이브 | 모노웨이브 출시일', '«게임 | 제목» 줄 — 제목 속 | 는 공백으로(짝짓기 키가 깨지지 않게)');
  ok(m.warnings.length >= 2, '경고가 남는다(' + m.warnings.length + '건)');
  const cands = [
    { id: 'guide-1', sec: 'guide', game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank' },
    { id: 'guide-2', sec: 'guide', game: '메이플', title: '메이플 하는법', angleType: 'howto' },
    { id: 'new-1', sec: 'new', game: 'A', title: 'A 출시일', angleType: 'news' },
    { id: 'core-1', sec: 'core', game: '이환', title: '이환 레이븐 세팅', angleType: 'howto' },
    { id: 'par-1', sec: 'parenting', game: '아기 가습기', title: '아기 가습기 추천' },
  ];
  const dedup = { results: [
    { game: '팰월드', title: '팰월드 거점 추천', verdict: 'CHECK', hits: [{ verdict: 'CHECK', date: '2026-09-13', sec: 'core', title: '팰월드 거점 위치', why: '공유어 2' }] },
    { game: '메이플', title: '메이플 하는법', verdict: 'DROP', hits: [{ verdict: 'DROP', date: '2026-09-19', sec: 'guide', title: '메이플스토리 하는법', why: '같은 질의' }] },
    { game: 'A', title: 'A 출시일', verdict: 'OK', hits: [] },
    { game: '이환', title: '이환 레이븐 세팅', verdict: 'OK', hits: [] },
    { game: '아기 가습기', title: '아기 가습기 추천', verdict: 'OK', hits: [] },
  ] };
  const classify = [{ writer: '봄딩', results: [
    { raw: '팰월드 | 팰월드 거점 추천', status: 'review', matchedTitle: '팰월드 거점 어디에', reason: 'r' },
    { raw: '메이플 | 메이플 하는법', status: 'new' },
    { raw: 'A | A 출시일', status: 'new' },
    { raw: '이환 | 이환 레이븐 세팅', status: 'carried', reason: '이월' },
    { raw: '아기 가습기 | 아기 가습기 추천', status: 'published', matchedTitle: '아기 가습기 고르는 법' },
  ] }];
  const signals = { items: [
    { id: 'guide-1', verdict: 'KEEP', demand: { tier: 2 }, depth: 'play', angleType: 'rank' },
    { id: 'guide-2', verdict: 'DROP', rule: 'R5', why: '진입형' },
    { id: 'new-1', verdict: 'DROP', rule: 'R1', why: '검색 흔적 없음' },
    { id: 'core-1', verdict: 'KEEP', demand: { tier: 1 } },
  ] };
  const g = C.gateItems(cands, dedup, classify, signals);
  eq(g.kept.map((x) => x.id), ['guide-1'], '통과 = dedup CHECK + classify review + signals KEEP 만');
  eq(g.kept[0].flags, ['dedup:CHECK', 'classify:review(봄딩)'], 'FLAG 가 남는다');
  eq(g.kept[0].coverage, [{ writer: '봄딩', title: '팰월드 거점 어디에' }], 'coverage = matchedTitle 그대로(L078)');
  eq([g.kept[0].demand, g.kept[0].depth], [{ tier: 2 }, 'play'], 'signals 의 demand·depth 가 통과 항목에 실린다');
  eq(g.dropped.map((x) => x.id + ':' + x.by), ['guide-2:dedup', 'new-1:signals', 'core-1:classify', 'par-1:classify'], 'DROP 사유 = 먼저 걸린 축(dedup > classify > signals) · carried·published 는 DROP');
  eq(g.dropped.find((x) => x.id === 'guide-2').also, ['signals R5'], '뒤에 걸린 축도 also 에 남긴다');
  ok(g.note.some((l) => l.startsWith('재탕 1건 제외')) && g.note.some((l) => l.startsWith('거둬냄 1건(R1 1)')) && g.note.some((l) => l.startsWith('커버리지 경고 1건')), 'note 초안 3줄(재탕·거둬냄·커버리지) ' + JSON.stringify(g.note));
  ok(g.note.every((l) => l.length <= 140), 'note 초안은 140자 이하');
}

console.log('\n' + (bad ? 'FAIL ' + bad + '/' + n : 'ALL PASS ' + n));
process.exit(bad ? 1 : 0);
