#!/usr/bin/env node
/* ============================================================================
   desk-mix.cjs — 데스크 «주제 비중» 로그 → _trend/_desk-mix.json   (2026-09-18 신설 · LLM 0)

   왜 있나
     2026-09-13 에 «뉴스형 ≤10% · 공략형 ≥50%» 목표를 세우고 2주 뒤 판정하기로 했지만, 그 수치를 보는 자리가
     CLI(angle-mix.py) 뿐이라 5일 동안 아무도 안 봤고 그사이 우리 초안의 뉴스형은 34.7% → 46.2% 로 더 나빠졌다.
     원인은 공급(데스크 추천)이었는데 공급 쪽 비중은 어디에도 기록되지 않았다(2026-09-18 검토 §3).
     이 도구가 «추천 → 발주 → 작성 글» 세 단계의 각도 비중과 분류별 발주율을 매일 한 파일에 남긴다.
     홈 「주제 비중」 타일이 이 파일만 읽는다(사이트는 네이버·백엔드를 직접 계산하지 않는다).

   무엇을 재나
     supply  최근 7판 게임 항목(pinned·core·guide·new·update·hot)의 angleType 비중. angleType 이 없는 옛 판은
             angle-mix 사다리(제목 정규식)로 대신 센다 — 몇 건을 정규식으로 셌는지 regex 에 남긴다.
     orders  최근 14일 데스크 경유 발주(백엔드 /requests · source=trend-desk)의 각도 비중. 발주 제목을 그 날 데스크 항목과
             맞춰 angleType·분류를 가져온다(못 맞추면 정규식). ★백엔드를 못 읽으면 null — 0 으로 위장하지 않는다.
     drafts  최근 14일 봄딩·영도 초안(posts.json) 중 게임 글의 제목 각도. 육아·임신·출산·취미 분류는 뺀다(게임 레인 지표).
     secRate 최근 14일 분류별 «추천 → 발주» 비율(2026-09-18 거둬내기 W6 의 검증 지표 — 거둬낸 뒤 이 값이 안 오르면 기준이 틀린 것).
     days    판마다 한 행(건수·분류별 건수·각도 비중) — 14판.
     followup 발행 후 D+7·D+14 AI 브리핑 재검 요약(_trend/_aib-followup.json · aib-followup.cjs 가 굽는다). 없으면 null.
              byAngle·bySec = 글마다 가장 늦은 재검(D+14 > D+7) 기준 «브리핑 뜸 %·우리 인용 %»(계획서 W4-1 «분류·각도별 진입률»).
              각도 = 글 제목(사다리) · 분류 = aib-followup 이 등록 때 박은 발주 경로(데스크 칸 · direct · briefing · desk? · 없으면 unknown).

   각도 4갈래 = howto(공략·방법·얻는 법·쿠폰) · rank(티어·추천·비교) · news(출시·일정·발표·결과) · info(정리·후기·기타)
   ★깊이 3갈래(2026-09-21) = play(하는 사람의 질의) · entry(설치·가입·하는 법 — 아직 안 하는 사람) · news. 각 막대의 `depth` 에 % 로 싣는다.
   목표선 = howto+rank ≥ 50%(2026-09-18 계획서 §W4 1차 관문 — 봄딩 P1 «공략·방법·쿠폰형 ≥50%»와 같은 방향).

   사용: node _tools/desk-mix.cjs [--offline] [--print]
         --print = 계산해 찍기만 하고 파일은 쓰지 않는다(월 1회 «캡처의 날»에 재검 각도별·분류별 표를 보고할 때).
         데스크 [E] 에서 stamp 뒤·커밋 앞에 돈다(하루 1회). 멱등 — 같은 날 다시 돌리면 같은 값으로 덮어쓴다.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { angleOf, angleTypeOf, getRequests, depthOf } = require('./desk-signals.cjs');

const ROOT = path.resolve(__dirname, '..');
const TREND = path.join(ROOT, '_trend', 'trend.json');
const POSTS = path.join(ROOT, 'posts.json');
const OUT = path.join(ROOT, '_trend', '_desk-mix.json');
const FOLLOW = path.join(ROOT, '_trend', '_aib-followup.json');
const GAME_SECS = ['pinned', 'core', 'guide', 'new', 'update', 'hot'];
const WRITERS = ['봄딩', '영도'];
const NOT_GAME = /육아|임신|출산|취미/;
const DAY = 86400e3;

const argv = process.argv.slice(2);
const OFFLINE = argv.includes('--offline');
const PRINT = argv.includes('--print');
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return d; } }
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const kst = (ts) => new Date(ts + 9 * 3600e3).toISOString().slice(0, 10);
const today = kst(Date.now());
const since = (days) => kst(Date.now() - (days - 1) * DAY);
function empty() { return { howto: 0, rank: 0, news: 0, info: 0 }; }
/* ★깊이(2026-09-21 · 사용자 «회원가입·설치·하는 법은 너무 기초다») — 각도만으로는 «하는 법»도 공략형이라 개선이 안 보인다.
   entry = 아직 안 하는 사람의 질의 · play = 하는 사람의 질의 · news = 발표 그 자체. */
