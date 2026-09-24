#!/usr/bin/env node
/* ============================================================================
   desk-candidates.cjs — 2단계 조사 [B-0] 코드 게이트의 «접착제» (2026-09-23 신설 · 감사 E#4 · LLM 0)

   왜 있나
     조사원 산출의 30~70% 가 «사후»에 버려지고 있었다(09-22 후보 22→6 · 09-21 34→16). 재탕·자기잠식·수요 판정을 조사 «앞»으로
     옮기려면 ⑴조사원 1단계 후보 파일(칸별)을 한 벌로 합치고 ⑵세 도구(desk-dedup · classify-picks · desk-signals check)의 출력을
     «기계가» 항목마다 짝지어 통과분만 상세 조사로 넘겨야 한다. 메인 세션이 손으로 하던 짝짓기(순번·잘린 pick 사고 L078·L080)를 코드로 고정한다.

   하위 명령
     merge --dir _tmp [--prefix cand-] [--in a.json,b.json] --out-json _tmp/candidates.json --out-txt _tmp/candidates.txt [--any-age]
           조사원 1단계 파일 _tmp/cand-<sec>.json([{game,title,angleType,keywords,sources,…}] 또는 {sec,items}) →
           candidates.json(desk-signals check 입력 · id·sec 부여) + candidates.txt(desk-dedup·classify-picks 입력 · «게임 | 제목» · 같은 순서).
           ★12시간보다 오래된 파일은 지난 회차 잔재로 보고 건너뛴다(--any-age 로 해제).
     gate  --cand _tmp/candidates.json --dedup _tmp/dedup.json --signals _tmp/signals.json [--classify "_tmp/classify-*.json"] --out _tmp/survivors.json
           세 도구 출력을 항목마다 짝지어 KEEP/DROP 을 확정한다. 짝짓기 키 = dedup: 순번(+제목 대조) · classify: raw(= candidates.txt 줄) · signals: id.
           DROP = dedup DROP · classify published/failed/carried(어느 작성자든 · SKILL [B] «carried 는 기본 DROP» L060) · signals DROP(R1~R5·W1·G·X·B)
           FLAG = dedup CHECK(각도 차이를 상세 단계 angle 에 적는다) · classify review(→ coverage[] = {writer, title: matchedTitle})
           출력 survivors.json = { date, total, kept:[항목 + flags + coverage + dedupHits + demand/aib/depth], dropped:[{id,sec,game,title,by,rule,why}], note:[초안 줄] }

   ⛔ 이 도구는 판정 규칙을 새로 만들지 않는다 — 세 도구의 판정을 «합치는» 일만 한다(규칙은 각 도구와 SKILL 이 정본).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const log = (...a) => console.error(...a);
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch (e) { return d; } };
function writeJson(p, obj) {
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, p);
}
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const clean1 = (s) => String(s == null ? '' : s).replace(/[|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const toLine = (it) => clean1(it.game) + ' | ' + clean1(it.title);
const normT = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

/* ── merge ──────────────────────────────────────────────────────────────── */
/* files: [{ file, sec?, data }] → { items, warnings } · 항목 = 조사원 반환 그대로 + id/sec */
function mergeCands(files) {
  const items = [], warnings = [];
  const counter = {};
  for (const f of files) {
    const data = f.data;
    let sec = f.sec || (data && !Array.isArray(data) && data.sec) || null;
    if (!sec && f.file) { const m = path.basename(f.file).match(/^cand-([a-z]+)/i); if (m) sec = m[1].toLowerCase(); }
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.items)) ? data.items : null;
    if (!list) { warnings.push((f.file || '(메모리)') + ': 배열도 {items} 도 아니다 — 건너뜀'); continue; }
    if (!sec) { warnings.push((f.file || '(메모리)') + ': sec 를 알 수 없다(파일명 cand-<sec>.json 또는 {sec}) — 건너뜀'); continue; }
    list.forEach((raw, i) => {
      if (!raw || typeof raw !== 'object') return;
      const it = Object.assign({}, raw);
      it.sec = String(it.sec || sec);
      if (!clean1(it.game) || !clean1(it.title)) { warnings.push(it.sec + ' #' + (i + 1) + ': game/title 누락 — 건너뜀'); return; }
      it.game = clean1(it.game); it.title = clean1(it.title);
      counter[it.sec] = (counter[it.sec] || 0) + 1;
      if (!it.id) it.id = it.sec + '-' + counter[it.sec];
      if (!Array.isArray(it.keywords) || !it.keywords.length) warnings.push(it.id + ': keywords[0](타깃 질의) 없음 — 제목 첫 절로 잰다');
      if (it.sec !== 'parenting' && !it.angleType) warnings.push(it.id + ': angleType 없음 — 제목 사다리로 채운다');
      if (!Array.isArray(it.sources) || !it.sources.length) warnings.push(it.id + ': sources 없음(1단계도 출처 1개는 필수)');
      items.push(it);
    });
  }
  return { items, warnings };
}

