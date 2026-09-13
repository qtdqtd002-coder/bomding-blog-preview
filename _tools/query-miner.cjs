#!/usr/bin/env node
/* ============================================================================
   query-miner.cjs — «사람들이 실제로 치는 검색어» 발굴 → _trend/_queries.json   (2026-09-13 신설)

   왜 만들었나
     봄딩 발주 규칙은 «[주제]는 독자가 검색창에 치는 문장»(writer-playbook 봄딩 «현재 처방 2» ①)인데,
     그 문장을 **찾는** 도구가 없어서 기획자가 감으로 지어 왔다. 그 결과 우리 초안이 뉴스·소식형 25%로
     봄딩 자작 시절(13%)과 거꾸로 갔다. 이 도구는 게임명 하나를 네이버 자동완성에 넣어 실제로 입력되는
     질의를 모으고, 라이브 글 원장과 대조해 **«질의는 있는데 우리 글이 없는 칸»**을 찍는다.
     기획 = 쓰담/docs/2026-09-13_봄딩영도_주제선정_도구지원_기획.html (A1)

   어디서 읽나 (공개 · 로그인 불필요)
     https://ac.search.naver.com/nx/ac?q=<질의>&st=100&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&q_enc=UTF-8&frm=nv
     응답 = { query:[...], items:[[ ["팰월드 온라인"], ["팰월드 교배"], … ]] }  (2026-09-13 실측)

   ★읽는 법의 한계 (이걸 어기면 거짓 근거가 된다)
     - 자동완성은 **순서만** 준다. 검색«량» 숫자가 아니다. «1번이 제일 많이 검색된다»고 적지 말 것.
       사실로 말할 수 있는 건 «이 질의가 실제로 입력된다»까지다. 수요 판정은 aib-check.py(브리핑 유무)로 대체한다.
     - 자동완성에는 오타·연관 브랜드·타 게임이 섞인다. 발주 전에 사람이 본다.
     - **이동형 질의**(나무위키·갤러리·디시·인벤·카페·«사이트»·다운로드 …)는 «그 페이지로 가고 싶다»는 뜻이라
       블로그 글이 답이 될 수 없다. 실재하는 질의이므로 파일에는 nav:true 로 남기되 **발주 후보(★)에서는 뺀다**.
       (2026-09-13 팰월드 실측 — 자동완성 30개 중 8개가 이동형이었다.)

   무엇을 하나
     ① 시드 = --game 으로 준 게임 / --pins(백엔드 지정 게임) / --from-ledger(원장 상위 게임)
     ② 확장 = 시드 자체 + 시드+접미 12종(하는 법·얻는 법·쿠폰·티어·추천·조건·비용·초보·세팅·공략·위치·순위)
              --deep 을 주면 1단 결과를 한 번 더 시드로 굴린다(질의 수 3~5배, 요청도 그만큼).
     ③ 각도 = angle-mix.py 부록 A 사다리(live-ledger.cjs 와 같은 이식본)
     ④ 대조 = _trend/_live-posts.json 의 그 작성자 제목과 맞춰 covered / open 판정
              covered = 질의에서 게임명을 뺀 «남은 말»이 같은 게임 글 제목에 전부 들어 있다.
              ★기계 판정이라 경계 사례가 있다 — «없다»가 아니라 «못 찾았다»로 읽고 발주 전에 확인한다.

   실행
     node _tools/query-miner.cjs --game 팰월드 --print
     node _tools/query-miner.cjs --pins                  # 사이트 「꼭 다룰 게임」 전부
     node _tools/query-miner.cjs --from-ledger --top 12  # 원장 상위 게임
     node _tools/query-miner.cjs --game 애니모 --deep --print
     node _tools/query-miner.cjs --open --writer 봄딩     # 저장분에서 «빈 칸»만 다시 보기
     node _tools/query-miner.cjs --game 팰월드 --aib      # aib-check.py 에 넣을 질의 목록(JSON) 출력

   운영 규칙
     - 요청 간격 --gap(기본 250ms) · 한 실행 --max-req(기본 400) 상한. 병렬 금지.
     - 실패해도 exit 0. 저장된 판을 덮어쓰되 실패한 게임은 지난 판을 보존한다.
     - LLM 0. 판단은 사람이 한다 — 이 파일은 사실(질의가 있다/우리 글이 없다)만 담는다.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_queries.json');
const LEDGER = path.join(ROOT, '_trend', '_live-posts.json');
const API = 'https://34.139.184.70.sslip.io';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const SUFFIX = ['하는 법', '얻는 법', '쿠폰', '티어', '추천', '조건', '비용', '초보', '세팅', '공략', '위치', '순위'];
/* 이동형 질의 = «그 사이트로 가고 싶다» — 블로그 글이 답이 될 수 없다(발주 후보에서 제외, 파일에는 남긴다) */
const NAV = /나무위키|위키|갤러리|디시|인벤|루리웹|카페|사이트|홈페이지|공홈|다운로드|다운받|설치파일|토렌트|apk|스토어|트위치|유튜브|디스코드|\bgg\b|지지/i;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const GAP = Math.max(0, parseInt(val('--gap', '250'), 10) || 0);
const MAXREQ = Math.max(1, parseInt(val('--max-req', '400'), 10) || 1);
const DEEP = has('--deep');

