#!/usr/bin/env node
/* ============================================================================
   usage-daily.cjs — 작성자별 «일간 사용량(토큰)» 스냅샷 (2026-09-02 신설)

   왜 만들었나
     큐 탭에서 «오늘 누가 얼마나 발주됐고, 그 작업이 토큰을 얼마나 먹었나»를 매일 보려면
     발주 건수(백엔드 /requests — 사이트가 직접 읽는다) 옆에 **토큰 쪽 실측**이 있어야 한다.
     토큰은 PC 로컬 트랜스크립트에만 있어 정적 사이트가 못 읽으므로 여기서 JSON 으로 굽는다.

   무엇을
     ~/.claude/projects/C--Users-qtdqt-Desktop-Claude/ 를 **재귀** 스캔한다.
       메인 세션 = <uuid>.jsonl · 서브에이전트 = <uuid>/subagents/agent-*.jsonl(+ .meta.json)
     assistant 메시지의 usage(input/output/cache_creation/cache_read)를 날짜(KST)별로 합산하고,
     각 노드를 작성자에게 귀속시킨다.

   ★귀속은 «추정»이다 (정확한 과금 분해가 아니다)
     세션·서브에이전트의 첫 user 프롬프트에서 작성자 신호를 점수화한다.
       BlogPreview/<작성자> 경로 언급 ×3 + 이름 등장 ×1 → 1위가 2위의 2배 이상이면 그 작성자.
       (프롬프트 대부분이 "다른 작성자(영도·겜더쿠…)와 혼동 말 것"처럼 5명을 다 적어서
        단순 '이름이 있나' 판정으로는 30~40%가 미분류가 된다 — 실측 후 점수제로 바꿨다.)
     귀속 안 된 노드(+메인 세션)는 **그 세션이 그날 실제로 돌린 작성자 비율대로** 나눈다.
     그래도 신호가 없으면 '기타/공용'(비쓰담 작업 포함)으로 남긴다 — 0으로 위장하지 않는다.
     ★'연봄하우스'는 쓰담 무관 프로젝트라 작성자 '연봄'으로 세지 않는다(문자열 마스킹).

   출력  _trend/_usage.json   (스키마 1)
     { schema, updated, keep, window, writers, other, method,
       days:[ { d:"YYYY-MM-DD", tok, cost, by:{<작성자>:tok}, costBy:{<작성자>:cost} } ] }
       tok  = 원시 토큰 합(input+output+cache_write+cache_read)
       cost = 비용 가중 합(input×1 · cache_write×1.25 · cache_read×0.1 · output×5) — 상대 단위
     ★사이트(큐 탭)는 tok 비중을 그리고, cost 는 툴팁·후속 분석용이다.

   실행  node _tools/usage-daily.cjs             # 최근 3일 재계산 → 기존 14일에 병합
         node _tools/usage-daily.cjs --window 7  # 재계산 창 지정
         node _tools/usage-daily.cjs --full      # 14일 전체 재계산
         node _tools/usage-daily.cjs --print     # 사람이 보는 표도 같이
   종료  0 = 정상 / 1 = 트랜스크립트 폴더 없음
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_usage.json');
const PROJ = path.join(os.homedir(), '.claude', 'projects', 'C--Users-qtdqt-Desktop-Claude');

const KEEP = 14;                       // 파일에 보관할 일수(트렌드 에디션과 동일)
const DEFAULT_WINDOW = 3;              // 기본 재계산 창 — 늦게 들어온 메시지까지 덮는다
const WRITERS = ['봄딩', '영도', '겜더쿠', '연봄', '하루살이'];
const OTHER = '기타/공용';
const COST = { in: 1, out: 5, cw: 1.25, cr: 0.1 };   // API 정가 비율(상대 단위)
const BS = String.fromCharCode(92);                  // 역슬래시(경로 정규화용)

const argv = process.argv.slice(2);
const flag = (n) => argv.indexOf(n) >= 0;
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const WINDOW = flag('--full') ? KEEP
  : Math.max(1, Math.min(KEEP, parseInt(opt('--window', DEFAULT_WINDOW), 10) || DEFAULT_WINDOW));

/* ---------- 날짜(로컬=KST) ---------- */
function dayKey(ts) {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
const cutoffMs = startOfToday.getTime() - (WINDOW - 1) * 86400000;
const cutoffDay = dayKey(cutoffMs);

/* ---------- 작성자 귀속(추정) ---------- */
function countOf(hay, needle) {
  let i = 0, n = 0;
  while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
  return n;
}
function whoOf(text) {
  if (!text) return null;
  const t = text.split(BS).join('/').split('연봄하우스').join('§');   // 쓰담 무관 프로젝트는 작성자 아님
  const score = {};
  for (const w of WRITERS) score[w] = 3 * countOf(t, 'BlogPreview/' + w) + countOf(t, w);
  const rank = Object.entries(score).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rank.length) return null;
  if (rank.length === 1) return rank[0][0];
  return rank[0][1] >= rank[1][1] * 2 ? rank[0][0] : null;   // 1위가 압도적일 때만 단정
}

