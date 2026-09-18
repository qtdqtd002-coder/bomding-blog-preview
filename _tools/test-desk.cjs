/* index.html 의 데스크 로직(DESK_SECTIONS/normEditions/edItems/deskMaterial)을 그대로 떼어내
   실제 trend.json 으로 돌려 본다. DOM 없이 데이터 변형만 검증. */
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\qtdqt\\Desktop\\Claude\\BlogPreview';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ★2026-09-03 개정 — 마커를 문자열에서 «정규식»으로 바꿨다.
   사이트 v5 개편에서 선언 키워드(const→var)·들여쓰기·주석 문양이 바뀌자 하네스가 통째로 죽었다.
   테스트가 사이트의 «표기»에 묶여 있으면 로직이 멀쩡해도 개편마다 테스트가 먼저 깨진다.
   묶여야 할 것은 표기가 아니라 «이름»이다. */
function grabRe(startRe, endRe, what) {
  const a = html.search(startRe);
  if (a < 0) throw new Error('시작 마커를 찾지 못했습니다: ' + what + ' — index.html 에서 이름이 바뀌었는지 확인하세요.');
  const rest = html.slice(a);
  const b = rest.search(endRe);
  if (b < 0) throw new Error('끝 마커를 찾지 못했습니다: ' + what);
  return rest.slice(0, b);
}
/* normEditions 가 참조하는 외부 상수(작성자 목록·휴면 목록)도 index.html 에서 같이 끌어온다.
   ★여기에 값을 하드코딩하면 사이트에서 작성자가 바뀌어도 테스트는 옛 값으로 통과해 버린다 —
     테스트가 진실을 보게 하려면 정의부를 그대로 떼어 와야 한다. */
function grabLine(re, what) {
  const m = html.match(re);
  if (!m) throw new Error('정의를 찾지 못했습니다: ' + what + ' — index.html 에서 이름이 바뀌었는지 확인하세요.');
  return m[0];
}
/* 휴면 목록의 변수명은 개편에서 INACTIVE_WRITERS → INACTIVE 로 바뀔 수 있다. 둘 다 받고 하네스 안에서 별칭을 맞춘다. */
const inactiveDecl = grabLine(/^[ \t]*(?:const|var|let) INACTIVE(?:_WRITERS)?=\[[^\]]*\];/m, 'INACTIVE_WRITERS');
const deps = [
  grabLine(/^[ \t]*(?:const|var|let) PREF=\[[^\]]*\];/m, 'PREF'),
  inactiveDecl,
  /INACTIVE_WRITERS=/.test(inactiveDecl) ? '' : 'var INACTIVE_WRITERS=INACTIVE;',
].join('\n');

const src = grabRe(/^[ \t]*(?:const|var|let) DESK_SECTIONS=\[/m, /function pinBox\s*\(/, 'DESK_SECTIONS…deskMaterial');
const mod = new Function(deps + '\n' + src + '\n return {DESK_SECTIONS,DESK_SEC,normEditions,edItems,deskMaterial,PREF,INACTIVE_WRITERS};')();
console.log('  · PREF = ' + mod.PREF.join(',') + ' | 휴면 = ' + (mod.INACTIVE_WRITERS.join(',') || '없음'));

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, '_trend', 'trend.json'), 'utf8'));
const TREND = mod.normEditions(raw);

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS ' : '  FAIL ') + msg); if (!cond) fail++; };
/* 노트 가독성 규칙 시행일 — 이 날짜 이전 에디션엔 소급하지 않는다(§[6] 참고) */
const NOTE_RULE_FROM = '2026-09-02';

/* ★불변식 검사만 한다 — 회차마다 바뀌는 수치(에디션 수·건수·경고 수·특정 id)에 단언을 걸지 않는다.
   시드 수치에 못을 박아 두면 매일 데이터가 아니라 테스트가 실패한다. */
