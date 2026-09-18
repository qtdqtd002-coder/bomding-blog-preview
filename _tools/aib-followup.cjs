#!/usr/bin/env node
/* ============================================================================
   aib-followup.cjs — 발행 후 D+7 · D+14 AI 브리핑 재검 → _trend/_aib-followup.json   (2026-09-18 신설 · LLM 0 · 비차단)

   왜 있나
     발주 전 브리핑 실검색(aib-check.py · game-blog-publish §1)은 «쓸 가치가 있는 질의인가»만 본다.
     발행한 글이 실제로 브리핑 출처에 들었는지는 아무도 다시 보지 않았다. 2026-09-18 검토에서 발행 4~14일 지난 글의
     타깃 질의 29개를 손으로 다시 검색해 보니, 출처가 열린 8개 질의 중 5개는 봄딩 글이 네이버에 게시돼 있었는데도
     인용 0건이었다 — 그런데 이 수치를 매일 재는 장치가 없어 «어떤 각도가 인용되는지»를 끝내 알 수 없었다.
     이 도구가 매일 아침(05:10 · ops-health 런처) 기한이 된 글만 골라 같은 질의로 다시 검색하고 결과를 쌓는다.
     요약은 desk-mix.cjs 가 _desk-mix.json 의 followup 에 싣는다(홈 「주제 비중」 타일).

   입력
     <작성자>/…/_qa/aib-check.json    — 파이프라인이 발주 전에 남긴 타깃 질의(results[].q)와 그때의 판정
     posts.json                       — 글의 등록일(created) = D+0 기준. 없으면 aib-check 의 checkedAt
   출력 _trend/_aib-followup.json(gitignore — 파생 데이터)
     { posts: { "<글 폴더>": { writer, pub, queries, pre:[{q,s,n,bd,yd}], d7:{at,res:[…]}, d14:{at,res:[…]} } } }
     s = shown · async · none · unknown  / bd·yd = 봄딩·영도 인용 순위(없으면 null)

   규칙
     - 기한: 등록 후 7일 이상이고 d7 이 없으면 d7, 14일 이상이고 d14 가 없으면 d14(둘 다 밀렸으면 d14 만 · d7 은 skipped).
     - 한 실행 네트워크 상한 --max(기본 30질의 · 8초 간격 · 24h 캐시 적중은 공짜). 남은 기한분은 다음 날 이어서 한다.
     - ★«인용 0»을 «글이 나쁘다»로 읽지 않는다 — 게시 안 된 초안·색인 지연·브리핑 자체가 안 뜨는 질의가 섞인다.
       판단 단위는 «각도(angleType)별 진입률»이지 글 한 편이 아니다.
     - 휴면 작성자는 대상이 아니다(현역 = 쓰담v2/canon/config.json writers − inactive).

   사용: node _tools/aib-followup.cjs [--max 30] [--dry]
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { aibLookup, aibFromCache, aibSummary } = require('./desk-signals.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_aib-followup.json');
const POSTS = path.join(ROOT, 'posts.json');
const CONFIG = path.join(ROOT, '..', '쓰담v2', 'canon', 'config.json');
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DRY = argv.includes('--dry');
const MAX = Math.max(0, parseInt(val('--max', '30'), 10) || 0);
const DAY = 86400e3;
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return d; } }
const kst = (ts) => new Date(ts + 9 * 3600e3).toISOString().slice(0, 10);
const today = kst(Date.now());
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);

/* 현역 = writers 의 작성자 목록 키(v1Only·v2 … — «_» 로 시작하는 설명 키와 inactive 제외)를 합친 것 − inactive */
function activeWriters() {
  const c = readJson(CONFIG, null);
  const w = c && c.writers;
  if (w && typeof w === 'object') {
    const all = [];
    Object.keys(w).forEach((k) => { if (k[0] !== '_' && k !== 'inactive' && Array.isArray(w[k])) w[k].forEach((x) => { if (typeof x === 'string' && !all.includes(x)) all.push(x); }); });
    const off = Array.isArray(w.inactive) ? w.inactive : [];
    const live = all.filter((x) => !off.includes(x));
    if (live.length) return live;
  }
  return ['봄딩', '영도'];
}
function walk(dir, out) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === '_qa') { const f = path.join(p, 'aib-check.json'); if (fs.existsSync(f)) out.push(f); } else if (!e.name.startsWith('.')) walk(p, out); }
  }
  return out;
}

(function main() {
  const writers = activeWriters();
  const posts = readJson(POSTS, []);
  const state = readJson(OUT, null) || { schema: 1, posts: {} };
  let added = 0;
  writers.forEach((w) => walk(path.join(ROOT, w), []).forEach((f) => {
    const folder = path.relative(ROOT, path.dirname(path.dirname(f))).split(path.sep).join('/');
    const j = readJson(f, null); if (!j || !Array.isArray(j.results)) return;
    const qs = [...new Set(j.results.map((r) => r && r.q).filter(Boolean))].slice(0, 3);
    if (!qs.length) return;
    const post = (Array.isArray(posts) ? posts : []).find((p) => p && typeof p.rel === 'string' && p.rel.startsWith(folder + '/'));
    const pub = (post && String(post.created || '').slice(0, 10)) || String(j.checkedAt || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pub)) return;
    const cur = state.posts[folder] || (added++, state.posts[folder] = { writer: w, pub, queries: qs, pre: j.results.map((r) => Object.assign({ q: r.q }, aibSummary(r) || {})) });
    cur.pub = pub; cur.queries = qs; cur.writer = w;
  }));
  /* 기한 판정 */
  const due = [];
  Object.entries(state.posts).forEach(([k, p]) => {
    const age = days(p.pub, today);
    if (age >= 14 && !p.d14) { due.push({ k, slot: 'd14' }); if (!p.d7) p.d7 = { skipped: true, at: null }; }
    else if (age >= 7 && !p.d7) due.push({ k, slot: 'd7' });
  });
  const qs = [...new Set(due.flatMap((d) => state.posts[d.k].queries))];
  console.log('발행 후 재검 ' + today + ' — 대상 글 ' + Object.keys(state.posts).length + '편(신규 ' + added + ') · 기한 ' + due.length + '건 · 질의 ' + qs.length + '개 · 현역 ' + writers.join('·'));
  if (DRY) { due.forEach((d) => console.log('  ' + d.slot + ' ' + d.k + ' — ' + state.posts[d.k].queries.join(' / '))); return; }
  const res = qs.length ? aibLookup(qs, MAX) : new Map();
  let done = 0;
  due.forEach((d) => {
    const p = state.posts[d.k];
    const rows = p.queries.map((q) => { const s = res.get(q) || aibSummary(aibFromCache(q)); return s ? Object.assign({ q }, s) : null; });
    if (rows.some((x) => !x)) return;   /* 상한에 걸려 못 잰 질의가 있으면 이 글은 내일 다시 */
    p[d.slot] = { at: new Date().toISOString(), res: rows };
    done++;
    console.log('  ' + d.slot + ' ' + d.k + ' — ' + rows.map((x) => x.q + ':' + x.s + (x.bd ? '(봄딩 ' + x.bd + '위)' : x.yd ? '(영도 ' + x.yd + '위)' : '')).join(' · '));
  });
  state.schema = 1; state.updated = new Date().toISOString();
  const tmp = OUT + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1) + '\n', 'utf8');
  fs.renameSync(tmp, OUT);
  console.log('→ ' + path.relative(ROOT, OUT) + ' · 이번에 채운 칸 ' + done + '/' + due.length + (done < due.length ? ' (나머지는 상한 · 내일 이어서)' : ''));
})();
