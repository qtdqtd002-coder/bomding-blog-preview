#!/usr/bin/env node
/* ============================================================================
   tier-check.cjs — 「이 게임 티어표, 봄딩이 이미 썼나?」 판정 (2026-08-15 신설)

   왜 만들었나
     일간 토픽 데스크의 '꼭 다룰 게임'은 게임마다 주제 3~5개를 내는데, 사용자 지시로
     **사람들이 많이 보는 티어표·컨텐츠 티어표를 그중에 끼워 넣되, 더 쓸 티어표가 없으면 빼야** 한다.
     그 판정 기준은 **봄딩**이다(사용자 지정).
     "이미 썼나"를 LLM 기억으로 판단하면 ⑴이미 쓴 티어표를 또 발주하거나(자기잠식)
     ⑵아직 안 쓴 축을 "썼겠지"라고 넘겨 기회를 버린다. → 실제 발행 데이터로 결정론 판정한다.

   무엇을 보나
     제목만 보면 오판한다 — 「무릉도장 총정리(랭킹 보상)」·「랭크전 등급 올리기」는 티어표가 아니고,
     반대로 티어표가 본문 표로만 들어간 글은 제목에 안 드러난다.
     → ⑴제목의 강한 신호(티어표·등급표·티어리스트) ⑵본문 HTML 실측 히트수 를 함께 본다.
     나아가 **축(axis)** 까지 뽑는다 — 캐릭터 티어표를 썼다고 '컨텐츠 티어표'까지 쓴 건 아니다.

   실행
     node _tools/tier-check.cjs --games "메이플플래닛,팰월드,이환"
     node _tools/tier-check.cjs --pins                 # 백엔드 GET /pins 의 지정 게임으로
     node _tools/tier-check.cjs --games "팰월드" --json # 기계용 JSON 만
   종료  0 = 정상 / 1 = 입력 없음·파싱 실패
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API = process.env.SSEUDAM_API || 'https://34.139.184.70.sslip.io';

/* 판정 기준 작성자 = 봄딩(사용자 지정). 바꾸려면 --writer 로 넘긴다 — 코드에 박아 두지 않는다. */
const argv = process.argv.slice(2);
const argOf = (name, def) => {
  const i = argv.indexOf(name);
  return (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : def;
};
const WRITER = argOf('--writer', '봄딩');
const JSON_ONLY = argv.includes('--json');

/* ── 신호 정의 ───────────────────────────────────────────────────────────────
   strong = 이 글은 티어표 글이다. weak = 티어를 다루긴 하는데 티어표는 아닐 수 있다.
   ★'랭크전 등급 올리기'류를 strong 에서 걷어내는 게 이 함수의 존재 이유다. */
const STRONG = ['티어표', '등급표', '티어리스트', 'tierlist', '티어정리', '등급정리', '티어순위'];
const WEAK = ['티어', '등급', '최강', '메타정리', '순위'];
/* 티어표가 아닌 문맥 — '랭크 올리기'는 티어표가 아니라 공략이다. */
const NOT_TIER_CTX = ['랭크전', '등급올리기', '티어올리기', '티어빠르게', '승급', '랭킹보상', '주간랭킹', '랭킹시스템'];
/* 축(axis) — 같은 게임이라도 축이 다르면 새 티어표를 쓸 수 있다. */
const AXES = [
  ['캐릭터', ['캐릭터', '유닛', '쿠키', '포켓몬', '팰', '영웅', '무장']],
  ['직업', ['직업', '클래스', '전직']],
  ['컨텐츠', ['컨텐츠', '콘텐츠', '모드', '던전', '레이드', '이벤트']],
  ['보스', ['보스', '레이드보스', '토벌']],
  ['장비', ['장비', '무기', '방어구', '아이템', '템']],
  ['스킬', ['스킬', '특성', '룬', '패시브']],
  ['덱·조합', ['덱', '조합', '파티', '시너지']],
  ['사냥터', ['사냥터', '맵', '스팟', '파밍']],
];

function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[\s·:\-_,.'"()[\]/!?~]/g, '')
    .replace(/[^\p{Script=Hangul}\p{L}\p{N}]/gu, '');
}
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch (e) { return fallback; }
}
/* HTML → 본문 텍스트. script/style 을 먼저 지워야 CSS 클래스명이 본문으로 새지 않는다. */
function htmlText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/* ★본문에서 '티어표'라는 낱말을 세면 안 된다 — 08-15 실측으로 확인한 오탐 두 갈래:
     ⑴ 다른 글을 가리키는 문장("등급 체계는 지난 등급표·티어표 글에서 이미 다뤘으니 생략할게요")
     ⑵ 같은 파일에 미리보기 본문 + #copy 붙여넣기 본문이 함께 들어 있어 모든 히트가 2배로 세진다
   쿠키런 이벤트 글이 이 둘 때문에 히트 12로 '티어표 글'로 오판됐다(실제로는 티어표가 없는 글).
   → 낱말 빈도가 아니라 **구조**를 본다: 소제목(h2~h4)에 있거나, 표 헤더(th)에 있어야 티어표 글이다.
     사람이 "이 글에 티어표가 있나?"를 확인하는 방식과 같다 — 목차를 보고 표를 본다. */
