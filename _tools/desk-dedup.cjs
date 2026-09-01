#!/usr/bin/env node
/* =============================================================================
   desk-dedup.cjs — 일간 토픽 데스크 «재탕» 결정론 탐지기 (2026-09-02 신설)

   왜 만들었나
   -----------
   L051→L053→L054→L058 이 같은 사고를 네 번 적었다: **며칠 전 판에 이미 낸 주제를 다시 낸다.**
   이유는 둘이고 둘 다 구조적이다.
     ⑴ 조사원에게 주는 «최근 판 제목» 창이 비용 때문에 5일이다. 실제 충돌은 **6~12일 전**에 있다.
     ⑵ `classify-picks.ps1` 의 🔄carried 탐지는 기본 `-PrevIssues 6` 이라 **6판까지만** 거슬러 본다.
   그래서 L054 처방이 «메인이 매 회차 trend.json 전량을 손으로 grep 한다»였고, 세 회차 연속
   7·8·8건을 잡았다. 값은 했지만 **가장 비싼 모델이 가장 기계적인 일을 하고 있었다**
   (10_비용 실측: 회차 $103 중 메인 opus 가 $76). 그 grep 이 이 파일이다.

   classify-picks.ps1 과 겹치지 않는다
   -----------------------------------
   classify-picks = «후보 vs **발행된 글**»(published/live/failed) — 자기잠식 방지.
   desk-dedup     = «후보 vs **지난 데스크 판**»(trend.json 전량) — 재추천 방지.
   둘 다 돌린다. 앞의 것은 글이 이미 있나를, 뒤의 것은 주제를 이미 추천했나를 본다.

   모드
   ----
   ① 조사 «전» — 조사원에게 줄 게임별 차단 목록(창을 5일 → 전량으로 넓혀도 비용이 안 는다.
      게임 하나로 좁히면 14일치가 5일치 전체 목록보다 작다):
        node desk-dedup.cjs --digest --game "메이플플래닛"
        node desk-dedup.cjs --digest --games "메이플플래닛,롤토체스" --days 14
   ② 조사 «후» — 후보 제목 파일을 지난 판 전량과 대조:
        node desk-dedup.cjs --check --candidates cands.txt [--days 14] [--json]
      후보 파일 = 한 줄에 하나. `게임명 | 제목` 또는 `게임명<TAB>제목` 도 받는다(없으면 제목에서 추론).

   판정
   ----
   DROP  = 사실상 같은 주제(제목 유사도 높음 또는 같은 게임 + 같은 숫자앵커). 싣지 않는다.
   CHECK = 같은 게임 + 약한 겹침. **사람이 각도를 본다** — 다르면 실으면서 angle 에 근거를 적는다.
   OK    = 지난 판 전량에 걸리는 것 없음.
   ⛔ 이 도구는 «싣지 마라»를 강제하지 않는다. 근거(어느 날 어떤 제목과 겹치는지)를 대는 게 일이다.
============================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TREND = path.join(ROOT, '_trend', 'trend.json');

/* ── 인자 ─────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = k => argv.includes(k);

const MODE = has('--digest') ? 'digest' : 'check';
const DAYS = Number(arg('--days', '0')) || 0;              /* 0 = trend.json 전량 */
const AS_JSON = has('--json');
const EXCLUDE = arg('--exclude-date', new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }));

/* ── 정규화 ───────────────────────────────────────────────────────────────── */
/* 조사·괄호·기호를 털어 «같은 말인데 다르게 쓴 제목»이 서로 닿게 한다.
   ★공백까지 지운다 — 「쿠키런 크럼블」/「쿠키런: 크럼블」/「쿠키런크럼블」이 같은 열쇠가 돼야 한다. */
