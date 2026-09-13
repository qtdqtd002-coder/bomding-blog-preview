#!/usr/bin/env node
/* ============================================================================
   live-ledger.cjs — 봄딩·영도 «라이브 글 원장» → _trend/_live-posts.json   (2026-09-13 신설)

   왜 만들었나
     네이버 글 번호(logNo)를 아는 곳이 우리한테 없었다. 그래서 작성 규칙이 «기존 글 링크블록을
     grep 해서 나오면 쓰고, 없으면 추측하지 말 것»(봄딩·영도 output-format §1-5)으로 묶여 있었고,
     실제로 내부링크가 «(발행 시 링크 연결)» 텍스트 안내로 빠지는 일이 반복됐다. 이 원장이 생기면
     추측할 자리 자체가 사라진다 — 같은 게임 기존 글의 진짜 URL 을 도구가 집어 준다.
     덧붙여 «어느 게임에 어떤 각도 글이 있나»(커버리지)·«오래된 효자 글»(리프레시)·«허브가 빈 게임»
     판정이 전부 이 한 파일에서 나온다. 기획 = 쓰담/docs/2026-09-13_봄딩영도_주제선정_도구지원_기획.html (B3)

   어디서 읽나 (공개 데이터 · 로그인 불필요)
     https://m.blog.naver.com/api/blogs/<id>/post-list?categoryNo=0&itemCount=30&page=N   (iPhone UA + Referer)
     항목에서 쓰는 것 = logNo · titleWithInspectMessage · addDate(epoch ms) · categoryName · commentCnt · sympathyCnt
     ★readCount 는 항상 null 이다(2026-09-13 실측) — 글별 조회수는 공개되지 않는다. 관리자 캡처(metrics-baseline)가 유일 경로.
     ★itemCount 는 30 이 상한(50↑ 은 400 param_is_invalidate — mate-citations 09-06 실측과 동일).
     ★result.totalCount 는 0 으로 온다(믿지 말 것) — 빈 페이지가 나올 때까지가 끝이다.

   게임 판정 (추측 0 — 실재하는 이름만 쓴다)
     어휘 = ① _glossary/_aliases.json 의 canon + aliases  ② posts.json 의 group(= 우리가 실제로 쓴 글 폴더명)
     제목에서 **가장 긴 어휘가 먼저** 걸리게 매칭한다(«메이플스토리»와 «메이플랜드»가 섞이지 않게).
     못 찾으면 null — «게임이 없다»가 아니라 «어휘에 없다»는 뜻이라 `--unmatched` 로 후보를 뽑아
     _aliases.json 에 한 줄 추가하면 다음 회차부터 잡힌다.

   각도 판정
     shared/blog-writing/tools/angle-mix.py 부록 A 사다리를 **그대로** 이식했다(위에서 먼저 맞는 것).
     ★같은 분류를 쓰지 않으면 이 원장의 커버리지와 angle-mix 의 주간 판정이 서로 다른 숫자를 말하게 된다.
     기계 분류라 경계 사례가 있다 — 추세·커버리지용이지 개별 글 판정용이 아니다.

   작성자
     대상 = «네이버에 글을 쓰는 현역». 현역 판정은 하드코딩하지 않고 쓰담v2/canon/config.json 의
     writers(v1Only ∪ v2) − writers.inactive 로 구한다(BRAIN ★0). 휴면이 풀리면 코드 수정 없이 따라온다.
     네이버 ID 정본 = _tools/check-published.ps1 의 작성자 표와 같다.

   실행
     node _tools/live-ledger.cjs                     # 증분 갱신(보통 1~2페이지에서 멈춘다)
     node _tools/live-ledger.cjs --full              # 전량 재수집(--max-pages 기본 60 = 1,800편/작성자)
     node _tools/live-ledger.cjs --print             # 사람이 보는 요약(어휘 적중률 포함)
     node _tools/live-ledger.cjs --unmatched         # 게임 어휘에 안 걸린 제목 = _aliases.json 보강 후보
     node _tools/live-ledger.cjs --stats --writer 봄딩 [--days 180]     # 게임×각도 커버리지
     node _tools/live-ledger.cjs --links --writer 봄딩 --game 팰월드 [--exclude <logNo>] [--n 3]
         → 그 작성자 양식 그대로의 내부링크 블록 HTML(봄딩 «✔ 같이 보기» / 영도 «▶ 같이 보면 좋은 글»)

   운영 규칙
     - 실패해도 exit 0(데스크·발행을 막지 않는다). 그 작성자는 error 를 남기고 지난 목록을 보존한다.
       파일을 못 쓰면 exit 1. --links/--stats 에서 원장이 없으면 exit 2(호출부가 «없음»을 구분할 수 있게).
     - 지우지 않는다 — 한 번 담은 글은 계속 남는다(라이브에서 삭제돼도 원장에는 gone 표시만).
     - 소비자 = 집필 스폰(내부링크) · refresh-queue · 주제 탐색기(_topics.json) · 영도 허브 갭.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_live-posts.json');
const POSTS = path.join(ROOT, 'posts.json');
const ALIASES = path.resolve(ROOT, '..', '_glossary', '_aliases.json');
const CONFIG = path.resolve(ROOT, '..', '쓰담v2', 'canon', 'config.json');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ITEMS = 30;
const GAP_MS = 300;

/* 네이버에 글을 쓰는 작성자의 blogId. 현역 여부는 config 가 정한다(아래 activeWriters). */
const NAVER_ID = { '봄딩': 'bomding', '영도': 'kkodug9', '하루살이': 'harusale-' };

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const FULL = has('--full');
const MAXP = Math.max(1, parseInt(val('--max-pages', FULL ? '60' : '6'), 10) || 1);

