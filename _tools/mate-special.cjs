#!/usr/bin/env node
/* ============================================================================
   mate-special.cjs — 네이버 메이트 «스페셜 지원금 대상자» 전원 일별 누적  (2026-10-24 신설 · LLM 0)

   왜 만들었나
     봄딩 인용수 추세를 벤치 2곳(게임인포·쿠치토)과만 비교하던 것을 «스페셜 지원금 대상자 전원(블로그 서비스 ·
     분야별 대표 1,000만 + 우수 300만)»과 «취미 분야(스포츠·게임·취미) 이달의 메이트 전원»으로 넓힌다(사용자 2026-10-23).
     네이버가 공개하는 세 숫자(누적·이번 달·선정 기준월 인용)는 «지금 값»뿐이라 일별로 쌓아야 추세·페이스·분포가 나온다.

   어디서 읽나 (전부 공개 · 로그인 0 · mate.naver.com 프런트가 쓰는 같은 API)
     ① 스페셜 명단  GET https://m.blog.naver.com/api/v1/special-reward-contributors?topicIds=TOPIC_001&…&topicIds=TOPIC_025
          result[].profile = { displayName, contributorHomePcUrl(블로그 주소 → id), previousMonthViewCount(선정 월 인용수),
                               topics[{topicId,topicName}], extraRewardType SPECIAL_1000 | SPECIAL_300 }
          ★«선정 월»은 페이지가 «이달의 메이트»로 보여 주는 달(10-24 실측: 2026-09 · 봄딩 prev=1,238,066 = 9월 합계)
     ② 이달의 메이트  GET https://m.blog.naver.com/api/v1/topic-contributors?topicIds=TOPIC_023&topicIds=TOPIC_024&topicIds=TOPIC_025&countPerTopic=300
          result[].contributors[].profile = { displayName, contributorHomePcUrl, cumulativeAibViewCount, isNewContributor, expertiseValue }
          ★10-24 실측: 게임 73곳 — 봄딩·게임인포 없음 · 쿠치토·겟따비므 있음 = 10월 메이트 명단(선정 기준 = 8월 인용)
     ③ 블로그 프로필  GET https://m.blog.naver.com/<id> (iPhone UA) → "isNaverMateBlog" · "mateInfo" · "mateCitations"{cumulativeCount,
          currentMonthCount,selectionPeriodCount,currentMonth,selectionPeriodMonth} · totalVisitorCount · dayVisitorCount · postCount
          (mate-citations.cjs parseProfile 과 같은 규칙 · 메이트가 아닌 블로그는 mateCitations 가 null 일 수 있다)

   무엇을 쓰나  _trend/_mate-special.jsonl — 하루 한 줄(JSON Lines · append 전용 · git diff 가 줄 추가로만 남는다)
     { "d":"YYYY-MM-DD", "at":ISO, "special":[{id,name,type,topics:[이름],prev}], "mates":{TOPIC_023:[{id,name,cum,new}],…},
       "blogs":{ id:{ n:이름, mate:bool, topic:메이트주제|null, cum, mon, monNo, sel, selMo, vis(totalVisitors), dv(dayVisitors), posts } },
       "errors":{ id:메시지 }, "n":{special,mates,blogs,errors} }
     - 하루 1줄. 오늘 줄이 있으면 기본은 «유지»(표본 시각 보존). `--refresh` 면 누적 인용이 오른 블로그가 하나라도 있을 때만 오늘 줄을 교체
       (네이버 아침 배치가 06:00 을 조금 넘겨 들어오는 날을 잡는 용도 — mate-citations.cjs --if-raised 와 같은 생각).
     - 실패해도 exit 0(루틴을 막지 않는다). 못 읽은 블로그는 errors 에 적고 그 블로그만 빈 채로 둔다. 파일을 못 쓰면 exit 1.
     - 대상 = 스페셜 명단 ∪ 취미 분야 메이트 ∪ 고정(봄딩·영도·게임인포·겟따비므). 명단이 바뀌면(월 교체) 그날부터 자동으로 따라간다.
     - ★10-24 추가: 25주제 «이달의 메이트» 전체 명단(10-24 실측 2,111곳)을 주제별로 읽어 `roster` 에 적는다 — 단 매일 전체를 쓰면 하루 100KB 가 늘므로
       **구성원(id 집합)이 바뀐 날에만 전체(id·cum·new)를 쓰고, 안 바뀐 날은 `{hash, n, same:true}` 만** 남긴다(월 교체일에 자동으로 전체가 한 번 남는다).
       취미 분야 3주제는 전과 같이 `mates` 에도 전체를 쓴다(비교 리포트가 읽는 자리).

   실행
     node _tools/mate-special.cjs              # 오늘 줄 수집(있으면 유지)
     node _tools/mate-special.cjs --refresh    # 누적이 올랐으면 오늘 줄 교체
     node _tools/mate-special.cjs --print      # 마지막 줄 요약(사람이 보는 표)
     node _tools/mate-special.cjs --dry        # 네트워크만, 파일 안 씀
     node _tools/mate-special.cjs --force      # 오늘 줄 무조건 교체(명단 기준선 재설정 때만)
   호출 = Windows 작업 sseudam-mate-special(매일 06:00 · .bc-locks/mate-special.ps1 → 이 파일 1개 커밋·push). 정본 = 쓰담 06_자동화.
   함정 = 프로필 요청 170곳 × 0.35초 ≈ 1~2분. 403 이 오면 20초 쉬고 1회 재시도(aib-check 와 같은 예절). 병렬 금지.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_mate-special.jsonl');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TOPICS = Array.from({ length: 25 }, (_, i) => 'TOPIC_' + String(i + 1).padStart(3, '0'));
const MATE_TOPICS = ['TOPIC_023', 'TOPIC_024', 'TOPIC_025'];      /* 취미 분야 = 스포츠·게임·취미 */
const FIXED = [{ id: 'bomding', name: '봄딩' }, { id: 'kkodug9', name: '영도' }, { id: 'gameinfor', name: '게임인포' }, { id: 'showsfw', name: '겟따비므' }];
const GAP_MS = 350;

