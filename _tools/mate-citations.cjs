#!/usr/bin/env node
/* ============================================================================
   mate-citations.cjs — 봄딩·영도 네이버 «AI 브리핑 인용수 · 방문자» 일별 스냅샷 → _trend/_citations.json   (2026-09-05 신설)

   왜 만들었나
     네이버 메이트 선정 기준 1순위가 AI 브리핑 인용수인데(선정월 − 2월의 값), 네이버는 월 단위 숫자 세 개
     (누적·이번 달·기준월)만 보여 주고 일별 흐름·API 는 없다. 그래서 매일 같은 시각에 공개 프로필을 읽어
     누적값을 적고, 그 «차분»으로 일별 인용 증분을 만든다. 방문자도 같은 방식(누적 방문자 차분 + 영도는
     공개 카운터 XML 로 달력일 정확값). 홈 탭 「AI 브리핑 인용」·「일별 방문자」 타일이 이 파일을 읽는다.

   어디서 읽나 (로그인 불필요 · 전부 공개 데이터)
     ① https://m.blog.naver.com/<id>  (iPhone UA)  응답 HTML 안의 JSON:
          "isNaverMateBlog":true,"mateInfo":{"topic":"게임","year":2026,"month":9},
          "mateCitations":{"cumulativeCount":N,"currentMonthCount":N,"selectionPeriodCount":N,"currentMonth":9,"selectionPeriodMonth":7}
          "totalVisitorCount":N · "dayVisitorCount":N · "postCount":N
        ★인용수는 «네이버 메이트로 선정된 블로그»만 공개된다(미선정=null). 영도는 선정 전이라 null — 0 으로 위장하지 않고
          «비공개»로 적는다. 선정되는 달부터 자동으로 값이 들어온다(코드 변경 불필요).
     ② https://blog.naver.com/NVisitorgp4Ajax.naver?blogId=<id>  → 최근 5일 «달력일» 방문자 XML.
        봄딩은 카운터를 닫아 204(없음) → 누적 차분으로 대체. 영도는 200.

   일별 값의 뜻 (★해석 규칙 — 사이트 툴팁·문서와 같아야 한다)
     rows[i].citations = rows[i+1].cum − rows[i].cum  → «그 날짜 행에서 다음 스냅샷까지» 늘어난 인용 = 사실상 그 날의 인용.
       매일 06:00 데스크 [E] 에서 1회 찍으므로 «어제 행»까지만 값이 있고 오늘 행은 내일 아침에 채워진다(pending).
     rows[i].visitors  = XML 의 그 달력일 값(src:"xml")  |  없으면 누적 방문자 차분(src:"diff", 06:00→06:00 창)
     span = 다음 스냅샷까지 일수(하루를 건너뛰면 2 — 그 증분은 이틀치다. 사이트가 «n일 합»으로 표시).

   운영 규칙
     - 하루 1행. 오늘 행이 이미 있으면 **덮어쓰지 않는다**(표본 시각을 지키려고). 강제=`--force`.
       단 latest(지금 값)·XML 과거일 백필·차분 재계산은 매번 한다.
     - 실패해도 exit 0 (데스크 발행을 막지 않는다). 그 블로그는 `error` 를 남기고 지난 행을 보존한다. 파일을 못 쓰면 exit 1.
     - 벤치마크(게임인포·쿠치토 = 게임 주제 스페셜 메이트)도 같이 적는다 — 7월이 전원 피크였듯 시즌 효과를 가르는 기준선.
       사이트는 그리지 않는다(사용자 요청 범위 = 봄딩·영도). `--no-bench` 로 끌 수 있다.
     - 60일 보관. 소비자 = index.html tileCite()/tileVisit() (14일 창).

   실행  node _tools/mate-citations.cjs            # 데스크 [E] 매일 06:00 (usage-daily·quota 와 같은 자리)
         node _tools/mate-citations.cjs --print    # 사람이 보는 표
         node _tools/mate-citations.cjs --force    # 오늘 행 재수집(표본 시각이 바뀐다 — 평소엔 쓰지 말 것)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_citations.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const KEEP = 60;
/* 현역 작성자 2인(브레인 ★0 라우팅표 — 휴면 3인은 네이버가 아니거나 휴면이라 대상 아님). 네이버 ID 정본 = check-published.ps1 과 동일 */
const WRITERS = [{ name: '봄딩', id: 'bomding' }, { name: '영도', id: 'kkodug9' }];
/* 게임 주제 벤치마크(공개 메이트) — 쓰담/docs/naver-mate-citations-2026-09-05.md §3 */
const BENCH = [{ name: '게임인포', id: 'gameinfor' }, { name: '쿠치토', id: 'arcsin802' }];

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const PRINT = argv.includes('--print');
const NOBENCH = argv.includes('--no-bench');

