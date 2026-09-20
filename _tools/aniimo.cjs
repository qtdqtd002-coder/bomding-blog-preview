#!/usr/bin/env node
/* =============================================================================
   aniimo.cjs — 애니모(Aniimo) 단일 조사 창구 · questlog.gg 기반 (2026-09-20 신설)

   왜 만들었나
   -----------
   ⑴ **questlog.gg 는 WebFetch 로 열면 안 된다.** `data-ssr="false"` 인 완전 클라이언트
      렌더(Nuxt SPA)라 도감표·맵·스탯이 정적 HTML 에 하나도 없다. 롤체지지에서 겪은
      «못 읽은 표를 지어내는» 사고(09-02 증강 8종 중 6종 오표기)와 같은 뿌리다.
      그래서 이 도구는 화면이 아니라 **페이지가 호출하는 tRPC API 의 JSON 을 그대로** 받는다.
      LLM 이 표를 읽고 옮겨 적는 단계가 없다.
   ⑵ **정본에 통째로 비어 있던 칸이 있다.** 공식 위키(`creatures.json` 86종)에는
      맵 좌표·속성 상성·포획 확률·NPC·아이템·상점이 없다. questlog 는 그걸 전부 갖고 있다.

   출처 등급 (2026-09-20 사용자 지정)
   ---------------------------------
     questlog.gg = **애니모 공신력 출처**로 지정됨. 커뮤니티 구축 DB 이지만 아이콘 경로가
     `/assets/Res/XGUI/...` 인 게임 클라이언트 원본 리소스 경로라, 화면을 읽어 옮긴 게 아니라
     **클라이언트 데이터에서 뽑은 값**이다. 롤체지지 도구의 Community Dragon 경로와 같은 성격.

     다만 **공식 1차와 충돌하면 공식 위키가 이긴다.** questlog 가 1차가 되는 칸은
     공식 위키에 «아예 없는» 것들이다 — 맵 좌표 · 상성 · 포획 확률 · NPC · 아이템 · 상점.

   ★반드시 알고 쓸 것 — 2026-09-20 교차검증으로 확인된 사실
   -------------------------------------------------------
   ① **스냅샷이 2026-09-11 에 고정돼 있다.** 펫 97종 전부 `updatedAt: 2026-09-11` —
      정식 출시(09-16) *이전* 덤프다. 출시 후 패치(09-17·18·19)가 반영돼 있지 않을 수 있다.
      정본 `creatures.json` 은 09-20 수집(v1.0.3551601.0)이라 **수치가 갈리면 정본이 최신**이다.
      이 도구는 모든 출력 끝에 스냅샷 날짜를 자동으로 찍는다 — 글에도 그대로 옮긴다.

   ② **«86종 vs 97종»은 모순이 아니라 수록 범위 차이다.** (09-20 검산)
      공식 위키 도감 = 86 · questlog = 97. 차이 11 = questlog 초과 15 − 정본 초과 4.
      questlog 초과 15종은 **전부 정본이 이름을 이미 알고 있던 개체**다
      (정본 «특수·전설 애니모» 행) — 공식 위키 도감에 페이지가 없을 뿐이다:
        · 전설 1: 아이리스테일(#13, 플러터 계열)
        · 봉인 제외 특수 1: 드림쵸(#31, 반짝쵸 계열)
        · 웨이브 군도 10: 쉘코랄#84·코랄드래곤#85·시뚠뚠#86·랑뚠뚠#87·리프램#88·리벨라#89
                          ·버블코타#90·가챠코#91·엔젤후드#92·이블엔젤#93
        · 진화체 2: 루나티아(=루나센 성숙기, 도감#9997 공유)·플레어리온(=헬리온 성숙기, #9998 공유)
        · 개명 1: 위치그라스 = 공식 위키 «위치햇그라스»(Witchin, 위키ID 021) ★09-20 신규 확인
      → **미출시·유령 데이터가 아니다.** 도감#9997·9998 은 특수 번호일 뿐 실재 개체다.
      정본에만 있는 3종(꼬마 불꽃 11001 · 펀치테일 047 · 버스트테일 048)은 questlog 에 없다.

   ③ **영문명(displayName)으로 대조하지 말 것.** questlog 의 displayName 은 개체명이 아니라
      **계열(family) 영문명**이다 — 쉘코랄·코랄드래곤이 둘 다 CORALFISH, 시뚠뚠·랑뚠뚠이 둘 다
      THUNTEN. 게다가 공식 위키 영문 철자와도 다르다(위키 Budclaw ↔ questlog BUDCRAB).
      **대조 축은 한국어 이름**이다. (09-20 실제로 영문 축으로 맞췄다가 «불일치 69건»이라는
      허위 결과가 나왔다. 도감번호 축도 마찬가지로 틀렸다 — 정본 `no` 는 도감번호가 아니라
      위키 아이템 ID 다. 11001·99996·99998 같은 값이 섞여 있는 게 그 증거.)

   ④ **이미지는 핫링크 금지.** icon·art 경로는 게임사 저작물이다. 글에 쓰려면 내려받아
      self-host(회사 표준 image-sourcing.md). img-lint 대상.

   무엇을 주나
   -----------
     · 펫(애니모) 97종 — 6스탯·특성·스킬·**속성 상성**·**포획 확률**·진화·형태·홈 능력
       ·**출현 지역**·알 부화·공명·연구, 전부 한국어
     · 맵 마커 13,929 — 애니모 출현 9,677 · 채집 1,356 · NPC 1,289 · 보물상자 961
       · 이동 239 · 서식지 190 · 도전 71 · 퍼즐 67 · POI 35 · 보스 33 (+좌표)
     · 지역 70 — 명명 지역 15(레벨 구간 포함) + 블록 55
     · NPC 1,159 · 아이템 2,848 · 버프 655 · 플레이어 스킬 189 · 상점 46
     · ★`cross` — 공식 위키 정본(`creatures.json`)과 한국어 이름 축 교차검증 리포트

   쓰는 법
   -------
     node aniimo.cjs brief                    # 한 장 요약(기본)
     node aniimo.cjs pet 탄멍멍                # 개체 상세(정본 대조 마크 포함)
     node aniimo.cjs pets [--element fire] [--role DPS] [--stage 3]
     node aniimo.cjs regions                  # 지역 70 + 레벨 구간
     node aniimo.cjs map --region 구름 초원     # 그 지역 마커 집계
     node aniimo.cjs map --pet 탄멍멍          # 그 애니모가 나오는 지점
     node aniimo.cjs map --category chest     # 보물상자 등 분류별
     node aniimo.cjs find 휘석                 # 아이템·NPC·버프·스킬·상점 통합 검색
     node aniimo.cjs cross                    # ★정본 교차검증(이름 차이·초과·누락)
     공통: --json(기계 출력) · --refresh(캐시 무시) · --limit N

   캐시 = `_trend/_aniimo/`(기본 720분 — 스냅샷이 09-11 고정이라 자주 받을 이유가 없다)

   정본 = `Desktop/Claude/_glossary/애니모(Aniimo).md` (소스맵·명칭·함정)
   지식공간 = `Desktop/Claude/_glossary/애니모(Aniimo)/`
============================================================================= */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '_trend', '_aniimo');
const CANON_DIR = path.resolve(ROOT, '..', '_glossary', '애니모(Aniimo)');
const CANON_CREATURES = path.join(CANON_DIR, 'creatures.json');