const argv = process.argv.slice(2);
const REFRESH = argv.includes('--refresh');
const PRINT = argv.includes('--print');
const DRY = argv.includes('--dry');
const FORCE = argv.includes('--force');   /* 오늘 줄을 무조건 교체(명단 스냅샷 기준선을 다시 잡을 때만 · 표본 시각이 바뀐다) */

function kstYmd(ms) {
  const d = new Date(ms + 9 * 3600e3), p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, headers, tries) {
  tries = tries == null ? 1 : tries;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: Object.assign({ 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' }, headers || {}) });
    const text = r.status === 204 ? '' : await r.text();
    if (r.status === 403 && tries > 0) { await sleep(20000); return get(url, headers, tries - 1); }
    return { status: r.status, text };
  } finally { clearTimeout(t); }
}
const idOf = (url) => { const m = String(url || '').match(/blog\.naver\.com\/([A-Za-z0-9_.-]+)/); return m ? m[1] : null; };

/* ① 스페셜 명단 */
async function fetchSpecial() {
  const q = TOPICS.map((t) => 'topicIds=' + t).join('&');
  const r = await get('https://m.blog.naver.com/api/v1/special-reward-contributors?' + q, { 'Accept': 'application/json', 'Referer': 'https://mate.naver.com/' });
  if (r.status !== 200) throw new Error('special HTTP ' + r.status);
  const j = JSON.parse(r.text);
  if (!j || !j.isSuccess || !Array.isArray(j.result)) throw new Error('special 응답 형식 변경?');
  return j.result.map((e) => {
    const p = e.profile || {};
    return { id: idOf(p.contributorHomePcUrl), name: p.displayName || '', type: p.extraRewardType || null, topics: (p.topics || []).map((t) => t.topicName), prev: p.previousMonthViewCount == null ? null : Number(p.previousMonthViewCount) };
  }).filter((e) => e.id);
}
/* ② 이달의 메이트(취미 분야 3주제) */
async function fetchMates() {
  const q = MATE_TOPICS.map((t) => 'topicIds=' + t).join('&') + '&countPerTopic=300';
  const r = await get('https://m.blog.naver.com/api/v1/topic-contributors?' + q, { 'Accept': 'application/json', 'Referer': 'https://mate.naver.com/' });
  if (r.status !== 200) throw new Error('mates HTTP ' + r.status);
  const j = JSON.parse(r.text);
  if (!j || !j.isSuccess || !Array.isArray(j.result)) throw new Error('mates 응답 형식 변경?');
  const out = {};
  j.result.forEach((t) => {
    out[t.topicId] = (t.contributors || []).map((c) => {
      const p = c.profile || {};
      return { id: idOf(p.contributorHomePcUrl), name: p.displayName || '', cum: p.cumulativeAibViewCount == null ? null : Number(p.cumulativeAibViewCount), new: !!p.isNewContributor };
    }).filter((c) => c.id);
  });
  return out;
}
/* ②-b 25주제 전체 명단 — 구성원 해시가 전날과 같으면 요약만 */
const ALL_TOPICS = Array.from({ length: 25 }, (_, i) => 'TOPIC_' + String(i + 1).padStart(3, '0'));
function hashIds(ids) { let h = 0; for (const s of ids.slice().sort()) for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(16).padStart(8, '0') + '-' + ids.length; }
async function fetchRoster(prev) {
  const out = {};
  for (const t of ALL_TOPICS) {
    await sleep(GAP_MS);
    try {
      const r = await get('https://m.blog.naver.com/api/v1/topic-contributors?topicIds=' + t + '&countPerTopic=1000', { 'Accept': 'application/json', 'Referer': 'https://mate.naver.com/' });
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      const j = JSON.parse(r.text); const res = (j && j.result || [])[0] || {};
      const list = (res.contributors || []).map((c) => { const p = c.profile || {}; return { id: idOf(p.contributorHomePcUrl), name: p.displayName || '', cum: p.cumulativeAibViewCount == null ? null : Number(p.cumulativeAibViewCount), new: !!p.isNewContributor }; }).filter((c) => c.id);
      const h = hashIds(list.map((c) => c.id));
      const pv = prev && prev[t];
      if (pv && pv.hash === h) out[t] = { name: res.topicName || '', hash: h, n: list.length, same: true };
      else out[t] = { name: res.topicName || '', hash: h, n: list.length, same: false, list };
    } catch (e) { out[t] = { error: String(e.message || e) }; }
  }
  return out;
}
/* 어제까지의 줄에서 주제별 마지막 해시(전체가 적힌 줄의 해시도 포함)를 찾는다 */
function lastRoster(lines, today) {
  const out = {};
  for (const l of lines) {
    if (!l.roster || l.d === today) continue;
    for (const [t, v] of Object.entries(l.roster)) if (v && v.hash) out[t] = { hash: v.hash };
  }
  return out;
}

/* ③ 프로필 */
function parseProfile(html) {
  const num = (k) => { const m = html.match(new RegExp('"' + k + '":(\\d+)')); return m ? Number(m[1]) : null; };
  const j = (s) => { try { return s && s !== 'null' ? JSON.parse(s) : null; } catch (e) { return null; } };
  let selected = null, info = null, cites = null;
  const trio = html.match(/"isNaverMateBlog":(true|false),"mateInfo":(\{[^}]*\}|null),"mateCitations":(\{[^}]*\}|null)/);
  if (trio) { selected = trio[1] === 'true'; info = j(trio[2]); cites = j(trio[3]); }
  else {
    const s = html.match(/"isNaverMateBlog":(true|false)/); selected = s ? s[1] === 'true' : null;
    info = j((html.match(/"mateInfo":(\{[^}]*\}|null)/) || [])[1]);
    cites = j((html.match(/"mateCitations":(\{[^}]*\}|null)/) || [])[1]);
  }
  return { found: !!(trio || html.indexOf('"totalVisitorCount"') >= 0), selected, info, cites, totalVisitors: num('totalVisitorCount'), dayVisitors: num('dayVisitorCount'), posts: num('postCount') };
}
async function profile(id) {
  const r = await get('https://m.blog.naver.com/' + id);
  if (r.status !== 200) throw new Error('HTTP ' + r.status);
  const p = parseProfile(r.text);
  if (!p.found) throw new Error('프로필 JSON 없음');
  const c = p.cites || {};
  return { mate: !!p.selected, topic: p.info && p.info.topic ? p.info.topic : null,
    cum: c.cumulativeCount == null ? null : Number(c.cumulativeCount), mon: c.currentMonthCount == null ? null : Number(c.currentMonthCount), monNo: c.currentMonth == null ? null : Number(c.currentMonth),
    sel: c.selectionPeriodCount == null ? null : Number(c.selectionPeriodCount), selMo: c.selectionPeriodMonth == null ? null : Number(c.selectionPeriodMonth),
    vis: p.totalVisitors, dv: p.dayVisitors, posts: p.posts };
}

