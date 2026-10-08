#!/usr/bin/env node
/* ============================================================================
   game-sources.cjs — 게임별 «지정 우선 출처» 조회 (2026-10-08 신설 · LLM 0)

   왜 있나
     사용자 지정(10-08): «도깨비의세계 글은 깨비지지(kkaebigg.com)를 우선적으로 참고».
     롤토체스(롤체지지)·애니모(questlog)처럼 게임마다 먼저 볼 곳이 생기는데, 그걸 프롬프트 문장으로만 두면
     집필 조사와 트렌드 추천 조사가 서로 다른 곳을 본다. → 원장 한 벌(`_trend/_game-sources.json`)을 두고
     집필·데스크·preflight 가 같은 파일을 읽는다.

   쓰는 법
     node _tools/game-sources.cjs                 # 등재된 게임 전부
     node _tools/game-sources.cjs 도깨비의세계     # 그 게임의 우선 출처·공식 출처·규칙(조사 시작 전에 본다)
     node _tools/game-sources.cjs 도깨비의세계 --json
   모듈  const gs = require('./game-sources.cjs');
         gs.sourcesFor('도깨비의 세계')            → 원장 항목 | null  (공백·대소문자 무시, aliases 포함)
         gs.citesPriority(['https://kkaebigg.com/…'], entry) → true/false
         gs.topicHits('도술 조합 추천', entry)      → ['도술','조합','추천']
   종료  0 = 정상 / 1 = 원장을 못 읽음 / 2 = 그런 게임 없음
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '_trend', '_game-sources.json');

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '')); } catch (e) { cache = { games: [] }; }
  if (!Array.isArray(cache.games)) cache.games = [];
  return cache;
}

function sourcesFor(game) {
  const k = norm(game);
  if (!k) return null;
  return load().games.find((g) => [g.game, ...(g.aliases || [])].some((n) => norm(n) === k)) || null;
}

function hostOf(u) {
  const m = String(u || '').trim().match(/^https?:\/\/([^/:?#]+)/i);
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}

/* sources: 문자열 URL 또는 {url} 객체 배열(조사원 후보·trend-lite 둘 다 받는다) */
function citesPriority(sources, entry) {
  if (!entry || !Array.isArray(sources)) return false;
  const hosts = (entry.priority || []).map((p) => String(p.host || '').toLowerCase()).filter(Boolean);
  return sources.some((s) => {
    const h = hostOf(typeof s === 'string' ? s : (s && s.url));
    return h && hosts.some((w) => h === w || h.endsWith('.' + w));
  });
}

function topicHits(text, entry) {
  const t = norm(text);
  return entry ? (entry.topicKeywords || []).filter((kw) => t.includes(norm(kw))) : [];
}

function brief(entry) {
  return (entry.priority || []).map((p) => ({ label: p.label, url: p.url, host: p.host }));
}

function printEntry(g) {
  console.log('■ ' + g.game + (g.designatedBy ? '  — ' + g.designatedBy : ''));
  (g.priority || []).forEach((p, i) => {
    console.log('  우선 ' + (i + 1) + '. ' + p.label + ' ' + p.url + (p.kind ? ' · ' + p.kind : ''));
    if (p.covers && p.covers.length) console.log('       다루는 것: ' + p.covers.join(' · '));
    if (p.facts) console.log('       ' + p.facts);
    if (p.verified) console.log('       확인: ' + p.verified);
  });
  if (g.official && g.official.length) console.log('  공식: ' + g.official.map((o) => o.label + ' ' + o.url).join(' · '));
  (g.rules || []).forEach((r) => console.log('  - ' + r));
}

module.exports = { load, sourcesFor, citesPriority, topicHits, brief, hostOf, FILE };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const name = argv.filter((a) => !a.startsWith('--')).join(' ');
  const data = load();
  if (!data.games.length) { console.error('원장을 못 읽었다(또는 비었다): ' + FILE); process.exit(1); }
  if (!name) {
    if (asJson) { console.log(JSON.stringify(data, null, 2)); process.exit(0); }
    data.games.forEach(printEntry);
    process.exit(0);
  }
  const g = sourcesFor(name);
  if (!g) { console.error('등재 안 된 게임: ' + name + ' — 등재 = ' + data.games.map((x) => x.game).join(', ')); process.exit(2); }
  if (asJson) console.log(JSON.stringify(g, null, 2)); else printEntry(g);
}