function kstYmd(ms) {
  const d = new Date(ms + 9 * 3600e3), p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00+09:00') - Date.parse(a + 'T00:00:00+09:00')) / 86400000); }

async function get(url, headers) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: Object.assign({ 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' }, headers || {}) });
    return { status: r.status, text: r.status === 204 ? '' : await r.text() };
  } finally { clearTimeout(t); }
}

/* 프로필 HTML → 숫자. 블로그 객체의 세 필드는 항상 이 순서로 붙어 있다(봄딩·영도·벤치 실측 09-05). 떨어져 있으면 개별 매칭으로 폴백 */
function parseProfile(html) {
  const num = (k) => { const m = html.match(new RegExp('"' + k + '":(\\d+)')); return m ? Number(m[1]) : null; };
  const j = (s) => { try { return s && s !== 'null' ? JSON.parse(s) : null; } catch (e) { return null; } };
  let selected = null, info = null, cites = null;
  const trio = html.match(/"isNaverMateBlog":(true|false),"mateInfo":(\{[^}]*\}|null),"mateCitations":(\{[^}]*\}|null)/);
  if (trio) { selected = trio[1] === 'true'; info = j(trio[2]); cites = j(trio[3]); }
  else {
    const s = html.match(/"isNaverMateBlog":(true|false)/); selected = s ? s[1] === 'true' : null;
    info = j((html.match(/"mateInfo":(\{[^}]*\}|null)/) || [])[1]);
    cites = j((html.match(/"mateCitations":(\{[^}]*\}|null)/) || [])[1]);
  }
  return {
    found: !!(trio || html.indexOf('"totalVisitorCount"') >= 0),
    selected, info, cites,
    totalVisitors: num('totalVisitorCount'), dayVisitors: num('dayVisitorCount'), posts: num('postCount')
  };
}
function parseXml(xml) {
  const out = {}; const re = /<visitorcnt id="(\d{4})(\d{2})(\d{2})" cnt="(\d+)"/g; let m;
  while ((m = re.exec(xml))) out[m[1] + '-' + m[2] + '-' + m[3]] = Number(m[4]);
  return out;
}

function readPrev() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; } }
function findOrMake(list, b) {
  let e = list.find((x) => x && x.id === b.id);
  if (!e) { e = { name: b.name, id: b.id, mate: null, latest: null, error: null, rows: [] }; list.push(e); }
  e.name = b.name; if (!Array.isArray(e.rows)) e.rows = [];
  return e;
}
function row(rows, d) {
  let r = rows.find((x) => x.d === d);
  if (!r) { r = { d, at: null, cum: null, month: null, monthNo: null, sel: null, selMonth: null, totalVisitors: null, dayVisitors: null, posts: null, citations: null, span: null, visitors: null, visitorsSrc: null }; rows.push(r); }
  return r;
}
/* 차분 재계산 — 행 전체를 날짜순으로 훑어 «다음 스냅샷과의 차»를 앞 행에 적는다 */
function derive(rows) {
  rows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const snaps = rows.filter((r) => r.at);           /* 실제 스냅샷 행만(XML 백필 전용 행 제외) */
  for (let i = 0; i < snaps.length; i++) {
    const a = snaps[i], b = snaps[i + 1];
    if (!b) { a.citations = null; a.span = null; if (a.visitorsSrc === 'diff') { a.visitors = null; a.visitorsSrc = null; } continue; }
    a.span = dayDiff(a.d, b.d) || 1;
    a.citations = (a.cum != null && b.cum != null) ? b.cum - a.cum : null;
    if (a.visitorsSrc !== 'xml') {
      if (a.totalVisitors != null && b.totalVisitors != null) { a.visitors = b.totalVisitors - a.totalVisitors; a.visitorsSrc = 'diff'; }
      else { a.visitors = null; a.visitorsSrc = null; }
    }
  }
}