let reqCount = 0;

const LADDER = [
  ['공략·방법형', /하는 ?법|방법|공략|위치|얻는 ?법|만드는 ?법|세팅|스킬트리|조합|루트|파밍|재료|퀘스트|보는 ?법|설정|설치|사용법|치트|명령어|염색코드|코디|기댓값|확률/],
  ['쿠폰형', /쿠폰|코드/],
  ['추천·티어·비교형', /티어|추천|순위|BEST|TOP|비교|뭐가 다를|차이/i],
  ['후기·리뷰형', /후기|리뷰|사용기|써본|첫인상/],
  ['뉴스·소식형', /출시|사전예약|사전 예약|발표|공개|업데이트|패치|콜라보|이벤트|일정|중단|확정|출시일|정식|소식|근황|생중계|응모/],
  ['정리·모음형', /총정리|정리|가이드|모음|링크|사이트/],
];
const ANGLES = LADDER.map((x) => x[0]).concat(['기타']);
function classify(t) { for (const [n, re] of LADDER) if (re.test(t)) return n; return '기타'; }
function isNav(t) { return NAV.test(t); }
/* 발주 후보 = 이동형이 아니고 + 그 작성자(who 생략 시 아무나)의 기존 글이 없는 질의 */
function isOpen(q, who) {
  if (q.nav) return false;
  const c = q.covered || {};
  return who ? !(c[who] || []).length : !Object.values(c).some((a) => a.length);
}
function normKey(s) { return String(s).toLowerCase().replace(/[\s·:：\-—–_'"’”“(){}\[\]!?.,]/g, ''); }
/* ★게임명이 «낱말로» 들어 있나 — 단순 포함 판정은 «애니모»가 «애니모션텍»(전혀 다른 회사)을 끌어온다(2026-09-13 실측).
   ⛔공백을 지운 뒤 판정하면 안 된다 — 그러면 «애니모 출시일»도 «애니모+출»로 붙어 전부 탈락한다(같은 날 2차 실측).
   그래서 «글자 사이 공백 허용 + 뒤에 한글이 붙으면 탈락» 으로 원문에서 본다(게임명 자체의 공백 표기 차이도 함께 흡수). */
function gameRe(game) {
  const chars = String(game).trim().split('').filter((c) => !/\s/.test(c))
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(chars.join('\\s*') + '(?![가-힣])', 'i');
}
function mentionsGame(q, game) { return gameRe(game).test(String(q)); }
function sleep(ms) { return ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve(); }

let capHit = false;
async function ac(q) {
  if (reqCount >= MAXREQ) { capHit = true; return []; }
  reqCount++;
  const url = 'https://ac.search.naver.com/nx/ac?q=' + encodeURIComponent(q)
    + '&st=100&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&q_enc=UTF-8&frm=nv';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Referer': 'https://search.naver.com/', 'Accept': '*/*' } });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    const j = JSON.parse(await r.text());
    const rows = (j && Array.isArray(j.items) ? j.items : []).flat();
    return rows.map((row) => (Array.isArray(row) ? row[0] : row)).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  } catch (e) { return []; } finally { clearTimeout(t); }
}

async function mine(game) {
  const seen = new Map();                       /* normKey → 표시용 질의 */
  const put = (q, depth) => {
    const k = normKey(q);
    if (!k || seen.has(k)) return;
    if (!mentionsGame(q, game)) return;         /* 게임과 무관한 자동완성(브랜드·오타 분기)은 버린다 */
    seen.set(k, { q, depth });
  };
  const base = await ac(game);
  base.forEach((q) => put(q, 1));
  await sleep(GAP);
  for (const sfx of SUFFIX) {
    (await ac(game + ' ' + sfx)).forEach((q) => put(q, 1));
    await sleep(GAP);
  }
  if (DEEP) {
    const round1 = [...seen.values()].map((x) => x.q).slice(0, 40);
    for (const q of round1) {
      (await ac(q + ' ')).forEach((r) => put(r, 2));
      await sleep(GAP);
    }
  }
  return [...seen.values()];
}

/* ── 원장 대조 ──────────────────────────────────────────────────────────── */
function readLedger() { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) { return null; } }

function coverage(ledger, game, q) {
  const out = {};
  if (!ledger || !Array.isArray(ledger.writers)) return out;
  const gk = normKey(game);
  /* 질의에서 게임명을 뺀 «남은 말» — 이게 전부 제목에 있으면 그 각도를 이미 다뤘다고 본다 */
  const restRaw = String(q).replace(new RegExp(game.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  const terms = restRaw.split(/\s+/).map((s) => normKey(s)).filter((s) => s.length >= 2);
  ledger.writers.forEach((w) => {
    const same = w.posts.filter((p) => (p.g && normKey(p.g) === gk) || normKey(p.t).includes(gk));
    if (!same.length) { out[w.name] = []; return; }
    if (!terms.length) { out[w.name] = same.slice(0, 3).map((p) => p.n); return; }
    out[w.name] = same.filter((p) => { const k = normKey(p.t); return terms.every((t) => k.includes(t)); })
      .slice(0, 3).map((p) => p.n);
  });
  return out;
}

/* ── 시드 ───────────────────────────────────────────────────────────────── */
async function seedGames() {
  const one = val('--game', null);
  if (one) return [one];
  if (has('--pins')) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(API + '/pins?ts=' + Date.now(), { signal: ctl.signal });
      clearTimeout(t);
      const j = await r.json();
      const g = (j && Array.isArray(j.games)) ? j.games.filter(Boolean) : [];
      if (g.length) return g;
      console.error('지정 게임 0종 — 시드가 없다.');
      return [];
    } catch (e) { console.error('/pins 조회 실패: ' + e.message); return []; }
  }
  if (has('--from-ledger')) {
    const l = readLedger();
    if (!l) { console.error('원장이 없다. 먼저: node _tools/live-ledger.cjs --full'); return []; }
    const top = Math.max(1, parseInt(val('--top', '10'), 10) || 10);
    const days = parseInt(val('--days', '180'), 10) || 180;
    const today = Date.now();
    const cnt = {};
    l.writers.forEach((w) => w.posts.forEach((p) => {
      if (!p.g || !p.d) return;
      if ((today - Date.parse(p.d + 'T00:00:00+09:00')) / 86400000 > days) return;
      cnt[p.g] = (cnt[p.g] || 0) + 1;
    }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, top).map(([g]) => g);
  }
  console.error('시드를 정해야 한다: --game <게임> | --pins | --from-ledger');
  return [];
}

/* ── 출력 ───────────────────────────────────────────────────────────────── */
function readPrev() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; } }