const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[「」『』《》〈〉\[\]（）()·・,，.…—–\-~!?"'“”‘’:;/\\|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const nospace = s => norm(s).replace(/\s/g, '');

const bigrams = s => { const t = nospace(s), out = new Set(); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; };
const dice = (A, B) => { if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return (2 * n) / (A.size + B.size); };

/* 숫자 앵커 = 재탕 탐지의 가장 강한 신호.
   L058 의 마비노기(「9월 3일부터 나흘」)·쿠키런(「169-1」)은 제목 문장이 달라도 숫자가 같았다.
   날짜(8/28·9월 3일·2026-09-09)·패치번호(169-1·18.1)·퍼센트·배수를 뽑는다. */
function anchors(s) {
  const t = String(s || '');
  const out = new Set();
  const push = (v) => { if (v) out.add(v); };
  (t.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}/g) || []).forEach(m => push('d:' + m.replace(/[.]/g, '-')));
  (t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g) || []).forEach(m => {
    const g = m.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/); push('d:' + Number(g[1]) + '/' + Number(g[2]));
  });
  (t.match(/\b(\d{1,2})\/(\d{1,2})\b/g) || []).forEach(m => { const g = m.split('/'); push('d:' + Number(g[0]) + '/' + Number(g[1])); });
  (t.match(/\b\d{1,3}-\d{1,3}\b/g) || []).forEach(m => push('v:' + m));          /* 169-1 같은 스테이지·챕터 */
  (t.match(/\b\d{1,2}\.\d{1,2}\b/g) || []).forEach(m => push('v:' + m));          /* 18.1 같은 패치 버전 */
  (t.match(/\d{1,4}\s*%/g) || []).forEach(m => push('p:' + m.replace(/\s/g, '')));
  (t.match(/\d{1,4}\s*배/g) || []).forEach(m => push('x:' + m.replace(/\s/g, '')));
  return out;
}

/* 내용어 토큰 — 2글자 이상 한글/영숫자 덩어리에서 흔한 말을 뺀다.
   흔한 말을 남기면 「업데이트」·「이벤트」만으로 아무 항목이나 서로 걸린다(분류기 오탐 L048 의 원인). */
const STOP = new Set(('업데이트 이벤트 게임 출시 공개 시작 오픈 신규 추가 변경 개편 안내 공지 패치 시즌 콜라보 쿠폰 보상 확률 정보 공략 가이드 추천 정리 비교 후기 리뷰 방법 총정리 최신 오늘 내일 이번 지금 여기 그리고 하지만 예정 진행 적용 종료 획득 사용 확인 전체 대한 위한 없는 있는 되는 하는 무엇 어떻게 얼마나 아기 유아 신생아 육아 제품 브랜드 순위 가격 인증 안전').split(/\s+/));
function tokens(s) {
  const out = new Set();
  for (const m of norm(s).match(/[가-힣]{2,}|[a-z0-9]{2,}/g) || []) {
    if (STOP.has(m)) continue;
    out.add(m);
    /* 한글 합성어 대응 — 「메이플플래닛」/「메이플」이 서로 닿게 앞 2~4음절도 넣는다.
       (L048 오탐 방지를 위해 «접두 일치»는 아래에서 단독 근거로 쓰지 않는다) */
    if (/^[가-힣]{4,}$/.test(m)) { out.add('~' + m.slice(0, 3)); out.add('~' + m.slice(0, 4)); }
  }
  return out;
}
const inter = (A, B) => { let n = 0; for (const x of A) if (B.has(x)) n++; return n; };

/* ── 지난 판 적재 ─────────────────────────────────────────────────────────── */
function loadPast() {
  if (!fs.existsSync(TREND)) { console.error('trend.json 이 없습니다: ' + TREND); process.exit(2); }
  const raw = JSON.parse(fs.readFileSync(TREND, 'utf8'));
  let eds = (raw.editions || []).filter(e => e && e.date && String(e.date) !== EXCLUDE);
  eds.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (DAYS > 0) eds = eds.slice(0, DAYS);
  const items = [];
  for (const ed of eds) for (const sec of (ed.sections || [])) for (const it of (sec.items || [])) {
    if (!it || !it.title) continue;
    /* ★ game·title·detail 세 필드를 함께 본다 — L054 처방 그대로.
       제목만 보면 「같은 공지의 다른 조각」(L058 마비노기·쿠키런)이 안 걸린다. */
    const blob = [it.game, it.title, it.detail, it.angle].filter(Boolean).join(' ');
    items.push({
      date: String(ed.date), sec: String(sec.key || ''), game: String(it.game || ''), title: String(it.title || ''),
      bgT: bigrams(it.title), tokT: tokens(it.title), tokAll: tokens(blob), anc: anchors(blob),
      gameKey: nospace(it.game)
    });
  }
  return { items, days: eds.map(e => String(e.date)) };
}

