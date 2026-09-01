#!/usr/bin/env node
/* =============================================================================
   build-trend-lite.cjs — 사이트 부팅용 경량 트렌드 파일 생성 (2026-09-02 신설)

   문제
   ----
   `_trend/trend.json` 은 14일치 전량이라 **794KB(gzip 218KB)** 인데, 사이트가 이걸
   **모든 페이지 로드에서 부팅 시** 받았다. 트렌드 탭을 안 열어도 받는다 —
   부팅에 실제로 필요한 건 ⑴상단 네비 배지(최신 판 건수) ⑵「오늘」 탭의 분류별 건수·대표 제목뿐이다.

   왜 keepDays 를 줄이지 않았나
   ---------------------------
   14일 창은 **재탕 탐지가 쓰는 창**이다([[L054]]·[[L058]] — 충돌이 6~12일 전에 있다).
   줄이면 방금 고친 버그가 되돌아온다. 그래서 **원본은 그대로 두고 부팅용만 따로 굽는다.**

   왜 «분리»가 아니라 «추가»인가 (설계 판단)
   -----------------------------------------
   trend.json 을 3일치로 «자르고» 나머지를 archive 로 빼는 안도 있었다. 그러면 중복이 없다.
   대신 **trend.json 만 읽는 도구가 조용히 3일만 보게 된다** — `classify-picks.ps1`·`desk-dedup.cjs` 가
   그렇다. 그건 방금 고친 «창이 좁아서 재탕을 못 본다» 버그와 **정확히 같은 사고**이고, 심지어 조용하다.
   그래서 **trend.json 은 14일 전량 그대로 두고**(도구 변경 0), 부팅용 파생물만 새로 만든다.
   중복의 대가는 «두 파일이 어긋날 수 있다»인데, 그건 `test-desk.cjs` §[7] 이 **하드 게이트로** 막는다.

   출력 = `_trend/trend-lite.json`
   ------------------------------
   - `editions` = 최신 N일(기본 3) — 사이트가 바로 그린다
   - `allDates` = 14일 전량의 날짜 목록 — **날짜 페이저가 14칸을 다 그리게** 한다(잘린 티가 안 난다)
   - `lite:true` · `full:"_trend/trend.json"` — 사이트가 «더 받아야 하나»를 이걸로 판단한다
   사이트는 페이저를 3일 밖으로 넘기거나 검색할 때만 원본을 받아 합친다.

   사용: node _tools/build-trend-lite.cjs [--days 3] [--check]
        --check = 굽지 않고 «현재 lite 가 trend.json 과 맞는가»만 본다(게이트용, exit 1 로 실패)
============================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FULL = path.join(ROOT, '_trend', 'trend.json');
const LITE = path.join(ROOT, '_trend', 'trend-lite.json');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const DAYS = Math.max(1, Number(arg('--days', '3')) || 3);
const CHECK = argv.includes('--check');

if (!fs.existsSync(FULL)) { console.error('trend.json 이 없습니다: ' + FULL); process.exit(2); }
const full = JSON.parse(fs.readFileSync(FULL, 'utf8'));
const eds = (full.editions || []).filter(e => e && e.date)
  .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

const lite = {
  schema: full.schema || 2,
  kind: full.kind || 'daily-topic-desk',
  updated: full.updated || '',
  keepDays: full.keepDays || 14,
  lite: true,
  liteDays: DAYS,
  full: '_trend/trend.json',
  /* ★페이저가 14칸을 다 그리도록 날짜만 전량 싣는다 — 없으면 사용자에게 «3일치밖에 없네»로 보인다 */
  allDates: eds.map(e => String(e.date)),
  sections: full.sections || [],
  editions: eds.slice(0, DAYS)
};

/* 두 파일이 어긋났는지 = «최신 날짜»·«날짜 목록»·«실린 판의 항목 수» 세 가지로 본다.
   내용 전체를 해시하지 않는 이유: lite 는 full 의 부분집합이라 해시가 원리적으로 다르다. */
function drift(cur) {
  if (!cur || !cur.lite) return 'lite 파일이 없거나 lite 플래그가 없다';
  const a = (cur.allDates || []).join(','), b = lite.allDates.join(',');
  if (a !== b) return `allDates 불일치 (lite ${cur.allDates ? cur.allDates.length : 0}일 vs trend.json ${lite.allDates.length}일)`;
  const cn = (cur.editions || []).length, ln = lite.editions.length;
  if (cn !== ln) return `실린 판 수 불일치 (lite ${cn} vs 기대 ${ln})`;
  for (let i = 0; i < ln; i++) {
    const c = cur.editions[i], l = lite.editions[i];
    if (String(c.date) !== String(l.date)) return `판 순서/날짜 불일치 (${c.date} vs ${l.date})`;
    const ci = (c.sections || []).reduce((s, x) => s + ((x.items || []).length), 0);
    const li = (l.sections || []).reduce((s, x) => s + ((x.items || []).length), 0);
    if (ci !== li) return `${l.date} 항목 수 불일치 (lite ${ci} vs trend.json ${li})`;
  }
  return null;
}

if (CHECK) {
  let cur = null;
  try { cur = JSON.parse(fs.readFileSync(LITE, 'utf8')); } catch (_) { }
  const d = drift(cur);
  if (d) { console.error('  FAIL trend-lite.json 이 trend.json 과 어긋남 — ' + d + '\n       → node _tools/build-trend-lite.cjs 로 다시 구우세요.'); process.exit(1); }
  console.log('  PASS trend-lite.json 최신 (' + lite.editions.length + '일 실림 / 전체 ' + lite.allDates.length + '일)');
  process.exit(0);
}

fs.writeFileSync(LITE, JSON.stringify(lite, null, 2) + '\n', 'utf8');
const kb = f => (fs.statSync(f).size / 1024).toFixed(0);
console.log(`trend-lite.json 생성 — ${lite.editions.length}일 실림 / 날짜 목록 ${lite.allDates.length}일`);
console.log(`  trend.json ${kb(FULL)}KB → lite ${kb(LITE)}KB (부팅 전송량 기준)`);
