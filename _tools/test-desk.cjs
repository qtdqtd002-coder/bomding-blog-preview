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
const src = grab(' const DESK_SECTIONS=[', ' /* ---------- 트렌드(일간 토픽 데스크) ---------- */');
const mod = new Function(src + '\n return {DESK_SECTIONS,DESK_SEC,normEditions,edItems,deskMaterial};')();

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, '_trend', 'trend.json'), 'utf8'));
const TREND = mod.normEditions(raw);

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS ' : '  FAIL ') + msg); if (!cond) fail++; };

console.log('\n[1] normEditions');
ok(TREND.length === 1, 'edition count = 1 (got ' + TREND.length + ')');
ok(TREND[0].date === '2026-08-14', 'date parsed');
ok(TREND[0].sections.length === 4, 'always 4 sections (got ' + TREND[0].sections.length + ')');
ok(TREND[0].sections.map(s => s.key).join(',') === 'new,update,hot,console', 'section order fixed');

console.log('\n[2] items');
const all = mod.edItems(TREND[0]);
ok(all.length === 14, 'total items = 14 (got ' + all.length + ')');
ok(all.every(i => i.id && i.title), 'every item has id + title');
ok(new Set(all.map(i => i.id)).size === all.length, 'ids unique');
ok(all.every(i => ['new', 'update', 'hot', 'console'].includes(i.sec)), 'sec tagged on every item');
ok(all.every(i => i.heat >= 0 && i.heat <= 3), 'heat clamped 0..3');
ok(all.every(i => Array.isArray(i.sources) && i.sources.every(s => s.url)), 'sources well-formed');
ok(all.filter(i => i.coverage.length).length === 5, 'coverage warnings = 5');

console.log('\n[3] deskMaterial (발주 모달 프리필)');
const m = mod.deskMaterial(all.find(i => i.id === '20260814-hot-1'));
ok(m.includes('[8/13 정식 출시]'), 'when 앞머리 포함');
ok(m.includes('참고: 인벤 https://'), '출처 URL 포함');
ok(m.includes('★기존 글 확인 필요: 봄딩'), 'coverage 경고가 소재 메모에 실림');
ok(mod.deskMaterial(all.find(i => i.id === '20260814-new-2')).indexOf('★기존 글') < 0, 'coverage 없으면 경고 미삽입');

console.log('\n[4] 방어 — 깨진/구 스키마 입력');
ok(mod.normEditions(null).length === 0, 'null → []');
ok(mod.normEditions({ issues: [{ writer: '봄딩', date: '2026-08-13' }] }).length === 0, '구 issues 스키마 → [] (조용히 버림)');
ok(mod.normEditions({ editions: [{ date: '2026-08-15' }] })[0].sections.length === 4, 'sections 없어도 4칸 생성');
const junk = mod.normEditions({ editions: [{ date: '2026-08-15', sections: [{ key: 'new', items: [{ title: '' }, null, { title: 'ok' }] }] }] });
ok(mod.edItems(junk[0]).length === 1, '빈 title·null 아이템 제거');
const two = mod.normEditions({ editions: [{ date: '2026-08-13' }, { date: '2026-08-15' }] });
ok(two[0].date === '2026-08-15', '최신순 정렬');

console.log('\n[5] 날짜 페이저 입력');
ok([...new Set(TREND.map(e => e.date))].length === TREND.length, '에디션당 날짜 1개(중복 없음)');

console.log(fail ? '\n>>> ' + fail + ' FAILED\n' : '\n>>> ALL PASS\n');
process.exit(fail ? 1 : 0);