const BASE = 'https://questlog.gg/aniimo/api/trpc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
const TTL_MIN = 720;

/* 데이터 스냅샷 기준일 — questlog 가 createdAt/updatedAt 으로 실어 보내는 값.
   fetch 때마다 실제 값으로 갱신되며, 출력 푸터에 찍힌다. */
let SNAPSHOT = null;

/* ── 공식 위키 도감(86종)에 페이지가 없는 개체 — ②번 주석 참조.
      유령이 아니라 «위키 미수록»이라는 뜻이다. 근거는 정본 «특수·전설 애니모» 행. */
const CANON_KNOWN_OFFDEX = {
  '아이리스테일': '전설 — 전설의 증표→전설 애니팟→전용 스토리(단 1회)',
  '드림쵸': '봉인 제외 특수',
  '쉘코랄': '웨이브 군도', '코랄드래곤': '웨이브 군도',
  '시뚠뚠': '웨이브 군도', '랑뚠뚠': '웨이브 군도',
  '리프램': '웨이브 군도', '리벨라': '웨이브 군도',
  '버블코타': '웨이브 군도', '가챠코': '웨이브 군도',
  '엔젤후드': '웨이브 군도', '이블엔젤': '웨이브 군도',
  '루나티아': '루나센(위키ID 99996) 성숙기 — 도감#9997 공유',
  '플레어리온': '헬리온(위키ID 99998) 성숙기 — 도감#9998 공유',
};

/* ── 인게임/questlog 표기 ↔ 공식 위키 표기가 다른 개체.
      글에는 병기한다(정본 «★인게임 개명» 행). «흔한 오표기» 열에 올리지 말 것 —
      둘 다 실재 표기라 glossary-lint 가 정상 글을 막는다. */
const RENAMES = {
  '위치그라스': '위치햇그라스',   // ★2026-09-20 신규 확인 (Witchin, 위키ID 021)
  '로즈펜서': '콕콕바라',        // 인게임 표기 (questlog 는 위키 표기 «콕콕바라» 사용)
  '볼트맨티스': '썬더스퀵',       // 인게임 표기
};

const ELEMENT_KO = {
  fire: '불', water: '물', grass: '풀', rock: '땅', wind: '바람',
  ice: '얼음', electric: '전기', dark: '어둠', holy: '빛',
};
/* 포지션 5종 — 정본 «도감 필터» 행의 공식 표기. 딜러·힐러·탱커로 쓰지 말 것. */
const ROLE_KO = {
  DPS: '딜', HEAL: '치유', SUP: '서포터', BREAK: '격파', ENERGY: '에너지 재생',
};
const STAGE_KO = { 1: '유년기', 2: '성장기', 3: '성숙기' };
const STAT_KO = {
  hp_max: 'HP', atk: '공격', def: '방어',
  def_mag: '무력화 저항', ep_regen_force: '에너지 회복', bp_atk: '무력화',
};
/* ── 형태 slug → 공식 위키 한국어 형태명.
   ★questlog 의 formName 은 공식 위키 영문 slug 와 «다른 체계»다(위키 Prismana ↔ questlog rainbow).
   정본 규칙 «영문 slug 임의 번역 금지»(evolution-forms.md §1)에 따라, 의미가 명백한 것만
   옮기고 근거 없는 것은 slug 를 그대로 둔 채 ⚠️ 를 붙인다.
   rainbow(21)·blackrainbow(12)·fire(2) 는 위키 18종 어디에도 대응이 없다 —
   «천휘»·«옵시디언»으로 단정하지 말 것(2026-09-20 미확정). */
