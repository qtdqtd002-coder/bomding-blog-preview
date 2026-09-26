#!/usr/bin/env node
/* ============================================================================
   usage-daily.cjs — 작성자별 «일간 사용량(토큰)» 스냅샷 (2026-09-02 신설)

   왜 만들었나
     큐 탭에서 «오늘 누가 얼마나 발주됐고, 그 작업이 토큰을 얼마나 먹었나»를 매일 보려면
     발주 건수(백엔드 /requests — 사이트가 직접 읽는다) 옆에 **토큰 쪽 실측**이 있어야 한다.
     토큰은 PC 로컬 트랜스크립트에만 있어 정적 사이트가 못 읽으므로 여기서 JSON 으로 굽는다.

   무엇을
     ~/.claude/projects/C--Users-qtdqt-Desktop-Claude/ 를 **재귀** 스캔한다.
       메인 세션 = <uuid>.jsonl · 서브에이전트 = <uuid>/subagents/ 하위 전부의 agent-<id>.jsonl(+ .meta.json)
       (★workflows/wf_<id>/ 아래 워크플로 에이전트도 서브에이전트다 — 2026-09-26 전엔 한 단계만 읽어 09-23 에 47M 을 놓쳤다)
     assistant 메시지의 usage(input/output/cache_creation/cache_read)를 날짜(KST)별로 합산하고,
     각 노드를 작성자에게 귀속시킨다.

   ★집계 단위 = API 응답 1개 (2026-09-26 수정 — 그 전 값은 2~3배 부풀어 있었다)
     응답 하나가 컨텐츠 블록(thinking·text·tool_use)마다 한 줄씩 기록되고 줄마다 같은 usage 가 반복된다.
     입력·캐시 토큰은 줄마다 똑같고, output 만 스트리밍 중간값 → 최종값으로 늘어난다(09-26 실측 2,368건 전부 단조 증가).
       · 줄마다 더하면        → 입력·캐시가 줄 수만큼 곱해진다(7일 5.98B 로 표시 · 실제 2.40B · ccusage 와 일치).
       · 첫 줄만 쓰면        → output 이 1/4 로 준다(중간값).
     그래서 (message.id, requestId) 키마다 «마지막 줄»만 센다. 파일 사이 중복(세션 이어하기 등)은 먼저 본 파일에 한 번만.
     검산 = `npx ccusage@latest daily --since <YYYYMMDD>` 의 일별 totalTokens 와 같아야 한다(같은 PC · 같은 트랜스크립트).

   ★귀속은 «추정»이다 (정확한 과금 분해가 아니다)
     세션·서브에이전트의 첫 user 프롬프트에서 작성자 신호를 점수화한다.
       BlogPreview/<작성자> 경로 언급 ×3 + 이름 등장 ×1 → 1위가 2위의 2배 이상이면 그 작성자.
       (프롬프트 대부분이 "다른 작성자(영도·겜더쿠…)와 혼동 말 것"처럼 5명을 다 적어서
        단순 '이름이 있나' 판정으로는 30~40%가 미분류가 된다 — 실측 후 점수제로 바꿨다.)
     귀속 안 된 노드(+메인 세션)는 **그 세션이 그날 실제로 돌린 작성자 비율대로** 나눈다(같은 날만 — 다른 날 비율은 안 빌린다).
     그날 신호가 없으면 세션 첫 프롬프트, 그래도 없으면 '기타/공용'(비쓰담 작업 포함)으로 남긴다 — 0으로 위장하지 않는다.
     ★'연봄하우스'·'연봄라이프'는 쓰담 무관 프로젝트라 작성자 '연봄'으로 세지 않는다(문자열 마스킹).
       띄어 쓴 '연봄 하우스'도 같다 — 09-23 연봄하우스 디자인 개편 세션(205M)이 휴면 작성자 '연봄'으로 잡혔던 원인.

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
const HOUSE_RE = /연봄\s*(하우스|라이프)/g;          // 쓰담 무관 프로젝트(연봄하우스·연봄라이프) — 띄어쓰기 변형 포함

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
  const t = text.split(BS).join('/').replace(HOUSE_RE, '§');   // 쓰담 무관 프로젝트는 작성자 아님
  const score = {};
  for (const w of WRITERS) score[w] = 3 * countOf(t, 'BlogPreview/' + w) + countOf(t, w);
  const rank = Object.entries(score).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rank.length) return null;
  if (rank.length === 1) return rank[0][0];
  return rank[0][1] >= rank[1][1] * 2 ? rank[0][0] : null;   // 1위가 압도적일 때만 단정
}

/* ---------- 트랜스크립트 1개 스캔 ----------
   응답 1개 = (message.id, requestId) 키 1개. 같은 키의 줄이 여럿이면 «마지막 줄»이 최종 usage 다(머리 주석 ★집계 단위).
   usage 는 뒤 줄이 덮어쓰고, 날짜는 첫 줄 시각을 지킨다. id 가 없는 줄(드묾)은 줄마다 따로 센다. */