function tierStructure(html) {
  const res = { headings: [], tableHeads: [] };
  const hRe = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = hRe.exec(html))) {
    const t = norm(htmlText(m[2]));
    if (STRONG.some(s => t.includes(s))) res.headings.push(t);
  }
  const tRe = /<table[\s\S]*?<\/table>/gi;
  while ((m = tRe.exec(html))) {
    const tbl = m[0];
    const head = norm(htmlText((tbl.match(/<th[\s\S]*?<\/th>/gi) || []).join(' ') +
                               ' ' + (tbl.match(/<caption[\s\S]*?<\/caption>/i) || [''])[0]));
    if (STRONG.some(s => head.includes(s)) || /티어|등급/.test(head)) res.tableHeads.push(head);
  }
  return res;
}
/* 히트 주변 창(window)에서 축 단어를 찾는다 — '컨텐츠 티어표'와 '캐릭터 티어표'를 가른다. */
function axesAround(normText, marks, win = 14) {
  const found = new Set();
  for (const mk of marks) {
    let i = 0;
    for (;;) {
      const k = normText.indexOf(mk, i); if (k < 0) break;
      const seg = normText.slice(Math.max(0, k - win), k + mk.length + win);
      for (const [axis, words] of AXES) if (words.some(w => seg.includes(w))) found.add(axis);
      i = k + mk.length;
    }
  }
  return [...found];
}

async function resolveGames() {
  const inline = argOf('--games', '');
  if (inline) return inline.split(',').map(s => s.trim()).filter(Boolean);
  if (argv.includes('--pins')) {
    const r = await fetch(API + '/pins');
    if (!r.ok) throw new Error('GET /pins 실패 — HTTP ' + r.status);
    const d = await r.json();
    return (d && Array.isArray(d.games)) ? d.games : [];
  }
  return [];
}

