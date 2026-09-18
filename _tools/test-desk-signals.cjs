// test-desk-signals.cjs — desk-signals.cjs 판정·정렬·수요 구간·서명 회귀 게이트 (2026-09-18 · 네트워크 0)
//   node _tools/test-desk-signals.cjs
//   ★desk-signals.cjs 를 고치면 반드시 돌린다. 규칙(R1~R4·W1·G)은 사용자 승인 사항이라 조용히 바뀌면 안 된다.
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
eq(S.demandOf({ n: 7 }, null, '뱀피르', []).tier, 2, '검색량 미연동 · 자동완성 7 → 2');
eq(S.demandOf(null, null, 'x', []).tier, null, '못 쟀으면 null(0 아님)');

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
  hotHow: I({ sec: 'hot', game: '제우스', title: '제우스 쿠폰 입력 방법', angleType: 'howto', demand: D(2) }),
  coreNews: I({ sec: 'core', game: '림버스', title: '10장 출시', angleType: 'news', demand: D(2) }),
  pin1: I({ sec: 'pinned', game: '롤토체스', title: '버그 수정', angleType: 'news', demand: D(2), heat: 1 }),
  pin2: I({ sec: 'pinned', game: '롤토체스', title: '특성 변경', angleType: 'news', demand: D(2), heat: 3 }),
  pin3: I({ sec: 'pinned', game: '롤토체스', title: '장갑 버그', angleType: 'news', demand: D(2), heat: 2 }),
  pinHow: I({ sec: 'pinned', game: '롤토체스', title: '초보 덱 추천', angleType: 'rank', demand: D(2), heat: 1 }),
  guideInfo: I({ sec: 'guide', game: '팰월드', title: '팰월드 정리', angleType: 'info', demand: D(2) }),
  guideZero: I({ sec: 'guide', game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank', demand: D(0) }),
  guideOk: I({ sec: 'guide', game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank', demand: D(1) }),
  updLow: I({ sec: 'update', game: 'G', title: 'G 신규 보스 공략', angleType: 'howto', demand: D(2), heat: 1 }),
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
eq(rule(it.coreNews), 'R2', 'R2 주력 게임 소식');
eq([it.pin1, it.pin2, it.pin3].map(rule).filter((x) => x === 'R3').length, 2, 'R3 지정 게임 news 는 게임당 1건');
eq(rule(it.pin2), 'KEEP', 'R3 는 약한 쪽부터 뺀다(heat 3 생존)');
eq(rule(it.pinHow), 'KEEP', '지정 게임 how-to 는 R3 대상 아님');
eq(rule(it.guideInfo), 'G', 'G 공략 칸 각도 제한');
eq(rule(it.guideZero), 'G', 'G 공략 칸 수요 0');
eq(rule(it.guideOk), 'KEEP', 'G 통과');
eq(rule(it.updLow), 'R4', 'R4 검색량 미연동 heat 1');
eq(rule(it.par), 'KEEP', '육아는 건드리지 않는다');
const evNews = [it.newN1, it.newN2, it.updN3].filter((x) => rule(x) === 'KEEP');
eq(evNews.length, 2, 'W1 신작·업데이트·화제 news 합 2건');
eq(rule(it.updN3), 'W1', 'W1 은 수요 낮은 쪽부터(tier 1 탈락)');
const newKeep = all.filter((x) => x.sec === 'new' && rule(x) === 'KEEP');
ok(newKeep.length <= S.CAPS.new, 'W1 신작 칸 상한 ' + S.CAPS.new + ' (남은 ' + newKeep.length + ')');
const cap = S.judge([1, 2, 3, 4].map((k) => I({ sec: 'update', game: 'N' + k, title: 'N' + k + ' 공략', angleType: 'howto', demand: D(k % 3) })), false);
eq(cap.drop.map((d) => d.rule), ['W1'], '업데이트 4건 → 상한으로 1건 탈락');
eq(cap.drop[0].it.game, 'N3', '상한 탈락은 수요 최저(tier 0)');
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

console.log('\n' + (bad ? 'FAIL ' + bad + '/' + n : 'ALL PASS ' + n));
process.exit(bad ? 1 : 0);
