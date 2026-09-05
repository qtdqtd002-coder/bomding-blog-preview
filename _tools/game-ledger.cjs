#!/usr/bin/env node
/* ============================================================================
   game-ledger.cjs — 게임별 «발행 원장» 자동 생성 (2026-09-05 신설)

   왜 만들었나
     롤토체스·애니모 같은 중장기 게임은 글이 수십 편으로 쌓인다. 「이 게임으로 지금까지 뭘 썼고,
     언제 썼고, 어느 게 실제로 블로그에 올라갔나」를 사람이 posts.json 을 뒤져 세면 매번 다르고
     (실측: 롤토체스가 «12편»·«13편»·«14편»으로 세 번 다르게 보고됐다), 폴더가 흩어져 있으면 아예 못 센다.
     → 별칭 색인(_glossary/_aliases.json)으로 게임을 묶고, posts.json(created)·published.json 에서
       **결정론적으로** 원장을 뽑아 그 게임의 지식 공간(_glossary/<space>/posts.md)에 «일자별»로 둔다.

   무엇을
     게임마다: 등록일 오름차순 표(등록일 · 작성자 · 제목 · 경로 · 실게시) + 작성자별·월별 집계.
     «실게시» = published.json(작성자 실블로그 제목 대조 자동 확인). 수동 표시(/mpub)는 백엔드에 있어
     여기선 안 본다(오프라인·LLM 0 원칙 — 필요하면 --mpub 로 한 번 받아 합친다).

   쓰는 법
     node _tools/game-ledger.cjs --all              # 별칭 색인의 space 가 있는 게임 전부
     node _tools/game-ledger.cjs --game 롤토체스     # 한 게임
     node _tools/game-ledger.cjs --all --mpub        # 백엔드 /mpub 수동 발행완료도 «실게시»에 합산
     node _tools/game-ledger.cjs --all --print       # 표를 stdout 에도 찍는다
   종료  0 = 정상 / 1 = 입력 없음·파싱 실패
   실행 주체  maintenance/daily-refresh.cjs(매일 04:20, LLM 0) + 발행 회차 뒤 수동.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');                      // BlogPreview
const CLAUDE = path.dirname(ROOT);                               // Desktop\Claude
const GLOSSARY = path.join(CLAUDE, '_glossary');
const ALIASES = path.join(GLOSSARY, '_aliases.json');
const API = process.env.SSEUDAM_API || 'https://34.139.184.70.sslip.io';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[\s·:\-_,.'"()[\]/!?~]/g, '')
    .replace(/[^\p{Script=Hangul}\p{L}\p{N}]/gu, '');
}
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch { return fallback; }
}
const KST = (d) => {
  const t = new Date(d.getTime() + 9 * 3600 * 1000), p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
};

/* 글 → 게임 판정. core-games.cjs·glossary-lint.py 와 같은 규칙:
   ⑴ 폴더(group)가 canon·aliases·folders 중 하나와 정규화 일치
   ⑵ 평면 저장(옛 09-04 꼴) 구제 — 원문이 «별칭 + 공백»으로 시작 */
function matcherFor(g) {
  const names = [...new Set([g.canon, ...(g.aliases || []), ...(g.folders || [])])].filter(Boolean);
  const keys = new Set(names.map(norm).filter(Boolean));
  const prefixes = names.filter((n) => String(n).length >= 3).map((n) => String(n) + ' ');
  return (post) => {
    const grp = String(post.group || '');
    if (keys.has(norm(grp))) return true;
    return prefixes.some((p) => grp.startsWith(p));
  };
}

