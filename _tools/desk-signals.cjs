#!/usr/bin/env node
/* ============================================================================
   desk-signals.cjs — 토픽 데스크 «검색 수요 · AI 브리핑» 신호 + 거둬내기 판정 + 칸 안 정렬
   (2026-09-18 신설 · LLM 0 · 사용자 승인 «권고안대로 전부 진행»)

   왜 있나
     2026-09-18 검토(쓰담/docs/2026-09-18_트렌드_추천방식_검토_수정계획.md) 실측:
       · 게임 추천 271건 중 공략·티어 18.8% — 신작·업데이트·화제 115건은 0건
       · 발주의 73%가 데스크 경유라 글 비중이 추천을 그대로 따라갔다
       · 수요(검색량)와 AI 브리핑 인용 가능성을 재는 장치가 없었다(heat = 조사원 주관 점수)
       · 추천의 76%(207/271)는 한 번도 발주되지 않았다
     이 도구가 신호를 «숫자»로 붙이고, 승인된 거둬내기 규칙을 기계로 집행하고, 칸 안을 수요순으로 세운다.

   하위 명령
     queries  --games "a,b" | --seeds N   [--top 20] [--aib-max 15] [--json out.json] [--no-mine]
              질의 발굴기(query-miner.cjs)로 «질의는 있는데 우리 글이 없는» 칸을 모으고 수요·브리핑을 붙여 순위를 낸다.
              guide 조사원·pinned 조사원에게 넘기는 후보 밭이다.
     check    --in <후보.json> [--json out.json] [--aib-max 30] [--cross-strict]
              조사 후보 [{id,sec,game,title,keywords,angleType,purpose,q?,entryOk?}] 의 신호를 재고 KEEP/DROP 을 판정한다.
              ★상세 조사·검증 에이전트를 띄우기 «전»에 돈다(2단계 조사 [B-0]) — 죽을 항목에 조사·검증 비용을 쓰지 않게.
     stamp    [--date YYYY-MM-DD] [--dry] [--aib-max 10]
              trend.json 그 날 에디션에 demand·aib·angleType·depth 를 적고, 규칙 위반을 거둬내고(백스톱), 칸 안을 정렬한다. 멱등.
              ★순서 = [C] trend.json 작성 뒤 · [D] build-trend-lite·test-desk 앞.
     seeds    [--top 12] [--print]
              guide 시드 원장(_trend/_guide-seeds.json · 56일 롤링)을 trend.json 으로 갱신하고 상위 게임을 보여 준다.
     parenting [--date YYYY-MM-DD]
              육아 칸 «주 1회» 판정 — 그 주(월~일)에 육아가 실린 판이 이미 있으면 SKIP, 없으면 DUE.

   신호 (항목에 그대로 실린다 — 사이트 발주 모달이 읽는다)
     angleType   howto(공략·방법·얻는 법·쿠폰) · rank(티어·추천·비교) · news(출시·일정·발표·결과·논란·매출) · info(정리·후기·기타)
                 데스크가 적은 값이 우선이고, 비어 있으면 angle-mix 사다리(제목 정규식)로 채운다.
     demand      { tier, src, ac, q, acRank, qMode, qHit?, acQ?, game?, kw? } — tier 0 없음 · 1 낮음 · 2 보통 · 3 높음
                 · ★2026-09-23(감사 E#1②) 자동완성 측정 단위 = «게임»이 아니라 **항목의 타깃 질의**(deriveQuery · keywords[0]).
                   옛 방식(게임당 1회 · 10 포화 · 상한 2)은 개편 후 77건 중 76건이 같은 tier 였다 — 판별력 0.
                 · q      = 측정한 질의(게임명이 없으면 앞에 붙인다) · acRank = 게임 이름 자동완성 top10 안 순위(1~10) 또는 null
                 · ac     = 게임 단위 자동완성 제안 수(0~10) — «게임 자체 수요 있음/없음» 보조 신호로만(0 이면 tier 0 확정 · 질의는 재지 않는다)
                 · qMode  = rank(게임 top10) · full(질의 원문 있음) · short(축약만) · none(없음) · gameonly(질의가 게임명뿐) · game(질의 못 잼 → 게임 단위)
                 · qHit   = qMode=short 일 때 자동완성에 있던 축약 질의(마지막 내용어를 뗀 것)
                 · game/kw = 네이버 검색광고 키워드도구 월간 검색수(PC+모바일 · 통합검색 최근 30일). ★키가 있으면 이 경로가 우선(변경 없음).
                   ★사용자 본인 API 키가 있을 때만: %USERPROFILE%\.naver-searchad\credentials.json
                     {"customerId":"…","accessLicense":"…","secretKey":"…"} — 이 도구만 읽는다.
                   ⛔세션·에이전트가 그 파일을 열지 않는다(트랜스크립트가 로그다). 출력·오류 메시지에 키를 싣지 않는다.
                 · tier 판정표(자동완성만 · 검색광고 키 없을 때 · tierFromQuery):
                     3 = 질의가 게임 이름 자동완성 top10 에 있다(그 게임의 대표 질의 · acRank)
                     2 = 질의 원문을 앞머리로 자동완성 제안이 있다(사람들이 실제로 치는 문장)
                     1 = 원문은 없고 축약 질의(마지막 내용어 하나 뗀 것)만 있다 · 또는 질의가 게임명뿐(게임 수요만 · ≤1)
                     0 = 게임 자동완성 0 · 또는 질의·축약 질의 모두 자동완성 없음(지어낸 질의)
                     null = 못 쟀다(네트워크) → 판정 보류(fail-open). 질의만 못 쟀으면 옛 게임 단위 표(0 / 1~3 / 4+ → 0/1/2)로 대체.
                   검색광고 연동이면 500 / 5,000 / 50,000(변경 없음).
     aib         { s, n, bd, yd, q } — 네이버 AI 브리핑 실검색(aib-check.py · 24h 캐시 · 8초 간격)
                 s = shown(출처 열람) · async(뜨지만 출처 미열람) · none(안 뜸) · unknown(차단·오류) · n = 출처 수 · bd/yd = 봄딩·영도 인용 순위
                 대상 = 게임 6칸 전부(★09-23 소식 칸 포함 — how-to 로 뒤집은 질의로) · 회차 네트워크 상한 --aib-max 안에서
                 우선순위 guide → pinned → core → new → update → hot(캐시 적중은 공짜).
     depth       entry(진입형) · play(실전형) · news(소식형) — 타깃 질의로 기계가 판정(R5).

   거둬내기 규칙 (2026-09-18 사용자 승인 · 시행 2026-09-19 판부터 · ★09-23 R4 개정 + X·B 신설)
     B   전 칸     _trend/_blocklist.json 의 {game, angle, until} 에 걸림(angle = 제목·질의 포함 문자열 | angleType | '*')  → DROP
     X   전 칸     같은 회차 «다른 칸»에 같은 게임 + 같은 angleType 이 상위 칸에 있고 주제가 겹침(desk-dedup 판정 ≠ OK)   → 뒤 칸 DROP
                  우선권 pinned > core > guide > new > update > hot. --cross-strict 면 주제 겹침 조건 없이 게임+angleType 만으로.
                  (기본값에 «주제 겹침» 조건을 둔 이유 = 09-20 사용자 승인 «guide 는 게임이 아니라 주제로 양보한다»[[L91]] 와의 충돌 방지)
     R1  new      검색 흔적 없음(tier 0 · 검색량 연동이면 게임·키워드 모두 월 500 미만)                                    → DROP
     R2  hot      angleType=news(논평·결과·매출·논란 — how-to 로 안 뒤집힌 화제)                                             → DROP
         core     angleType=news(소식은 how-to 로 뒤집힐 때만)                                                              → DROP
     R3  pinned   게임당 news 1건 초과(패치 세부 나열)                                                                       → DROP(약한 쪽부터)
     R4  new·update·hot  수요 최저 구간 = tier 0(★09-23 — heat 는 조사원 주관값이라 판정·정렬에서 뺐다 · 표시는 남는다)          → DROP
     R5  전 칸     진입형 질의(설치·가입·하는 법…)인데 신작(최근 14판 new)도 아니고 entryOk 도 없음                            → DROP
     W1  new·update·hot 의 news 합 2건 초과 · 칸 상한 new 3 · update 3 · hot 2 · guide 8                                     → DROP(약한 쪽부터)
     G   guide    angleType ∈ {howto, rank} 이고 tier ≥ 1                                                                    → 아니면 DROP
     ★신호를 못 잰 경우(네트워크 실패)는 그 규칙을 적용하지 않는다(fail-open) — «모름»을 «없음»으로 바꾸지 않는다.
     ★parenting 은 건드리지 않는다(게임 축 밖 · 규칙 = SKILL [A-3]).

   정렬 (칸 안)  수요 tier ↓ → 브리핑(뜸·우리 미인용 → 뜸·출처 미열람 → 모름 → 뜸·이미 인용 → 안 뜸) → acRank ↑ → 원래 순서.
                pinned 는 게임 묶음 순서를 지키고 그 안에서만 정렬한다. (heat 는 09-23 부터 정렬에 쓰지 않는다)

   ★함정
     - 자동완성은 게임명을 «낱말로» 품은 제안만 센다(«애니모»가 «애니모션텍»을 끌어오던 query-miner 교훈 그대로).
     - 긴 공식명은 자동완성이 0 일 수 있다(«동방홍마향 뉴 클래식» 0 · «동방홍마향» 10) → 뒤 낱말을 떼며 재시도하고,
       데스크 keywords 중 게임과 낱말을 공유하는 표기(한글 독음 등)도 함께 본다. 그중 최댓값을 쓴다.
     - 검색광고 API 는 동시 요청이 많으면 422 를 준다(공식 답변 · naver/searchad-apidoc#1235) → 순차 + 재시도.
     - 월간 검색수는 «연관 키워드 간 비교용 보조 지표»(공식 답변 #1403) — 구간(tier)으로만 쓰고 순위표처럼 읽지 않는다.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TREND = path.join(ROOT, '_trend', 'trend.json');
const CACHE = path.join(ROOT, '_trend', '_signals-cache.json');
const SEEDS = path.join(ROOT, '_trend', '_guide-seeds.json');
const QUERIES = path.join(ROOT, '_trend', '_queries.json');
const CORE = path.join(ROOT, '_trend', '_core-games.json');
const MINER = path.join(__dirname, 'query-miner.cjs');
const CREDS = path.join(os.homedir(), '.naver-searchad', 'credentials.json');
const AIB_PY = path.join(os.homedir(), '.claude', 'shared', 'blog-writing', 'tools', 'aib-check.py');
const AIB_CACHE = path.join(os.homedir(), '.claude', 'shared', 'blog-writing', '_aib-cache');
const API = 'https://34.139.184.70.sslip.io';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const RULE_FROM = '2026-09-19';
const DEPTH_KO = { entry: '진입형', play: '실전형', news: '소식형' };
const CAPS = { new: 3, update: 3, hot: 2, guide: 8 };
const EVENT_SECS = ['new', 'update', 'hot'];
const NEWS_MAX_EVENT = 2;
const AIB_SECS = ['guide', 'pinned', 'core', 'new', 'update', 'hot'];   /* ★09-23 소식 칸 포함 · 순서 = 회차 상한 안 우선순위 */
const GAME_SECS = ['pinned', 'core', 'guide', 'new', 'update', 'hot'];
const SEC_PRIORITY = { pinned: 0, core: 1, guide: 2, new: 3, update: 4, hot: 5 };   /* X 규칙 우선권(작을수록 상위 칸) */
const BLOCKLIST = path.join(ROOT, '_trend', '_blocklist.json');
const DD = require('./desk-dedup.cjs');   /* X 규칙의 «주제 겹침» 판정 — 재탕 도구와 같은 자로 잰다 */
const BLOG = { bd: 'bomding', yd: 'kkodug9' };
const AC_TTL_H = 72, SA_TTL_H = 24, AIB_TTL_H = 24;
const AC_GAP = 250, SA_GAP = 300;