console.log('\n[1] normEditions');
ok(TREND.length >= 1, 'edition count >= 1 (got ' + TREND.length + ')');
ok(TREND.length <= (raw.keepDays || 14), 'keepDays 이내 (' + TREND.length + ' <= ' + (raw.keepDays || 14) + ')');
ok(TREND.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date)), 'every date parsed as YYYY-MM-DD');
/* ★칸 수·순서는 index.html 의 DESK_SECTIONS 에서 끌어온다 — 사이트가 분류를 늘리면 테스트도 같이 따라간다.
   (숫자를 여기 박아 두면 사이트 개편 때 데이터가 아니라 테스트가 먼저 깨진다) */
const SECKEYS = mod.DESK_SECTIONS.map(s => s.key);
console.log('  · DESK_SECTIONS = ' + SECKEYS.join(','));
ok(TREND.every(e => e.sections.length === SECKEYS.length), 'sections = DESK_SECTIONS 수(' + SECKEYS.length + ')');
ok(TREND.every(e => e.sections.map(s => s.key).join(',') === SECKEYS.join(',')), 'section order = DESK_SECTIONS 순서');

console.log('\n[2] items (최신 에디션)');
const ED = TREND[0];
const all = mod.edItems(ED);
console.log('  · ' + ED.date + ' — ' + all.length + '건 ' +
  ED.sections.map(s => s.key + ':' + s.items.length).join(' '));
ok(all.length > 0, 'edition has at least 1 item');
ok(all.every(i => i.id && i.title), 'every item has id + title');
ok(new Set(all.map(i => i.id)).size === all.length, 'ids unique within edition');
/* ★분류 키를 여기 나열하지 않는다 — SECKEYS(=index.html DESK_SECTIONS)에서 끌어온다.
   08-15 에 core 를 추가했을 때 이 줄이 옛 4키를 박고 있어 데이터가 아니라 테스트가 먼저 깨졌다(L006 동형 재발). */
ok(all.every(i => SECKEYS.includes(i.sec)), 'sec tagged on every item (' + SECKEYS.join('/') + ')');
ok(all.every(i => i.heat >= 0 && i.heat <= 3), 'heat clamped 0..3');
ok(all.every(i => Array.isArray(i.sources) && i.sources.length >= 1 && i.sources.every(s => s.url)), 'every item has >=1 well-formed source');
ok(all.every(i => !('writer' in i) || !i.writer), 'no writer key (배정은 발주 팝업 몫)');
ok(TREND.every(e => new Set(mod.edItems(e).map(i => i.id)).size === mod.edItems(e).length), 'ids unique in every edition');

console.log('\n[3] deskMaterial (발주 모달 프리필)');
const anyItem = all[0];
const m = mod.deskMaterial(anyItem);
ok(typeof m === 'string' && m.length > 0, 'material 생성됨');
ok(m.includes('http'), '출처 URL 포함');
const withCov = all.find(i => i.coverage.length);
const noCov = all.find(i => !i.coverage.length);
if (withCov) ok(mod.deskMaterial(withCov).includes('★기존 글 확인 필요'), 'coverage 경고가 소재 메모에 실림');
else console.log('  SKIP coverage 경고 — 오늘 판에 경고 붙은 항목 없음');
if (noCov) ok(mod.deskMaterial(noCov).indexOf('★기존 글') < 0, 'coverage 없으면 경고 미삽입');
else console.log('  SKIP 무경고 항목 — 오늘 판 전 항목에 경고가 붙음');
/* ★2026-09-18 — 신호(검색 수요·AI 브리핑)가 소재 메모에 실리는가. 오늘 판에 없을 수 있으니 합성 항목으로 본다 */
{
  const syn = mod.normEditions({ editions: [{ date: '2026-09-19', sections: [{ key: 'guide', items: [{
    id: 'x', game: '팰월드', title: '팰월드 거점 추천', angleType: 'rank', keywords: ['팰월드 거점'],
    demand: { tier: 2, src: 'ac', ac: 10 }, aib: { s: 'shown', n: 5, bd: null, yd: null, q: '팰월드 거점' },
    sources: [{ label: '공식', url: 'https://example.com' }] }] }] }] });
  const it = mod.edItems(syn[0])[0];
  const mm = mod.deskMaterial(it);
  ok(it.angleType === 'rank' && it.demand && it.demand.tier === 2 && it.aib && it.aib.s === 'shown', 'normEditions 가 angleType·demand·aib 를 넘긴다');
  ok(mm.includes('[검색 수요] 보통 · 자동완성 10/10'), '소재 메모에 [검색 수요]');
  ok(mm.includes('[AI 브리핑] 뜸 · 출처 5곳 · 우리 글 미인용'), '소재 메모에 [AI 브리핑]');
  const old = mod.normEditions({ editions: [{ date: '2026-09-01', sections: [{ key: 'new', items: [{ title: 't', sources: [{ url: 'https://e.com' }] }] }] }] });
  const oi = mod.edItems(old[0])[0];
  ok(oi.demand === null && oi.aib === null && mod.deskMaterial(oi).indexOf('[검색 수요]') < 0, '신호 없는 옛 판은 줄을 만들지 않는다');
}