function emptyDepth() { return { play: 0, entry: 0, news: 0 }; }
function pctDepth(d) {
  const n = d.play + d.entry + d.news;
  return { n, play: n ? Math.round(d.play / n * 1000) / 10 : 0, entry: n ? Math.round(d.entry / n * 1000) / 10 : 0, news: n ? Math.round(d.news / n * 1000) / 10 : 0 };
}
function pct(mix) {
  const n = Object.values(mix).reduce((a, b) => a + b, 0);
  const o = { n };
  Object.keys(mix).forEach((k) => { o[k] = n ? Math.round(mix[k] / n * 1000) / 10 : 0; });
  o.guide = n ? Math.round((mix.howto + mix.rank) / n * 1000) / 10 : 0;
  return o;
}

/* 발행 후 재검 요약 — d7·d14 전체 + 글마다 가장 늦은 재검(D+14 > D+7) 기준 각도별·분류별 «브리핑 뜸 %·우리 인용 %» */
function followupSummary(f) {
  if (!f || !f.posts) return null;
  const posts = Object.values(f.posts);
  const sum = { posts: posts.length };
  ['d7', 'd14'].forEach((k) => {
    const rows = posts.map((p) => p[k]).filter((x) => x && Array.isArray(x.res));
    const q = rows.flatMap((x) => x.res);
    sum[k] = { posts: rows.length, queries: q.length, shown: q.filter((x) => x.s === 'shown').length,
      async: q.filter((x) => x.s === 'async').length, none: q.filter((x) => x.s === 'none').length,
      cited: q.filter((x) => x.bd || x.yd).length };
  });
  const byAngle = {}, bySec = {};
  posts.forEach((p) => {
    const last = [p.d14, p.d7].find((x) => x && Array.isArray(x.res));
    if (!last) return;
    [[byAngle, p.title ? angleOf(p.title) : 'unknown'], [bySec, p.sec || 'unknown']].forEach(([m, key]) => {
      const c = m[key] = m[key] || { posts: 0, queries: 0, shown: 0, cited: 0 };
      c.posts++; c.queries += last.res.length;
      c.shown += last.res.filter((x) => x.s === 'shown' || x.s === 'async').length;   /* async = 브리핑은 떴고 출처만 미확인 — 타일·발주 모달과 같은 정의 */
      c.cited += last.res.filter((x) => x.bd || x.yd).length;
    });
  });
  [byAngle, bySec].forEach((m) => Object.values(m).forEach((c) => {
    c.shownRate = c.queries ? Math.round(c.shown / c.queries * 1000) / 10 : null;
    c.citedRate = c.queries ? Math.round(c.cited / c.queries * 1000) / 10 : null;
  }));
  sum.byAngle = byAngle; sum.bySec = bySec;
  sum.updated = f.updated || null;
  return sum;
}