/* ── 공용 ─────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sleep = (ms) => (ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const OFFLINE = has('--offline');
const log = (...a) => console.error(...a);

function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return d; } }
function writeJson(p, obj, indent) {
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, indent == null ? 2 : indent) + '\n', 'utf8');
  fs.renameSync(tmp, p);   /* 원자 교체 — 쓰다 죽어도 원본이 0바이트가 되지 않는다(09-14 index.html 0바이트 사고 교훈) */
}
function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function ageH(iso) { const t = Date.parse(iso); return isFinite(t) ? (Date.now() - t) / 3600e3 : 1e9; }
function normKey(s) { return String(s || '').toLowerCase().replace(/[\s·:：\-—–_'"’”“(){}\[\]!?.,「」『』<>]/g, ''); }
function cleanGame(g) { return String(g || '').replace(/[:：·\-–—!?'"「」『』()\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
function gameRe(game) {
  const chars = String(game).trim().split('').filter((c) => !/\s/.test(c)).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(chars.join('\\s*') + '(?![가-힣])', 'i');
}
const mentions = (s, needle) => gameRe(needle).test(String(s));

/* ── 각도(angleType) ───────────────────────────────────────────────────── */
/* angle-mix.py 부록 A 사다리와 같은 순서(위에서 먼저 맞는 것) → 4갈래로 접는다 */
const LADDER = [
  ['howto', /하는 ?법|방법|공략|(?<!스)위치|얻는 ?법|만드는 ?법|세팅|스킬트리|조합|루트|파밍|재료|퀘스트|보는 ?법|설정|설치|사용법|치트|명령어|염색코드|코디|기댓값|확률|빌드|덱|특성|상성|카운터|강화|각성|승급|재련|우선순위|효율|드랍|주간|일일|보상|스펙|스탯|육성/],
  ['howto', /쿠폰|코드/],
  ['rank', /티어|추천|순위|BEST|TOP|비교|뭐가 다를|차이/i],
  ['info', /후기|리뷰|사용기|써본|첫인상/],
  ['news', /출시|사전예약|사전 예약|발표|공개|업데이트|패치|콜라보|이벤트|일정|중단|확정|출시일|정식|소식|근황|생중계|응모/],
  ['info', /총정리|정리|가이드|모음|링크|사이트/],
];
const ANGLE_TYPES = ['howto', 'rank', 'news', 'info'];
function angleOf(title) { for (const [k, re] of LADDER) if (re.test(title || '')) return k; return 'info'; }
function angleTypeOf(it) { const a = String(it.angleType || '').trim(); return ANGLE_TYPES.includes(a) ? a : angleOf(it.title); }

/* ── 타깃 질의 ─────────────────────────────────────────────────────────── */
/* 명시 q > keywords[0] > 제목의 첫 절(쉼표·대시 앞). 제목이 «검색 질의 문장 + , 부제» 문법이라 첫 절이 곧 질의다. */
function deriveQuery(it) {
  if (it.q) return String(it.q).trim();
  const kw = (it.keywords || []).map(String).map((s) => s.trim()).filter(Boolean);
  if (kw.length) return kw[0];
  return String(it.title || '').split(/[,，]|\s[—–-]\s/)[0].replace(/[?？!.…]+$/, '').trim();
}

/* ── 캐시 ─────────────────────────────────────────────────────────────── */
let CACHED = null;
function cache() { if (!CACHED) { CACHED = readJson(CACHE, null) || {}; CACHED.ac = CACHED.ac || {}; CACHED.sa = CACHED.sa || {}; } return CACHED; }
function saveCache() {
  if (!CACHED) return;
  const c = CACHED;
  for (const [k, v] of Object.entries(c.ac)) if (ageH(v.at) > AC_TTL_H * 4) delete c.ac[k];   /* 오래된 건 정리 — 파일이 자라지만 않게 */
  for (const [k, v] of Object.entries(c.sa)) if (ageH(v.at) > SA_TTL_H * 7) delete c.sa[k];
  c.schema = 1; c.updated = new Date().toISOString();
  try { writeJson(CACHE, c, 0); } catch (e) { log('⚠ 캐시 저장 실패: ' + e.message); }
}

/* ── 자동완성(수요 바닥 확인) ───────────────────────────────────────────── */
let acReq = 0;
async function acRaw(q) {
  if (OFFLINE) return null;
  const url = 'https://ac.search.naver.com/nx/ac?q=' + encodeURIComponent(q) +
    '&st=100&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&q_enc=UTF-8&frm=nv';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    acReq++;
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Referer': 'https://search.naver.com/', 'Accept': '*/*' } });
    if (r.status !== 200) return null;
    const j = JSON.parse(await r.text());
    const rows = (j && Array.isArray(j.items) ? j.items : []).flat();
    return rows.map((row) => (Array.isArray(row) ? row[0] : row)).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  } catch (e) { return null; } finally { clearTimeout(t); await sleep(AC_GAP); }
}
/* needle 을 «낱말로» 품은 제안 수. null = 못 쟀다(네트워크) — 0 과 다르다. */
async function acCount(needle) {
  const k = normKey(needle); if (!k) return null;
  const c = cache().ac[k];
  if (c && ageH(c.at) <= AC_TTL_H) return c;
  const list = await acRaw(needle);
  if (list === null) return null;
  const rel = list.filter((s) => mentions(s, needle));
  const v = { n: rel.length, top: rel.slice(0, 10), at: new Date().toISOString() };   /* top 10 — 질의 순위(acRank)가 이 목록을 본다(09-23 · 옛 캐시의 5개는 TTL 로 자연 교체) */
  cache().ac[k] = v;
  return v;
}
/* 게임 변형 = 정리한 전체 이름 → 뒤 낱말을 떼며(두 낱말까지 · 한 낱말은 4자 이상일 때만) + 게임과 낱말을 공유하는 keywords + keywords[0] */
function gameVariants(game, keywords) {
  const out = [];
  const add = (s) => { s = cleanGame(s); if (s && !out.some((x) => normKey(x) === normKey(s))) out.push(s); };
  const g = cleanGame(game); add(g);
  const toks = g.split(' ').filter(Boolean);
  for (let n = toks.length - 1; n >= 1; n--) {
    const p = toks.slice(0, n).join(' ');
    if (n >= 2 || p.replace(/\s/g, '').length >= 4) add(p);
  }
  const gtoks = toks.map(normKey).filter((t) => t.length >= 2);
  (keywords || []).map(String).forEach((kw, i) => {
    const kt = cleanGame(kw).split(' ').map(normKey).filter((t) => t.length >= 2);
    if (i === 0 || kt.some((t) => gtoks.some((g2) => g2.includes(t) || t.includes(g2)))) add(kw);
  });
  return out.slice(0, 6);
}
async function acBest(game, keywords) {
  let best = null, known = false;
  for (const v of gameVariants(game, keywords)) {
    const r = await acCount(v);
    if (!r) continue;
    known = true;
    if (!best || r.n > best.n) best = { n: r.n, top: r.top, q: v };
    if (best.n >= 4) break;   /* 이미 «보통» 이상 — 요청을 아낀다 */
  }
  return known ? best : null;
}
/* ── 질의 단위 자동완성 (2026-09-23 · 감사 E#1② «게임 단위 측정은 판별력 0») ─────────────────────
   내용어 = 질의에서 게임명 낱말을 뺀 2자 이상 토큰. 측정 3종(캐시 72h · 항목당 최대 2 요청):
     rank  = 게임 이름 자동완성 top10 안에서 내용어 전부를 품은 첫 제안의 순위(게임 단위 캐시 top 을 재사용 · 요청 0)
     full  = 질의 원문을 앞머리로 넣었을 때 «질의를 품은» 제안 수(0 = 아무도 그 문장을 안 친다)
     short = 원문이 0 이고 내용어가 2개 이상일 때, 마지막 내용어를 뗀 축약 질의의 제안 수(근처 수요)
   null = 세 값을 하나도 못 쟀다(네트워크) · noContent = 질의가 게임명뿐. */
function contentTokens(q, game) {
  const gk = normKey(cleanGame(game));
  const gt = new Set(cleanGame(game).split(' ').map(normKey).filter(Boolean));
  return cleanGame(q).split(' ').map((t) => t.trim()).filter((t) => { const k = normKey(t); return k && k.length >= 2 && !gt.has(k) && !(gk && gk.includes(k)); });
}
function queryWithGame(game, q) {
  const g = cleanGame(game), qm = cleanGame(q);
  if (!g || !qm) return qm || g;
  const gk = normKey(g);
  const shares = qm.split(' ').some((t) => { const k = normKey(t); return k.length >= 2 && (gk.includes(k) || k.includes(gk)); });
  return shares ? qm : g + ' ' + qm;
}
async function acQuery(game, q, gameAc) {
  const qm = queryWithGame(game, q);
  if (!qm) return null;
  const toks = contentTokens(qm, game);
  if (!toks.length) return { q: qm, noContent: true, rank: null, full: null, short: null };
  const out = { q: qm, rank: null, full: null, short: null };
  if (gameAc && Array.isArray(gameAc.top)) {
    const i = gameAc.top.findIndex((s) => { const k = normKey(s); return toks.every((t) => k.includes(normKey(t))); });
    if (i >= 0) out.rank = i + 1;
  }
  const f = await acCount(qm);
  if (f) out.full = { n: f.n };
  if (f && f.n === 0 && toks.length >= 2) {
    const last = normKey(toks[toks.length - 1]);
    const parts = qm.split(' ');
    let cut = -1; for (let i = parts.length - 1; i >= 0; i--) if (normKey(parts[i]) === last) { cut = i; break; }
    const sq = (cut > 0 ? parts.slice(0, cut) : parts.slice(0, -1)).join(' ').trim();   /* 마지막 내용어부터 뒤를 뗀다(«애니모 천휘 얻는 법» → «애니모 천휘») */
    const s = sq ? await acCount(sq) : null;
    if (s) out.short = { q: sq, n: s.n };
  }
  if (out.rank == null && !out.full && !out.short) return null;
  return out;
}
function qModeOf(qa) {
  if (!qa) return 'game';
  if (qa.noContent) return 'gameonly';
  if (qa.rank != null) return 'rank';
  if (qa.full && qa.full.n > 0) return 'full';
  if (qa.short && qa.short.n > 0) return 'short';
  return qa.full ? 'none' : 'game';
}

/* ── 검색광고 키워드도구(월간 검색수) ──────────────────────────────────── */
let SA_OFF = false, saReq = 0;
function loadCreds() {
  if (OFFLINE) return null;
  let j = readJson(CREDS, null);
  if (!j || !j.customerId) j = { customerId: process.env.NAVER_SEARCHAD_CUSTOMER_ID, accessLicense: process.env.NAVER_SEARCHAD_ACCESS_LICENSE, secretKey: process.env.NAVER_SEARCHAD_SECRET_KEY };
  return (j && j.customerId && j.accessLicense && j.secretKey) ? j : null;
}
/* 공식 서명(naver/searchad-apidoc python-sample signaturehelper.py): base64(HMAC-SHA256(secret, "{ts}.{METHOD}.{uri}")) — uri 에 쿼리스트링은 넣지 않는다 */
function saSign(ts, method, uri, secret) { return crypto.createHmac('sha256', secret).update(ts + '.' + method + '.' + uri).digest('base64'); }
const saKey = (s) => String(s || '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();
function saNum(v) { if (typeof v === 'number') return { n: v, lt: false }; const s = String(v || ''); if (/</.test(s)) return { n: 0, lt: true }; const n = Number(s.replace(/[^\d.]/g, '')); return { n: isFinite(n) ? n : 0, lt: false }; }
async function saBatch(creds, kws) {
  const uri = '/keywordstool';
  const qs = 'hintKeywords=' + kws.map(encodeURIComponent).join(',') + '&showDetail=1';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ts = String(Date.now());
    const headers = { 'X-Timestamp': ts, 'X-API-KEY': creds.accessLicense, 'X-Customer': String(creds.customerId), 'X-Signature': saSign(ts, 'GET', uri, creds.secretKey), 'Content-Type': 'application/json; charset=UTF-8' };
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    try {
      saReq++;
      const r = await fetch('https://api.searchad.naver.com' + uri + '?' + qs, { headers, signal: ctl.signal });
      if (r.status === 200) { const j = await r.json(); return (j && j.keywordList) || []; }
      if (r.status === 422 || r.status === 429) { await sleep(2000 * attempt); continue; }
      if (r.status === 401 || r.status === 403) { SA_OFF = true; log('⚠ 검색광고 API 인증 실패(HTTP ' + r.status + ') — 키 파일 값을 확인하세요. 이번 실행은 자동완성만 씁니다.'); return null; }
      log('⚠ 검색광고 API HTTP ' + r.status + ' — 이 묶음은 건너뜀'); return null;
    } catch (e) { if (attempt === 3) { log('⚠ 검색광고 API 연결 실패 — ' + String(e.message || e).slice(0, 80)); return null; } await sleep(1000 * attempt); }
    finally { clearTimeout(t); await sleep(SA_GAP); }
  }
  return null;
}
/* 여러 키워드의 월간 검색수 — 캐시 우선, 모자란 것만 5개씩 묶어 순차 조회. 반환 Map(saKey → {pc,mo,total,lt}) */
async function saVolumes(words) {
  const out = new Map();
  const creds = loadCreds();
  const need = [];
  for (const w of words) {
    const k = saKey(w); if (!k || out.has(k)) continue;
    const c = cache().sa[k];
    if (c && ageH(c.at) <= SA_TTL_H) out.set(k, c); else if (k.length <= 50) need.push(k);
  }
  if (!creds || SA_OFF || !need.length) return { map: out, on: !!creds && !SA_OFF };
  const uniq = [...new Set(need)];
  for (let i = 0; i < uniq.length && !SA_OFF; i += 5) {
    const chunk = uniq.slice(i, i + 5);
    const list = await saBatch(creds, chunk);
    if (!list) continue;
    const at = new Date().toISOString();
    const got = new Map(list.map((x) => [saKey(x.relKeyword), x]));
    for (const k of chunk) {
      const x = got.get(k);
      let v;
      if (x) { const pc = saNum(x.monthlyPcQcCnt), mo = saNum(x.monthlyMobileQcCnt); v = { pc: pc.n, mo: mo.n, total: pc.n + mo.n, lt: pc.lt && mo.lt, at }; }
      else v = { pc: 0, mo: 0, total: 0, lt: true, miss: true, at };   /* 키워드도구가 그 표기를 모른다 = 사실상 검색량 없음 */
      cache().sa[k] = v; out.set(k, v);
    }
  }
  return { map: out, on: !SA_OFF };
}

/* ── 수요 판정 ─────────────────────────────────────────────────────────── */
function tierFromMonthly(n) { return n >= 50000 ? 3 : n >= 5000 ? 2 : n >= 500 ? 1 : 0; }
function tierFromAc(n) { return n == null ? null : n <= 0 ? 0 : n <= 3 ? 1 : 2; }
/* ★09-23 질의 단위 판정표(파일 머리 주석) — gameN = 게임 단위 제안 수(보조 신호) · qa = acQuery 결과 */
function tierFromQuery(gameN, qa) {
  if (gameN == null) return null;                 /* 게임조차 못 쟀다 → 보류 */
  if (gameN <= 0) return 0;                       /* 게임 자체 검색 흔적 없음 */
  const m = qModeOf(qa);
  if (m === 'game') return tierFromAc(gameN);     /* 질의를 못 쟀다 → 옛 게임 단위 표로 fail-open */
  if (m === 'gameonly') return Math.min(1, tierFromAc(gameN));
  return m === 'rank' ? 3 : m === 'full' ? 2 : m === 'short' ? 1 : 0;
}
/* 한 항목의 demand. saMap 은 미리 모아 둔 월간 검색수(없으면 null). qa = 질의 단위 자동완성(없으면 게임 단위로 대체). */
function demandOf(acB, sa, game, keywords, qa) {
  const d = { tier: null, src: 'none', ac: acB ? acB.n : null };
  if (acB && acB.q && normKey(acB.q) !== normKey(cleanGame(game))) d.acQ = acB.q;
  if (qa && qa.q) { d.q = qa.q; d.acRank = qa.rank == null ? null : qa.rank; d.qMode = qModeOf(qa); if (d.qMode === 'short') d.qHit = qa.short.q; }
  if (sa && sa.on) {
    const gk = saKey(cleanGame(game)), gv = sa.map.get(gk);
    let kwBest = null;
    (keywords || []).forEach((kw) => { const k = saKey(kw); if (!k || k === gk) return; const v = sa.map.get(k); if (v && !v.miss && (!kwBest || v.total > kwBest.n)) kwBest = { q: String(kw), n: v.total }; });
    if (gv) d.game = gv.total;
    if (kwBest) d.kw = kwBest;
    if (gv || kwBest) {
      d.src = 'searchad';
      /* 키워드 단위가 있으면 그걸로, 없으면 게임 단위 — 단 «이 질문 자체»의 검색량이 미확인이라 1 로 캡 */
      d.tier = kwBest && kwBest.n >= 10 ? tierFromMonthly(kwBest.n) : Math.min(1, tierFromMonthly(gv ? gv.total : 0));
      return d;
    }
  }
  if (acB) { d.src = 'ac'; d.tier = tierFromQuery(acB.n, qa); if (!d.qMode) d.qMode = qModeOf(qa); }
  return d;
}

/* ── AI 브리핑 ─────────────────────────────────────────────────────────── */
function aibCachePath(q) { return path.join(AIB_CACHE, crypto.createHash('sha1').update(q, 'utf8').digest('hex') + '.json'); }
function aibSummary(r) {
  if (!r || !r.status) return null;
  const s = ['shown', 'async', 'none'].includes(r.status) ? r.status : 'unknown';
  const src = Array.isArray(r.sources) ? r.sources : [];
  const rankOf = (id) => { const h = src.find((x) => String(x.blog || '') === id || String(x.url || '').includes('blog.naver.com/' + id + '/')); return h ? h.rank : null; };
  return { s, n: src.length, bd: rankOf(BLOG.bd), yd: rankOf(BLOG.yd), at: r.fetchedAt || null };
}
function aibFromCache(q) {
  try { const d = JSON.parse(fs.readFileSync(aibCachePath(q), 'utf8')); if (ageH(d.fetchedAt) <= AIB_TTL_H) return d; } catch (e) { }
  return null;
}
let aibNet = 0;
/* 질의 목록 → Map(q → 요약). 캐시 적중은 공짜, 나머지는 budget 까지만 aib-check.py 로(순차·8초 간격). */
function aibLookup(qs, budget) {
  const out = new Map(), miss = [];
  for (const q of [...new Set(qs.filter(Boolean))]) { const c = aibFromCache(q); if (c) out.set(q, aibSummary(c)); else miss.push(q); }
  const run = OFFLINE ? [] : miss.slice(0, Math.max(0, budget));
  if (run.length) {
    const tmp = path.join(os.tmpdir(), 'desk-aib-' + process.pid + '.json'), res = tmp.replace('.json', '-out.json');
    fs.writeFileSync(tmp, JSON.stringify(run.map((q, i) => ({ id: 'q' + i, q }))), 'utf8');
    log('  · AI 브리핑 실검색 ' + run.length + '질의(캐시 적중 ' + out.size + ') — 질의당 약 10초');
    const r = cp.spawnSync('python', [AIB_PY, '--file', tmp, '--json', res, '--max', String(run.length), '--gap', '8'],
      { encoding: 'utf8', timeout: run.length * 25000 + 90000, env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }), windowsHide: true });
    if (r.error) log('⚠ aib-check 실행 실패: ' + r.error.message);
    const j = readJson(res, null);
    ((j && j.results) || []).forEach((x) => { if (x && x.q) out.set(x.q, aibSummary(x)); });
    aibNet += run.length;
    try { fs.unlinkSync(tmp); fs.unlinkSync(res); } catch (e) { }
  }
  return out;
}

/* ── 판정 · 정렬 ───────────────────────────────────────────────────────── */
function aibRank(a) {
  if (!a) return 2;
  if (a.s === 'shown') return (a.bd || a.yd) ? 3 : 0;   /* 뜨는데 우리 미인용 = 가장 좋은 자리 · 이미 인용 = 지키는 자리 */
  if (a.s === 'async') return 1;
  if (a.s === 'none') return 4;
  return 2;
}
function sortKey(it, idx) {
  const d = it.demand || {}, t = d.tier == null ? -0.5 : d.tier;
  return [-t, aibRank(it.aib), d.acRank == null ? 99 : Number(d.acRank), idx];   /* ★09-23 heat 제외(조사원 주관값) · 질의 순위로 대체 */
}
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
/* items: [{sec, ...}] (한 에디션 전체 또는 후보 전체). 반환 {keep:[], drop:[{it, rule, why}]} — 입력 순서는 보존 */
/* ── 깊이(2026-09-21 · 사용자 «회원가입·설치·하는 법은 너무 기초다») ───────────────────────────
   entry = 그 게임을 «아직 안 하는 사람»의 질의(설치·가입·계정 연동·삭제·사양·하는 법·초보 가이드)
   play  = 이미 하는 사람의 질의(공략·빌드·조합·효율·우선순위·티어·확률…)   news = 출시·패치 발표 그 자체
   판정 대상은 «제목»이 아니라 **타깃 질의(keywords[0])** 다 — 제목의 부제에 «…하는 법»이 붙는 건 흔해서 제목으로 재면 실전형까지 진입형이 된다.
   실측(09-15~21 · 117건): 진입형 21건의 발주율 14% vs 그 밖 24% — 그리고 발주된 진입형 3건은 전부 신작이거나 진입 경로가 바뀐 경우였다. */
const ENTRY_RE = /하는\s?법|하는법|게임\s?방법|플레이\s?방법|설치|다운로드|회원\s?가입|계정\s?(연동|만들기)|연동\s?(순서|방법)|삭제|제거|언인스톨|사양|요구\s?사항|입문|초보\s?가이드|처음\s?시작|접속\s?오류|한글\s?패치|쿠폰\s?(등록|입력|사용)\s?(방법|법)/;
/* ★판정은 기계가만 한다 — 항목이 `depth` 를 스스로 선언해 R5 를 비껴가지 못하게(예외는 `entryOk` 사유 한 곳으로만 연다).
   test-desk 의 독립 게이트도 같은 규칙이라, 둘이 갈라지지 않는다. */
function depthOf(it) {
  const q = String(((it && it.keywords) || [])[0] || (it && it.q) || (it && it.title) || '');
  if (ENTRY_RE.test(q)) return 'entry';
  if (angleTypeOf(it || {}) === 'news') return 'news';
  return 'play';
}
/* 진입형을 허용할 게임 = 최근 14판의 «신작» 칸에 올랐던 게임(= 막 나온 게임). 그 밖의 예외는 항목이 `entryOk`(사유)로 들고 온다. */
function newGamesFrom(doc, days) {
  const out = new Set();
  const eds = ((doc && doc.editions) || []).filter((e) => e && e.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, days || 14);
  eds.forEach((e) => (e.sections || []).forEach((s) => {
    if (s.key !== 'new') return;
    (s.items || []).forEach((it) => { if (it && it.game) out.add(normKey(it.game)); });
  }));
  return out;
}

/* ── 블록리스트(09-23 · L95) — _trend/_blocklist.json [{game, angle, until, reason}] · angle = 제목·질의 포함 문자열 | angleType | '*' ── */
function loadBlocklist() {
  const j = readJson(BLOCKLIST, null);
  const arr = Array.isArray(j) ? j : (j && Array.isArray(j.items)) ? j.items : [];
  return arr.filter((b) => b && b.game);
}
const sameGameKey = (a, b) => { const A = normKey(a), B = normKey(b); return !!(A && B && (A === B || A.includes(B) || B.includes(A))); };
function blockHit(it, list, today) {
  if (!it || !it.game || !Array.isArray(list) || !list.length) return null;
  const hay = normKey([it.title, ...((it.keywords || []).map(String)), it.angle, it.q].filter(Boolean).join(' '));
  for (const b of list) {
    if (!b || !b.game) continue;
    if (b.until && String(b.until) < String(today)) continue;   /* until 포함 · 지났으면 무시 */
    if (!sameGameKey(b.game, it.game)) continue;
    const a = String(b.angle == null ? '*' : b.angle).trim();
    if (a === '*' || (ANGLE_TYPES.includes(a) && angleTypeOf(it) === a) || (normKey(a) && hay.includes(normKey(a)))) return b;
  }
  return null;
}
/* X 규칙의 «주제 겹침» — 상위 칸 항목(up)을 «지난 판 항목»처럼 두고 desk-dedup 으로 잰다(OK 가 아니면 겹침) */
function crossOverlap(up, it) {
  try {
    const past = DD.pastItem({ game: up.game, title: up.title, detail: up.detail, angle: up.angle }, 'today', up.sec);
    return DD.judge({ game: it.game, title: it.title }, [past]).verdict !== 'OK';
  } catch (e) { return false; }
}

function judge(items, saOn, ctx) {
  const drop = new Map();
  const mark = (it, rule, why) => { if (!drop.has(it)) drop.set(it, { it, rule, why }); };
  const bl = (ctx && ctx.blocklist) || [], today = (ctx && ctx.today) || kstToday();
  items.forEach((it) => {
    const sec = it.sec, a = angleTypeOf(it), d = it.demand || {}, t = d.tier;
    if (!GAME_SECS.includes(sec)) return;
    const b = blockHit(it, bl, today);
    if (b) mark(it, 'B', '블록리스트 ' + b.game + ' / ' + (b.angle == null ? '*' : b.angle) + ' (~' + (b.until || '무기한') + ')' + (b.reason ? ' — ' + b.reason : ''));
    if (sec === 'new' && t === 0) mark(it, 'R1', '검색 흔적 없음(' + (d.src === 'searchad' ? '월 500 미만' : d.ac === 0 ? '게임 자동완성 0' : '질의 자동완성 없음') + ')');
    if ((sec === 'hot' || sec === 'core') && a === 'news') mark(it, 'R2', sec === 'hot' ? '논평·결과형 화제(how-to 아님)' : '주력 게임 소식(how-to 아님)');
    /* R4 — 수요 최저 구간 = tier 0(★09-23 heat 제거 · 검색광고 연동이면 월 500 미만 · 아니면 질의·게임 자동완성 없음) */
    if (EVENT_SECS.includes(sec) && t === 0) mark(it, 'R4', '수요 최저 구간(' + (d.src === 'searchad' ? '월 500 미만' : d.ac === 0 ? '게임 자동완성 0' : '질의 자동완성 없음') + ')');
    if (sec === 'guide') {
      if (!['howto', 'rank'].includes(a)) mark(it, 'G', '공략 칸인데 각도가 ' + a);
      else if (t === 0) mark(it, 'G', '공략 칸인데 수요 없음');
    }
    /* R5 — 진입형은 «신작이거나 진입 경로가 바뀐» 때만. 그 밖엔 이미 그 게임을 하는 사람이 찾지 않는다. */
    if (depthOf(it) === 'entry') {
      const newG = (ctx && ctx.newGames) || new Set();
      const ok = (it.entryOk && String(it.entryOk).trim()) || newG.has(normKey(it.game));
      if (!ok) mark(it, 'R5', '진입형 질의(설치·가입·하는 법) — 신작도 아니고 진입 경로 변경 근거(entryOk)도 없음');
    }
  });
  const alive = (it) => !drop.has(it);
  const byKey = (list) => list.map((it) => ({ it, k: sortKey(it, items.indexOf(it)) })).sort((x, y) => cmpKey(x.k, y.k)).map((x) => x.it);
  /* X — 크로스섹션(09-23 · L89 3회째 승격): 상위 칸(pinned>core>guide>new>update>hot)에 같은 게임+같은 angleType 이 살아 있고
     주제가 겹치면(desk-dedup ≠ OK · --cross-strict 면 조건 없음) 뒤 칸을 뺀다. 같은 칸끼리는 조사원·dedup 몫. */
  const strict = !!(ctx && ctx.crossStrict);
  const ordered = items.map((it, i) => ({ it, i })).filter((x) => GAME_SECS.includes(x.it.sec))
    .sort((x, y) => (SEC_PRIORITY[x.it.sec] - SEC_PRIORITY[y.it.sec]) || (x.i - y.i));
  ordered.forEach((x, k) => {
    if (!alive(x.it)) return;
    for (let j = 0; j < k; j++) {
      const up = ordered[j].it;
      if (!alive(up) || up.sec === x.it.sec) continue;
      if (!sameGameKey(up.game, x.it.game) || angleTypeOf(up) !== angleTypeOf(x.it)) continue;
      if (!strict && !crossOverlap(up, x.it)) continue;
      mark(x.it, 'X', '같은 회차 ' + up.sec + ' 칸에 같은 게임·같은 각도(' + angleTypeOf(up) + (strict ? '' : ')·주제 겹침') + ': «' + String(up.title || '').slice(0, 30) + '»');
      break;
    }
  });
  /* R3 — pinned 게임당 news ≤ 1 */
  const pg = {};
  items.filter((it) => it.sec === 'pinned' && alive(it) && angleTypeOf(it) === 'news').forEach((it) => { (pg[normKey(it.game)] = pg[normKey(it.game)] || []).push(it); });
  Object.values(pg).forEach((list) => byKey(list).slice(1).forEach((it) => mark(it, 'R3', '지정 게임 소식은 게임당 1건(패치 세부 나열 금지)')));
  /* W1 — new·update·hot news 합 ≤ 2 */
  byKey(items.filter((it) => EVENT_SECS.includes(it.sec) && alive(it) && angleTypeOf(it) === 'news')).slice(NEWS_MAX_EVENT)
    .forEach((it) => mark(it, 'W1', '소식형은 신작·업데이트·화제 합쳐 하루 ' + NEWS_MAX_EVENT + '건까지'));
  /* W1 — 칸 상한 */
  Object.entries(CAPS).forEach(([sec, cap]) => byKey(items.filter((it) => it.sec === sec && alive(it))).slice(cap)
    .forEach((it) => mark(it, 'W1', sec + ' 칸 상한 ' + cap)));
  return { keep: items.filter(alive), drop: [...drop.values()] };
}
/* 칸 안 정렬 — pinned 는 게임 묶음 순서 유지 */
function sortSection(key, items) {
  if (key === 'parenting' || items.length < 2) return items;
  const idx = new Map(items.map((it, i) => [it, i]));
  const cmp = (a, b) => cmpKey(sortKey(a, idx.get(a)), sortKey(b, idx.get(b)));
  if (key !== 'pinned') return items.slice().sort(cmp);
  const order = [], groups = {};
  items.forEach((it) => { const g = normKey(it.game); if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(it); });
  return order.flatMap((g) => groups[g].slice().sort(cmp));
}

/* ── 신호 계산(공통) ───────────────────────────────────────────────────── */
async function computeSignals(items, aibBudget) {
  const gameItems = items.filter((it) => GAME_SECS.includes(it.sec));
  /* ⑴ 자동완성 — 게임 단위(보조 신호 · 게임당 한 번) + ★질의 단위(항목마다 · 09-23 · 게임 흔적 0 이면 질의는 재지 않는다) */
  const acByGame = new Map();
  for (const it of gameItems) {
    const gk = normKey(it.game); if (!gk || acByGame.has(gk)) continue;
    acByGame.set(gk, await acBest(it.game, it.keywords));
  }
  const qaByItem = new Map();
  for (const it of gameItems) {
    const gAc = acByGame.get(normKey(it.game)) || null;
    qaByItem.set(it, (gAc && gAc.n === 0) ? null : await acQuery(it.game, deriveQuery(it), gAc));
  }
  /* ⑵ 검색광고 — 게임명 + keywords 전량을 한 번에 */
  const words = [];
  gameItems.forEach((it) => { words.push(cleanGame(it.game)); (it.keywords || []).slice(0, 4).forEach((k) => words.push(String(k))); });
  const sa = await saVolumes(words);
  /* ⑶ AI 브리핑 — guide → pinned → core 순으로 상한까지 */
  const aibItems = AIB_SECS.flatMap((s) => gameItems.filter((it) => it.sec === s));
  const aib = aibLookup(aibItems.map(deriveQuery), aibBudget);
  for (const it of gameItems) {
    it.angleType = angleTypeOf(it);
    const q = deriveQuery(it), qa = qaByItem.get(it) || null;
    it.demand = demandOf(acByGame.get(normKey(it.game)) || null, sa, it.game, it.keywords, qa);
    if (it.demand.q == null) it.demand.q = (qa && qa.q) || q;         /* 측정 질의는 못 쟀어도 기록한다(stamp 계약) */
    if (!('acRank' in it.demand)) it.demand.acRank = null;
    if (AIB_SECS.includes(it.sec)) { const s = aib.get(q); if (s) it.aib = Object.assign({ q }, s); }
    if (it.demand.src === 'searchad' && it.demand.tier != null) it.heat = Math.max(1, Math.min(3, it.demand.tier));   /* 검색량이 있으면 화제도는 기계가 매긴다 */
  }
  return { saOn: sa.on };
}
function fmtDemand(d) {
  if (!d || d.tier == null) return '수요 ?';
  const lab = ['없음', '낮음', '보통', '높음'][d.tier];
  if (d.src === 'searchad') return '수요 ' + lab + (d.kw ? ' · «' + d.kw.q + '» 월 ' + d.kw.n.toLocaleString() : d.game != null ? ' · 게임 월 ' + Number(d.game).toLocaleString() : '');
  const qd = { rank: '질의 top' + d.acRank, full: '질의 있음', short: '축약만«' + (d.qHit || '') + '»', none: '질의 없음', gameonly: '질의=게임명', game: '질의 못 잼' }[d.qMode] || '';
  return '수요 ' + lab + (qd ? ' · ' + qd : '') + ' · 게임 자동완성 ' + d.ac + (d.acQ ? '(«' + d.acQ + '»)' : '');
}
function fmtAib(a) {
  if (!a) return '';
  if (a.s === 'shown') return '브리핑 뜸·출처 ' + a.n + (a.bd ? ' · 봄딩 ' + a.bd + '위' : '') + (a.yd ? ' · 영도 ' + a.yd + '위' : '') + (a.bd || a.yd ? '' : ' · 우리 미인용');
  return { async: '브리핑 뜸·출처 미열람', none: '브리핑 안 뜸', unknown: '브리핑 확인 실패' }[a.s] || '';
}

/* ── 명령: check ───────────────────────────────────────────────────────── */
async function cmdCheck() {
  const inp = val('--in', null);
  if (!inp) { log('사용: desk-signals.cjs check --in <후보.json> [--json out.json]'); process.exit(2); }
  const raw = readJson(inp, null);
  const items = (Array.isArray(raw) ? raw : (raw && raw.items) || []).filter((x) => x && x.sec);
  if (!items.length) { log('후보가 비었다: ' + inp); process.exit(2); }
  const { saOn } = await computeSignals(items, Number(val('--aib-max', '30')) || 0);
  if (!OFFLINE) saveCache();   /* 오프라인 실행은 캐시를 건드리지 않는다(테스트·픽스처 실행 무흔적) */
  const ctx = { newGames: newGamesFrom(readJson(TREND, null), 14), blocklist: loadBlocklist(), today: kstToday(), crossStrict: has('--cross-strict') };
  const { drop } = judge(items, saOn, ctx);
  const dropSet = new Map(drop.map((d) => [d.it, d]));
  console.log('\n신호 · 판정 — 후보 ' + items.length + '건 · 검색량 ' + (saOn ? '연동' : '미연동(자동완성·질의 단위)') + ' · 자동완성 요청 ' + acReq + ' · 검색광고 요청 ' + saReq + ' · 브리핑 실검색 ' + aibNet +
    ' · 블록리스트 ' + ctx.blocklist.length + '건 · 크로스섹션 ' + (ctx.crossStrict ? 'strict' : '주제 겹침 조건'));
  GAME_SECS.concat(['parenting']).forEach((sec) => {
    const list = items.filter((it) => it.sec === sec); if (!list.length) return;
    console.log('\n[' + sec + '] ' + list.length + '건');
    sortSection(sec, list).forEach((it) => {
      const d = dropSet.get(it);
      console.log('  ' + (d ? 'DROP ' + d.rule.padEnd(3) : 'KEEP    ') + ' ' + String(it.id || '').padEnd(6) + ' ' + (it.game || '') + ' | ' + (it.title || '').slice(0, 48) +
        (sec === 'parenting' ? '' : '  [' + DEPTH_KO[depthOf(it)] + ' · ' + it.angleType + ' · ' + fmtDemand(it.demand) + (it.aib ? ' · ' + fmtAib(it.aib) : '') + ']') + (d ? '  ← ' + d.why : ''));
    });
  });
  const out = val('--json', null);
  if (out) writeJson(out, { checkedAt: new Date().toISOString(), saOn, blocklist: ctx.blocklist.length, crossStrict: ctx.crossStrict, items: items.map((it) => ({ id: it.id, sec: it.sec, game: it.game, title: it.title, angleType: it.angleType, depth: GAME_SECS.includes(it.sec) ? depthOf(it) : undefined, demand: it.demand, aib: it.aib || null, heat: it.heat, verdict: dropSet.has(it) ? 'DROP' : 'KEEP', rule: dropSet.has(it) ? dropSet.get(it).rule : null, why: dropSet.has(it) ? dropSet.get(it).why : null })) });
  console.log('\n→ DROP ' + drop.length + '건' + (drop.length ? ' (' + Object.entries(drop.reduce((m, d) => { m[d.rule] = (m[d.rule] || 0) + 1; return m; }, {})).map(([k, v]) => k + ' ' + v).join(' · ') + ')' : '') +
    ' — DROP 은 검증에 넘기지 말고 note 한 줄에 «거둬냄 N건(규칙별)»으로 남긴다.');
}

/* ── 명령: stamp ───────────────────────────────────────────────────────── */
async function cmdStamp() {
  const doc = readJson(TREND, null);
  if (!doc || !Array.isArray(doc.editions) || !doc.editions.length) { log('trend.json 이 없거나 비었다'); process.exit(2); }
  const date = val('--date', null) || doc.editions.map((e) => e.date).sort().reverse()[0];
  const ed = doc.editions.find((e) => e.date === date);
  if (!ed) { log('에디션 없음: ' + date); process.exit(2); }
  if (date < RULE_FROM && !has('--force')) { log('시행일(' + RULE_FROM + ') 이전 판은 손대지 않는다: ' + date + ' (--force 로만)'); process.exit(2); }
  const items = [];
  (ed.sections || []).forEach((s) => (s.items || []).forEach((it) => { if (it) { it.sec = s.key; items.push(it); } }));
  const before = JSON.stringify(ed);
  const { saOn } = await computeSignals(items, Number(val('--aib-max', '10')) || 0);
  if (!OFFLINE) saveCache();
  const ctx = { newGames: newGamesFrom(doc, 14), blocklist: loadBlocklist(), today: date, crossStrict: has('--cross-strict') };
  const { drop } = judge(items, saOn, ctx);
  const dropSet = new Set(drop.map((d) => d.it));
  (ed.sections || []).forEach((s) => {
    s.items = sortSection(s.key, (s.items || []).filter((it) => it && !dropSet.has(it)));
    s.items.forEach((it) => { delete it.sec; });
  });
  items.forEach((it) => { if (!dropSet.has(it) && it.angleType) it.depth = depthOf(it); delete it.sec; });
  const changed = JSON.stringify(ed) !== before;
  const mix = {}, dep = {}; items.filter((it) => !dropSet.has(it) && it.angleType).forEach((it) => { mix[it.angleType] = (mix[it.angleType] || 0) + 1; dep[it.depth] = (dep[it.depth] || 0) + 1; });
  console.log('stamp ' + date + ' — 게임 항목 ' + items.filter((it) => it.angleType).length + '건 · 검색량 ' + (saOn ? '연동' : '미연동') +
    ' · 각도 ' + ANGLE_TYPES.map((k) => k + ' ' + (mix[k] || 0)).join(' / ') +
    ' · 깊이 ' + ['play', 'entry', 'news'].map((k) => DEPTH_KO[k] + ' ' + (dep[k] || 0)).join(' / '));
  if (drop.length) {
    console.log('★BACKSTOP 거둬냄 ' + drop.length + '건 — check 단계에서 빠졌어야 할 항목이다. note 의 «거둬냄» 줄에 합산할 것:');
    drop.forEach((d) => console.log('   - [' + d.rule + '] ' + (d.it.game || '') + ' | ' + String(d.it.title || '').slice(0, 50) + ' ← ' + d.why));
  }
  if (has('--dry')) { console.log('(--dry — 파일은 쓰지 않았다)'); return; }
  if (changed) { writeJson(TREND, doc, 2); console.log('→ trend.json 갱신(정렬·신호 기록). 다음: build-trend-lite → test-desk'); }
  else console.log('→ 변경 없음(멱등)');
}

/* ── 명령: seeds ───────────────────────────────────────────────────────── */
async function fetchPins() {
  if (OFFLINE) return [];
  try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000); const r = await fetch(API + '/pins?ts=' + Date.now(), { signal: ctl.signal }); clearTimeout(t); const j = await r.json(); return (j && Array.isArray(j.games)) ? j.games : []; } catch (e) { return []; }
}
async function cmdSeeds(opts) {
  const doc = readJson(TREND, { editions: [] });
  const s = readJson(SEEDS, null) || { schema: 1, games: {} };
  const today = kstToday(), cutoff = new Date(Date.parse(today + 'T00:00:00+09:00') - 56 * 86400e3 + 9 * 3600e3).toISOString().slice(0, 10);
  (doc.editions || []).forEach((e) => (e.sections || []).forEach((sec) => {
    if (!EVENT_SECS.includes(sec.key)) return;
    (sec.items || []).forEach((it) => {
      if (!it || !it.game) return;
      const k = normKey(it.game); const g = s.games[k] || (s.games[k] = { game: it.game, first: e.date, last: e.date, days: [] });
      if (e.date < g.first) g.first = e.date; if (e.date > g.last) { g.last = e.date; g.game = it.game; }
      if (!g.days.includes(e.date)) g.days.push(e.date);
    });
  }));
  Object.keys(s.games).forEach((k) => { const g = s.games[k]; g.days = g.days.filter((d) => d >= cutoff).sort(); if (g.last < cutoff) delete s.games[k]; });
  s.updated = new Date().toISOString();
  writeJson(SEEDS, s, 1);
  const pins = (await fetchPins()).map(normKey);
  const core = ((readJson(CORE, {}) || {}).balanced || []).map((x) => normKey(x.game || x));
  const dayMs = (d) => Date.parse(d + 'T00:00:00+09:00');
  const scored = Object.values(s.games).filter((g) => !pins.includes(normKey(g.game)) && !core.includes(normKey(g.game))).map((g) => {
    const since = Math.round((dayMs(today) - dayMs(g.last)) / 86400e3);
    return { game: g.game, days: g.days.length, last: g.last, score: g.days.length + (since <= 7 ? 3 : since <= 14 ? 2 : since <= 28 ? 1 : 0) };
  }).sort((a, b) => b.score - a.score || (a.last < b.last ? 1 : -1));
  const top = Math.max(1, Number((opts && opts.top) || val('--top', '12')) || 12);
  const pick = scored.slice(0, top);
  if (!opts || opts.print !== false) {
    console.log('guide 시드 — 원장 ' + Object.keys(s.games).length + '종(56일) · 지정·주력 제외 후 상위 ' + pick.length);
    pick.forEach((g, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + g.game + '  (등장 ' + g.days + '일 · 마지막 ' + g.last + ')'));
  }
  return pick.map((g) => g.game);
}

/* ── 명령: queries ─────────────────────────────────────────────────────── */
const HOWTO_ANGLES = ['공략·방법형', '쿠폰형', '추천·티어·비교형'];
function staleMonth(q) {
  const m = String(q).match(/(\d{1,2})\s*월/); if (!m) return false;
  const now = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1;
  return Number(m[1]) !== now;
}
async function cmdQueries() {
  let games = (val('--games', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!games.length && has('--seeds')) games = await cmdSeeds({ top: Number(val('--seeds', '12')) || 12, print: true });
  if (!games.length) { log('사용: desk-signals.cjs queries --games "a,b" | --seeds 12'); process.exit(2); }
  if (!has('--no-mine') && !OFFLINE) {
    log('  · 질의 발굴(query-miner) ' + games.length + '종 — 게임당 약 13요청·250ms 간격');
    const r = cp.spawnSync(process.execPath, [MINER, '--games', games.join(','), '--max-req', '600'], { encoding: 'utf8', timeout: 20 * 60e3, windowsHide: true });
    if (r.status !== 0 || r.error) log('⚠ query-miner 실패 — 저장된 질의로 진행: ' + String((r.error && r.error.message) || r.stderr || '').slice(0, 120));
  }
  const qdoc = readJson(QUERIES, { games: [] });
  const want = new Set(games.map(normKey));
  const cands = [];
  (qdoc.games || []).filter((g) => want.has(normKey(g.game))).forEach((g) => {
    const seen = new Set();
    g.queries.forEach((q) => {
      if (q.nav || !HOWTO_ANGLES.includes(q.angle) || staleMonth(q.q)) return;
      if (Object.values(q.covered || {}).some((a) => a && a.length)) return;   /* 봄딩·영도 어느 쪽이든 이미 쓴 각도 */
      const rest = cleanGame(String(q.q).replace(gameRe(g.game), ' ')).split(' ').filter(Boolean);
      const key = q.angle === '쿠폰형' ? 'coupon' : normKey(rest[0] || q.q);   /* 같은 뜻 변형(쿠폰 번호·쿠폰 입력·쿠폰 코드)은 한 묶음 */
      if (seen.has(key)) return; seen.add(key);
      cands.push({ game: g.game, q: q.q, angle: q.angle, keywords: [q.q] });
    });
  });
  if (!cands.length) { console.log('발주 후보 질의 0건(전부 기존 글이 덮었거나 이동형)'); return; }
  const acByGame = new Map();
  for (const c of cands) { const k = normKey(c.game); if (!acByGame.has(k)) acByGame.set(k, await acBest(c.game, [])); }
  const sa = await saVolumes(cands.flatMap((c) => [cleanGame(c.game), c.q]));
  cands.forEach((c) => {
    c.demand = demandOf(acByGame.get(normKey(c.game)) || null, sa, c.game, [c.q]);
    if (c.demand.src === 'ac' && c.demand.tier === 0) c.demand.tier = 1;   /* 자동완성에 실제로 뜬 질의다 — 바닥은 1 */
  });
  const pre = cands.slice().sort((a, b) => (b.demand.tier || 0) - (a.demand.tier || 0));
  const aib = aibLookup(pre.slice(0, Number(val('--aib-max', '15')) || 0).map((c) => c.q), Number(val('--aib-max', '15')) || 0);
  cands.forEach((c) => { const s = aib.get(c.q) || aibSummary(aibFromCache(c.q)); if (s) c.aib = s; });
  saveCache();
  const ang = { '공략·방법형': 0, '쿠폰형': 1, '추천·티어·비교형': 2 };
  /* ★같은 수요 구간이면 «실전형»을 앞세운다(2026-09-21) — 채굴 순서대로 두면 머리 질의(하는 법·설치)가 늘 위에 와서
     게임당 상한에 진입형만 남았다(09-21 공략 칸 6건 중 4건). */
  const rankKeyOf = (c, i) => [-(c.demand.tier == null ? -0.5 : c.demand.tier), depthOf({ keywords: [c.q], title: c.q }) === 'entry' ? 1 : 0, aibRank(c.aib), ang[c.angle], i];
  const ranked = cands.map((c, i) => ({ c, k: rankKeyOf(c, i) }))
    .sort((x, y) => cmpKey(x.k, y.k)).map((x) => x.c);
  /* ★게임당 상한(2026-09-20) — 09-19 첫 판에서 상위 20건이 시드 12종 중 6종(메이플 6·오버워치 5·롤 4)에 몰려,
     공략 조사원이 «같은 게임 2건» 규칙과 부딪혀 6건밖에 못 냈다. 게임을 고루 섞어야 상한만큼 뽑힌다.
     --games 로 게임을 직접 준 때(지정·주력)는 그 게임 몫을 다 봐야 하므로 기본 상한 없음. */
  const PERGAME = Math.max(0, Number(val('--per-game', has('--seeds') ? '3' : '0')) || 0);
  let pool = ranked;
  if (PERGAME) {
    const cnt = new Map();
    pool = ranked.filter((c) => { const k = normKey(c.game), n = cnt.get(k) || 0; if (n >= PERGAME) return false; cnt.set(k, n + 1); return true; });
  }
  const top = pool.slice(0, Math.max(1, Number(val('--top', '20')) || 20));
  /* ★09-23 — 상위 후보만 «질의 단위»로 다시 잰다(check 와 같은 자 · ≤top 요청). 채굴된 질의라 원문이 자동완성에 있는 게 정상 → 바닥은 1. */
  for (const c of top) {
    const gAc = acByGame.get(normKey(c.game)) || null;
    const qa = (gAc && gAc.n === 0) ? null : await acQuery(c.game, c.q, gAc);
    c.demand = demandOf(gAc, sa, c.game, [c.q], qa);
    if (c.demand.src === 'ac' && c.demand.tier === 0 && gAc && gAc.n > 0) c.demand.tier = 1;
    if (c.demand.q == null) c.demand.q = c.q;
  }
  if (!OFFLINE) saveCache();
  const topIdx = new Map(top.map((c, i) => [c, i]));
  top.sort((a, b) => cmpKey(rankKeyOf(a, topIdx.get(a)), rankKeyOf(b, topIdx.get(b))));
  const gamesInTop = new Set(top.map((c) => normKey(c.game))).size;
  console.log('\n질의 빈칸 — ' + games.length + '종에서 ' + cands.length + '건(이동형·기존 글·지난달 제외) · 상위 ' + top.length + '건 / ' + gamesInTop + '종' + (PERGAME ? ' · 게임당 최대 ' + PERGAME : ''));
  top.forEach((c, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + c.game + ' | ' + c.q + '  [' + DEPTH_KO[depthOf({ keywords: [c.q], title: c.q })] + ' · ' + c.angle + ' · ' + fmtDemand(c.demand) + (c.aib ? ' · ' + fmtAib(c.aib) : '') + ']'));
  const out = val('--json', null);
  if (out) { writeJson(out, { at: new Date().toISOString(), games, items: top }, 1); console.log('→ ' + out); }
  console.log('★질의가 있다 ≠ 지금 쓸 수 있다 — 조사원이 1차 자료(공식·위키)로 답을 확인한 질의만 발주한다.');
}

/* ── 명령: parenting — 육아 칸 «주 1회» 판정 ─────────────────────────────────
   그 주(월~일, KST)에 육아 칸이 실린 판이 이미 있으면 SKIP, 없으면 DUE. 보통 월요일 판이 DUE 가 되고,
   월요일 회차가 죽었으면 그 주 다음 판이 이어받는다(요일을 사람이 계산하지 않게 — 규칙 = SKILL [A-3]).
   --date 로 «오늘»을 바꿔 시험할 수 있다. 출력 첫 낱말이 DUE|SKIP 이고 exit 0. */
function cmdParenting() {
  const doc = readJson(TREND, { editions: [] });
  const today = val('--date', null) || kstToday();
  const t = new Date(today + 'T12:00:00Z');
  const mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400e3).toISOString().slice(0, 10);
  const hit = (doc.editions || []).filter((e) => e && e.date >= mon && e.date <= today && e.date !== (has('--include-today') ? '' : today) &&
    ((((e.sections || []).find((s) => s && s.key === 'parenting') || {}).items || []).filter(Boolean).length));
  if (hit.length) console.log('SKIP 이번 주(' + mon + '~) 육아 판 있음: ' + hit.map((e) => e.date).join(', ') + ' — 오늘 판 육아 칸은 0건(note 줄 불필요 · 사이트가 «주 1회»를 그린다)');
  else console.log('DUE 이번 주(' + mon + '~) 육아 판 없음 — 오늘 판에 육아 3픽(SKILL [A-3])');
  return Promise.resolve();
}

/* ── 진입 ─────────────────────────────────────────────────────────────── */
/* ── 글 → 발주 경로(칸)  (aib-followup · 2026-09-19 · 계획서 W4-1 «분류·각도별 브리핑 진입률») ─────────────
   글 폴더 = 백엔드 요청 postRel 에서 파일명을 뺀 것. trend-desk 요청은 발주 제목(topic)을 데스크 항목 제목과 맞춰 칸 키를 얻는다.
   ★D+14 쯤엔 그 판이 trend.json(14판)에서 빠지므로 글을 «등록할 때» 한 번 정해 박아 둔다(aib-followup). */
async function getRequests(ms) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 20000);
    const r = await fetch(API + '/requests?ts=' + Date.now(), { signal: ctl.signal });
    clearTimeout(t);
    if (r.status !== 200) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (e) { return null; }
}
function deskItems(doc) {
  const out = [];
  ((doc && doc.editions) || []).forEach((e) => ((e && e.sections) || []).forEach((s) => ((s && s.items) || []).forEach((it) => {
    if (it && it.title) out.push({ date: e.date, sec: s.key, title: it.title });
  })));
  return out;
}
/* trend-desk → 칸 키(판에서 못 찾으면 desk?) · site·pwa → direct(사람이 직접 적은 주제) · briefing → 08-14 이전 작성자별 브리핑 ·
   그 밖 → other · 요청을 못 찾거나 백엔드를 못 읽으면 unknown(추정으로 채우지 않는다). 같은 폴더 요청이 여럿이면 가장 늦은 것. */