/* ── gate ───────────────────────────────────────────────────────────────── */
/* cands: candidates.json 항목 · dedup: desk-dedup --json 출력 · classify: [{writer, results}] · signals: desk-signals check --json 출력 */
function gateItems(cands, dedup, classify, signals) {
  const dres = (dedup && Array.isArray(dedup.results)) ? dedup.results : [];
  const sres = new Map((((signals && signals.items) || [])).map((x) => [String(x.id), x]));
  const cls = (classify || []).filter((c) => c && Array.isArray(c.results)).map((c) => ({ writer: c.writer, byRaw: new Map(c.results.map((r) => [normT(r.raw), r])), byPick: new Map(c.results.map((r) => [normT(r.pick), r])) }));
  const kept = [], dropped = [];
  const tally = {};
  const bump = (k) => { tally[k] = (tally[k] || 0) + 1; };
  cands.forEach((it, i) => {
    const line = toLine(it);
    const flags = [], coverage = [], reasons = [];
    let drop = null;
    /* ⑴ dedup — 순번으로 짝짓되 제목이 다르면 제목으로 찾는다 */
    let d = dres[i];
    if (!d || normT(d.title) !== normT(it.title)) d = dres.find((r) => normT(r.title) === normT(it.title)) || null;
    if (d) {
      const h = (d.hits || [])[0];
      if (d.verdict === 'DROP') { drop = { by: 'dedup', rule: 'DROP', why: h ? ('[' + h.date + ' ' + h.sec + '] ' + h.title + ' (' + h.why + ')') : '지난 판과 동일' }; bump('재탕'); }
      else if (d.verdict === 'CHECK') { flags.push('dedup:CHECK'); }
      it.dedupHits = (d.hits || []).slice(0, 3).map((x) => ({ verdict: x.verdict, date: x.date, sec: x.sec, title: x.title, why: x.why }));
    } else if (dres.length) flags.push('dedup:미대조');
    /* ⑵ classify — 작성자마다 raw 로 짝짓는다 */
    for (const c of cls) {
      const r = c.byRaw.get(normT(line)) || c.byPick.get(normT(line)) || null;
      if (!r) { flags.push('classify:' + c.writer + ':미대조'); continue; }
      if (['published', 'failed', 'carried'].includes(r.status)) {
        if (!drop) { drop = { by: 'classify', rule: r.status + '(' + c.writer + ')', why: r.reason || '' }; bump(r.status === 'carried' ? '재추천' : '자기잠식'); }
        else reasons.push('classify ' + c.writer + ' ' + r.status);
      } else if (r.status === 'review') {
        flags.push('classify:review(' + c.writer + ')');
        if (r.matchedTitle) coverage.push({ writer: c.writer, title: String(r.matchedTitle) });
      }
    }
    /* ⑶ signals — id 로 */
    const s = sres.get(String(it.id));
    if (s) {
      if (s.verdict === 'DROP' && !drop) { drop = { by: 'signals', rule: s.rule, why: s.why || '' }; bump('거둬냄'); }
      else if (s.verdict === 'DROP') reasons.push('signals ' + s.rule);
      ['angleType', 'demand', 'aib', 'depth'].forEach((k) => { if (s[k] != null) it[k] = s[k]; });
      if (s.verdict === 'DROP' && s.rule) tally['rule:' + s.rule] = (tally['rule:' + s.rule] || 0) + 1;
    } else if (it.sec !== 'parenting' && sres.size) flags.push('signals:미대조');
    if (drop) dropped.push({ id: it.id, sec: it.sec, game: it.game, title: it.title, by: drop.by, rule: drop.rule, why: drop.why, also: reasons });
    else kept.push(Object.assign({}, it, { flags, coverage }));
  });
  /* note 초안 — SKILL «note 규칙»(한 줄 140자 · 한 줄에 한 가지) */
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const note = [];
  const dd = dropped.filter((x) => x.by === 'dedup');
  if (dd.length) note.push(cut('재탕 ' + dd.length + '건 제외: ' + dd.map((x) => x.game + ' ' + x.title.slice(0, 14) + (x.why.match(/\d{4}-(\d{2}-\d{2})/) ? '(' + x.why.match(/\d{4}-(\d{2}-\d{2})/)[1] + ')' : '')).join(' · '), 140));
  const cc = dropped.filter((x) => x.by === 'classify');
  if (cc.length) note.push(cut('기발행·재추천 ' + cc.length + '건 제외: ' + cc.map((x) => x.game + ' ' + x.title.slice(0, 14)).join(' · '), 140));
  const ss = dropped.filter((x) => x.by === 'signals');
  if (ss.length) {
    const byRule = {}; ss.forEach((x) => { byRule[x.rule] = (byRule[x.rule] || 0) + 1; });
    note.push(cut('거둬냄 ' + ss.length + '건(' + Object.entries(byRule).map(([k, v]) => k + ' ' + v).join(' · ') + ')', 140));
  }
  const cov = kept.filter((x) => x.coverage.length).length;
  if (cov) note.push('커버리지 경고 ' + cov + '건(기존 글과 각도 차이를 angle 에 명시)');
  return { kept, dropped, note, tally };
}