/* ---------- 트랜스크립트 1개 스캔 ---------- */
function scanFile(fp) {
  const out = { first: null, byDay: Object.create(null) };
  let txt;
  try { txt = fs.readFileSync(fp, 'utf8'); } catch (e) { return out; }
  for (const line of txt.split('\n')) {
    if (!line) continue;
    let j;
    try { j = JSON.parse(line); } catch (e) { continue; }
    if (out.first === null && j.type === 'user' && j.message) {
      const c = j.message.content;
      out.first = typeof c === 'string' ? c
        : Array.isArray(c) ? c.map((x) => x.text || '').join(' ') : '';
    }
    const u = j.message && j.message.usage;
    if (!u) continue;
    const ts = Date.parse(j.timestamp || 0) || 0;
    if (!ts || ts < cutoffMs) continue;
    const k = dayKey(ts);
    const b = out.byDay[k] || (out.byDay[k] = { tok: 0, cost: 0 });
    const i = u.input_tokens || 0, o = u.output_tokens || 0;
    const cw = u.cache_creation_input_tokens || 0, cr = u.cache_read_input_tokens || 0;
    b.tok += i + o + cw + cr;
    b.cost += i * COST.in + o * COST.out + cw * COST.cw + cr * COST.cr;
  }
  return out;
}

/* ---------- 수집 ---------- */
if (!fs.existsSync(PROJ)) {
  console.error('[usage-daily] 트랜스크립트 폴더 없음: ' + PROJ);
  process.exit(1);
}

const acc = Object.create(null);                       // day -> writer -> {tok,cost}
function add(day, who, tok, cost) {
  if (day < cutoffDay) return;
  const A = acc[day] || (acc[day] = Object.create(null));
  const B = A[who] || (A[who] = { tok: 0, cost: 0 });
  B.tok += tok; B.cost += cost;
}
let nSess = 0, nSub = 0;