const FORM_KO = {
  basic: '기본 형태', highland: '고지 형태', snow: '설원 형태',
  mountainforests: '산림 형태', flowersea: '꽃바다 형태', night: '밤 형태',
  thunderstorm: '뇌우 형태', beach: '해변 형태', forest: '숲 형태',
  mountain: '산지 형태', grassland: '초원 형태', cloud: '구름 형태',
  plateau: '고원 형태', tidalflat: '습지 형태', bay: '바다만 형태',
};
const MAPTYPE_KO = {
  aniimo: '애니모 출현', gathering: '채집', npc: 'NPC', treasure: '보물상자',
  travel: '이동', habitat: '서식지', challenge: '도전', puzzle: '퍼즐',
  poi: '주요 지점', boss: '보스', misc: '기타',
};

/* ───────────────────────────── 하부: HTTP · 캐시 ───────────────────────────── */

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'ko-KR,ko;q=0.9' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).href));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + url + '\n' + body.slice(0, 300)));
        resolve(body);
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout ' + url)); });
  });
}

async function trpc(route, input, opts) {
  /* ★캐시 키는 반드시 «입력 전체»를 반영해야 한다. 초판이 hex 24자로 잘랐더니
     {"language":"ko","page":N} 의 page 자리가 통째로 잘려 1·2·3 페이지가 같은 키가 됐고,
     97종이 «120종»으로 부풀었다(page1 을 3번 담음). 해시로 전체를 접는다. */
  const key = route + '_' + crypto.createHash('md5').update(JSON.stringify(input)).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, key + '.json');
  if (!opts.refresh && fs.existsSync(file)) {
    const age = (Date.now() - fs.statSync(file).mtimeMs) / 60000;
    if (age < TTL_MIN) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const url = BASE + '/' + route + '?input=' + encodeURIComponent(JSON.stringify(input));
  const raw = await get(url);
  const parsed = JSON.parse(raw);
  if (parsed.error) throw new Error('tRPC 오류 ' + route + ': ' + (parsed.error.message || ''));
  const data = parsed.result.data;
  ensureDir(CACHE_DIR);
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  return data;
}