function secOfPost(folder, reqs, items) {
  if (!Array.isArray(reqs)) return 'unknown';
  let r = null;
  reqs.forEach((x) => {
    if (!x || typeof x.postRel !== 'string' || x.postRel.split('/').slice(0, -1).join('/') !== folder) return;
    if (!r || (x.createdAt || 0) > (r.createdAt || 0)) r = x;
  });
  if (!r) return 'unknown';
  if (r.source === 'trend-desk') {
    const k = normKey(r.topic);
    const hit = (items || []).find((x) => normKey(x.title) === k);
    return hit ? hit.sec : 'desk?';
  }
  if (r.source === 'site' || r.source === 'pwa') return 'direct';
  if (r.source === 'briefing') return 'briefing';
  return 'other';
}

module.exports = { angleOf, angleTypeOf, deriveQuery, tierFromMonthly, tierFromAc, tierFromQuery, qModeOf, contentTokens, queryWithGame, demandOf, judge, sortSection, sortKey, aibRank, aibSummary, aibLookup, aibFromCache, saSign, saKey, saNum, gameVariants, staleMonth, CAPS, RULE_FROM, SEC_PRIORITY, getRequests, deskItems, secOfPost, depthOf, newGamesFrom, DEPTH_KO, blockHit, loadBlocklist, crossOverlap, sameGameKey };

if (require.main === module) {
  const cmd = argv[0];
  const run = { check: cmdCheck, stamp: cmdStamp, seeds: () => cmdSeeds({}), queries: cmdQueries, parenting: cmdParenting }[cmd];
  if (!run) { log('사용: desk-signals.cjs <queries|check|stamp|seeds|parenting> … (파일 머리 주석 참조)'); process.exit(2); }
  run().catch((e) => { log('실패: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
}