for (const ent of fs.readdirSync(PROJ, { withFileTypes: true })) {
  if (!ent.isFile() || !ent.name.endsWith('.jsonl')) continue;
  const fp = path.join(PROJ, ent.name);
  let st;
  try { st = fs.statSync(fp); } catch (e) { continue; }
  if (st.mtimeMs < cutoffMs) continue;                 // 창 안의 메시지가 있으면 mtime 도 반드시 그 이후다
  nSess++;
  const id = ent.name.slice(0, -6);
  const main = scanFile(fp);
  const subs = [];
  const sd = path.join(PROJ, id, 'subagents');
  if (fs.existsSync(sd)) {
    for (const f of fs.readdirSync(sd)) {
      if (!f.endsWith('.jsonl')) continue;
      const sp = path.join(sd, f);
      let sst;
      try { sst = fs.statSync(sp); } catch (e) { continue; }
      if (sst.mtimeMs < cutoffMs) continue;
      nSub++;
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(sp.slice(0, -6) + '.meta.json', 'utf8')); } catch (e) { /* 메타 없어도 진행 */ }
      const r = scanFile(sp);
      subs.push({ who: whoOf((r.first || '') + ' ' + (meta.description || '')), byDay: r.byDay });
    }
  }
  /* 날짜별 작성자 비율(그날 이 세션이 실제로 돌린 작업) + 세션 전체 비율(폴백) */
  const dayMix = Object.create(null), sessMix = Object.create(null);
  for (const sb of subs) {
    if (!sb.who) continue;
    for (const [d, b] of Object.entries(sb.byDay)) {
      const M = dayMix[d] || (dayMix[d] = Object.create(null));
      M[sb.who] = (M[sb.who] || 0) + b.tok;
      sessMix[sb.who] = (sessMix[sb.who] || 0) + b.tok;
    }
  }
  const sessWho = whoOf(main.first);
  const spread = (byDay) => {
    for (const [d, b] of Object.entries(byDay)) {
      const mix = dayMix[d] && Object.keys(dayMix[d]).length ? dayMix[d]
        : Object.keys(sessMix).length ? sessMix : null;
      if (mix) {
        const tot = Object.values(mix).reduce((s, v) => s + v, 0) || 1;
        for (const [w, v] of Object.entries(mix)) add(d, w, b.tok * v / tot, b.cost * v / tot);
      } else if (sessWho) add(d, sessWho, b.tok, b.cost);
      else add(d, OTHER, b.tok, b.cost);
    }
  };
  for (const sb of subs) {
    if (sb.who) { for (const [d, b] of Object.entries(sb.byDay)) add(d, sb.who, b.tok, b.cost); }
    else spread(sb.byDay);
  }
  spread(main.byDay);
}

/* ---------- 기존 파일과 병합(재계산 창 밖의 날짜는 보존) ---------- */
let prev = { days: [] };
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* 첫 실행 */ }
const kept = (Array.isArray(prev.days) ? prev.days : []).filter((x) => x && x.d && x.d < cutoffDay);

const fresh = Object.keys(acc).sort().map((d) => {
  const A = acc[d];
  const by = {}, costBy = {};
  let tok = 0, cost = 0;
  for (const [w, v] of Object.entries(A).sort((a, b) => b[1].tok - a[1].tok)) {
    by[w] = Math.round(v.tok); costBy[w] = Math.round(v.cost);
    tok += v.tok; cost += v.cost;
  }
  return { d, tok: Math.round(tok), cost: Math.round(cost), by, costBy };
});

const days = kept.concat(fresh)
  .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  .slice(-KEEP);

const result = {
  schema: 1,
  updated: new Date().toISOString(),
  keep: KEEP,
  window: WINDOW,
  writers: WRITERS,
  other: OTHER,
  method: '트랜스크립트 usage 합산 + 프롬프트 신호 기반 작성자 귀속(추정). cost=in×1·cacheW×1.25·cacheR×0.1·out×5',
  days,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');

const last = days[days.length - 1];
console.log('[usage-daily] wrote ' + path.relative(ROOT, OUT) +
  ' — 창 ' + WINDOW + '일(세션 ' + nSess + '·서브 ' + nSub + ') · 보관 ' + days.length + '일' +
  (last ? ' · 최신 ' + last.d + ' ' + (last.tok / 1e6).toFixed(1) + 'M' : ''));

if (flag('--print')) {
  for (const day of days) {
    const tot = day.tok || 1;
    console.log('\n── ' + day.d + '  ' + (day.tok / 1e6).toFixed(1) + 'M ──');
    Object.entries(day.by).sort((a, b) => b[1] - a[1]).forEach(([w, v]) =>
      console.log('   ' + w.padEnd(8) + (v / 1e6).toFixed(1).padStart(7) + 'M  ' +
        (100 * v / tot).toFixed(1).padStart(5) + '%  (비용비중 ' +
        (100 * (day.costBy[w] || 0) / (day.cost || 1)).toFixed(1) + '%)'));
  }
}