/* 페이지네이션 라우트를 끝까지 긁는다 */
async function trpcAllPages(route, opts) {
  const first = await trpc(route, { language: 'ko', page: 1 }, opts);
  let out = first.pageData.slice();
  for (let p = 2; p <= first.pageCount; p++) {
    const d = await trpc(route, { language: 'ko', page: p }, opts);
    out = out.concat(d.pageData);
    await sleep(120);
  }
  noteSnapshot(out);
  return out;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* questlog 가 실어 보내는 createdAt/updatedAt 중 가장 최근 값을 스냅샷 기준일로 잡는다 */
function noteSnapshot(rows) {
  for (const r of rows || []) {
    const d = r.updatedAt || r.createdAt;
    if (d && (!SNAPSHOT || String(d) > SNAPSHOT)) SNAPSHOT = String(d).slice(0, 10);
  }
}

/* ───────────────────────────── 정본 대조 ───────────────────────────── */

let _canon = null;
function canon() {
  if (_canon) return _canon;
  if (!fs.existsSync(CANON_CREATURES)) {
    _canon = { byName: new Map(), count: 0, meta: null, missing: true };
    return _canon;
  }
  const j = JSON.parse(fs.readFileSync(CANON_CREATURES, 'utf8'));
  const byName = new Map();
  for (const c of j.creatures || []) byName.set(c.name_ko, c);
  _canon = { byName, count: (j.creatures || []).length, meta: j.meta || null, missing: false };
  return _canon;
}

/* 한 개체가 공식 위키 정본과 어떤 관계인지 판정한다.
   ★이 함수가 이 도구의 게이트다 — 정본에 없는 이름을 조용히 통과시키지 않는다. */
function canonMark(name) {
  const c = canon();
  if (c.missing) return { mark: '?', note: '정본 creatures.json 없음 — 대조 불가' };
  if (c.byName.has(name)) return { mark: 'OK', note: '공식 위키 도감 수록' };
  if (RENAMES[name] && c.byName.has(RENAMES[name])) {
    return { mark: 'RENAME', note: '공식 위키 표기 «' + RENAMES[name] + '» — 글에는 병기', canonName: RENAMES[name] };
  }
  if (CANON_KNOWN_OFFDEX[name]) {
    return { mark: 'OFFDEX', note: '위키 도감 미수록(정본이 존재는 확인): ' + CANON_KNOWN_OFFDEX[name] };
  }
  return { mark: 'UNKNOWN', note: '★정본에 없는 이름 — 공식 위키로 교차 확인 전에는 글에 쓰지 말 것' };
}

function markLabel(m) {
  return { OK: '✅', RENAME: '★개명', OFFDEX: '⚠️위키미수록', UNKNOWN: '🔴미확인', '?': '❔' }[m.mark] || '';
}

/* ───────────────────────────── 데이터 로더 ───────────────────────────── */

async function loadPets(opts) { return trpcAllPages('database.getPets', opts); }
async function loadPetDetail(id, opts) {
  const d = await trpc('database.getPet', { language: 'ko', id: String(id) }, opts);
  noteSnapshot([d]);
  return d;
}
async function loadMarkers(opts) {
  const d = await trpc('map.getMarkers', { language: 'ko' }, opts);
  return d;
}
async function loadRegions(opts) {
  const d = await trpc('map.getRegions', { language: 'ko' }, opts);
  return d;
}

/* ───────────────────────────── 출력 헬퍼 ───────────────────────────── */

function pad(s, n) {
  s = String(s === null || s === undefined ? '' : s);
  let w = 0;
  for (const ch of s) w += (ch.charCodeAt(0) > 0x1100 ? 2 : 1);
  return s + ' '.repeat(Math.max(0, n - w));
}

function footer() {
  const c = canon();
  const lines = [
    '',
    '─'.repeat(78),
    '출처 = questlog.gg (애니모 공신력 출처 지정 2026-09-20) · tRPC API 직접 수신',
    '데이터 스냅샷 = ' + (SNAPSHOT || '미상') + '  ★글에 수치를 실으면 이 날짜를 병기한다',
  ];
  if (!c.missing && c.meta) {
    lines.push('공식 위키 정본 = creatures.json ' + c.count + '종 (' + (c.meta.fetched || '') + ' 수집, ' + (c.meta.game_version_at_fetch || '') + ')');
    lines.push('★수치가 갈리면 공식 위키 정본이 최신이다. questlog 가 1차인 칸 = 맵·상성·포획·NPC·아이템·상점');
  }
  lines.push('⛔ 이미지(icon·art) 핫링크 금지 — 내려받아 self-host');
  return lines.join('\n');
}

/* ───────────────────────────── 명령: brief ───────────────────────────── */

async function cmdBrief(opts) {
  const [pets, markers, regions] = await Promise.all([
    loadPets(opts), loadMarkers(opts), loadRegions(opts),
  ]);
  if (opts.json) return out({ pets: pets.length, markers: markers.length, regions: regions.length }, opts);

  const byEl = {}, byRole = {}, byStage = {};
  for (const p of pets) {
    byEl[p.mainCategory] = (byEl[p.mainCategory] || 0) + 1;
    byRole[p.subCategory] = (byRole[p.subCategory] || 0) + 1;
    byStage[p.stage] = (byStage[p.stage] || 0) + 1;
  }
  const byType = {};
  for (const m of markers) byType[m.mapType] = (byType[m.mapType] || 0) + 1;

  const named = regions.filter((r) => r.tier === 'region' && r.name);

  console.log('애니모(Aniimo) 조사 브리핑 — questlog.gg');
  console.log('='.repeat(78));
  console.log('');
  console.log('■ 애니모 ' + pets.length + '종');
  console.log('  원소   ' + Object.entries(byEl).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => (ELEMENT_KO[k] || k) + ' ' + v).join(' · '));
  console.log('  포지션 ' + Object.entries(byRole).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => (ROLE_KO[k] || k) + ' ' + v).join(' · '));
  console.log('  단계   ' + Object.entries(byStage).sort()
    .map(([k, v]) => (STAGE_KO[k] || k) + ' ' + v).join(' · '));
  console.log('');
  console.log('■ 맵 마커 ' + markers.length.toLocaleString() + '개');
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + pad(MAPTYPE_KO[k] || k, 14) + String(v).padStart(6));
  }
  console.log('');
  console.log('■ 지역 ' + regions.length + '개 (명명 ' + named.length + ' + 블록 ' + (regions.length - named.length) + ')');
  for (const r of named.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0))) {
    console.log('  ' + pad(r.name, 16) + 'Lv ' + String(r.minLevel).padStart(2) + '~' + String(r.maxLevel).padStart(2));
  }
  console.log('');
  console.log('■ 정본 교차 상태 — 자세히는 `node aniimo.cjs cross`');
  const cr = crossReport(pets);
  console.log('  ✅정본일치 ' + cr.ok.length + ' · ★개명 ' + cr.rename.length
    + ' · ⚠️위키미수록 ' + cr.offdex.length + ' · 🔴미확인 ' + cr.unknown.length
    + ' · 정본에만 ' + cr.canonOnly.length);
  if (cr.unknown.length) {
    console.log('  🔴 ' + cr.unknown.map((x) => x.name).join(', ') + ' ← 공식 위키 교차 전 사용 금지');
  }
  console.log(footer());
}

/* ───────────────────────────── 명령: pets / pet ───────────────────────────── */

async function cmdPets(opts) {
  let pets = await loadPets(opts);
  if (opts.element) {
    const want = String(opts.element).toLowerCase();
    pets = pets.filter((p) => p.mainCategory === want
      || ELEMENT_KO[p.mainCategory] === opts.element);
  }
  if (opts.role) {
    const want = String(opts.role).toUpperCase();
    pets = pets.filter((p) => p.subCategory === want || ROLE_KO[p.subCategory] === opts.role);
  }
  if (opts.stage) pets = pets.filter((p) => String(p.stage) === String(opts.stage));
  pets.sort((a, b) => (a.handbookNumber || 0) - (b.handbookNumber || 0));
  if (opts.limit) pets = pets.slice(0, opts.limit);
  if (opts.json) return out(pets.map((p) => ({ ...p, canon: canonMark(p.name) })), opts);

  console.log('애니모 목록 — ' + pets.length + '종');
  console.log('='.repeat(78));
  console.log(pad('도감#', 7) + pad('이름', 16) + pad('원소', 7) + pad('포지션', 13)
    + pad('단계', 8) + pad('합계', 6) + '정본대조');
  console.log('─'.repeat(78));
  for (const p of pets) {
    const m = canonMark(p.name);
    console.log(pad('#' + p.handbookNumber, 7) + pad(p.name, 16)
      + pad(ELEMENT_KO[p.mainCategory] || p.mainCategory, 7)
      + pad(ROLE_KO[p.subCategory] || p.subCategory, 13)
      + pad(STAGE_KO[p.stage] || p.stage, 8)
      + pad(p.baseTotal, 6) + markLabel(m)
      + (m.mark === 'RENAME' ? '(' + m.canonName + ')' : ''));
  }
  console.log(footer());
}