/* 후보의 게임명 추론 — 지난 판에 나온 게임명 중 후보 제목에 통째로 들어 있는 것.
   (지난 판에 없던 새 게임이면 재탕일 수 없으므로 추론 실패는 문제가 아니다) */
function guessGame(title, pastGames) {
  const t = nospace(title);
  let best = '';
  for (const g of pastGames) if (g.key && g.key.length >= 2 && t.includes(g.key) && g.key.length > nospace(best).length) best = g.raw;
  return best;
}

/* ── 판정 ─────────────────────────────────────────────────────────────────── */
function judge(cand, past) {
  const cBg = bigrams(cand.title), cTok = tokens(cand.title + ' ' + (cand.game || '')), cAnc = anchors(cand.title);
  const cGameKey = nospace(cand.game);
  const hits = [];
  for (const p of past) {
    const sameGame = !!(cGameKey && p.gameKey && (cGameKey === p.gameKey || cGameKey.includes(p.gameKey) || p.gameKey.includes(cGameKey)));
    const sim = dice(cBg, p.bgT);
    const shared = inter(cTok, p.tokT);
    const sharedAll = inter(cTok, p.tokAll);
    const ancHit = [...cAnc].filter(a => p.anc.has(a));
    let verdict = null, why = '';
    /* 육아만 다른 규칙 — `game` 이 «제품 카테고리»라 카테고리가 같으면 그 자체로 재탕이다
       (SKILL [A-3]⑷ "봄딩이 이미 쓴 제품군은 금지"). 게임은 반대다: 같은 게임을 여러 번 다루는 게 pinned 의 설계라
       게임명 일치만으로 DROP 하면 안 된다. 그래서 이 한 줄이 parenting 에만 걸린다. */
    if (p.sec === 'parenting' && cGameKey && cGameKey === p.gameKey) { verdict = 'DROP'; why = '같은 제품 카테고리(육아는 제품군 재탕 금지)'; }
    else if (sim >= 0.55) { verdict = 'DROP'; why = `제목 유사도 ${sim.toFixed(2)}`; }
    else if (sameGame && ancHit.length && (shared >= 1 || sim >= 0.25)) { verdict = 'DROP'; why = `같은 게임 + 같은 앵커(${ancHit.join(',')})`; }
    else if (sim >= 0.40 && shared >= 2) { verdict = 'DROP'; why = `제목 유사도 ${sim.toFixed(2)} + 공유어 ${shared}`; }
    else if (sameGame && shared >= 2) { verdict = 'CHECK'; why = `같은 게임 + 공유어 ${shared}`; }
    else if (sameGame && sharedAll >= 2) { verdict = 'CHECK'; why = `같은 게임 + 본문(detail) 공유어 ${sharedAll}`; }
    else if (!sameGame && sim >= 0.35) { verdict = 'CHECK'; why = `제목 유사도 ${sim.toFixed(2)}`; }
    if (verdict) hits.push({ verdict, why, date: p.date, sec: p.sec, game: p.game, title: p.title, sim: Number(sim.toFixed(2)) });
  }
  hits.sort((a, b) => (a.verdict === b.verdict ? b.sim - a.sim : (a.verdict === 'DROP' ? -1 : 1)));
  const verdict = hits.some(h => h.verdict === 'DROP') ? 'DROP' : (hits.length ? 'CHECK' : 'OK');
  return { verdict, hits: hits.slice(0, 5) };
}

