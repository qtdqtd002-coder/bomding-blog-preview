#!/usr/bin/env node
/* =============================================================================
   lolchess.cjs — 롤토체스(TFT) 단일 조사 창구 · 롤체지지(lolchess.gg) 기반 (2026-09-04 신설)

   왜 만들었나
   -----------
   ⑴ **정보 오염.** 롤체지지·OP.GG 는 Next.js SPA 라 화면 표(티어·통계·한국어 명칭)가
      정적 HTML 에 없다. 그래서 WebFetch 로 열면 내부 소형 모델이 «못 읽은 표»를 그럴듯하게
      지어낸다 — 실사고 2건:
        · 09-02 데스크: 증강 최상위 8종 중 **6종의 한국어 명칭이 실제와 달랐고 2종은 존재하지 않는 이름**
        · 09-02 데스크: 티어표 전 행이 **같은 수치로 채워지는 환각 패턴** → 지정 게임 티어표 0건
      숫자가 다 맞아도 «주어»가 뒤집히는 사고(엄호대 12/25/60/120 귀속 반전)도 같은 뿌리다.
   ⑵ **토큰 낭비.** 같은 사실을 찾자고 WebSearch→WebFetch 를 여러 바퀴 돈다. 실측상 WebFetch
      회신의 97.5%가 1KB 미만인데 **회신 300자마다 컨텍스트 전체를 다시 읽는다.**

   그래서 이 도구는 **LLM 을 통과시키지 않는다.** 롤체지지가 페이지에 실어 보내는 JSON 을
   그대로 받아 한국어 명칭으로 치환해 찍는다. 사람도 모델도 «읽고 옮겨적을» 일이 없다.

   무엇을 주나 (전부 롤체지지 1차)
   -------------------------------
     · 메타덱 20여 종(회차마다 변동) — **롤체지지 표기 이름**·점유율·승률·순방률·평균등수·핵심 챔피언·아이템·특성
     · 챔피언·특성·아이템 통계 — 등장률·평균등수
     · 챔피언 160 · 특성 109 · 아이템 272 · 증강 986 **한국어 명칭·설명 정본**
     · 패치노트 전체 — 최신판은 «무엇이 몇에서 몇으로» 원문 그대로(+ 라이엇 공식 대조 URL 자동 출력)
     · 가이드 덱 31 · 스트리머 덱 10
     · ★라이엇 «게임 클라이언트» 원본(Community Dragon 한국어) — **아이템 조합 55종 · 증강 596 이름/설명 ·
       챔피언 기본 능력치 · 특성 단계 구간**. 아래 loadCdragon 주석에 함정 5개와 그 코드 차단법을 적어 뒀다.
     · 어제 스냅샷 대비 **점유율 변동**(신선도 · `angles`)

   무엇을 «못» 주나 — 지어내지 말 것
   ---------------------------------
     · **증강 통계/티어**: `/meta-deck-augments` 가 set18 에서 빈 응답(`{"patchRevisions":[]}`)을
       돌려준다. 서버가 안 준다 — 다른 데서 긁어오지 말고 **그 주제를 쓰지 않는다.**
       (09-02 사고가 정확히 이 칸을 상상으로 채우다 났다. 증강 «명칭·설명»은 `find` 로 조회 가능.)
     · 슬라이스가 하나뿐: `tierId=1`(사이트 기본=마스터+) · `queueId=1100`(랭크) · `dt=3`(최근 2일).
       tierId 0·2·3·4 와 queueId 1160(더블 업)은 전부 `null` 이다(2026-09-04 실측).
       **"다이아 기준" 같은 말을 쓰지 않는다.**

   출처 표기 (글에 실을 때)
   ------------------------
     통계·메타덱 = 롤체지지(lolchess.gg) + **조회 시점·패치·표본 수 병기**. 라이브 트래커라 내일이면 바뀐다.
     게임 규칙·세트 개요·출시일 = **라이엇 공식**이 1차(teamfighttactics.leagueoflegends.com).
     패치노트 본문은 라이엇 원문의 한국어판을 롤체지지가 싣는 것 — 인용 시 공식 패치노트를 함께 확인한다.

   쓰는 법
   -------
     node lolchess.cjs brief                 # 한 장 요약(기본) — 데스크·기획이 먼저 보는 것
     node lolchess.cjs decks   [--top 10]
     node lolchess.cjs champions [--top 20] [--cost 4]
     node lolchess.cjs traits  [--top 20]
     node lolchess.cjs items   [--top 20]
     node lolchess.cjs patch   [--id 558] [--list 10]
     node lolchess.cjs guide-decks | streamer-decks
     node lolchess.cjs find "감시자"          # 명칭 조회 — 롤체지지 + CDragon(라이엇 원본) 동시, 조합 레시피 자동 병기
     node lolchess.cjs recipes ["망토"]       # ★아이템 조합 레시피 55종(라이엇 원본) — 옛 위키 재대조 경로의 대체
     node lolchess.cjs champ "아리"           # ★챔피언 기본 능력치(원본 수치) + 치환된 스킬 설명
     node lolchess.cjs angles                # 데이터에서 파생한 글감 후보 + 어제 대비 변동
     공통: --json(기계 출력) · --refresh(캐시 무시) · --no-snapshot
   캐시 = `_trend/_lolchess/`(기본 180분) · 스냅샷 = `_trend/_lolchess/snapshots/YYYY-MM-DD.json`
============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const API = 'https://tft.dakgg.io/api/v1';
const WEB = 'https://lolchess.gg';
const UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// 서버가 실제로 데이터를 주는 유일한 슬라이스(2026-09-04 실측). 바꾸지 말 것 — 나머지는 null 이다.
const SLICE = { tierId: 1, dt: 3, queueId: 1100 };
const SLICE_LABEL = '마스터+ · 랭크 · 최근 2일(사이트 기본 슬라이스)';

const ROOT      = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '_trend', '_lolchess');
const SNAP_DIR  = path.join(CACHE_DIR, 'snapshots');

const argv = process.argv.slice(2);
const CMD  = (argv[0] && !argv[0].startsWith('--')) ? argv[0] : 'brief';
const flag = (n) => argv.includes('--' + n);
const opt  = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const num  = (n, d) => { const v = Number(opt(n, d)); return Number.isFinite(v) ? v : d; };
const JSON_OUT = flag('json');
const REFRESH  = flag('refresh');
const TTL_MIN  = num('ttl', 180);

/* ── 유틸 ───────────────────────────────────────────────────────────────── */
const KST = (ms) => {
  if (!ms) return '?';
  const d = new Date(Number(ms) + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
const today = () => KST(Date.now()).slice(0, 10);
const n0 = (v) => Number(v).toLocaleString('ko-KR');
const pc = (v, dg = 2) => (Number(v) * 100).toFixed(dg) + '%';
/* ★롤체지지 응답의 `pickRate` 는 분모가 확인되지 않는다(2026-09-04 실측: 상위 덱 1.0782 → 100% 초과,
   plays/총표본 과도 불일치). 그래서 사람이 읽는 출력에는 절대 싣지 않고, 우리가 두 수로 직접 계산한
   «점유율 = 그 항목 표본 ÷ 전체 표본»만 쓴다. 원값은 --json 의 pickRateRaw 로만 넘긴다. */
const share = (plays, total) => (total ? (plays / total * 100).toFixed(2) + '%' : '?');
const fx = (v, dg = 2) => Number(v).toFixed(dg);
const pad = (s, w) => { let n = 0; for (const c of String(s)) n += c.charCodeAt(0) > 0x2e80 ? 2 : 1; return String(s) + ' '.repeat(Math.max(0, w - n)); };

function die(msg, code = 1) { process.stderr.write('[lolchess] ' + msg + '\n'); process.exit(code); }
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': WEB + '/', 'Accept': 'application/json,text/html;q=0.9' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/* 캐시 경유 fetch. 실패 시 만료 캐시라도 쓰되 «낡음»을 반드시 표시한다(조용한 stale 금지). */
async function cached(key, ttlMin, loader) {
  ensureDir(CACHE_DIR);
  const f = path.join(CACHE_DIR, key + '.json');
  if (!REFRESH && fs.existsSync(f)) {
    try {
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Date.now() - c.fetchedAt < ttlMin * 60000) return { ...c, fromCache: true };
    } catch { /* 깨진 캐시는 무시하고 새로 받는다 */ }
  }
  try {
    const data = await loader();
    const rec = { fetchedAt: Date.now(), data };
    fs.writeFileSync(f, JSON.stringify(rec), 'utf8');
    return { ...rec, fromCache: false };
  } catch (e) {
    if (fs.existsSync(f)) {
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      process.stderr.write(`[lolchess] ⚠ 네트워크 실패(${e.message}) → 캐시 사용, 받은 시각 ${KST(c.fetchedAt)} KST\n`);
      return { ...c, fromCache: true, stale: true };
    }
    throw e;
  }
}

const apiURL = (ep, extra = {}) => {
  const q = new URLSearchParams({ hl: 'ko', from: 'web', ...extra });
  return `${API}/${ep}?${q}`;
};

/* SSR 페이지의 __NEXT_DATA__ → react-query 결과 맵. 패치노트는 API 경로가 없어 이 길로만 온다. */
async function ssrQueries(pagePath, key, ttlMin) {
  const rec = await cached(key, ttlMin, async () => {
    const html = await fetchText(`${WEB}${pagePath}${pagePath.includes('?') ? '&' : '?'}hl=ko`);
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('__NEXT_DATA__ 없음 — 사이트 구조가 바뀌었다');
    const nd = JSON.parse(m[1]);
    const out = {};
    for (const q of (nd.props?.pageProps?.dehydratedState?.queries || [])) out[q.queryHash] = q.state?.data;
    return out;
  });
  return rec;
}

/* ── 데이터 로더 ────────────────────────────────────────────────────────── */
async function loadDecks() {
  const r = await cached('meta-decks', TTL_MIN, async () =>
    JSON.parse(await fetchText(apiURL('meta-decks', { tierId: SLICE.tierId, dt: SLICE.dt }))));
  const d = r.data;
  if (!d || !d.metaDeckList) die('메타덱 응답이 비었다 — 슬라이스나 API 가 바뀌었을 수 있다. --refresh 후 재시도.');
  return { ...d, fetchedAt: r.fetchedAt, stale: r.stale };
}
async function loadStat(kind) { // champions | traits | items
  const r = await cached('meta-deck-' + kind, TTL_MIN, async () =>
    JSON.parse(await fetchText(apiURL('meta-deck-' + kind, { tierId: SLICE.tierId }))));
  return { ...r.data, fetchedAt: r.fetchedAt };
}
async function loadAugmentRefs() {
  const r = await ssrQueries('/augments/set18', 'refs-augments', 24 * 60);
  return r.data['["augmentRefs","ko","set18"]']?.augments || [];
}
async function loadPatchList() {
  const r = await ssrQueries('/guide/patch-notes', 'patch-notes', 6 * 60);
  const list = r.data['["patchNoteListRefs","ko"]']?.patchNotes || [];
  let latest = null;
  for (const [k, v] of Object.entries(r.data)) if (k.startsWith('["patchNoteDataRefs"')) latest = v?.patchNote;
  return { list, latest, fetchedAt: r.fetchedAt };
}
async function loadPatchNote(id) {
  const r = await ssrQueries(`/guide/patch-notes/${id}`, 'patch-note-' + id, 24 * 60);
  for (const [k, v] of Object.entries(r.data)) if (k.startsWith('["patchNoteDataRefs"')) return v?.patchNote;
  return null;
}
async function loadGuideDecks(ep) { // guide-decks | streamer-decks
  const r = await cached(ep, 12 * 60, async () => JSON.parse(await fetchText(apiURL(ep))));
  return r.data;
}

/* ── Community Dragon — 라이엇 «게임 클라이언트» 원본 데이터 (2026-09-04 추가) ────
   왜 넣었나: 롤체지지가 못 주는 세 가지를 라이엇 원본이 준다.
     ⑴ **아이템 조합 레시피 55종**(「죽음의 검 = BF대검 + BF대검」) — 이게 급했다.
        글로서리가 「조합이 의심스러우면 wiki.leagueoflegends.com 개별 아이템 페이지로 재대조」라고
        시켰는데 **그 위키가 2026-09-04 봇 챌린지 뒤로 들어가 403** 이다(전 경로·API 포함).
        즉 봄딩 조합표 글의 재검증 경로가 끊겨 있었고, 이 데이터가 그 자리를 그대로 메운다.
     ⑵ **증강 596종 한국어 이름 + 설명** — 09-02 에 명칭 6/8 을 틀린 바로 그 밭.
     ⑶ **챔피언 기본 능력치**(체력·방어·마저·공격력·공속·사거리·마나) 정확값.

   ★함정 5개는 «규칙으로 적지 않고 코드로 막았다»(설계 B) — 지켜야 할 것이 늘면 언젠가 안 지켜진다:
     ① 스킬 설명에 `@MagicDamageCalc1@` 같은 **플레이스홀더가 미치환**이다 → **스킬 설명을 아예 내보내지 않는다.**
        치환된 스킬 텍스트가 필요하면 롤체지지 `find` 쪽을 쓴다(그쪽은 이미 숫자가 박혀 있다).
     ② 특성 수치 변수명이 **해시**(`{6eab9c5e}`)라 desc 의 `@TeamDurability@` 와 순서가 **어긋난다**
        (전쟁기계 실측: desc 는 팀→전쟁기계 순인데 데이터는 반대) → **variables 를 아예 내보내지 않는다.**
        이걸 순서로 짐작하면 09-02 「숫자는 맞는데 주어가 뒤집힘」 사고가 그대로 재발한다.
     ③ 원본 `Last-Modified` 가 **핫픽스보다 늦다**(08-29 판이 09-01 의 18.1d 를 모른다)
        → 출력 머리에 **데이터 일자와 «이후 패치 N건 미반영»을 자동으로 찍는다.**
     ④ `setData[].name` 이 틀렸다(`TFTSet18` 인데 `name:"Set10"`) → **그 필드를 쓰지 않는다.**
     ⑤ 챔피언 91기에 **PVE 몬스터·아이템 모루가 섞여 있다**(협곡 바위 게·훈련 봇·용병 상자…)
        → **롤체지지 refs 에 있는 것만** 남긴다(교집합 75기. 추측이 아니라 두 출처의 실제 교집합).

   비용: 원본 24.6MB 는 **LLM 컨텍스트에 들어가지 않는다.** 받아서 179KB 인덱스로 줄여 두고,
   평소엔 **HEAD 0.15초**로 바뀌었는지만 본다(최초 1회 다운로드 1.5초 + 파싱 0.23초 실측).
────────────────────────────────────────────────────────────────────────────── */
const CDRAGON_URL   = 'https://raw.communitydragon.org/latest/cdragon/tft/ko_kr.json';
const CDRAGON_INDEX = path.join(CACHE_DIR, 'cdragon-index.json');
const SET_MUTATOR   = 'TFTSet18';

const stripTags = (s) => String(s || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/%i:[a-zA-Z]+%/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

async function loadCdragon(R) {
  ensureDir(CACHE_DIR);
  let lastModified = null;
  try {
    const head = await fetch(CDRAGON_URL, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    lastModified = head.headers.get('last-modified');
  } catch { /* HEAD 실패는 치명적이지 않다 — 캐시가 있으면 쓴다 */ }

  if (!REFRESH && fs.existsSync(CDRAGON_INDEX)) {
    try {
      const c = JSON.parse(fs.readFileSync(CDRAGON_INDEX, 'utf8'));
      if (!lastModified || c.sourceLastModified === lastModified) return c;
    } catch { /* 깨진 인덱스는 다시 만든다 */ }
  }

  const raw = JSON.parse(await fetchText(CDRAGON_URL));
  const items = new Map(raw.items.filter((x) => x.apiName).map((x) => [x.apiName, x]));
  const set = raw.setData.find((x) => x.mutator === SET_MUTATOR);
  if (!set) die(`CDragon 에 ${SET_MUTATOR} 가 없다 — 새 세트로 넘어갔는지 확인할 것(SET_MUTATOR 상수).`);

  const idx = {
    builtAt: Date.now(),
    sourceLastModified: lastModified,
    setMutator: SET_MUTATOR,           // ④ name 필드는 틀리므로 mutator 만 신뢰한다
    // ⑤ 롤체지지 refs 교집합 = 실제 플레이어블. R 이 없으면 필터하지 못하므로 표시해 둔다.
    filtered: !!R,
    champions: (set.champions || [])
      .filter((c) => (R ? R.C.has(c.apiName) : true))
      .map((c) => ({ key: c.apiName, name: c.name, cost: c.cost, traits: c.traits || [],
                     stats: c.stats || null, skillName: (c.ability || {}).name || null })),
                     // ① ability.desc 는 담지 않는다(플레이스홀더 미치환)
    traits: (set.traits || []).map((t) => ({
      key: t.apiName, name: t.name, desc: stripTags(t.desc).replace(/@[A-Za-z0-9_*.]+@/g, '?'),
      steps: (t.effects || []).map((e) => ({ min: e.minUnits, max: e.maxUnits > 1000 ? null : e.maxUnits })),
      // ② variables 는 담지 않는다(해시 키 ↔ desc 변수명 순서가 어긋난다)
    })),
    augments: (set.augments || []).filter((a) => items.has(a))
      .map((a) => ({ key: a, name: items.get(a).name, desc: stripTags(items.get(a).desc) })),
    recipes: raw.items
      .filter((x) => x.composition && x.composition.length && x.name && String(x.apiName).startsWith('DA_'))
      .map((x) => ({ key: x.apiName, name: x.name,
                     from: x.composition.map((c) => (items.get(c) || {}).name || c) })),
  };
  fs.writeFileSync(CDRAGON_INDEX, JSON.stringify(idx), 'utf8');
  return idx;
}

/* ③ CDragon 이 최신 패치를 반영했는지 매 출력에 찍는다 — 조용히 낡은 값을 쓰는 게 제일 위험하다. */
function cdragonStamp(cd, patchList) {
  const lm = cd.sourceLastModified ? new Date(cd.sourceLastModified).getTime() : null;
  const behind = lm && patchList ? patchList.filter((p) => p.registeredAt > lm) : [];
  let s = `[CDragon] 라이엇 게임 데이터 ${cd.setMutator}`
        + (lm ? ` · 원본 갱신 ${KST(lm)} KST` : ' · 원본 갱신 시각 불명')
        + `${cd.filtered ? '' : ' · ⚠PVE 필터 미적용'}\n`;
  if (behind.length) {
    s += `⚠ 이 데이터 이후 패치 ${behind.length}건(${behind.map((p) => p.patchVersion).join(', ')})이 나왔다 — `
       + `**밸런스 수치는 반영돼 있지 않을 수 있다.** 명칭·조합·구조는 안전, 수치는 \`patch\` 로 재확인할 것.\n`;
  }
  return s;
}

/* ── 이름 해석 ──────────────────────────────────────────────────────────── */
function mkRefs(refs) {
  const m = (arr) => new Map((arr || []).map((x) => [x.key, x]));
  const C = m(refs.champions), T = m(refs.traits), I = m(refs.items);
  return {
    C, T, I,
    champ: (k) => C.get(k)?.name || k,
    cost:  (k) => C.get(k)?.cost ?? null,
    trait: (k) => T.get(k)?.name || k,
    item:  (k) => I.get(k)?.name || k,
    // numUnits 를 refs 의 styles 구간에 대조해 얻는다 — 추측이 아니라 사이트가 준 값의 파생.
    style: (k, numUnits) => {
      const st = T.get(k)?.styles || [];
      const hit = st.find((s) => numUnits >= s.min && (s.max == null || numUnits <= s.max));
      return hit ? hit.style : null;
    },
  };
}

/* 덱 이름 = 롤체지지가 `deckKey` 에 박아 둔 «특성-챔피언-해시» 를 한국어로 편 것.
   예: `DA_18_Elderwood-DA_18_Ezreal-0f39…` → 「나무정령 이즈리얼」.
   ★파생 라벨(최다 인원 특성 + coreRank 1 챔피언)을 먼저 만들어 봤다가 버렸다 — 두 가지가 틀린다:
     ⑴ 특성 인원이 데이터 갱신마다 흔들려 **같은 덱 이름이 회차마다 바뀐다**(소환사 3 → 처형자 4).
     ⑵ 캐리를 잘못 짚는다(사이트는 「나무정령 이즈리얼」인데 coreRank 1 은 드레이븐이었다).
   deckKey 는 덱의 «식별자»라 통계와 무관하게 고정이고, 사이트 표기와도 일치한다. */
function deckLabel(d, R) {
  const segs = String(d.deckKey || '').split('-');
  const named = segs.map((s) => (R.T.get(s)?.name) || (R.C.get(s)?.name) || null).filter(Boolean);
  if (named.length) return named.join(' ');
  // 폴백: deckKey 가 없거나 refs 에 없는 키일 때만 데이터에서 만든다(회차 간 흔들릴 수 있음 — 위 주석 참조).
  const t = [...(d.deck?.traits || [])].sort((a, b) => (b.numUnits - a.numUnits) || (b.style - a.style))[0];
  const core = (d.deck?.champions || []).find((c) => c.coreRank === 1) || (d.deck?.champions || [])[0];
  return [t ? `${R.trait(t.key)} ${t.numUnits}` : '', core ? R.champ(core.key) : ''].filter(Boolean).join(' · ') || '(이름 미상)';
}

function stamp(head, meta) {
  const l = [`[롤체지지] ${meta.season || 'set?'} · 패치 ${meta.patchVersion || '?'} · ${SLICE_LABEL}`];
  if (meta.plays) l.push(`표본 ${n0(meta.plays)}판${meta.matchCount ? ` / ${n0(meta.matchCount)}경기` : ''}`);
  l.push(`데이터 갱신 ${KST(meta.updatedAt)} KST · 조회 ${KST(Date.now())} KST`);
  return `${head}\n${l.join(' · ')}\n출처 https://lolchess.gg/ — 라이브 트래커라 값은 매일 바뀐다(글에 조회 시점·패치·표본 병기)\n`;
}
const pv = (d) => d.patchRevisions?.[0]?.patchVersion || null;

/* ── 스냅샷(신선도) ─────────────────────────────────────────────────────── */
function saveSnapshot(decks, R, meta) {
  if (flag('no-snapshot')) return;
  ensureDir(SNAP_DIR);
  const rec = {
    date: today(), takenAt: Date.now(), season: meta.season, patchVersion: meta.patchVersion,
    updatedAt: meta.updatedAt, plays: meta.plays,
    decks: decks.map((d) => ({ key: d.key, label: deckLabel(d, R), plays: d.plays,
      share: meta.plays ? d.plays / meta.plays : null, winRate: d.winRate, avgPlacement: d.avgPlacement })),
  };
  fs.writeFileSync(path.join(SNAP_DIR, rec.date + '.json'), JSON.stringify(rec), 'utf8');
}
function prevSnapshot() {
  if (!fs.existsSync(SNAP_DIR)) return null;
  const files = fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith('.json')).sort();
  const older = files.filter((f) => f.slice(0, 10) < today());
  if (!older.length) return null;
  try { return JSON.parse(fs.readFileSync(path.join(SNAP_DIR, older[older.length - 1]), 'utf8')); } catch { return null; }
}

/* ── 명령 ───────────────────────────────────────────────────────────────── */
async function cmdDecks(topN) {
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const L = d.metaDeckList;
  const meta = { season: d.season, patchVersion: pv(d), updatedAt: L.updatedAt, plays: L.plays };
  const decks = [...L.metaDecks].sort((a, b) => b.plays - a.plays);
  saveSnapshot(decks, R, meta);
  const top = decks.slice(0, topN);

  if (JSON_OUT) return console.log(JSON.stringify({ meta, decks: top.map((x) => shapeDeck(x, R, L.plays)) }, null, 2));

  let out = stamp(`■ 메타덱 ${L.metaDecks.length}종 (점유율순 상위 ${top.length})`, meta);
  out += `\n${pad('덱(롤체지지 표기)', 34)}${pad('점유율', 9)}${pad('승률', 8)}${pad('순방', 8)}${pad('평균등수', 9)}표본\n`;
  out += '─'.repeat(85) + '\n';
  for (const x of top) {
    out += `${pad(deckLabel(x, R), 34)}${pad(share(x.plays, L.plays), 9)}${pad(fx(x.winRate, 1) + '%', 8)}${pad(fx(x.topRate, 1) + '%', 8)}${pad(fx(x.avgPlacement), 9)}${n0(x.plays)}\n`;
  }
  out += `\n※ 점유율 = 그 덱 표본 ÷ 전체 표본 ${n0(L.plays)}판(우리가 직접 계산). 승률=1위 비율 · 순방=4등 이내 비율 · 평균등수 낮을수록 좋다(1~8).\n`;
  for (const x of top.slice(0, 5)) {
    const ch = (x.deck?.champions || []).filter((c) => c.coreRank && c.coreRank < 90)
      .sort((a, b) => a.coreRank - b.coreRank)
      .map((c) => `${R.champ(c.key)}(${R.cost(c.key) ?? '?'}코)${c.items?.length ? '[' + c.items.map(R.item).join('·') + ']' : ''}`);
    const tr = (x.deck?.traits || []).sort((a, b) => b.style - a.style)
      .map((t) => `${R.trait(t.key)} ${t.numUnits}${R.style(t.key, t.numUnits) ? '(' + R.style(t.key, t.numUnits) + ')' : ''}`);
    out += `\n· ${deckLabel(x, R)}\n   핵심 ${ch.join(' / ')}\n   특성 ${tr.join(' · ')}\n`;
  }
  console.log(out);
}
function shapeDeck(x, R, total) {
  return {
    key: x.key, label: deckLabel(x, R), plays: x.plays, pickRateRaw: x.pickRate, winRate: x.winRate,
    topRate: x.topRate, avgPlacement: x.avgPlacement, share: total ? Math.round(x.plays / total * 10000) / 100 : null,
    champions: (x.deck?.champions || []).map((c) => ({ name: R.champ(c.key), cost: R.cost(c.key), coreRank: c.coreRank, items: (c.items || []).map(R.item) })),
    traits: (x.deck?.traits || []).map((t) => ({ name: R.trait(t.key), numUnits: t.numUnits, style: R.style(t.key, t.numUnits) })),
  };
}

async function cmdStat(kind, topN) {
  const d0 = await loadDecks();
  const R = mkRefs(d0.refs);
  const s = await loadStat(kind);
  const box = s.metaDeckChampion || s.metaDeckTrait || s.metaDeckItem;
  const rows = box.metaDeckChampionStats || box.metaDeckTraitStats || box.metaDeckItemStats;
  const meta = { season: s.season, patchVersion: pv(s), updatedAt: box.updatedAt, plays: box.plays, matchCount: box.matchCount };
  const costF = num('cost', 0);

  let list = rows.map((r) => {
    const base = { plays: r.plays, avg: Number(r.avgPlacement), pickRateRaw: r.pickRate,
                   rate: box.plays ? r.plays / box.plays : null };
    if (kind === 'champions') return { ...base, name: R.champ(r.key), cost: R.cost(r.key), key: r.key };
    if (kind === 'traits') { const [k, , units] = r.keys; return { ...base, name: `${R.trait(k)} ${units}`, style: R.style(k, units), key: k }; }
    return { ...base, name: R.item(r.key), key: r.key };
  });
  if (kind === 'champions' && costF) list = list.filter((x) => x.cost === costF);
  list.sort((a, b) => b.plays - a.plays);
  const top = list.slice(0, topN);

  if (JSON_OUT) return console.log(JSON.stringify({ meta, kind, rows: top }, null, 2));
  const ko = { champions: '챔피언', traits: '특성', items: '아이템' }[kind];
  let out = stamp(`■ ${ko} 통계 ${list.length}종${costF ? ` (${costF}코스트만)` : ''} — 등장률순 상위 ${top.length}`, meta);
  out += `\n${pad('#', 4)}${pad(ko, 26)}${kind === 'champions' ? pad('코스트', 8) : (kind === 'traits' ? pad('단계', 10) : '')}${pad('등장률', 9)}${pad('평균등수', 9)}표본\n`;
  out += '─'.repeat(78) + '\n';
  top.forEach((x, i) => {
    out += pad(i + 1, 4) + pad(x.name, 26)
      + (kind === 'champions' ? pad(x.cost ?? '?', 8) : (kind === 'traits' ? pad(x.style || '-', 10) : ''))
      + pad(share(x.plays, box.plays), 9) + pad(fx(x.avg), 9) + n0(x.plays) + '\n';
  });
  out += `\n※ 등장률 = 그 항목 표본 ÷ 전체 표본 ${n0(box.plays)}판(우리가 직접 계산 — 사이트 표시값과 소수점이 다를 수 있다).\n`;
  out += `   한 판에 여러 특성·아이템이 동시에 잡히므로 열의 합은 100%를 넘는다. 정렬 기준은 표본 수.\n`;
  console.log(out);
}

async function cmdPatch() {
  const id = opt('id', null);
  const { list, latest, fetchedAt } = await loadPatchList();
  const note = id ? await loadPatchNote(id) : latest;
  if (JSON_OUT) return console.log(JSON.stringify({ list: list.slice(0, num('list', 10)), note }, null, 2));

  let out = `[롤체지지] 패치노트 목록 ${list.length}판 · 조회 ${KST(Date.now())} KST\n`;
  out += `출처 https://lolchess.gg/guide/patch-notes — 본문은 라이엇 한국어 패치노트. 인용 시 공식 원문도 확인한다.\n\n`;
  for (const p of list.slice(0, num('list', 8))) {
    out += `  ${pad(p.patchVersion, 10)}${pad(p.season, 9)}${KST(p.registeredAt)} KST   (id ${p.id})\n`;
  }
  if (note) {
    const head = list.find((p) => p.id === note.id);
    // 라이엇 공식 원문 대조 경로. b·c·d 핫픽스는 «기본 패치 페이지 안»에 「추가 패치 노트」로 붙는다(2026-09-04 실측 확인).
    const base = (head?.patchVersion || '').match(/^(\d+)\.(\d+)/);
    if (base) out += `\n공식 원문 대조: https://teamfighttactics.leagueoflegends.com/ko-kr/news/game-updates/teamfight-tactics-patch-${base[1]}-${base[2]}/\n              (핫픽스 b·c·d 는 이 페이지 하단 「추가 패치 노트」 절에 붙는다. curl 로 정적 수집 가능 — 인용 전 1회 대조.)\n`;
    out += `\n■ ${head ? head.patchVersion : ''} 전문 (id ${note.id} · 등록 ${KST(note.registeredAt)} KST)\n`;
    for (const [sec, body] of Object.entries(note.content || {})) {
      out += `\n【${sec}】\n`;
      for (const l of (body.descs || [])) out += `  · ${l}\n`;
    }
  }
  console.log(out);
}

async function cmdFind(q) {
  if (!q) die('찾을 이름을 주세요:  node lolchess.cjs find "감시자"');
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const augs = await loadAugmentRefs();
  const cd = await loadCdragon(R).catch((e) => { process.stderr.write(`[lolchess] ⚠ CDragon 불가(${e.message}) — 롤체지지 결과만 낸다\n`); return null; });
  const recipeOf = new Map((cd?.recipes || []).map((r) => [r.name, r.from]));
  const pool = [
    ...(d.refs.champions || []).map((x) => ({ ...x, _t: '챔피언', _s: '롤체지지' })),
    ...(d.refs.traits || []).map((x) => ({ ...x, _t: '특성', _s: '롤체지지' })),
    ...(d.refs.items || []).map((x) => ({ ...x, _t: '아이템', _s: '롤체지지' })),
    ...augs.map((x) => ({ ...x, _t: '증강', _s: '롤체지지' })),
    // CDragon 은 라이엇 원본이라 «롤체지지에 없는 이름»을 잡아 준다. 중복은 아래에서 접는다.
    ...(cd?.augments || []).map((x) => ({ ...x, _t: '증강', _s: 'CDragon' })),
  ];
  const nq = q.toLowerCase().replace(/\s+/g, '');
  const hit = pool.filter((x) => (x.name || '').toLowerCase().replace(/\s+/g, '').includes(nq) || (x.key || '').toLowerCase().includes(nq));
  if (JSON_OUT) return console.log(JSON.stringify(hit.map((x) => ({ type: x._t, source: x._s, name: x.name, key: x.key, cost: x.cost, desc: x.desc, recipe: recipeOf.get(x.name) || null })), null, 2));
  if (!hit.length) return console.log(`[명칭 조회] "${q}" 일치 없음 — 롤체지지·CDragon(라이엇 원본) 어디에도 없다. **한국어 정식 명칭이 아니다.** 지어내지 말고 다른 표기로 다시 찾을 것.`);
  const NOTE = '※ 설명문의 `%i:...%` 는 롤체지지 아이콘 자리표시자라 지웠다(수치·문장은 원문 그대로).';
  // 같은 이름이 두 출처에 다 있으면 한 줄로 접고 출처를 합쳐 적는다(중복 나열 금지).
  const merged = [];
  for (const x of hit) {
    const same = merged.find((m) => m.name === x.name && m._t === x._t);
    if (same) { if (!same._s.includes(x._s)) same._s += '+' + x._s; if (!same.desc && x.desc) same.desc = x.desc; }
    else merged.push({ ...x });
  }
  let out = `[명칭 조회] "${q}" ${merged.length}건 — 한국어 정식 명칭(${d.season})\n`;
  out += `출처 표기: 롤체지지 = 라이브 트래커 / CDragon = 라이엇 게임 데이터 원본. 한쪽에만 있으면 그것도 정보다.\n\n`;
  for (const x of merged.slice(0, num('top', 20))) {
    out += `· [${x._t}] ${x.name}   (key ${x.key}${x.cost ? ` · ${x.cost}코스트` : ''} · 출처 ${x._s})\n`;
    if (recipeOf.has(x.name)) out += `    조합 ${recipeOf.get(x.name).join(' + ')}  ← 라이엇 원본 레시피\n`;
    if (x.skill?.name) out += `    스킬 ${x.skill.name}\n`;
    const desc = (x.desc || x.skill?.desc || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
      .replace(/%i:[a-zA-Z]+%/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
    if (desc) out += `    ${desc.slice(0, 300)}\n`;
    if (x.styles) out += `    단계 ${x.styles.map((s) => `${s.style} ${s.min}${s.max ? '~' + s.max : '+'}`).join(' / ')}\n`;
  }
  console.log(out);
}

/* 아이템 조합 레시피 — 라이엇 원본. 옛 재대조 경로(라이엇 위키)가 403 이라 이게 그 자리를 대신한다. */
async function cmdRecipes(q) {
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const cd = await loadCdragon(R);
  const patch = await loadPatchList().catch(() => ({ list: [] }));
  let rows = [...cd.recipes].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (q) {
    const nq = q.replace(/\s+/g, '');
    rows = rows.filter((r) => r.name.replace(/\s+/g, '').includes(nq) || r.from.some((f) => String(f).replace(/\s+/g, '').includes(nq)));
  }
  if (JSON_OUT) return console.log(JSON.stringify({ setMutator: cd.setMutator, sourceLastModified: cd.sourceLastModified, recipes: rows }, null, 2));
  let out = cdragonStamp(cd, patch.list);
  out += `\n■ 아이템 조합 레시피 ${rows.length}종${q ? ` ("${q}" 일치)` : ''}\n`;
  out += `조합은 «구조»라 핫픽스로 바뀌지 않는다 — 위 미반영 경고는 수치에만 해당한다.\n\n`;
  for (const r of rows) out += `  ${pad(r.name, 24)} = ${r.from.join(' + ')}\n`;
  out += `\n※ 라이엇 게임 클라이언트 데이터가 출처다(커뮤니티 그리드 판독이 아니다) — 조합표 글은 이 값을 그대로 옮긴다.\n`;
  console.log(out);
}

/* 챔피언 기본 능력치 — CDragon 원본 수치 + 롤체지지의 «치환된» 스킬 설명을 한자리에. */
async function cmdChamp(q) {
  if (!q) die('챔피언 이름을 주세요:  node lolchess.cjs champ "아리"');
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const cd = await loadCdragon(R);
  const patch = await loadPatchList().catch(() => ({ list: [] }));
  const nq = q.replace(/\s+/g, '');
  const hit = cd.champions.filter((c) => c.name.replace(/\s+/g, '').includes(nq) || c.key.toLowerCase().includes(q.toLowerCase()));
  if (JSON_OUT) return console.log(JSON.stringify({ setMutator: cd.setMutator, sourceLastModified: cd.sourceLastModified, champions: hit }, null, 2));
  if (!hit.length) return console.log(`[챔피언] "${q}" 없음 — 플레이어블 ${cd.champions.length}기 중 일치 없음(PVE 몬스터는 제외돼 있다).`);
  let out = cdragonStamp(cd, patch.list);
  const S = { hp: '체력', damage: '공격력', armor: '방어력', magicResist: '마법저항력', attackSpeed: '공격속도',
              range: '사거리', mana: '최대마나', initialMana: '시작마나', critChance: '치명타확률', critMultiplier: '치명타배율' };
  for (const c of hit.slice(0, num('top', 6))) {
    out += `\n■ ${c.name} (${c.cost}코스트 · key ${c.key})\n`;
    out += `   특성 ${(c.traits || []).join(' · ') || '-'}\n`;
    if (c.skillName) out += `   스킬 ${c.skillName}\n`;
    if (c.stats) out += `   ${Object.entries(c.stats).filter(([k]) => S[k]).map(([k, v]) => `${S[k]} ${Math.round(v * 1000) / 1000}`).join(' · ')}\n`;
    const lc = R.C.get(c.key);
    const sd = stripTags(lc?.skill?.desc);
    if (sd) out += `   스킬 설명(롤체지지 — 수치가 치환된 판) ${sd.slice(0, 260)}\n`;
  }
  out += `\n※ 능력치는 1성 기준 원본값이다. 스킬 «설명»은 CDragon 쪽이 @변수@ 미치환이라 롤체지지 판만 싣는다.\n`;
  console.log(out);
}

async function cmdGuide(ep) {
  const g = await loadGuideDecks(ep);
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const rows = (g.guideDecks || g.streamerDecks || []).map((x) => ({
    name: x.name, cost: x.cost, streamer: x.streamerId || x.streamer || null,
    champions: (x.data?.slots || []).map((s) => `${R.champ('DA_' + s.champion) !== 'DA_' + s.champion ? R.champ('DA_' + s.champion) : s.champion}${s.star ? '★'.repeat(s.star) : ''}`),
  }));
  if (JSON_OUT) return console.log(JSON.stringify({ guides: g.guides, rows }, null, 2));
  let out = `[롤체지지] ${ep === 'guide-decks' ? '가이드 덱' : '스트리머 덱'} ${rows.length}종 · 기준 ${(g.guides || []).map((x) => x.name).join(', ')} · 조회 ${KST(Date.now())} KST\n\n`;
  for (const r of rows) out += `· ${r.name}${r.streamer ? ` (${r.streamer})` : ''}  — 비용 ${r.cost ?? '?'}\n`;
  out += `\n※ 덱 이름은 롤체지지 «덱 빌더» 제작자가 붙인 것 — 라이엇 공식 명칭이 아니다.\n`;
  console.log(out);
}

async function cmdAngles() {
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const L = d.metaDeckList;
  const meta = { season: d.season, patchVersion: pv(d), updatedAt: L.updatedAt, plays: L.plays };
  const decks = [...L.metaDecks].sort((a, b) => b.plays - a.plays);
  const prev = prevSnapshot();
  saveSnapshot(decks, R, meta);

  const moves = [];
  if (prev) {
    const pm = new Map(prev.decks.map((x) => [x.key, x]));
    for (const x of decks) {
      const p = pm.get(x.key);
      const cur = L.plays ? x.plays / L.plays : 0;
      if (!p || p.share == null) { moves.push({ label: deckLabel(x, R), kind: '신규', d: cur, to: cur }); continue; }
      const diff = cur - p.share;
      if (Math.abs(diff) >= 0.005) moves.push({ label: deckLabel(x, R), kind: diff > 0 ? '상승' : '하락', d: diff, from: p.share, to: cur });
    }
    moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  }

  const patch = await loadPatchList();
  const changed = [];
  for (const [sec, body] of Object.entries(patch.latest?.content || {})) {
    if (!/챔피언|특성/.test(sec)) continue;
    for (const line of (body.descs || [])) {
      const nm = (d.refs.champions || []).find((c) => line.startsWith(c.name)) || (d.refs.traits || []).find((t) => line.includes(t.name));
      if (nm) changed.push({ name: nm.name, line });
    }
  }
  const inMeta = new Set();
  for (const x of decks.slice(0, 8)) for (const c of (x.deck?.champions || [])) inMeta.add(R.champ(c.key));
  const hot = changed.filter((c) => inMeta.has(c.name));

  if (JSON_OUT) return console.log(JSON.stringify({ meta, moves: moves.slice(0, 10), patchChanged: changed.length, patchXmeta: hot }, null, 2));

  let out = stamp('■ 글감 후보 — 데이터에서만 파생(지어낸 각도 없음)', meta);
  out += `\n【① 지금 메타 상위 5덱】 — 공략·운영 각도\n`;
  decks.slice(0, 5).forEach((x, i) => out += `  ${i + 1}. ${deckLabel(x, R)}  점유 ${share(x.plays, L.plays)} · 순방 ${fx(x.topRate, 1)}% · 평균 ${fx(x.avgPlacement)}\n`);
  out += `\n【② 어제 대비 점유율 변동】 ${prev ? `(기준 ${prev.date} · 패치 ${prev.patchVersion})` : '— 이전 스냅샷 없음(오늘이 첫 회차). 내일부터 나온다.'}\n`;
  for (const m of moves.slice(0, 8)) out += `  ${m.kind === '신규' ? '🆕' : (m.kind === '상승' ? '▲' : '▼')} ${pad(m.label, 34)}${m.from != null ? `점유 ${pc(m.from)} → ${pc(m.to)}` : `점유 ${pc(m.to)}`}\n`;
  out += `\n【③ 최신 패치(${patch.list[0]?.patchVersion || '?'})에서 손댄 것 중 «지금 메타 상위 8덱»에 들어 있는 것】 — 시의성 각도\n`;
  if (!hot.length) out += `  (겹치는 항목 없음 — 억지로 엮지 말 것)\n`;
  for (const c of hot.slice(0, 12)) out += `  · ${c.line}\n`;
  out += `\n【④ 상시 수요 각도(검색형)】 — 위 ①~③에 소식이 없을 때만\n`;
  out += `  · 코스트별 챔피언 티어(node lolchess.cjs champions --cost 4)\n  · 특성 활성화 단계·조합(traits)\n  · 아이템 우선순위(items)\n  · 세트 개요·시스템 = 라이엇 공식 1차로만\n`;
  out += `\n⛔ 증강 티어·증강 통계는 서버가 데이터를 주지 않는다 — 이 각도는 발주하지 않는다.\n`;
  console.log(out);
}

async function cmdBrief() {
  const d = await loadDecks();
  const R = mkRefs(d.refs);
  const L = d.metaDeckList;
  const meta = { season: d.season, patchVersion: pv(d), updatedAt: L.updatedAt, plays: L.plays };
  const decks = [...L.metaDecks].sort((a, b) => b.plays - a.plays);
  saveSnapshot(decks, R, meta);
  const patch = await loadPatchList();

  if (JSON_OUT) {
    return console.log(JSON.stringify({
      meta, patchNotes: patch.list.slice(0, 3),
      topDecks: decks.slice(0, 8).map((x) => shapeDeck(x, R, L.plays)),
      counts: { decks: L.metaDecks.length, champions: d.refs.champions?.length, traits: d.refs.traits?.length, items: d.refs.items?.length },
    }, null, 2));
  }
  let out = stamp('■ 롤토체스 한 장 요약', meta);
  out += `\n최신 패치 ${patch.list[0]?.patchVersion || '?'} (등록 ${KST(patch.list[0]?.registeredAt)} KST) · 직전 ${patch.list.slice(1, 3).map((p) => p.patchVersion).join(', ')}\n`;
  out += `\n■ 점유율 상위 8덱 (점유율 = 그 덱 표본 ÷ 전체 표본 ${n0(L.plays)}판)\n`;
  decks.slice(0, 8).forEach((x, i) => out += `  ${pad(i + 1 + '.', 4)}${pad(deckLabel(x, R), 34)}점유 ${pad(share(x.plays, L.plays), 8)}순방 ${pad(fx(x.topRate, 1) + '%', 8)}평균 ${fx(x.avgPlacement)}\n`);
  const secs = Object.entries(patch.latest?.content || {});
  out += `\n■ 최신 패치 변경 요약\n`;
  for (const [sec, body] of secs) out += `  · ${sec.replace(/^.*패치 노트 - /, '')} ${(body.descs || []).length}건\n`;
  out += `\n■ 더 볼 것\n  decks / champions --cost N / traits / items / patch / find "이름" / angles\n`;
  out += `⛔ 증강 통계·증강 티어는 데이터가 없다(서버 빈 응답) — 상상으로 채우지 말 것.\n`;
  console.log(out);
}

/* ── 진입 ───────────────────────────────────────────────────────────────── */
(async () => {
  try {
    switch (CMD) {
      case 'brief':          await cmdBrief(); break;
      case 'decks':          await cmdDecks(num('top', 12)); break;
      case 'champions':      await cmdStat('champions', num('top', 20)); break;
      case 'traits':         await cmdStat('traits', num('top', 20)); break;
      case 'items':          await cmdStat('items', num('top', 20)); break;
      case 'patch':          await cmdPatch(); break;
      case 'find':           await cmdFind(argv[1] && !argv[1].startsWith('--') ? argv[1] : opt('q', null)); break;
      case 'recipes':        await cmdRecipes(argv[1] && !argv[1].startsWith('--') ? argv[1] : opt('q', null)); break;
      case 'champ':          await cmdChamp(argv[1] && !argv[1].startsWith('--') ? argv[1] : opt('q', null)); break;
      case 'guide-decks':    await cmdGuide('guide-decks'); break;
      case 'streamer-decks': await cmdGuide('streamer-decks'); break;
      default: die(`모르는 명령: ${CMD}\n  brief | decks | champions | traits | items | patch | find | guide-decks | streamer-decks | angles`);
      case 'angles':         await cmdAngles(); break;
    }
  } catch (e) {
    die(e.stack || e.message, 2);
  }
})();