function printGame(g) {
  const open = g.queries.filter((q) => isOpen(q));
  const nav = g.queries.filter((q) => q.nav).length;
  console.log('\n' + g.game + ' — 질의 ' + g.queries.length + '개 · 발주 후보 ' + open.length + '개 · 이동형 제외 ' + nav + '개');
  const byA = {};
  g.queries.forEach((q) => { (byA[q.angle] = byA[q.angle] || []).push(q); });
  ANGLES.filter((a) => byA[a]).forEach((a) => {
    const hit = byA[a].filter((q) => Object.values(q.covered || {}).some((x) => x.length)).length;
    console.log('  [' + a + '] ' + byA[a].length + '개 (우리 글 있음 ' + hit + ')');
    byA[a].slice(0, 8).forEach((q) => {
      const who = Object.entries(q.covered || {}).filter(([, v]) => v.length).map(([k]) => k);
      const mark = who.length ? '·' : (q.nav ? '–' : '★');
      const tail = who.length ? '   (' + who.join(',') + ' 기존글)' : (q.nav ? '   (이동형)' : '');
      console.log('     ' + mark + ' ' + q.q + tail);
    });
  });
  console.log('  ★ = 발주 후보(우리 글 없음) · · = 기존글 있음 · – = 이동형(글로 못 먹는 질의)');
}