(async () => {
  const posts = readJSON(path.join(ROOT, 'posts.json'), null);
  if (!Array.isArray(posts)) { console.error('[tier-check] posts.json 을 읽지 못했습니다.'); process.exit(1); }

  let games;
  try { games = await resolveGames(); }
  catch (e) { console.error('[tier-check] ' + e.message); process.exit(1); }
  if (!games.length) {
    console.error('[tier-check] 판정할 게임이 없습니다. --games "A,B" 또는 --pins 를 주세요.');
    process.exit(1);
  }

  const mine = posts.filter(p => p && p.author === WRITER && p.rel);
  const out = { updated: new Date().toISOString().slice(0, 10), writer: WRITER, games: [] };

  for (const g of games) {
    const gk = norm(g);
    /* 이 게임의 글 = 폴더(group)가 서로를 포함하거나, 제목에 게임명이 들어간 글 */
    const hits = mine.filter(p => {
      const grp = norm(p.group);
      return (grp && (grp.includes(gk) || gk.includes(grp))) || norm(p.title).includes(gk);
    });

    const tierPosts = [];
    for (const p of hits) {
      const tk = norm(p.title);
      const strongTitle = STRONG.filter(s => tk.includes(s));
      const weakTitle = WEAK.filter(s => tk.includes(s));
      const badCtx = NOT_TIER_CTX.filter(s => tk.includes(s));

      /* 본문 실측 — 제목에 안 드러난 표를 잡는다(구조 신호만 센다. 위 tierStructure 주석 참조). */
      let heads = [], tbls = [], read = false;
      try {
        const raw = fs.readFileSync(path.join(ROOT, p.rel), 'utf8');
        const st = tierStructure(raw);
        read = true; heads = st.headings; tbls = st.tableHeads;
      } catch (_) { /* 파일이 없으면(삭제·이동) 제목 신호만으로 판정한다 */ }

      /* 판정: 제목에 강한 신호가 있고 '랭크 올리기' 문맥이 아니거나 · 소제목에 강한 신호가 있거나 ·
         티어/등급 표가 실제로 들어 있으면 '티어표 글'. */
      const isTier = (strongTitle.length && !badCtx.length) || heads.length > 0 || tbls.length > 0;
      if (!isTier && !weakTitle.length) continue;

      const titleAxes = axesAround(tk, STRONG.concat(WEAK));
      const bodyAxes = axesAround(heads.concat(tbls).join(' '), STRONG.concat(WEAK));
      tierPosts.push({
        title: p.title, rel: p.rel, group: p.group || '',
        date: String(p.created || p.updated || '').slice(0, 10),
        strength: isTier ? 'strong' : 'weak',
        signal: { titleStrong: strongTitle, titleWeak: weakTitle, notTierCtx: badCtx,
                  headings: heads.length, tierTables: tbls.length, bodyRead: read },
        axes: [...new Set(titleAxes.concat(bodyAxes))],
      });
    }

    tierPosts.sort((a, b) => (a.strength === b.strength ? (a.date < b.date ? 1 : -1) : (a.strength === 'strong' ? -1 : 1)));
    const strongPosts = tierPosts.filter(t => t.strength === 'strong');
    const coveredAxes = [...new Set(strongPosts.flatMap(t => t.axes))];
    const openAxes = AXES.map(a => a[0]).filter(a => !coveredAxes.includes(a));

    /* 추천 여부 — 사용자 규칙: "더 이상 쓸 티어표가 없을 것 같으면 티어표는 안 나와도 좋다."
       ⒜강한 티어표 글이 하나도 없다 → 티어표 주제를 낸다
       ⒝있는데 축이 남아 있다 → 남은 축으로만 낸다(같은 축 재탕 금지)
       ★★단, openAxes 는 '이 게임에 그 축이 실재한다'는 뜻이 아니다(사냥터 없는 게임도 있다).
         조사 담당이 그 축이 게임에 실재하는지 확인한 뒤에만 발주한다. */
    const verdict = !strongPosts.length ? 'write'
      : (openAxes.length ? 'write-other-axis' : 'skip');

    out.games.push({
      game: g, matchedPosts: hits.length, tierPosts,
      coveredAxes, openAxes, verdict,
      note: verdict === 'write' ? '티어표 글 없음 — 티어표 주제 1건 넣을 것'
        : verdict === 'write-other-axis' ? ('이미 쓴 축=' + coveredAxes.join('/') + ' — 남은 축으로만(축 실재 여부는 조사에서 확인)')
        : '쓸 만한 축이 남지 않음 — 티어표 주제 빼도 됨',
    });
  }

  if (JSON_ONLY) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

  console.log('[tier-check] 기준 작성자 = ' + WRITER + ' · 대상 ' + games.length + '종\n');
  for (const r of out.games) {
    const mark = r.verdict === 'write' ? '○ 티어표 넣기'
      : r.verdict === 'write-other-axis' ? '△ 다른 축으로' : '✕ 티어표 빼기';
    console.log('── ' + r.game + '  [' + mark + ']  (' + WRITER + ' 글 ' + r.matchedPosts + '편 중 티어성 ' + r.tierPosts.length + '편)');
    console.log('   ' + r.note);
    r.tierPosts.forEach(t => console.log(
      '     · [' + t.strength + '] ' + t.title +
      '  (제목 ' + (t.signal.titleStrong.join('+') || '—') +
      ' · 소제목 ' + t.signal.headings + ' · 티어표 ' + t.signal.tierTables +
      (t.signal.bodyRead ? '' : ' · 파일없음') +
      (t.axes.length ? ' · 축 ' + t.axes.join('/') : '') + ')'));
    if (r.verdict !== 'skip') console.log('   남은 축 후보: ' + (r.openAxes.join(', ') || '없음'));
    console.log('');
  }
  console.log(JSON.stringify(out.games.map(r => ({ game: r.game, verdict: r.verdict })), null, 0));
  process.exit(0);
})();