async function snapshot(entry, b, withXml, today, nowIso) {
  let p;
  try {
    const r = await get('https://m.blog.naver.com/' + b.id);
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    p = parseProfile(r.text);
    if (!p.found) throw new Error('프로필 JSON 없음(마크업 변경?)');
  } catch (e) { entry.error = { at: nowIso, msg: String(e && e.message || e) }; return 'ERR ' + entry.error.msg; }
  entry.error = null;
  entry.mate = p.selected && p.info ? { topic: p.info.topic || null, year: p.info.year || null, month: p.info.month || null } : null;
  const c = p.cites || null;
  entry.latest = {
    at: nowIso, selected: !!p.selected,
    cum: c ? c.cumulativeCount : null, month: c ? c.currentMonthCount : null, monthNo: c ? c.currentMonth : null,
    sel: c ? c.selectionPeriodCount : null, selMonth: c ? c.selectionPeriodMonth : null,
    totalVisitors: p.totalVisitors, dayVisitors: p.dayVisitors, posts: p.posts
  };
  /* 오늘 행 — 첫 표본을 지킨다 */
  const exists = entry.rows.some((r) => r.d === today && r.at);
  let note = exists && !FORCE ? '오늘 행 있음(유지)' : (exists ? '오늘 행 재수집(--force)' : '오늘 행 신규');
  if (!exists || FORCE) {
    const r = row(entry.rows, today);
    Object.assign(r, { at: nowIso, cum: entry.latest.cum, month: entry.latest.month, monthNo: entry.latest.monthNo, sel: entry.latest.sel, selMonth: entry.latest.selMonth,
      totalVisitors: p.totalVisitors, dayVisitors: p.dayVisitors, posts: p.posts });
  }
  /* 달력일 방문자(XML) — 오늘은 진행 중이라 어제까지만 */
  if (withXml) {
    try {
      const x = await get('https://blog.naver.com/NVisitorgp4Ajax.naver?blogId=' + b.id);
      if (x.status === 200 && x.text) {
        const v = parseXml(x.text); let n = 0;
        Object.keys(v).forEach((d) => { if (d < today) { const r = row(entry.rows, d); r.visitors = v[d]; r.visitorsSrc = 'xml'; n++; } });
        note += ' · XML ' + n + '일';
      } else note += ' · XML 없음(' + x.status + ')';
    } catch (e) { note += ' · XML 실패'; }
  }
  derive(entry.rows);
  /* 보관 창 */
  const cut = kstYmd(Date.now() - KEEP * 86400000);
  entry.rows = entry.rows.filter((r) => r.d >= cut);
  return note;
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('ko-KR'); }

(async () => {
  const prev = readPrev() || {};
  const doc = {
    schema: 1, updated: null, keep: KEEP,
    method: '공개 프로필 JSON(mateCitations·totalVisitorCount) 일별 스냅샷 + 누적 차분 = 일별 값. 인용수는 메이트 선정 블로그만 공개(미선정=비공개). 영도 방문자=NVisitorgp4Ajax 달력일 XML.',
    writers: Array.isArray(prev.writers) ? prev.writers : [],
    bench: Array.isArray(prev.bench) ? prev.bench : []
  };
  const now = Date.now(), nowIso = new Date(now).toISOString(), today = kstYmd(now);
  const lines = [];
  for (const b of WRITERS) lines.push('[' + b.name + '] ' + await snapshot(findOrMake(doc.writers, b), b, true, today, nowIso));
  if (!NOBENCH) for (const b of BENCH) lines.push('[벤치 ' + b.name + '] ' + await snapshot(findOrMake(doc.bench, b), b, false, today, nowIso));
  doc.updated = nowIso;
  try {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  } catch (e) { console.error('[citations] 파일 쓰기 실패: ' + e.message); process.exit(1); }
  console.log('[citations] ' + today + ' → ' + path.relative(ROOT, OUT) + '\n  ' + lines.join('\n  '));
  if (PRINT) {
    for (const e of doc.writers.concat(NOBENCH ? [] : doc.bench)) {
      const L = e.latest || {};
      console.log('\n' + e.name + ' (' + e.id + ')' + (e.mate ? ' · ' + e.mate.year + '.' + e.mate.month + ' ' + e.mate.topic + ' 메이트' : ' · 메이트 아님(인용수 비공개)') + (e.error ? ' · ERROR ' + e.error.msg : ''));
      console.log('  누적 ' + fmt(L.cum) + ' · ' + (L.monthNo || '?') + '월 ' + fmt(L.month) + ' · 기준월 ' + (L.selMonth || '?') + '월 ' + fmt(L.sel) + ' · 누적방문 ' + fmt(L.totalVisitors) + ' · 글 ' + fmt(L.posts));
      console.table(e.rows.slice(-10).map((r) => ({ d: r.d, cum: r.cum, citations: r.citations, span: r.span, visitors: r.visitors, src: r.visitorsSrc, snap: r.at ? r.at.slice(11, 16) + 'Z' : '' })));
    }
  }
  process.exit(0);
})();
