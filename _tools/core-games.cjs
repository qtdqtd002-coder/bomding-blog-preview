#!/usr/bin/env node
/* ============================================================================
   core-games.cjs — 「주로 다루는 게임」 자동 산출 (2026-08-14 신설)

   왜 만들었나
     일간 토픽 데스크의 첫 분류 '주로 다루는 게임'은 **봄딩·영도가 실제로 계속 쓰는 게임**이어야 한다.
     그걸 사람 기억이나 LLM 눈대중으로 정하면 매일 흔들리고, 한 달 전에 접은 게임이 계속 올라온다.
     → 실제 발행 데이터(posts.json · published.json · _live-titles.json)에서 **결정론적으로** 뽑는다.

   무엇을
     작성자별로 게임(=글 폴더의 group)을 최근성 가중 점수로 세워 상위 N개를 고른다.
       최근 30일 글 ×3 · 31~90일 ×2 · 91~180일 ×1 · 그 이상 0
       + 실제 라이브 발행분(published)에 ×1.25 가산 — 초안만 쌓인 게임은 '주로 다루는'이 아니다.
     별칭(공백·중점 표기차)은 정규화해 합치고, 비게임 폴더(게이밍기어·소식지 등)는 제외한다.
     ★서로 다른 게임인 동일 프랜차이즈(메이플플래닛/메이플랜드/메이플스토리)는 **합치지 않는다.**

   출력  _trend/_core-games.json
     { updated, window, writers:{ <작성자>:[{game, score, posts, recent30, recent90, published, last, aliases[]}] },
       combined:[ {game, writers:[...], score, ...} ] }

   실행  node _tools/core-games.cjs            # 기본: 작성자별 상위 12, combined 상위 20
         node _tools/core-games.cjs --print    # 사람이 보는 표도 같이
   종료  0 = 정상 / 1 = 입력 파일 없음·파싱 실패
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_core-games.json');

/* 대상 = 현역 게임 작성자. 하루살이는 IT라 게임 데스크 대상이 아니고,
   겜더쿠·연봄은 2026-08-14 휴면이라 뺀다(정본 = 쓰담v2/canon/config.json writers.inactive). */
const WRITERS = ['봄딩', '영도'];

/* 게임이 아닌 글 폴더 — '주로 다루는 게임'에 섞이면 안 된다. 정규화된 키로 비교. */
const NOT_GAMES = new Set([
  '게이밍기어', '기어', '소식지', '공지', '기타', '잡담', '블로그',
  '육아', '육아템', '취미', '굿즈', '맛집', '여행', '생활',
].map(norm));

/* 표기가 갈렸을 뿐 같은 게임인 것만 수동 병합(정규화로 안 붙는 경우).
   ★다른 게임을 합치지 않도록 보수적으로만 등재한다. */
const ALIAS = new Map(Object.entries({
  '영원한도시': '이환',
  '영원한 도시': '이환',
  '이환영원한도시': '이환',
}).map(([k, v]) => [norm(k), v]));

const NOW = process.env.CORE_GAMES_TODAY || new Date().toISOString().slice(0, 10);