function readLines() {
  try { return fs.readFileSync(OUT, 'utf8').split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); }
  catch (e) { return []; }
}
function writeLines(lines) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
}
function summary(line) {
  const sp = line.special || [], bl = line.blogs || {};
  const rows = sp.slice().sort((a, b) => (b.prev || 0) - (a.prev || 0));
  const hob = rows.filter((e) => e.topics.some((t) => ['게임', '스포츠', '취미'].includes(t)));
  const fmt = (v) => v == null ? '-' : (v / 10000).toFixed(1) + '만';
  const out = ['[mate-special] ' + line.d + ' 스페셜 ' + sp.length + '곳(1000만 ' + sp.filter((e) => e.type === 'SPECIAL_1000').length + ') · 취미 분야 메이트 ' + Object.values(line.mates || {}).reduce((a, l) => a + l.length, 0) + '곳 · 프로필 ' + Object.keys(bl).length + ' · 오류 ' + Object.keys(line.errors || {}).length];
  out.push('  취미 분야 스페셜(선정 월 인용 순): ' + hob.map((e) => e.name + '(' + e.id + ')' + fmt(e.prev) + (e.type === 'SPECIAL_1000' ? '★' : '') + (bl[e.id] && bl[e.id].mate === false ? '⛔비메이트' : '')).join(' · '));
  const ro = line.roster || {}; const rk = Object.keys(ro);
  if (rk.length) out.push('  25주제 명단: ' + rk.reduce((a, t) => a + (ro[t].n || 0), 0) + '곳 · 전체 기록 ' + rk.filter((t) => ro[t].list).length + '주제 · 변동 없음 ' + rk.filter((t) => ro[t].same).length + '주제 · 오류 ' + rk.filter((t) => ro[t].error).length);
  const b = bl.bomding; if (b) out.push('  봄딩: mate=' + b.mate + ' cum=' + fmt(b.cum) + ' mon=' + fmt(b.mon) + '(' + b.monNo + '월) sel=' + fmt(b.sel) + '(' + b.selMo + '월) posts=' + b.posts);
  return out.join('\n');
}