async function main() {
  const doc = readJson(TREND, { editions: [] });
  const eds = (doc.editions || []).filter((e) => e && e.date).sort((a, b) => (a.date < b.date ? 1 : -1));
  const items = [];                       /* {date, sec, it, type, via} */
  eds.forEach((e) => (e.sections || []).forEach((s) => {
    if (!GAME_SECS.includes(s.key)) return;
    (s.items || []).forEach((it) => { if (it && it.title) items.push({ date: e.date, sec: s.key, it, type: angleTypeOf(it), via: it.angleType ? 'desk' : 'regex' }); });
  }));

  /* ── 공급(최근 7판) ── */
  const d7 = eds.slice(0, 7).map((e) => e.date);
  const sup = empty(), supD = emptyDepth(); let supRegex = 0;
  items.filter((x) => d7.includes(x.date)).forEach((x) => { sup[x.type]++; supD[depthOf(x.it)]++; if (x.via === 'regex') supRegex++; });

  /* ── 판별 행(14판) ── */
  const days = eds.slice(0, 14).map((e) => {
    const mix = empty(), secs = {};
    (e.sections || []).forEach((s) => { secs[s.key] = (s.items || []).length; });
    items.filter((x) => x.date === e.date).forEach((x) => { mix[x.type]++; });
    return { d: e.date, n: Object.values(secs).reduce((a, b) => a + b, 0), secs, mix: pct(mix) };
  });

  /* ── 발주(최근 14일) + 분류별 발주율 ── */
  const reqs = OFFLINE ? null : await getRequests();
  let orders = null, secRate = null;
  if (reqs) {
    const from = since(14);
    const byTitle = new Map(items.map((x) => [norm(x.it.title), x]));
    const ord = empty(), ordD = emptyDepth(); let matched = 0, n = 0;
    const ordered = new Set();
    reqs.filter((r) => r && r.source === 'trend-desk' && r.createdAt && kst(r.createdAt) >= from).forEach((r) => {
      n++;
      const hit = byTitle.get(norm(r.topic));
      if (hit) { matched++; ordered.add(hit); ord[hit.type]++; ordD[depthOf(hit.it)]++; }
      else { ord[angleOf(r.topic)]++; ordD[depthOf({ title: r.topic })]++; }
    });
    orders = Object.assign(pct(ord), { matched, depth: pctDepth(ordD) });
    const supplyWin = items.filter((x) => x.date >= from);
    secRate = GAME_SECS.map((sec) => {
      const s = supplyWin.filter((x) => x.sec === sec), o = s.filter((x) => ordered.has(x));
      return { sec, supply: s.length, ordered: o.length, rate: s.length ? Math.round(o.length / s.length * 1000) / 10 : null };
    });
  }

  /* ── 작성 글(최근 14일 · 봄딩·영도 게임 초안) ── */
  const posts = readJson(POSTS, []);
  const from14 = since(14);
  const dr = empty(), drD = emptyDepth(), byW = {};
  WRITERS.forEach((w) => { byW[w] = empty(); });
  (Array.isArray(posts) ? posts : []).forEach((p) => {
    if (!p || !WRITERS.includes(p.author)) return;
    const c = String(p.created || '').slice(0, 10);
    if (!c || c < from14 || NOT_GAME.test(p.cat || '')) return;
    const t = angleOf(p.title);
    dr[t]++; byW[p.author][t]++; drD[depthOf({ title: p.title })]++;
  });
  const drafts = Object.assign(pct(dr), { depth: pctDepth(drD), byWriter: Object.fromEntries(WRITERS.map((w) => [w, pct(byW[w])])) });

  /* ── 발행 후 재검 요약 ── */
  const followup = followupSummary(readJson(FOLLOW, null));

  const out = {
    schema: 1, kind: 'desk-mix', updated: new Date().toISOString(), ruleFrom: '2026-09-19',
    target: { guide: 50 },
    bars: [
      Object.assign({ k: 'supply', label: '트렌드 추천', window: '최근 ' + d7.length + '판', regex: supRegex, depth: pctDepth(supD) }, pct(sup)),
      orders ? Object.assign({ k: 'orders', label: '발주', window: '최근 14일' }, orders) : { k: 'orders', label: '발주', window: '최근 14일', n: null },
      Object.assign({ k: 'drafts', label: '작성 글', window: '최근 14일' }, drafts),
    ],
    secRate, days, followup,
  };
  if (!PRINT) {
    const tmp = OUT + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(out, null, 1) + '\n', 'utf8');
    fs.renameSync(tmp, OUT);
  }

  const line = (b) => b.n == null ? b.label + ' 미연결' : b.label + ' ' + b.n + '건 — 공략·티어 ' + b.guide + '% (공략 ' + b.howto + ' · 티어 ' + b.rank + ' · 소식 ' + b.news + ' · 기타 ' + b.info + ')';
  console.log('desk-mix ' + today + (PRINT ? ' (--print · 파일은 쓰지 않음)' : ' → ' + path.relative(ROOT, OUT)));
  out.bars.forEach((b) => console.log('  ' + line(b)));
  out.bars.forEach((b) => { if (b.depth && b.depth.n) console.log('  깊이 ' + b.label + ': 실전 ' + b.depth.play + '% · 진입 ' + b.depth.entry + '% · 소식 ' + b.depth.news + '%'); });
  if (secRate) console.log('  발주율(14일): ' + secRate.map((s) => s.sec + ' ' + s.ordered + '/' + s.supply).join(' · '));
  if (followup) {
    console.log('  재검: D+7 ' + followup.d7.queries + '질의(인용 ' + followup.d7.cited + ') · D+14 ' + followup.d14.queries + '질의(인용 ' + followup.d14.cited + ')');
    const LBL = { howto: '공략', rank: '티어·추천', news: '소식', info: '기타', unknown: '제목 없음' };
    const row = (m, lbl) => Object.entries(m).map(([k, c]) => (lbl[k] || k) + ' ' + c.posts + '편·' + c.queries + '질의 뜸 ' + c.shownRate + '% 인용 ' + c.citedRate + '%').join(' · ');
    if (Object.keys(followup.byAngle).length) console.log('  재검 각도별(글마다 가장 늦은 재검): ' + row(followup.byAngle, LBL));
    if (Object.keys(followup.bySec).length) console.log('  재검 분류별: ' + row(followup.bySec, {}));
  }
}

module.exports = { followupSummary };
if (require.main === module) main().catch((e) => { console.error('desk-mix 실패: ' + (e && e.stack ? e.stack : e)); process.exit(0); });