/* ── 공통 ───────────────────────────────────────────────────────────────── */
function kstYmd(ms) {
  const d = new Date(Number(ms) + 9 * 3600e3), p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
function todayKst() { return kstYmd(Date.now()); }
function daysAgo(ymd) {
  return Math.round((Date.parse(todayKst() + 'T00:00:00+09:00') - Date.parse(ymd + 'T00:00:00+09:00')) / 86400000);
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ENT[n])
    .trim();
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJson(url, referer) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, {
      signal: ctl.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'application/json,*/*', 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': referer },
    });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return JSON.parse(await r.text());
  } finally { clearTimeout(t); }
}

/* ── 현역 작성자 (BRAIN ★0 — 하드코딩 금지) ─────────────────────────────── */
function activeWriters() {
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { cfg = null; }
  const w = (cfg && cfg.writers) || {};
  const all = [].concat(Array.isArray(w.v1Only) ? w.v1Only : [], Array.isArray(w.v2) ? w.v2 : []);
  const off = new Set(Array.isArray(w.inactive) ? w.inactive : []);
  const list = (all.length ? all : Object.keys(NAVER_ID)).filter((n) => !off.has(n) && NAVER_ID[n]);
  return list.map((n) => ({ name: n, id: NAVER_ID[n] }));
}