/* ── 실행 ─────────────────────────────────────────────────────────────────── */
const { items: PAST, days: DAYLIST } = loadPast();
const PAST_GAMES = [...new Map(PAST.filter(p => p.game).map(p => [nospace(p.game), { raw: p.game, key: nospace(p.game) }])).values()];

if (MODE === 'digest') {
  /* 조사원 프롬프트에 그대로 붙일 «이미 낸 주제» 목록. 게임으로 좁히면 전량이라도 작다. */
  const want = (arg('--games', arg('--game', '')) || '').split(',').map(s => s.trim()).filter(Boolean);
  const groups = new Map();
  for (const p of PAST) {
    if (want.length && !want.some(w => nospace(p.game).includes(nospace(w)) || nospace(w).includes(nospace(p.game)) || nospace(p.title).includes(nospace(w)))) continue;
    const k = p.game || '(게임명 없음)';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  if (AS_JSON) {
    console.log(JSON.stringify({ window: DAYLIST, games: [...groups].map(([g, v]) => ({ game: g, items: v.map(x => ({ date: x.date, sec: x.sec, title: x.title })) })) }, null, 2));
  } else {
    console.log(`# 이미 낸 주제 (데스크 ${DAYLIST.length}일치: ${DAYLIST[DAYLIST.length - 1]} ~ ${DAYLIST[0]} · 오늘 ${EXCLUDE} 제외)`);
    console.log('# ⛔ 아래와 같은 각도는 다시 내지 않는다. 각도가 확실히 다르면 무엇이 다른지 angle 에 적는다.\n');
    for (const [g, v] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`## ${g} (${v.length}건)`);
      v.sort((a, b) => b.date.localeCompare(a.date)).forEach(x => console.log(`- [${x.date} ${x.sec}] ${x.title}`));
      console.log('');
    }
    if (!groups.size) console.log('(해당 게임으로 지난 판에 낸 주제가 없습니다 — 새 밭입니다)');
  }
  process.exit(0);
}

/* check 모드 */
const cf = arg('--candidates', '');
if (!cf || !fs.existsSync(cf)) {
  console.error('사용법: node desk-dedup.cjs --check --candidates <후보파일>  |  --digest [--game <게임>]');
  process.exit(2);
}
const cands = fs.readFileSync(cf, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  .map(line => {
    const m = line.split(/\t|\s*\|\s*/);
    if (m.length >= 2 && m[0].length <= 30) return { game: m[0].trim(), title: m.slice(1).join(' ').trim() };
    return { game: '', title: line };
  })
  .map(c => ({ game: c.game || guessGame(c.title, PAST_GAMES), title: c.title }));

const out = cands.map(c => ({ ...c, ...judge(c, PAST) }));
const n = v => out.filter(o => o.verdict === v).length;

if (AS_JSON) { console.log(JSON.stringify({ window: DAYLIST, results: out }, null, 2)); }
else {
  console.log(`# 데스크 재탕 대조 — 후보 ${out.length}건 vs 지난 판 ${PAST.length}건(${DAYLIST.length}일치, 오늘 ${EXCLUDE} 제외)\n`);
  for (const o of out) {
    const chip = o.verdict === 'DROP' ? '❌DROP ' : o.verdict === 'CHECK' ? '🟡CHECK' : '✅OK   ';
    console.log(`${chip} ${o.game ? '[' + o.game + '] ' : ''}${o.title}`);
    o.hits.forEach(h => console.log(`         └ ${h.verdict === 'DROP' ? '동일' : '겹침'}: [${h.date} ${h.sec}] ${h.title}  (${h.why})`));
  }
  console.log(`\n>>> DROP ${n('DROP')} · CHECK ${n('CHECK')} · OK ${n('OK')}`);
  console.log('    DROP = 싣지 않는다(사유를 note 에 적는다) · CHECK = 각도가 다른지 사람이 보고, 실으면 angle 에 근거 한 줄.');
}
process.exit(0);