console.log('\n[4] 방어 — 깨진/구 스키마 입력');
ok(mod.normEditions(null).length === 0, 'null → []');
ok(mod.normEditions({ issues: [{ writer: '봄딩', date: '2026-08-13' }] }).length === 0, '구 issues 스키마 → [] (조용히 버림)');
ok(mod.normEditions({ editions: [{ date: '2026-08-15' }] })[0].sections.length === mod.DESK_SECTIONS.length, 'sections 없어도 DESK_SECTIONS 만큼 칸 생성');
const junk = mod.normEditions({ editions: [{ date: '2026-08-15', sections: [{ key: 'new', items: [{ title: '' }, null, { title: 'ok' }] }] }] });
ok(mod.edItems(junk[0]).length === 1, '빈 title·null 아이템 제거');
const two = mod.normEditions({ editions: [{ date: '2026-08-13' }, { date: '2026-08-15' }] });
ok(two[0].date === '2026-08-15', '최신순 정렬');

console.log('\n[5] 날짜 페이저 입력');
ok([...new Set(TREND.map(e => e.date))].length === TREND.length, '에디션당 날짜 1개(중복 없음)');

/* [6] 노트 가독성 — 2026-09-02 신설.
   08-14~09-01 의 note 는 1,100~3,700자 한 문단이었다. 사이트가 줄 목록으로 그리게 고쳤지만,
   렌더만 고치면 «줄 하나가 655자»인 상태는 그대로다(사용자 지적: "정보대로 쭉 정리돼 보기 어렵다").
   그래서 길이를 코드로 막는다 — 산문 규칙은 집행되지 않는다(context-budget 교훈).
   ★소급 적용하지 않는다: 규칙 시행일 이전 판은 보고만 하고 통과시킨다(지난 데이터가 아니라
     오늘 내는 판을 막는 게 목적이고, 옛 판은 keepDays 안에 저절로 빠진다). */
console.log('\n[6] 데스크 노트 가독성 (시행 ' + NOTE_RULE_FROM + '~)');
const NOTE_MAX_LINES = 6, NOTE_MAX_CHARS = 140;
let noteChecked = 0;
for (const e of TREND) {
  const legacy = e.date < NOTE_RULE_FROM;
  const long = e.note.filter(l => l.length > NOTE_MAX_CHARS);
  const label = e.date + ' note ' + e.note.length + '줄' + (long.length ? ' · ' + long.length + '줄이 ' + NOTE_MAX_CHARS + '자 초과(최장 ' + Math.max(...long.map(l => l.length)) + ')' : '');
  if (legacy) { console.log('  (구판) ' + label); continue; }
  noteChecked++;
  ok(e.note.length <= NOTE_MAX_LINES, label + ' — ' + NOTE_MAX_LINES + '줄 이하');
  ok(long.length === 0, e.date + ' note 각 줄 ' + NOTE_MAX_CHARS + '자 이하' +
    (long.length ? ' — 넘친 줄: 「' + long[0].slice(0, 40) + '…」' : ''));
}
if (!noteChecked) console.log('  SKIP — 시행일 이후 에디션이 아직 없음(구판만 있음)');