async function cmdPet(name, opts) {
  const pets = await loadPets(opts);
  const hit = pets.find((p) => p.name === name)
    || pets.find((p) => p.name.includes(name))
    || pets.find((p) => String(p.id) === String(name));
  if (!hit) {
    console.error('찾지 못했다: ' + name);
    const near = pets.filter((p) => p.name.includes(String(name).slice(0, 2))).slice(0, 8);
    if (near.length) console.error('비슷한 이름: ' + near.map((p) => p.name).join(', '));
    process.exitCode = 1;
    return;
  }
  const d = await loadPetDetail(hit.id, opts);
  const m = canonMark(d.name);
  if (opts.json) return out({ ...d, canon: m }, opts);

  console.log(d.name + '  ' + markLabel(m) + '  (도감#' + d.handbookNumber + ' · id ' + d.id + ')');
  console.log('='.repeat(78));
  console.log('정본 대조 : ' + m.note);
  if (m.mark === 'UNKNOWN') {
    console.log('           🔴 이 이름은 공식 위키 정본에 없다. 교차 확인 전에는 글에 쓰지 않는다.');
  }
  console.log('계열      : ' + (d.familyName || '-') + '  |  단계 ' + (STAGE_KO[d.stage] || d.stage)
    + '  |  원소 ' + (d.elementName || ELEMENT_KO[d.mainCategory] || d.mainCategory)
    + '  |  포지션 ' + (ROLE_KO[d.role] || d.role || '-'));
  if (d.description) console.log('소개      : ' + d.description);
  if (d.lore) console.log('도감 설명 : ' + d.lore);

  if (Array.isArray(d.stats) && d.stats.length) {
    console.log('');
    console.log('■ 기본 스탯 (합계 ' + (d.baseTotal || '-') + ')');
    console.log('  ' + d.stats.map((s) => (STAT_KO[s.key] || s.key) + ' ' + s.value).join(' · '));
  }
  if (Array.isArray(d.traits) && d.traits.length) {
    console.log('');
    console.log('■ 특성');
    for (const t of d.traits) console.log('  · ' + (t.name || t.key) + (t.description ? ' — ' + t.description : ''));
  }
  if (d.matchups) {
    console.log('');
    console.log('■ 속성 상성  ★공식 위키에 없는 칸 — questlog 가 1차');
    const r = (d.matchups.resistantTo || []).map((e) => e.name).join(', ');
    const w = (d.matchups.weakAgainst || []).map((e) => e.name).join(', ');
    if (r) console.log('  저항  : ' + r);
    if (w) console.log('  취약  : ' + w);
  }
  if (Array.isArray(d.skills) && d.skills.length) {
    console.log('');
    console.log('■ 스킬 ' + d.skills.length + '개');
    for (const s of d.skills) {
      console.log('  · ' + (s.name || s.key) + (s.type ? ' [' + s.type + ']' : ''));
      if (s.description) console.log('      ' + String(s.description).replace(/\s+/g, ' ').slice(0, 160));
    }
  }
  if (Array.isArray(d.petIsFoundInRegions) && d.petIsFoundInRegions.length) {
    console.log('');
    console.log('■ 출현 지역  ★공식 위키에 좌표가 없는 칸');
    for (const r of d.petIsFoundInRegions) {
      console.log('  · ' + pad(r.name, 16) + (r.subCategory ? '(' + r.subCategory + ')' : ''));
    }
  }
  if (d.catch) {
    console.log('');
    console.log('■ 포획  ★공식 위키에 없는 칸 — 공식 «확률 안내»(aniimo.com/ko/formula-multipliers)와 교차');
    /* ★baseChance 는 groupId(애니팟 종류로 추정)마다 «스케일이 다르다» — 0.56·0.4 같은 비율과
       10·100 같은 값이 한 배열에 섞여 있다. 초판이 전부 ×100 해서 «1000%·10000%» 를 찍었다.
       0<x≤1 만 백분율로 환산하고, 그 밖은 원값을 단위 미상으로 남긴다. 지어내지 않는다. */
    const rates = (d.catch.rates || []).filter((r) => r.baseChance);
    const pct = rates.filter((r) => r.baseChance > 0 && r.baseChance <= 1);
    const raw = rates.filter((r) => r.baseChance > 1);
    for (const r of pct) {
      console.log('  · [그룹 ' + r.groupId + '] 기본 확률 ' + (r.baseChance * 100).toFixed(1) + '%'
        + (r.brokenMultiplier ? ' · 무력화 시 ×' + r.brokenMultiplier : '')
        + (r.fromBehindMultiplier ? ' · 배후 ×' + r.fromBehindMultiplier : ''));
    }
    for (const r of raw) {
      console.log('  · [그룹 ' + r.groupId + '] baseChance=' + r.baseChance
        + '  ⚠️단위 미상 — 백분율이 아니다(확정 포획·특수 애니팟 계수로 추정). 그대로 글에 쓰지 말 것');
    }
    console.log('  ※ groupId 가 어떤 애니팟인지는 questlog 가 알려주지 않는다 — 공식 확률 안내와 교차 전 단정 금지.');
    if (Array.isArray(d.catch.natures) && d.catch.natures.length) {
      console.log('  성격 ' + d.catch.natures.length + '종 : '
        + d.catch.natures.map((n) => n.name + ' ' + Math.round((n.chance || 0) * 100) + '%').join(' · '));
    }
  }
  if (Array.isArray(d.evolutions) && d.evolutions.length) {
    console.log('');
    console.log('■ 진화  ★공식 위키는 진화 «조건»을 싣지 않는다(evolution-forms.md 주석) — questlog 가 이 칸의 창구');
    for (const e of d.evolutions) {
      /* ⚠️ e.stage 는 «개체의 성장 단계»가 아니라 진화 순번이다 — 화르랑(성장기)에 stage:1 이
         붙어 있다. 단계로 옮기면 틀리므로 찍지 않는다(2026-09-20 실측). */
      console.log('  → ' + (e.targetName || e.name || e.targetId));
      for (const c2 of e.conditions || []) {
        console.log('      조건 · ' + String(c2).replace(/\n/g, ' / '));
      }
      const mats = (e.materials || []).map((m) => (m.name || m.id) + (m.count ? '×' + m.count : ''));
      if (mats.length) console.log('      재료 · ' + mats.join(', '));
    }
  }
  if (Array.isArray(d.forms) && d.forms.length) {
    console.log('');
    const names = d.forms.map((f) => {
      const slug = f.formName || f.key || '';
      return FORM_KO[slug] || (slug + '(⚠️미대응 slug)');
    });
    console.log('■ 형태 ' + d.forms.length + '종 : ' + names.join(' · '));
    console.log('  ★slug 임의 번역 금지 — Highland=고지 · Plateau=고원. rainbow·blackrainbow·fire 는');
    console.log('    공식 위키 18종에 대응이 없다(«천휘»·«옵시디언»으로 단정 금지 — 2026-09-20 미확정).');
  }
  if (Array.isArray(d.homeAbilities) && d.homeAbilities.length) {
    console.log('');
    console.log('■ 홈 능력 : ' + d.homeAbilities.map((h) => (h.name || h.key) + (h.level ? ' Lv' + h.level : '')).join(' · '));
    console.log('  ※ 홈 능력과 «탐사 스킬»은 다른 칸이다(정본 «도감 항목명» 행).');
  }
  const twine = [];
  if (d.canFly) twine.push('비행');
  if (d.canGlide) twine.push('활공');
  if (d.canClimb) twine.push('등반');
  if (d.canSkateboard) twine.push('제트 보드');
  if (twine.length) console.log('\n■ 이동 능력 : ' + twine.join(' · '));
  console.log(footer());
}