function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[\s·:\-_,.'"()[\]/]/g, '')
    .replace(/[^\p{Script=Hangul}\p{L}\p{N}]/gu, '');
}
function daysAgo(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 99999;
  return Math.round((Date.parse(NOW + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 86400000);
}
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch (e) { return fallback; }
}

const posts = readJSON(path.join(ROOT, 'posts.json'), null);
if (!Array.isArray(posts)) { console.error('[core-games] posts.json 을 읽지 못했습니다.'); process.exit(1); }
const pubRels = new Set((readJSON(path.join(ROOT, 'published.json'), {}) || {}).publishedRels || []);

const result = { updated: NOW, window: '최근 180일(30/90일 가중)', writers: {}, combined: [] };
const combinedMap = new Map();

for (const w of WRITERS) {
  const agg = new Map();   // normKey -> record
  for (const p of posts) {
    if (p.author !== w || !p.group) continue;
    const key = ALIAS.get(norm(p.group)) ? norm(ALIAS.get(norm(p.group))) : norm(p.group);
    if (!key || NOT_GAMES.has(key)) continue;
    const age = daysAgo(p.created || p.updated);
    if (age > 180) continue;

    if (!agg.has(key)) {
      agg.set(key, { game: ALIAS.get(norm(p.group)) || p.group, score: 0, posts: 0,
                     recent30: 0, recent90: 0, published: 0, last: '', aliases: new Set() });
    }
    const a = agg.get(key);
    a.aliases.add(p.group);
    a.posts++;
    if (age <= 30) a.recent30++;
    if (age <= 90) a.recent90++;
    const live = p.published === true || pubRels.has(p.rel);
    if (live) a.published++;
    const d = String(p.created || p.updated || '').slice(0, 10);
    if (d > a.last) a.last = d;
    /* 최근성 가중 + 라이브 가산 */
    const base = age <= 30 ? 3 : age <= 90 ? 2 : 1;
    a.score += base * (live ? 1.25 : 1);
    /* 표기 대표는 '가장 최근에 쓴 표기'로 — 최신 표기를 따라간다 */
    if (d === a.last) a.game = ALIAS.get(norm(p.group)) || p.group;
  }

  const list = [...agg.values()]
    .filter(a => a.posts >= 2)                    /* 1편짜리는 '주로 다루는'이 아니다 */
    .map(a => ({ ...a, score: Math.round(a.score * 100) / 100, aliases: [...a.aliases].sort() }))
    .sort((x, y) => y.score - x.score || y.recent30 - x.recent30 || (x.last < y.last ? 1 : -1))
    .slice(0, 12);

  result.writers[w] = list;
  for (const a of list) {
    const k = norm(a.game);
    if (!combinedMap.has(k)) combinedMap.set(k, { game: a.game, writers: [], score: 0, posts: 0, recent30: 0, recent90: 0, published: 0, last: '' });
    const c = combinedMap.get(k);
    c.writers.push(w); c.score += a.score; c.posts += a.posts;
    c.recent30 += a.recent30; c.recent90 += a.recent90; c.published += a.published;
    if (a.last > c.last) c.last = a.last;
  }
}

result.combined = [...combinedMap.values()]
  .map(c => ({ ...c, score: Math.round(c.score * 100) / 100 }))
  .sort((x, y) => y.score - x.score || (x.last < y.last ? 1 : -1))
  .slice(0, 20);

/* ── balanced: 데스크 '주로 다루는 게임' 10칸에 실제로 넣을 목록 ──
   단순 점수 통합은 글 수가 많은 쪽(봄딩 267편 vs 영도 75편)이 10칸을 거의 독식한다.
   → **작성자별 목록에서 번갈아 뽑는다.** 한쪽이 소진되면 남은 쪽이 나머지를 채운다.
   결과적으로 두 블로그가 대략 반씩 들어가고, 각 블로그 안에서는 점수 순서가 지켜진다.
   ★이 배열이 데스크가 읽는 정본이다 — 스킬은 여기서 게임을 고르고 그 게임의 '오늘 소식'을 조사한다. */
const CORE_SLOTS = Number(process.env.CORE_GAMES_SLOTS || 10);
{
  const queues = WRITERS.map(w => ({ w, q: (result.writers[w] || []).slice() }));
  const picked = [];
  const seen = new Set();
  while (picked.length < CORE_SLOTS && queues.some(x => x.q.length)) {
    for (const x of queues) {
      if (picked.length >= CORE_SLOTS) break;
      const a = x.q.shift();
      if (!a) continue;
      const k = norm(a.game);
      if (seen.has(k)) { continue; }
      seen.add(k);
      picked.push({ game: a.game, writer: x.w, score: a.score, posts: a.posts,
                    recent30: a.recent30, published: a.published, last: a.last });
    }
  }
  result.balanced = picked;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('[core-games] wrote ' + path.relative(ROOT, OUT) +
            ' — ' + WRITERS.map(w => w + ' ' + result.writers[w].length).join(' · ') +
            ' · combined ' + result.combined.length + ' (기준일 ' + NOW + ')');

if (process.argv.includes('--print')) {
  for (const w of WRITERS) {
    console.log('\n── ' + w + ' 주로 다루는 게임 ──');
    result.writers[w].forEach((a, i) => console.log(
      String(i + 1).padStart(2) + '. ' + a.game.padEnd(24) +
      ' score ' + String(a.score).padStart(6) + ' | 글 ' + String(a.posts).padStart(2) +
      ' (30일 ' + a.recent30 + ' / 90일 ' + a.recent90 + ') 라이브 ' + a.published + ' | 최종 ' + a.last +
      (a.aliases.length > 1 ? ' | 별칭 ' + a.aliases.join('=') : '')));
  }
  console.log('\n── 통합(두 블로그 합산) ──');
  result.combined.forEach((c, i) => console.log(
    String(i + 1).padStart(2) + '. ' + c.game.padEnd(24) + ' score ' + String(c.score).padStart(6) +
    ' | ' + c.writers.join('+') + ' | 글 ' + c.posts + ' | 최종 ' + c.last));
  console.log('\n── ★balanced (데스크 「주로 다루는 게임」 ' + CORE_SLOTS + '칸 · 작성자 교대) ──');
  result.balanced.forEach((c, i) => console.log(
    String(i + 1).padStart(2) + '. ' + c.game.padEnd(24) + ' [' + c.writer + '] score ' +
    String(c.score).padStart(6) + ' | 글 ' + c.posts + ' | 최종 ' + c.last));
}
