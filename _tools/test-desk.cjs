/* index.html 의 데스크 로직(DESK_SECTIONS/normEditions/edItems/deskMaterial)을 그대로 떼어내
   실제 trend.json 으로 돌려 본다. DOM 없이 데이터 변형만 검증. */
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\qtdqt\\Desktop\\Claude\\BlogPreview';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function grab(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  if (a < 0) throw new Error('marker not found: ' + startMarker);
  const b = html.indexOf(endMarker, a);
  if (b < 0) throw new Error('end marker not found: ' + endMarker);
  return html.slice(a, b);
}
/* normEditions 가 참조하는 외부 상수(작성자 목록·휴면 목록)도 index.html 에서 같이 끌어온다.
   ★여기에 값을 하드코딩하면 사이트에서 작성자가 바뀌어도 테스트는 옛 값으로 통과해 버린다 —
     테스트가 진실을 보게 하려면 정의부를 그대로 떼어 와야 한다. */
function grabLine(re, what) {
  const m = html.match(re);
  if (!m) throw new Error('정의를 찾지 못했습니다: ' + what + ' — index.html 에서 이름이 바뀌었는지 확인하세요.');
  return m[0];
}
const deps = [
  grabLine(/ const PREF=\[[^\]]*\];/, 'PREF'),
  grabLine(/ const INACTIVE_WRITERS=\[[^\]]*\];/, 'INACTIVE_WRITERS'),
].join('\n');

const src = grab(' const DESK_SECTIONS=[', ' /* ---------- 트렌드(일간 토픽 데스크) ---------- */');
const mod = new Function(deps + '\n' + src + '\n return {DESK_SECTIONS,DESK_SEC,normEditions,edItems,deskMaterial,PREF,INACTIVE_WRITERS};')();
console.log('  · PREF = ' + mod.PREF.join(',') + ' | 휴면 = ' + (mod.INACTIVE_WRITERS.join(',') || '없음'));

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, '_trend', 'trend.json'), 'utf8'));
const TREND = mod.normEditions(raw);

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS ' : '  FAIL ') + msg); if (!cond) fail++; };

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

console.log(fail ? '\n>>> ' + fail + ' FAILED\n' : '\n>>> ALL PASS\n');
process.exit(fail ? 1 : 0);