/* ───────────────────────────── 명령: regions / map ───────────────────────────── */

async function cmdRegions(opts) {
  const [regions] = await Promise.all([loadRegions(opts), loadPets(opts)]); // pets = 스냅샷 날짜용(캐시)
  const named = regions.filter((r) => r.tier === 'region' && r.name)
    .sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0));
  if (opts.json) return out(named, opts);
  console.log('애니모 지역 — 명명 ' + named.length + '곳 (전체 ' + regions.length + ', 나머지는 레벨 블록)');
  console.log('='.repeat(78));
  console.log(pad('지역', 18) + pad('레벨 구간', 12) + pad('맵', 22) + 'id');
  console.log('─'.repeat(78));
  for (const r of named) {
    console.log(pad(r.name, 18) + pad('Lv ' + r.minLevel + '~' + r.maxLevel, 12)
      + pad(r.mapWorldId, 22) + r.id);
  }
  console.log(footer());
}

async function cmdMap(opts) {
  /* map·region 라우트에는 createdAt 이 없어 스냅샷 날짜가 잡히지 않는다.
     펫 목록을 캐시에서 한 번 읽어 푸터의 «스냅샷 미상»을 막는다(캐시 히트라 비용 0). */
  const [markers, regions] = await Promise.all([loadMarkers(opts), loadRegions(opts), loadPets(opts)]);
  let rows = markers;
  let title = '전체';

  if (opts.pet) {
    const pets = await loadPets(opts);
    const hit = pets.find((p) => p.name === opts.pet) || pets.find((p) => p.name.includes(opts.pet));
    if (!hit) { console.error('애니모를 찾지 못했다: ' + opts.pet); process.exitCode = 1; return; }
    rows = markers.filter((m) => m.dbType === 'pet' && String(m.dbId) === String(hit.id));
    title = hit.name + ' 출현 지점';
    const m = canonMark(hit.name);
    if (m.mark === 'UNKNOWN') console.log('🔴 ' + m.note + '\n');
  } else if (opts.category) {
    rows = markers.filter((m) => m.mapCategory === opts.category || m.mapType === opts.category);
    title = opts.category;
  } else if (opts.region) {
    // 지역 폴리곤 안에 들어가는 마커를 점-다각형 판정으로 고른다
    const reg = regions.find((r) => r.name === opts.region)
      || regions.find((r) => r.name && r.name.includes(opts.region));
    if (!reg) { console.error('지역을 찾지 못했다: ' + opts.region); process.exitCode = 1; return; }
    rows = markers.filter((m) => m.mapWorldId === reg.mapWorldId
      && (m.coordinates || []).some((c) => pointInPolygon(c, reg.coordinates)));
    title = reg.name + ' (Lv ' + reg.minLevel + '~' + reg.maxLevel + ')';
  }

  if (opts.json) return out(rows, opts);

  console.log('맵 마커 — ' + title + ' : ' + rows.length.toLocaleString() + '개');
  console.log('='.repeat(78));
  const byType = {};
  for (const m of rows) byType[m.mapType] = (byType[m.mapType] || 0) + 1;
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + pad(MAPTYPE_KO[k] || k, 14) + String(v).padStart(6));
  }
  console.log('');
  const lim = opts.limit || 40;
  const byName = {};
  for (const m of rows) {
    const k = m.name || '(이름없음)';
    if (!byName[k]) byName[k] = { n: 0, type: m.mapType, sample: m.coordinates && m.coordinates[0] };
    byName[k].n++;
  }
  const list = Object.entries(byName).sort((a, b) => b[1].n - a[1].n).slice(0, lim);
  console.log('상위 ' + list.length + '종 (이름별 지점 수)');
  console.log(pad('이름', 26) + pad('분류', 14) + pad('지점', 6) + '예시 좌표');
  console.log('─'.repeat(78));
  let untranslated = 0;
  for (const [n, v] of list) {
    /* 게임 데이터에 한국어가 아직 안 들어간 항목이 섞여 있다(예: «Starly 나무판»).
       영문을 그대로 글에 옮기면 정본 «직역·음차 금지» 위반이라 자리에서 표시한다. */
    const raw = /[A-Za-z]{3,}/.test(n);
    if (raw) untranslated++;
    console.log(pad(n, 26) + pad(MAPTYPE_KO[v.type] || v.type, 14) + pad(v.n, 6)
      + (v.sample ? '[' + v.sample[0].toFixed(1) + ', ' + v.sample[1].toFixed(1) + ']' : '')
      + (raw ? '  ⚠️미번역' : ''));
  }
  if (untranslated) {
    console.log('');
    console.log('⚠️ 미번역 ' + untranslated + '건 — 영문 그대로 글에 옮기지 않는다(정본 «직역·음차 금지»).');
    console.log('   인게임 한국어 표기를 확인한 뒤에만 쓴다.');
  }
  console.log(footer());
}