(async () => {
  const today = kstYmd(Date.now()), nowIso = new Date().toISOString();
  const lines = readLines();
  if (PRINT) { const last = lines[lines.length - 1]; console.log(last ? summary(last) : '[mate-special] 기록 없음'); process.exit(0); }
  const existing = lines.find((l) => l.d === today);
  if (existing && !REFRESH && !FORCE && !DRY) { console.log('[mate-special] ' + today + ' 오늘 줄 있음(유지) — --refresh 로 교체'); process.exit(0); }

  const line = { d: today, at: nowIso, special: [], mates: {}, blogs: {}, errors: {}, n: {} };
  try { line.special = await fetchSpecial(); } catch (e) { line.errors['_special'] = String(e.message || e); }
  await sleep(GAP_MS);
  try { line.mates = await fetchMates(); } catch (e) { line.errors['_mates'] = String(e.message || e); }
  line.roster = await fetchRoster(lastRoster(lines, today));

  const ids = new Map();
  FIXED.forEach((f) => ids.set(f.id, f.name));
  line.special.forEach((e) => ids.set(e.id, e.name));
  Object.values(line.mates).forEach((l) => l.forEach((c) => { if (!ids.has(c.id)) ids.set(c.id, c.name); }));
  for (const [id, name] of ids) {
    await sleep(GAP_MS + Math.floor(Math.random() * 150));
    try { const p = await profile(id); line.blogs[id] = Object.assign({ n: name }, p); }
    catch (e) { line.errors[id] = String(e.message || e); }
  }
  line.n = { special: line.special.length, mates: Object.values(line.mates).reduce((a, l) => a + l.length, 0), roster: Object.values(line.roster || {}).reduce((a, v) => a + (v.n || 0), 0), blogs: Object.keys(line.blogs).length, errors: Object.keys(line.errors).length };

  if (DRY) { console.log(summary(line)); console.log('[mate-special] --dry: 파일 안 씀'); process.exit(0); }
  if (existing && (REFRESH || FORCE)) {
    const raised = Object.keys(line.blogs).some((id) => { const a = existing.blogs && existing.blogs[id], b = line.blogs[id]; return a && b && a.cum != null && b.cum != null && b.cum > a.cum; });
    if (!raised && !FORCE) { console.log('[mate-special] ' + today + ' --refresh: 누적 인용 변동 없음 — 파일 안 씀'); process.exit(0); }
    const idx = lines.indexOf(existing); lines[idx] = line;
  } else lines.push(line);
  try { writeLines(lines); } catch (e) { console.error('[mate-special] 파일 쓰기 실패: ' + e.message); process.exit(1); }
  console.log(summary(line) + '\n[mate-special] 저장 ' + OUT + ' (' + lines.length + '줄)');
})().catch((e) => { console.error('[mate-special] 예외: ' + (e && e.message || e)); process.exit(0); });