async function fetchMpub() {
  try {
    const r = await fetch(API + '/mpub', { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return new Set();
    const d = await r.json();
    return new Set((d && d.rels) || []);
  } catch { return new Set(); }
}

function render(g, rows, mpubSet, generatedAt) {
  const byWriter = {}, byMonth = {};
  for (const r of rows) {
    byWriter[r.author] = (byWriter[r.author] || 0) + 1;
    const m = r.created.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
  }
  const live = rows.filter((r) => r.live).length;
  const L = [];
  L.push(`# ${g.canon} — 발행 원장 (자동 생성 · 손으로 고치지 말 것)`);
  L.push('');
  L.push(`- 생성 ${generatedAt} KST · 도구 \`BlogPreview/_tools/game-ledger.cjs\` · 원천 \`posts.json\`(등록일=created)·\`published.json\`${mpubSet ? '·백엔드 /mpub' : ''} · 게임 판정 \`_glossary/_aliases.json\``);
  L.push(`- **${rows.length}편** — ${Object.entries(byWriter).map(([w, n]) => `${w} ${n}`).join(' · ') || '없음'} · 실게시 확인 **${live}편**`);
  L.push(`- 월별: ${Object.entries(byMonth).sort().map(([m, n]) => `${m} ${n}편`).join(' · ') || '-'}`);
  L.push('- 등록일 = 그 경로가 처음 커밋된 시각(폴더 이동 글은 `_moves.json` 으로 옛 경로 기준 보존). 실게시 = 작성자 실블로그에서 제목이 확인된 글(수동 표시 포함 시 ✓m).');
  L.push('- 지식(사실·명칭·교훈)은 이 표가 아니라 같은 폴더 `log/YYYY-MM-DD.md` 와 정본 `../' + (g.glossary || '') + '` 에 쌓인다.');
  L.push('');
  L.push('| 등록일 | 작성자 | 제목 | 경로 | 실게시 |');
  L.push('|---|---|---|---|---|');
  for (const r of rows) {
    const dir = r.rel.split('/').slice(0, -1).join('/') + '/';
    L.push(`| ${r.created.slice(0, 10)} | ${r.author} | ${r.title.replace(/\|/g, '｜')} | \`${dir}\` | ${r.live ? (r.liveKind === 'm' ? '✓m' : '✓') : '-'} |`);
  }
  L.push('');
  return L.join('\n') + '\n';
}

(async () => {
  const idx = readJSON(ALIASES, null);
  if (!idx || !Array.isArray(idx.games)) { console.error('[game-ledger] _aliases.json 을 읽지 못했습니다: ' + ALIASES); process.exit(1); }
  const posts = readJSON(path.join(ROOT, 'posts.json'), null);
  if (!Array.isArray(posts) || posts.length === 0) { console.error('[game-ledger] posts.json 이 비었거나 없습니다.'); process.exit(1); }
  const pub = readJSON(path.join(ROOT, 'published.json'), {});
  const pubSet = new Set((pub && pub.publishedRels) || []);
  const mpubSet = has('--mpub') ? await fetchMpub() : null;

  const want = argOf('--game', null);
  let games = idx.games.filter((g) => g.space || g.glossary);
  if (want) games = games.filter((g) => norm(g.canon) === norm(want) || (g.aliases || []).some((a) => norm(a) === norm(want)));
  if (!games.length) { console.error('[game-ledger] 대상 게임이 없습니다(별칭 색인에 space/glossary 가 있어야 합니다).'); process.exit(1); }

  const generatedAt = KST(new Date());
  const summary = [];
  for (const g of games) {
    const space = g.space || String(g.glossary || '').replace(/\.md$/, '');
    if (!space) continue;
    const isMine = matcherFor(g);
    const rows = posts.filter((p) => p && p.rel && isMine(p)).map((p) => ({
      created: String(p.created || ''), author: p.author || '', title: p.title || '', rel: p.rel,
      live: pubSet.has(p.rel) || !!(mpubSet && mpubSet.has(p.rel)),
      liveKind: pubSet.has(p.rel) ? 'a' : (mpubSet && mpubSet.has(p.rel) ? 'm' : ''),
    })).sort((a, b) => a.created.localeCompare(b.created) || a.rel.localeCompare(b.rel, 'ko'));
    const dir = path.join(GLOSSARY, space);
    fs.mkdirSync(path.join(dir, 'log'), { recursive: true });
    const out = path.join(dir, 'posts.md');
    const md = render(g, rows, mpubSet, generatedAt);
    fs.writeFileSync(out, md, 'utf8');
    summary.push(`${g.canon}: ${rows.length}편(실게시 ${rows.filter((r) => r.live).length}) → ${path.relative(CLAUDE, out)}`);
    if (has('--print')) process.stdout.write(md + '\n');
  }
  console.log('[game-ledger] ' + summary.join(' | '));
})();