const SEEN = new Set();   // 파일 사이 중복 키 — 먼저 본 파일에 한 번만 센다
function scanFile(fp) {
  const out = { first: null, byDay: Object.create(null) };
  let txt;
  try { txt = fs.readFileSync(fp, 'utf8'); } catch (e) { return out; }
  const msgs = new Map();
  let n = 0;
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
    const key = j.message.id ? j.message.id + ':' + (j.requestId || '') : fp + '#' + (n++);
    const prev = msgs.get(key);
    msgs.set(key, { ts: prev ? prev.ts : ts, u });   // usage 는 마지막 줄 · 날짜는 첫 줄(응답 시작 — ccusage 와 같은 기준, 자정 걸친 응답)
  }
  for (const [key, m] of msgs) {
    if (SEEN.has(key)) continue;
    SEEN.add(key);
    const k = dayKey(m.ts);
    const b = out.byDay[k] || (out.byDay[k] = { tok: 0, cost: 0 });
    const i = m.u.input_tokens || 0, o = m.u.output_tokens || 0;
    const cw = m.u.cache_creation_input_tokens || 0, cr = m.u.cache_read_input_tokens || 0;
    b.tok += i + o + cw + cr;
    b.cost += i * COST.in + o * COST.out + cw * COST.cw + cr * COST.cr;
  }
  return out;
}

/* 서브에이전트 트랜스크립트 — <uuid>/subagents/ 아래를 끝까지 내려간다(workflows/wf_<id>/agent-<id>.jsonl 포함, journal.jsonl 제외) */
function listAgentFiles(dir) {
  const out = [];
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listAgentFiles(p));
    else if (e.isFile() && e.name.startsWith('agent-') && e.name.endsWith('.jsonl')) out.push(p);
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

const mtimeOf = (p) => { try { return fs.statSync(p).mtimeMs; } catch (e) { return -1; } };
for (const ent of fs.readdirSync(PROJ, { withFileTypes: true })) {
  if (!ent.isFile() || !ent.name.endsWith('.jsonl')) continue;
  const fp = path.join(PROJ, ent.name);
  const id = ent.name.slice(0, -6);
  /* 창 안의 메시지가 있으면 mtime 도 반드시 그 이후다. 메인이 오래됐어도 서브가 창 안이면 세션을 본다 */
  const agentFiles = listAgentFiles(path.join(PROJ, id, 'subagents')).filter((sp) => mtimeOf(sp) >= cutoffMs);
  const mainFresh = mtimeOf(fp) >= cutoffMs;
  if (!mainFresh && !agentFiles.length) continue;
  nSess++;
  const main = scanFile(fp);   // 메인이 창 밖이면 byDay 는 비고 첫 프롬프트(귀속 신호)만 쓰인다
  const subs = [];
  for (const sp of agentFiles) {
    nSub++;
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(sp.slice(0, -6) + '.meta.json', 'utf8')); } catch (e) { /* 메타 없어도 진행 */ }
    const r = scanFile(sp);
    subs.push({ who: whoOf((r.first || '') + ' ' + (meta.description || '')), byDay: r.byDay });
  }
  /* 날짜별 작성자 비율(그날 이 세션이 실제로 돌린 작업).
     ★«세션 전체 비율» 폴백은 2026-09-26 폐지 — 며칠씩 이어지는 세션(트렌드 논의 → 사흘 뒤 봄딩 작성 서브)의
       첫날 메인 토큰 143M 이 전부 봄딩으로 갔고, 같은 날 값이 재계산 창(기본 3일 / --full 14일)에 따라 달라졌다.
       그날 귀속 신호가 없으면 세션 자신의 첫 프롬프트 → 그래도 없으면 '기타/공용'. */
  const dayMix = Object.create(null);
  for (const sb of subs) {
    if (!sb.who) continue;
    for (const [d, b] of Object.entries(sb.byDay)) {
      const M = dayMix[d] || (dayMix[d] = Object.create(null));
      M[sb.who] = (M[sb.who] || 0) + b.tok;
    }
  }
  const sessWho = whoOf(main.first);
  const spread = (byDay) => {
    for (const [d, b] of Object.entries(byDay)) {
      const mix = dayMix[d] && Object.keys(dayMix[d]).length ? dayMix[d] : null;
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
  method: '트랜스크립트 usage 합산(응답 1개=(message.id,requestId) 마지막 줄 1회 · 서브·워크플로 재귀) + 프롬프트 신호 기반 작성자 귀속(추정). cost=in×1·cacheW×1.25·cacheR×0.1·out×5',
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