/* ── 파일 도우미 ───────────────────────────────────────────────────────── */
function expandGlob(pat) {
  if (!pat) return [];
  return pat.split(',').map((s) => s.trim()).filter(Boolean).flatMap((p) => {
    if (!/[*?]/.test(p)) return fs.existsSync(p) ? [p] : [];
    const dir = path.dirname(p), base = path.basename(p);
    const re = new RegExp('^' + base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    try { return fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f)); } catch (e) { return []; }
  });
}

function cmdMerge() {
  const dir = val('--dir', '_tmp'), prefix = val('--prefix', 'cand-');
  const outJ = val('--out-json', null), outT = val('--out-txt', null);
  if (!outJ || !outT) { log('사용: desk-candidates.cjs merge --dir _tmp [--prefix cand-] [--in a.json,b.json] --out-json <파일> --out-txt <파일>'); process.exit(2); }
  let files = expandGlob(val('--in', ''));
  if (!files.length) { try { files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).map((f) => path.join(dir, f)); } catch (e) { files = []; } }
  const maxAgeMs = 12 * 3600e3, now = Date.now();
  const loaded = [];
  for (const f of files) {
    let st = null; try { st = fs.statSync(f); } catch (e) { continue; }
    if (!has('--any-age') && now - st.mtimeMs > maxAgeMs) { log('  · 건너뜀(12시간 초과 · 지난 회차 잔재): ' + f); continue; }
    loaded.push({ file: f, data: readJson(f, null) });
  }
  if (!loaded.length) { log('후보 파일이 없다: ' + dir + '/' + prefix + '*.json'); process.exit(2); }
  const { items, warnings } = mergeCands(loaded);
  warnings.forEach((w) => log('  ⚠ ' + w));
  writeJson(outJ, items);
  fs.writeFileSync(outT, items.map(toLine).join('\n') + '\n', 'utf8');
  const bySec = {}; items.forEach((it) => { bySec[it.sec] = (bySec[it.sec] || 0) + 1; });
  console.log('merge — 파일 ' + loaded.length + ' · 후보 ' + items.length + '건(' + Object.entries(bySec).map(([k, v]) => k + ' ' + v).join(' · ') + ') · 경고 ' + warnings.length + ' → ' + outJ + ' · ' + outT);
}