async function main() {
  if (has('--open')) {
    const prev = readPrev();
    if (!prev) { console.error('저장된 질의가 없다. 먼저 수집하라.'); process.exit(2); }
    const who = val('--writer', null);
    prev.games.forEach((g) => {
      const open = g.queries.filter((q) => isOpen(q, who));
      if (!open.length) return;
      console.log('\n' + g.game + ' — ' + (who ? who + ' ' : '') + '빈 질의 ' + open.length);
      open.slice(0, 20).forEach((q) => console.log('  [' + q.angle + '] ' + q.q));
    });
    return;
  }

  const games = await seedGames();
  if (!games.length) process.exit(0);
  const ledger = readLedger();
  if (!ledger) console.error('⚠ 원장이 없어 «우리 글 유무» 대조를 건너뛴다(질의만 모은다).');

  const prev = readPrev();
  const keep = new Map();
  if (prev && Array.isArray(prev.games)) prev.games.forEach((g) => keep.set(g.game, g));

  for (const game of games) {
    capHit = false;
    const list = await mine(game);
    if (!list.length) { console.error('⚠ ' + game + ' — 자동완성 0건(지난 판 보존)'); continue; }
    /* ★요청 상한에 걸려 덜 돈 회차가 «더 적은 결과»로 저장본을 덮어쓰지 않게 한다(2026-09-14 QA 발견).
       상한은 예의(네이버 부하)를 위한 것이지 «데이터를 줄이라»는 뜻이 아니다. */
    const prev = keep.get(game);
    if (capHit && prev && prev.count > list.length) {
      console.error('⚠ ' + game + ' — 요청 상한(' + MAXREQ + ')에 걸려 ' + list.length + '건만 모았다 → 지난 판 ' + prev.count + '건 보존');
      continue;
    }
    keep.set(game, {
      game, minedAt: new Date().toISOString(), count: list.length, partial: capHit || undefined,
      queries: list.map((x) => ({ q: x.q, depth: x.depth, angle: classify(x.q), nav: isNav(x.q), covered: coverage(ledger, game, x.q) })),
    });
    console.error('  ' + game + ' — 질의 ' + list.length + '개');
  }

  const doc = {
    schema: 1, kind: 'search-query-candidates', updated: new Date().toISOString(),
    source: 'ac.search.naver.com/nx/ac (자동완성 · 순서만 제공, 검색량 아님)',
    suffixes: SUFFIX, angles: ANGLES, requests: reqCount,
    games: [...keep.values()].sort((a, b) => String(a.game).localeCompare(b.game, 'ko')),
  };
  try { fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n', 'utf8'); }
  catch (e) { console.error('저장 실패: ' + e.message); process.exit(1); }

  if (has('--aib')) {
    const picks = [];
    games.forEach((gn) => {
      const g = keep.get(gn); if (!g) return;
      g.queries.filter((q) => isOpen(q))
        .slice(0, 10).forEach((q, i) => picks.push({ id: gn + '-' + (i + 1), q: q.q }));
    });
    console.log(JSON.stringify(picks, null, 2));
    console.error('\n→ 저장: ' + path.relative(ROOT, OUT) + ' · 위 JSON 을 aib-check.py --file 에 넣는다');
    return;
  }
  if (has('--print')) games.forEach((gn) => { const g = keep.get(gn); if (g) printGame(g); });
  console.error('\n→ ' + path.relative(ROOT, OUT) + ' (요청 ' + reqCount + '회)');
}

main().catch((e) => { console.error('실패: ' + (e && e.stack ? e.stack : e)); process.exit(0); });