/* 점-다각형 판정(ray casting) — 지역 폴리곤 안의 마커를 고를 때만 쓴다 */
function pointInPolygon(pt, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ───────────────────────────── 명령: find ───────────────────────────── */

async function cmdFind(q, opts) {
  const routes = [
    ['database.getItems', '아이템'], ['database.getNpcs', 'NPC'],
    ['database.getBuffs', '버프'], ['database.getPlayerSkills', '플레이어 스킬'],
    ['database.getShops', '상점'],
  ];
  const results = [];
  for (const [route, label] of routes) {
    const rows = await trpcAllPages(route, opts);
    for (const r of rows) {
      if (r.name && r.name.includes(q)) results.push({ 분류: label, 이름: r.name, id: r.id, 계열: r.mainCategory || '', 세부: r.subCategory || '' });
    }
  }
  const pets = await loadPets(opts);
  for (const p of pets) {
    if (p.name.includes(q)) {
      results.push({ 분류: '애니모', 이름: p.name, id: p.id, 계열: ELEMENT_KO[p.mainCategory] || p.mainCategory, 세부: ROLE_KO[p.subCategory] || p.subCategory });
    }
  }
  if (opts.json) return out(results, opts);
  console.log('통합 검색 «' + q + '» — ' + results.length + '건');
  console.log('='.repeat(78));
  console.log(pad('분류', 14) + pad('이름', 28) + pad('계열', 12) + '세부');
  console.log('─'.repeat(78));
  for (const r of results.slice(0, opts.limit || 60)) {
    console.log(pad(r.분류, 14) + pad(r.이름, 28) + pad(r.계열, 12) + r.세부);
  }
  if (results.length > (opts.limit || 60)) console.log('  … 외 ' + (results.length - (opts.limit || 60)) + '건 (--limit 로 확장)');
  console.log(footer());
}

/* ───────────────────────────── 명령: cross (정본 교차검증) ───────────────────────────── */

function crossReport(pets) {
  const c = canon();
  const ok = [], rename = [], offdex = [], unknown = [];
  const seen = new Set();
  for (const p of pets) {
    const m = canonMark(p.name);
    seen.add(m.canonName || p.name);
    const row = { name: p.name, no: p.handbookNumber, el: p.mainCategory, role: p.subCategory, stage: p.stage, mark: m };
    if (m.mark === 'OK') ok.push(row);
    else if (m.mark === 'RENAME') rename.push(row);
    else if (m.mark === 'OFFDEX') offdex.push(row);
    else unknown.push(row);
  }
  const canonOnly = [];
  if (!c.missing) {
    for (const [name, cc] of c.byName) {
      if (!seen.has(name)) canonOnly.push({ name, no: cc.no, en: cc.name_en, el: (cc.elements_ko || []).join('·') });
    }
  }
  return { ok, rename, offdex, unknown, canonOnly };
}

async function cmdCross(opts) {
  const pets = await loadPets(opts);
  const r = crossReport(pets);
  const c = canon();
  if (opts.json) return out(r, opts);

  console.log('애니모 정본 교차검증 — questlog.gg ↔ 공식 위키(creatures.json)');
  console.log('='.repeat(78));
  console.log('축 = **한국어 이름**. 영문명(displayName)은 계열 단위라 개체 대조에 쓸 수 없고,');
  console.log('     도감번호도 정본 `no`(위키 아이템 ID)와 체계가 달라 대조 축이 되지 못한다.');
  console.log('');
  console.log('questlog ' + pets.length + '종  vs  공식 위키 정본 ' + c.count + '종');
  console.log('  ✅ 정본 일치       ' + String(r.ok.length).padStart(3));
  console.log('  ★ 개명(병기 필요)  ' + String(r.rename.length).padStart(3));
  console.log('  ⚠️ 위키 도감 미수록 ' + String(r.offdex.length).padStart(3) + '  (정본이 «존재»는 확인한 특수·전설·웨이브 군도)');
  console.log('  🔴 미확인          ' + String(r.unknown.length).padStart(3) + '  ← 공식 위키 교차 전 사용 금지');
  console.log('  ◻ 정본에만 있음    ' + String(r.canonOnly.length).padStart(3) + '  (questlog 미수록)');

  if (r.rename.length) {
    console.log('');
    console.log('■ ★개명 — 글에는 반드시 병기한다 (정본 «★인게임 개명» 행)');
    for (const x of r.rename) console.log('  · ' + pad(x.name, 14) + '= 공식 위키 «' + x.mark.canonName + '»');
  }
  if (r.offdex.length) {
    console.log('');
    console.log('■ ⚠️ 공식 위키 도감에 페이지가 없는 개체 — 유령이 아니다');
    for (const x of r.offdex) {
      console.log('  · ' + pad('#' + x.no, 7) + pad(x.name, 14) + pad(ELEMENT_KO[x.el] || x.el, 6)
        + CANON_KNOWN_OFFDEX[x.name]);
    }
    console.log('  → 이 개체들의 스탯·스킬은 questlog 가 **유일한 창구**다(공식 위키에 페이지 자체가 없다).');
  }
  if (r.unknown.length) {
    console.log('');
    console.log('■ 🔴 정본에 없는 이름 — 공식 위키·인게임으로 교차하기 전에는 글에 쓰지 않는다');
    for (const x of r.unknown) console.log('  · ' + pad('#' + x.no, 7) + pad(x.name, 14) + (ELEMENT_KO[x.el] || x.el));
  }
  if (r.canonOnly.length) {
    console.log('');
    console.log('■ ◻ 공식 위키에만 있고 questlog 에 없는 개체');
    for (const x of r.canonOnly) console.log('  · ' + pad(x.name, 14) + pad('위키ID ' + x.no, 14) + pad(x.en, 22) + x.el);
    console.log('  → 이 개체는 questlog 로 보강할 수 없다. 공식 위키 정본만 쓴다.');
  }
  console.log(footer());
}

/* ───────────────────────────── 진입점 ───────────────────────────── */

function out(obj, opts) {
  console.log(JSON.stringify({ snapshot: SNAPSHOT, source: 'questlog.gg', data: obj }, null, opts.pretty ? 2 : 0));
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--pretty') { opts.json = true; opts.pretty = true; }
    else if (a === '--refresh') opts.refresh = true;
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a === '--element') opts.element = argv[++i];
    else if (a === '--role') opts.role = argv[++i];
    else if (a === '--stage') opts.stage = argv[++i];
    else if (a === '--pet') opts.pet = argv[++i];
    else if (a === '--region') opts.region = collectRest(argv, ++i, opts);
    else if (a === '--category') opts.category = argv[++i];
    else opts._.push(a);
  }
  return opts;
}
/* «구름 초원»처럼 공백이 든 지역명을 따옴표 없이 넘겨도 받아준다 */
function collectRest(argv, i, opts) {
  const parts = [];
  while (i < argv.length && !String(argv[i]).startsWith('--')) { parts.push(argv[i]); i++; }
  opts.__skipTo = i;
  for (let k = parts.length - 1; k >= 1; k--) argv.splice(i - k, 1);
  return parts.join(' ');
}