function cmdGate() {
  const candP = val('--cand', null), outP = val('--out', null);
  if (!candP || !outP) { log('사용: desk-candidates.cjs gate --cand <candidates.json> --dedup <dedup.json> --signals <signals.json> [--classify "<glob>"] --out <survivors.json>'); process.exit(2); }
  const cands = readJson(candP, null);
  if (!Array.isArray(cands) || !cands.length) { log('후보가 비었다: ' + candP); process.exit(2); }
  const dedup = val('--dedup', null) ? readJson(val('--dedup'), null) : null;
  const signals = val('--signals', null) ? readJson(val('--signals'), null) : null;
  const classify = expandGlob(val('--classify', '')).map((f) => readJson(f, null)).filter((j) => j && Array.isArray(j.results));
  if (dedup === null) log('  ⚠ dedup 결과 없음(--dedup) — 재탕 축 미대조');
  if (signals === null) log('  ⚠ signals 결과 없음(--signals) — 수요·거둬내기 축 미대조');
  if (!classify.length) log('  ⚠ classify 결과 없음(--classify) — 자기잠식 축 미대조');
  const r = gateItems(cands, dedup, classify, signals);
  const out = { date: kstToday(), total: cands.length, kept: r.kept, dropped: r.dropped, note: r.note, axes: { dedup: dedup !== null, classify: classify.map((c) => c.writer), signals: signals !== null } };
  writeJson(outP, out);
  console.log('gate — 후보 ' + cands.length + '건 → 통과 ' + r.kept.length + ' · 제외 ' + r.dropped.length + '(' + Object.entries(r.tally).filter(([k]) => !k.startsWith('rule:')).map(([k, v]) => k + ' ' + v).join(' · ') + ') · 축: dedup ' + (dedup !== null ? '○' : '✕') + ' classify ' + (classify.length ? classify.map((c) => c.writer).join('/') : '✕') + ' signals ' + (signals !== null ? '○' : '✕'));
  r.dropped.forEach((x) => console.log('  DROP ' + String(x.rule).padEnd(14) + ' ' + String(x.id).padEnd(8) + ' ' + x.game + ' | ' + x.title.slice(0, 44) + '  ← ' + x.by + ' ' + String(x.why).slice(0, 70)));
  r.kept.filter((x) => x.flags.length).forEach((x) => console.log('  FLAG ' + x.flags.join(',').padEnd(14).slice(0, 14) + ' ' + String(x.id).padEnd(8) + ' ' + x.game + ' | ' + x.title.slice(0, 44)));
  if (r.note.length) { console.log('  note 초안:'); r.note.forEach((n) => console.log('   - ' + n)); }
  console.log('→ ' + outP + ' — kept 만 상세 조사([A-5])로 넘긴다. flags 가 있는 항목은 angle 에 «기존 X와 달리 Y»를 적게 한다.');
}

module.exports = { mergeCands, gateItems, toLine, expandGlob };

if (require.main === module) {
  const run = { merge: cmdMerge, gate: cmdGate }[argv[0]];
  if (!run) { log('사용: desk-candidates.cjs <merge|gate> … (파일 머리 주석 참조)'); process.exit(2); }
  try { run(); } catch (e) { log('실패: ' + (e && e.stack ? e.stack : e)); process.exit(1); }
}