/* ── 게임 어휘 ──────────────────────────────────────────────────────────── */
function normKey(s) { return String(s).toLowerCase().replace(/[\s·:：\-—–_'"’”“(){}\[\]!?.,]/g, ''); }

function buildVocab() {
  const map = new Map();                       /* normKey → canon 표기 */
  const add = (name, canon) => {
    const k = normKey(name);
    if (k.length < 2) return;
    if (!map.has(k)) map.set(k, canon);
  };
  try {
    const a = JSON.parse(fs.readFileSync(ALIASES, 'utf8'));
    (a.games || []).forEach((g) => {
      add(g.canon, g.canon);
      (g.aliases || []).forEach((al) => add(al, g.canon));
      (g.folders || []).forEach((f) => add(f, g.canon));
    });
  } catch (e) { /* 별칭 색인이 없어도 posts.json 만으로 동작한다 */ }
  try {
    const p = JSON.parse(fs.readFileSync(POSTS, 'utf8'));
    const arr = Array.isArray(p) ? p : (p.posts || Object.values(p));
    arr.forEach((x) => { if (x && x.group) add(x.group, String(x.group)); });
  } catch (e) { /* posts.json 이 없어도 별칭 색인만으로 동작한다 */ }
  /* 긴 이름이 먼저 걸리게 — «메이플스토리»가 «메이플랜드»보다 앞서야 한다 */
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
}

function detectGame(title, vocab) {
  const k = normKey(title);
  for (const [key, canon] of vocab) if (k.includes(key)) return canon;
  return null;
}

/* ── 각도 사다리 (angle-mix.py 부록 A 이식 — 분류명까지 동일) ───────────── */
const LADDER = [
  ['공략·방법형', /하는 ?법|방법|공략|위치|얻는 ?법|만드는 ?법|세팅|스킬트리|조합|루트|파밍|재료|퀘스트|보는 ?법|설정|설치|사용법|치트|명령어|염색코드|코디|기댓값|확률/],
  ['쿠폰형', /쿠폰|코드/],
  ['추천·티어·비교형', /티어|추천|순위|BEST|TOP|비교|뭐가 다를|차이/i],
  ['후기·리뷰형', /후기|리뷰|사용기|써본|첫인상/],
  ['뉴스·소식형', /출시|사전예약|사전 예약|발표|공개|업데이트|패치|콜라보|이벤트|일정|중단|확정|출시일|정식|소식|근황|생중계|응모/],
  ['정리·모음형', /총정리|정리|가이드|모음|링크|사이트/],
];
const ANGLES = LADDER.map((x) => x[0]).concat(['기타']);
function classify(title) {
  for (const [name, re] of LADDER) if (re.test(title)) return name;
  return '기타';
}

/* ── 수집 ───────────────────────────────────────────────────────────────── */
async function fetchWriter(w, known) {
  const out = [];
  const ref = 'https://m.blog.naver.com/' + w.id;
  let pages = 0;
  for (let page = 1; page <= MAXP; page++) {
    const url = 'https://m.blog.naver.com/api/blogs/' + encodeURIComponent(w.id)
      + '/post-list?categoryNo=0&itemCount=' + ITEMS + '&page=' + page;
    const j = await getJson(url, ref);
    if (!j || !j.isSuccess || !j.result || !Array.isArray(j.result.items)) throw new Error('post-list 응답 형식 변경? (p' + page + ')');
    const items = j.result.items;
    pages = page;
    if (!items.length) break;
    let fresh = 0;
    for (const it of items) {
      const n = String(it.logNo || '').trim();
      if (!n) continue;
      if (!known.has(n)) fresh++;
      out.push({
        n,
        d: it.addDate ? kstYmd(it.addDate) : null,
        t: decode(it.titleWithInspectMessage),
        cat: decode(it.categoryName) || null,
        cm: Number(it.commentCnt) || 0,
        sy: Number(it.sympathyCnt) || 0,
      });
    }
    /* 증분 모드: 이 페이지가 전부 아는 글이면 그 앞은 볼 필요가 없다 */
    if (!FULL && fresh === 0) break;
    if (page < MAXP) await sleep(GAP_MS);
  }
  return { items: out, pages };
}

function readPrev() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; } }

/* 한 글 = 한 줄로 직렬화(일 단위로 커밋되는 파일이라 diff 가 읽혀야 한다) */
function serialize(doc) {
  const L = [];
  L.push('{');
  L.push('  "schema": ' + JSON.stringify(doc.schema) + ',');
  L.push('  "kind": ' + JSON.stringify(doc.kind) + ',');
  L.push('  "updated": ' + JSON.stringify(doc.updated) + ',');
  L.push('  "source": ' + JSON.stringify(doc.source) + ',');
  L.push('  "angles": ' + JSON.stringify(doc.angles) + ',');
  L.push('  "writers": [');
  doc.writers.forEach((w, wi) => {
    L.push('    {');
    L.push('      "name": ' + JSON.stringify(w.name) + ', "id": ' + JSON.stringify(w.id)
      + ', "count": ' + w.count + ', "newest": ' + JSON.stringify(w.newest)
      + ', "oldest": ' + JSON.stringify(w.oldest) + ', "pages": ' + w.pages
      + ', "gameHitRate": ' + w.gameHitRate + ', "error": ' + JSON.stringify(w.error) + ',');
    L.push('      "posts": [');
    w.posts.forEach((p, pi) => {
      L.push('        ' + JSON.stringify(p) + (pi < w.posts.length - 1 ? ',' : ''));
    });
    L.push('      ]');
    L.push('    }' + (wi < doc.writers.length - 1 ? ',' : ''));
  });
  L.push('  ]');
  L.push('}');
  return L.join('\n') + '\n';
}

async function collect() {
  const prev = readPrev();
  const vocab = buildVocab();
  const writers = activeWriters();
  const nowIso = new Date().toISOString();
  const outWriters = [];

  for (const w of writers) {
    const old = prev && Array.isArray(prev.writers) ? prev.writers.find((x) => x.name === w.name) : null;
    const keep = new Map();
    if (old && Array.isArray(old.posts)) old.posts.forEach((p) => keep.set(String(p.n), p));

    let got = null, err = null, pages = 0;
    try { const r = await fetchWriter(w, keep); got = r.items; pages = r.pages; }
    catch (e) { err = String(e && e.message ? e.message : e); }

    if (got) {
      for (const it of got) {
        const g = detectGame(it.t, vocab);
        keep.set(it.n, { n: it.n, d: it.d, t: it.t, g, a: classify(it.t), cat: it.cat, cm: it.cm, sy: it.sy });
      }
    }
    const posts = [...keep.values()].sort((a, b) => (b.d || '').localeCompare(a.d || '') || Number(b.n) - Number(a.n));
    const hit = posts.filter((p) => p.g).length;
    outWriters.push({
      name: w.name, id: w.id, count: posts.length,
      newest: posts.length ? posts[0].d : null,
      oldest: posts.length ? posts[posts.length - 1].d : null,
      pages, gameHitRate: posts.length ? Math.round((hit / posts.length) * 1000) / 10 : 0,
      error: err, posts,
    });
    if (err) console.error('  ⚠ ' + w.name + ' 수집 실패: ' + err + ' (지난 목록 ' + posts.length + '편 보존)');
  }

  const doc = {
    schema: 1, kind: 'live-post-ledger', updated: nowIso,
    source: 'm.blog.naver.com/api/blogs/<id>/post-list (공개)',
    angles: ANGLES, writers: outWriters,
  };
  try { fs.writeFileSync(OUT, serialize(doc), 'utf8'); }
  catch (e) { console.error('원장 저장 실패: ' + e.message); process.exit(1); }
  outWriters.forEach((w) => {
    console.log(w.name + ' — ' + w.count + '편 (' + (w.oldest || '?') + ' ~ ' + (w.newest || '?')
      + ') · ' + w.pages + '페이지 조회 · 게임 판정 ' + w.gameHitRate + '%' + (w.error ? ' · ⚠' + w.error : ''));
  });
  console.log('→ ' + path.relative(ROOT, OUT));
  return doc;
}

/* ── 읽기 모드 ──────────────────────────────────────────────────────────── */
function load() {
  const d = readPrev();
  if (!d || !Array.isArray(d.writers)) { console.error('원장이 없다. 먼저: node _tools/live-ledger.cjs --full'); process.exit(2); }
  return d;
}
function pickWriter(doc, name) {
  const w = doc.writers.find((x) => x.name === name);
  if (!w) { console.error('작성자 «' + name + '» 가 원장에 없다. 있는 것: ' + doc.writers.map((x) => x.name).join(', ')); process.exit(2); }
  return w;
}

function cmdPrint() {
  const d = load();
  console.log('라이브 글 원장 — 갱신 ' + d.updated);
  d.writers.forEach((w) => {
    console.log('\n' + w.name + ' (' + w.id + ') — ' + w.count + '편 · ' + (w.oldest || '?') + ' ~ ' + (w.newest || '?')
      + ' · 게임 판정 ' + w.gameHitRate + '%');
    const byA = {};
    w.posts.forEach((p) => { byA[p.a] = (byA[p.a] || 0) + 1; });
    console.log('  각도  ' + ANGLES.filter((a) => byA[a]).map((a) => a + ' ' + byA[a]
      + '(' + Math.round((byA[a] / w.count) * 100) + '%)').join(' · '));
    const byG = {};
    w.posts.forEach((p) => { if (p.g) byG[p.g] = (byG[p.g] || 0) + 1; });
    const top = Object.entries(byG).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('  상위 게임  ' + top.map(([g, n]) => g + ' ' + n).join(' · '));
  });
}

function cmdUnmatched() {
  const d = load();
  const who = val('--writer', null);
  d.writers.filter((w) => !who || w.name === who).forEach((w) => {
    const un = w.posts.filter((p) => !p.g);
    console.log('\n' + w.name + ' — 게임 어휘 미적중 ' + un.length + '편 / ' + w.count);
    const head = {};
    un.forEach((p) => {
      const first = String(p.t).split(/[\s,·]+/).slice(0, 2).join(' ').replace(/[^\w가-힣 ]/g, '').trim();
      if (first.length >= 2) head[first] = (head[first] || 0) + 1;
    });
    Object.entries(head).sort((a, b) => b[1] - a[1]).slice(0, 25)
      .forEach(([k, n]) => console.log('  ' + String(n).padStart(3) + '  ' + k));
    console.log('  ※ 실제 게임명이면 _glossary/_aliases.json 에 한 줄 추가 → 다음 회차부터 잡힌다(추측 금지: 실재 확인 후).');
  });
}

function cmdStats() {
  const d = load();
  const w = pickWriter(d, val('--writer', '봄딩'));
  const days = parseInt(val('--days', '0'), 10) || 0;
  const posts = w.posts.filter((p) => p.g && p.d && (!days || daysAgo(p.d) <= days));
  const games = {};
  posts.forEach((p) => { (games[p.g] = games[p.g] || {})[p.a] = (games[p.g][p.a] || 0) + 1; });
  const rows = Object.entries(games).map(([g, m]) => [g, m, Object.values(m).reduce((a, b) => a + b, 0)])
    .sort((a, b) => b[2] - a[2]);
  const cols = ANGLES;
  console.log(w.name + ' 게임×각도 커버리지' + (days ? ' (최근 ' + days + '일)' : ' (전체)') + ' — ' + posts.length + '편 / 게임 ' + rows.length + '종');
  console.log('');
  console.log('게임'.padEnd(20) + cols.map((c) => c.slice(0, 6).padStart(8)).join('') + '   합');
  rows.slice(0, parseInt(val('--top', '25'), 10) || 25).forEach(([g, m, tot]) => {
    console.log(String(g).slice(0, 19).padEnd(20)
      + cols.map((c) => String(m[c] || '·').padStart(8)).join('') + String(tot).padStart(5));
  });
  if (has('--json')) {
    console.log('\n' + JSON.stringify({ writer: w.name, days: days || null, angles: cols, games: rows.map(([g, m, t]) => ({ game: g, total: t, byAngle: m })) }, null, 2));
  }
}

/* 내부링크 블록 — 작성자별 양식 정본 = 각 스킬 references/output-format.md §1-5 */
function cmdLinks() {
  const d = load();
  const name = val('--writer', null);
  if (!name) { console.error('--writer <봄딩|영도> 가 필요하다'); process.exit(2); }
  const w = pickWriter(d, name);
  const game = val('--game', null);
  if (!game) { console.error('--game <게임명> 이 필요하다'); process.exit(2); }
  const n = Math.max(1, Math.min(5, parseInt(val('--n', '3'), 10) || 3));
  const exclude = new Set(String(val('--exclude', '')).split(',').map((s) => s.trim()).filter(Boolean));
  const gk = normKey(game);

  let cand = w.posts.filter((p) => p.g && normKey(p.g) === gk && !exclude.has(String(p.n)));
  if (!cand.length) cand = w.posts.filter((p) => normKey(p.t).includes(gk) && !exclude.has(String(p.n)));
  const pick = cand.slice(0, n);

  if (has('--json')) {
    console.log(JSON.stringify({ writer: w.name, game, found: cand.length, picked: pick.map((p) => ({ logNo: p.n, date: p.d, title: p.t, angle: p.a, url: 'https://blog.naver.com/' + w.id + '/' + p.n })) }, null, 2));
    return;
  }
  if (!pick.length) {
    console.log('같은 게임 기존 글 0편 — 링크 블록을 만들지 않는다(억지로 만들지 않음: output-format §1-5).');
    return;
  }
  const url = (p) => 'https://blog.naver.com/' + w.id + '/' + p.n;
  const lines = pick.map((p) => '· <a href="' + url(p) + '" target="_blank">' + esc(p.t) + '</a>');
  let html;
  if (w.name === '영도') {
    html = '<p><b>▶ 같이 보면 좋은 글</b><br>\n' + lines.join('<br>\n') + '</p>';
  } else {
    html = '<p><b>✔ ' + esc(game) + ' 같이 보기 좋은 내용</b><br>\n' + lines.join('<br>\n') + '</p>';
  }
  console.log(html);
  console.error('\n[근거] ' + w.name + ' · ' + game + ' 후보 ' + cand.length + '편 중 최신 ' + pick.length + '편');
  pick.forEach((p) => console.error('  ' + p.d + '  ' + p.n + '  [' + p.a + ']  ' + p.t));
}

/* ── 라우팅 ─────────────────────────────────────────────────────────────── */
(async function main() {
  try {
    if (has('--links')) return cmdLinks();
    if (has('--stats')) return cmdStats();
    if (has('--unmatched')) return cmdUnmatched();
    if (has('--print')) return cmdPrint();
    await collect();
  } catch (e) {
    console.error('실패: ' + (e && e.stack ? e.stack : e));
    process.exit(has('--links') || has('--stats') ? 2 : 0);
  }
})();