const HELP = `aniimo.cjs — 애니모 단일 조사 창구 (questlog.gg)

  node aniimo.cjs brief                     한 장 요약
  node aniimo.cjs pet <이름>                 개체 상세 + 정본 대조
  node aniimo.cjs pets [--element fire] [--role DPS] [--stage 3]
  node aniimo.cjs regions                   지역 + 레벨 구간
  node aniimo.cjs map --region 구름 초원      지역별 마커
  node aniimo.cjs map --pet 탄멍멍           출현 지점
  node aniimo.cjs map --category chest      분류별 마커
  node aniimo.cjs find <검색어>              아이템·NPC·버프·스킬·상점 통합 검색
  node aniimo.cjs cross                     ★공식 위키 정본과 교차검증

  공통 옵션: --json --pretty --refresh --limit N

  ⛔ questlog.gg 를 WebFetch 로 열지 않는다(완전 SPA — 표를 지어낸다). 이 도구로만.
  ★ 수치를 글에 실으면 «questlog.gg · 스냅샷 YYYY-MM-DD» 를 병기한다.`;

(async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  const cmd = opts._[0] || 'brief';
  try {
    switch (cmd) {
      case 'brief': await cmdBrief(opts); break;
      case 'pet': await cmdPet(opts._.slice(1).join(' '), opts); break;
      case 'pets': await cmdPets(opts); break;
      case 'regions': await cmdRegions(opts); break;
      case 'map': await cmdMap(opts); break;
      case 'find': await cmdFind(opts._.slice(1).join(' '), opts); break;
      case 'cross': await cmdCross(opts); break;
      case 'help': case '--help': case '-h': console.log(HELP); break;
      default:
        console.error('모르는 명령: ' + cmd + '\n');
        console.error(HELP);
        process.exitCode = 1;
    }
  } catch (e) {
    console.error('실패: ' + e.message);
    process.exitCode = 1;
  }
})();