/* [7] 경량본 최신성 — 2026-09-02 신설.
   사이트는 부팅에서 `_trend/trend-lite.json`(최신 3일 + 날짜 목록 14일)만 받는다.
   trend.json 을 새로 쓰고 lite 를 다시 굽지 않으면 **사이트가 어제 판을 보여 준다** —
   그것도 «에러 없이» 보여 주므로 눈으로는 안 걸린다. 그래서 발행 게이트에서 막는다.
   (trend.json 자체는 14일 전량 그대로다 — 도구들이 보는 창은 하나도 안 좁아졌다) */
console.log('\n[7] 경량본(trend-lite.json) 최신성');
{
  const r = require('child_process').spawnSync(process.execPath,
    [path.join(ROOT, '_tools', 'build-trend-lite.cjs'), '--check'], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  if (out) console.log(out.split('\n').map(l => l.replace(/^\s{0,2}/, '  ')).join('\n'));
  ok(r.status === 0, 'trend-lite.json 이 trend.json 과 일치');
}

/* [8] 거둬내기·신호 계약 — 2026-09-18 사용자 승인(«권고안대로 전부 진행») · 시행 2026-09-19 판부터.
   정본 = 쓰담/docs/2026-09-18_트렌드_추천방식_검토_수정계획.md §W1·§W6 + SKILL [B-3]. 기계 집행 = _tools/desk-signals.cjs(check·stamp).
   이 게이트는 «데스크가 stamp 를 건너뛰거나 손으로 판을 고쳐도» 규칙이 새지 않게 막는 마지막 백스톱이다.
   ★raw(trend.json 그대로)를 본다 — normEditions 는 사이트 상한(5)으로 잘라 버려서 4·5건 초과를 못 본다.
   ★게이트 자신도 시험한다: 규칙을 지킨 합성 판 = 0건, 어긴 합성 판 = 기대한 위반만 — 빈 게이트가 초록으로 통과하는 일을 막는다. */
const RULE_FROM = '2026-09-19';
const CAPS = { new: 3, update: 3, hot: 2, guide: 8 };
const GAME = ['pinned', 'core', 'guide', 'new', 'update', 'hot'];
function weekOf(d) { const t = new Date(d + 'T12:00:00Z'); return new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); }
function ruleViolations(e, all) {
  const v = [];
  const sec = (k) => (((e.sections || []).find((s) => s && s.key === k) || {}).items || []).filter(Boolean);
  Object.entries(CAPS).forEach(([k, cap]) => { if (sec(k).length > cap) v.push('cap:' + k + ' ' + sec(k).length + '>' + cap); });
  const game = GAME.flatMap((k) => sec(k).map((it) => ({ k, it })));
  game.forEach(({ k, it }) => {
    if (!['howto', 'rank', 'news', 'info'].includes(it.angleType)) v.push('angleType:' + k + ' «' + String(it.title).slice(0, 20) + '»');
    if (it.demand && ![0, 1, 2, 3, null].includes(it.demand.tier)) v.push('demand.tier:' + k);
    if (it.aib && !['shown', 'async', 'none', 'unknown'].includes(it.aib.s)) v.push('aib.s:' + k);
  });
  const evNews = game.filter((x) => ['new', 'update', 'hot'].includes(x.k) && x.it.angleType === 'news').length;
  if (evNews > 2) v.push('W1:소식형 ' + evNews + '>2');
  game.filter((x) => (x.k === 'hot' || x.k === 'core') && x.it.angleType === 'news').forEach((x) => v.push('R2:' + x.k));
  const pn = {}; game.filter((x) => x.k === 'pinned' && x.it.angleType === 'news').forEach((x) => { pn[x.it.game] = (pn[x.it.game] || 0) + 1; });
  Object.entries(pn).forEach(([g, n]) => { if (n > 1) v.push('R3:' + g + ' ' + n); });
  game.filter((x) => x.k === 'new' && x.it.demand && x.it.demand.tier === 0).forEach(() => v.push('R1:new'));
  game.filter((x) => ['new', 'update', 'hot'].includes(x.k)).forEach(({ k, it }) => {
    const sa = it.demand && it.demand.src === 'searchad';
    if (sa ? it.demand.tier === 0 : (Number(it.heat) || 0) <= 1) v.push('R4:' + k);
  });
  sec('guide').forEach((it) => { if (!['howto', 'rank'].includes(it.angleType) || !it.demand || !(it.demand.tier >= 1)) v.push('G:guide'); });
  if (sec('parenting').length) {
    const wk = weekOf(e.date);
    const other = (all || []).filter((o) => o && o.date !== e.date && weekOf(o.date) === wk &&
      ((((o.sections || []).find((s) => s && s.key === 'parenting') || {}).items || []).filter(Boolean).length));
    if (other.length) v.push('육아 주1회:' + other.map((o) => o.date).join(','));
  }
  return v;
}
console.log('\n[8] 거둬내기·신호 계약 (시행 ' + RULE_FROM + '~)');
{
  const I = (o) => Object.assign({ id: Math.random().toString(36).slice(2), title: 't', heat: 2, sources: [{ url: 'https://e.com' }] }, o);
  const good = { date: '2026-09-21', sections: [
    { key: 'pinned', items: [I({ game: '롤토체스', angleType: 'news' }), I({ game: '롤토체스', angleType: 'howto' }), I({ game: '애니모', angleType: 'news' })] },
    { key: 'core', items: [I({ game: '팰월드', angleType: 'howto' })] },
    { key: 'guide', items: [I({ game: '메이플', angleType: 'howto', demand: { tier: 2, src: 'ac' } })] },
    { key: 'parenting', items: [I({ game: '아기 가습기' })] },
    { key: 'new', items: [I({ game: 'A', angleType: 'news', demand: { tier: 1, src: 'ac' } }), I({ game: 'B', angleType: 'howto', demand: { tier: 2, src: 'ac' } })] },
    { key: 'update', items: [I({ game: 'C', angleType: 'news', heat: 3 })] },
    { key: 'hot', items: [I({ game: 'D', angleType: 'howto' })] }] };
  const vg = ruleViolations(good, [good, { date: '2026-09-18', sections: [{ key: 'parenting', items: [I({})] }] }]);
  ok(vg.length === 0, '게이트 자기시험 — 규칙을 지킨 합성 판은 위반 0' + (vg.length ? ' (나온 것: ' + vg.join(' · ') + ')' : ''));
  const bad = { date: '2026-09-22', sections: [
    { key: 'pinned', items: [I({ game: '롤토체스', angleType: 'news' }), I({ game: '롤토체스', angleType: 'news' })] },
    { key: 'core', items: [I({ game: '팰월드', angleType: 'news' })] },
    { key: 'guide', items: [I({ game: 'X', angleType: 'info', demand: { tier: 2, src: 'ac' } })] },
    { key: 'parenting', items: [I({ game: '아기 칫솔' })] },
    { key: 'new', items: [I({ game: 'A', angleType: 'news', demand: { tier: 0, src: 'ac' } }), I({ game: 'B', angleType: 'news' }), I({ game: 'E', angleType: 'howto' }), I({ game: 'F', angleType: 'howto', heat: 1 })] },
    { key: 'update', items: [] },
    { key: 'hot', items: [I({ game: 'D', angleType: 'news' })] }] };
  const vb = ruleViolations(bad, [bad, good]);
  const want = ['cap:new', 'W1:', 'R2:core', 'R2:hot', 'R3:롤토체스', 'R1:new', 'R4:new', 'G:guide', '육아 주1회'];
  const miss = want.filter((w) => !vb.some((x) => x.startsWith(w)));
  ok(miss.length === 0, '게이트 자기시험 — 어긴 합성 판에서 9종 위반을 모두 잡는다' + (miss.length ? ' (놓친 것: ' + miss.join(' · ') + ')' : ''));
}
{
  let checked = 0;
  for (const e of (raw.editions || [])) {
    if (!e || !e.date || e.date < RULE_FROM) continue;
    checked++;
    const v = ruleViolations(e, raw.editions);
    ok(v.length === 0, e.date + ' 거둬내기·신호 계약' + (v.length ? ' — 위반: ' + v.join(' · ') : ''));
  }
  if (!checked) console.log('  SKIP — 시행일 이후 에디션이 아직 없음(규칙은 ' + RULE_FROM + ' 판부터)');
}

console.log(fail ? '\n>>> ' + fail + ' FAILED\n' : '\n>>> ALL PASS\n');
process.exit(fail ? 1 : 0);
