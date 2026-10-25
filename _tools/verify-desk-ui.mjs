// verify-desk-ui.mjs — 트렌드 탭 「지금 검색되는 공략」·발주 모달 신호·육아 주 1회 + 홈 「주제 비중」 헤드리스 검증 (2026-09-18)
//   node _tools/verify-desk-ui.mjs [--out DIR]
//   · verify-why.mjs 와 같은 하네스. ★백엔드는 가짜 서버, 트렌드·주제 비중 데이터는 «합성 판»으로 가로챈다 —
//     운영 trend.json 에는 아직 guide 칸·신호가 없고(첫 판 = 09-19 06:00), 운영 데이터를 고쳐 시험하지 않는다.
//   · 보는 것: 7칸 순서·공략 칸 색/아이콘 · 행에 신호가 새지 않는가(행 = 게임·주제·발주 그대로) · 모달 «검색 수요»·«AI 브리핑» 줄과
//     소재 메모 · 신호 없는 옛 항목엔 줄이 없는가 · 육아 주 1회 빈 칸 문구와 «판 보기» 이동 · 지정 게임 문구 ·
//     홈 타일 막대 비율(그려진 픽셀)·목표 눈금·미연결 표기·툴팁·표 뷰·재검 줄 · 1920/390/360 넘침 0 · 칸 머리 한 줄(390·360) · hover 캡션 대비 · 콘솔 0 · CSS 구조
//   · ★2026-10-12 홈 「블로그 활동」 방문자 막대 — 인용이 비공개인 작성자(영도) 칸의 막대 수·높이 비(그려진 픽셀)·색·축 단위·스탯·툴팁·표 ·
//     두 칸 차트 정렬 · 방문자가 없을 때의 예전 모양(선 하나). 데이터는 «합성 판»(_citations.json 가로채기 · 날짜는 실행일 기준 상대값).
//   · `--index FILE` = 그 파일을 index.html 로 서빙한다(커밋 전 판·변이 판으로 «새 검사가 옛 결함을 잡는가»를 볼 때. 평소엔 쓰지 않는다)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, createReadStream, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = val('--out', join(tmpdir(), '_deskui-out'));
const INDEX = val('--index', null) ? resolve(val('--index', null)) : join(ROOT, 'index.html');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/* ── 합성 판 ── */
const src = (n) => [{ label: '공식', url: 'https://example.com/' + n }];
const I = (sec, n, o) => Object.assign({ id: 'syn-' + sec + '-' + n, game: 'G' + n, title: sec + ' 주제 ' + n, purpose: '게임 공략', why: '왜 지금', detail: '확인된 사실 한 줄', angle: '각도', heat: 2, keywords: ['G' + n + ' 공략'], sources: src(sec + n) }, o);
const E1 = { date: '2026-09-23', headline: '합성 판 — 수요일', note: ['★육아 제품은 주 1회(월요일 판)'], sections: [
  { key: 'pinned', items: [I('pinned', 1, { game: '롤토체스', title: '롤토체스 초보 덱 추천, 18.2 기준', angleType: 'rank', demand: { tier: 2, src: 'ac', ac: 10 }, aib: { s: 'shown', n: 4, bd: 2, yd: null, q: '롤토체스 초보 덱' } })] },
  { key: 'core', items: [I('core', 1, { game: '팰월드', title: '팰월드 거점 추천 위치', coverage: [{ writer: '봄딩', title: '팰월드 거점 어디에 지을까, 평지 넓은 자리 5곳', words: ['거점'] }], angleType: 'howto', demand: { tier: 1, src: 'searchad', ac: 10, game: 42000, kw: { q: '팰월드 거점', n: 3200 } }, aib: { s: 'async', n: 0, bd: null, yd: null, q: '팰월드 거점' } })] },
  { key: 'guide', items: [
    I('guide', 1, { game: '메이플스토리', title: '메이플스토리 초보 세팅 방법, 사냥 전에 할 것', angleType: 'howto', depth: 'play', demand: { tier: 2, src: 'ac', ac: 9 }, aib: { s: 'shown', n: 5, bd: null, yd: null, q: '메이플 스토리 세팅' } }),
    I('guide', 2, { game: '리그 오브 레전드', title: '리그 오브 레전드 게임 방법, 처음 하는 사람 기준', angleType: 'howto',
      coverage: [{ writer: '봄딩', title: '롤 처음 시작하는 법, 계정 만들기부터', words: ['처음', '방법'] }, { writer: '봄딩', title: '리그 오브 레전드 튜토리얼 보상 정리', words: ['리그', '레전드'] }], depth: 'entry', entryOk: '09-20 서비스 이관으로 접속 경로 변경', demand: { tier: 2, src: 'ac', ac: 10 }, aib: { s: 'none', n: 0, bd: null, yd: null, q: '리그 오브 레전드 게임 방법' } }),
    /* ★guide-3 은 «실제 판만큼 긴» 항목이다(사실 3문장 + ★주의 + 긴 각도) — 요약 카드가 길어야 작은 창에서 모달 본문이 넘치고,
       그래야 «주제 칸 포커스가 본문을 끌어내리는가» 검사가 옛 결함을 잡는다(짧은 합성 항목으로는 변이 시험에서 못 잡았다 · 10-11) */
    I('guide', 3, { game: '뱀피르', title: '뱀피르 쿠폰 9월 입력 방법', coverage: [{ writer: '봄딩', title: '뱀피르 쿠폰 모음, 8월 코드 정리', words: ['쿠폰'] }, { writer: '영도', title: '뱀피르 쿠폰 입력하는 곳' }], angleType: 'howto', demand: { tier: 2, src: 'ac', ac: 8 },
      why: '9월 쿠폰 3종이 한꺼번에 풀렸고 입력 경로가 설정 메뉴로 옮겨져 «뱀피르 쿠폰 입력» 검색이 몰린다',
      detail: '공식 공지에 따르면 9월 쿠폰 3종은 9월 30일 23시 59분까지 쓸 수 있고 계정당 한 번만 등록된다.\n입력 경로는 9월 12일 패치로 우편함에서 설정 > 계정 > 쿠폰 등록으로 옮겨졌고 iOS 는 웹 쿠폰 페이지에서만 된다.\n보상은 쿠폰마다 다르며 가장 큰 것은 고급 소환권 10장과 강화석 300개다.\n★iOS 웹 쿠폰 페이지 주소는 공지에 링크로만 있어 본문에 직접 적지 못했다 — 확인 필요',
      angle: '기존 봄딩 «뱀피르 쿠폰 모음, 8월 코드 정리»가 코드 목록을 다룬 것과 달리 9월 패치 뒤 바뀐 입력 경로와 iOS 예외를 순서대로 다룬다. 영도 «쿠폰 입력하는 곳»은 패치 전 경로다.' })] },
  { key: 'parenting', items: [] },
  { key: 'new', items: [I('new', 1, { angleType: 'news', demand: { tier: 1, src: 'ac', ac: 2 } })] },
  { key: 'update', items: [I('update', 1, { angleType: 'howto', demand: { tier: 2, src: 'ac', ac: 10 } })] },
  { key: 'hot', items: [I('hot', 1, { angleType: 'howto', demand: { tier: 2, src: 'ac', ac: 10 } })] }] };
const E2 = { date: '2026-09-22', headline: '합성 판 — 화요일', note: [], sections: [
  { key: 'core', items: [I('core', 2, {})] }, { key: 'parenting', items: [] }] };
const E3 = { date: '2026-09-21', headline: '합성 판 — 월요일', note: [], sections: [
  { key: 'guide', items: [I('guide', 9, { angleType: 'rank', demand: { tier: 1, src: 'ac', ac: 3 } })] },
  { key: 'parenting', items: [I('parenting', 1, { game: '아기 가습기', title: '아기 가습기 추천 5종', purpose: '제품 비교·추천', lane: '봄딩', coverage: [{ writer: '봄딩', title: '아기 가습기 3종 비교, 가열식이랑 초음파식', words: ['가습기'] }] }),
    I('parenting', 2, { game: '아기 칫솔', title: '아기 칫솔 비교', purpose: '제품 비교·추천', lane: '봄딩' })] }] };
const E4 = { date: '2026-09-18', headline: '합성 판 — 옛 판', note: [], sections: [
  { key: 'new', items: [I('new', 7, { title: '옛 판 항목(신호 없음)' })] }, { key: 'parenting', items: [] }] };
const SECTIONS = ['pinned', 'core', 'guide', 'parenting', 'new', 'update', 'hot'].map((k) => ({ key: k, label: k }));
const FULL = { schema: 2, kind: 'daily-topic-desk', updated: '2026-09-23T06:40:00+09:00', keepDays: 14, sections: SECTIONS, editions: [E1, E2, E3, E4] };
const LITE = Object.assign({}, FULL, { lite: true, liteDays: 3, full: '_trend/trend.json', allDates: FULL.editions.map((e) => e.date), editions: [E1, E2, E3] });
const MIX_A = { schema: 1, kind: 'desk-mix', updated: '2026-09-23T06:45:00+09:00', target: { guide: 50 },
  bars: [{ k: 'supply', label: '트렌드 추천', window: '최근 7판', regex: 4, n: 20, howto: 40, rank: 15, news: 10, info: 35, guide: 55, depth: { n: 20, play: 75, entry: 15, news: 10 } },
    { k: 'orders', label: '발주', window: '최근 14일', n: null },
    { k: 'drafts', label: '작성 글', window: '최근 14일', n: 12, howto: 20, rank: 5, news: 50, info: 25, guide: 25, depth: { n: 12, play: 50, entry: 8.3, news: 41.7 } }],
  followup: { posts: 17, d7: { posts: 3, queries: 9, shown: 3, async: 2, none: 4, cited: 1 }, d14: { posts: 0, queries: 0, shown: 0, async: 0, none: 0, cited: 0 } } };
const MIX_B = Object.assign({}, MIX_A, { followup: null, bars: [MIX_A.bars[0], { k: 'orders', label: '발주', window: '최근 14일', n: 0 }, Object.assign({}, MIX_A.bars[2], { guide: 100, howto: 100, rank: 0, news: 0, info: 0 })] });
let MIX = MIX_A;

/* ── 합성 «블로그 활동» 판(2026-10-12) ── 운영 _citations.json 은 날마다 달라 검사 기준이 못 된다.
   날짜는 실행일 기준 상대값(사이트가 «어제까지 14일»을 그리므로) — 자정을 걸친 실행에도 어긋나지 않게 요청 때마다 만든다.
   봄딩 = 인용 공개(막대 = 인용) · 영도 = 인용 비공개 + 달력일 방문자(막대 = 방문자). VIS: n일 전 → 방문자(없으면 3,000) —
   1일 전 5,000(최대) · 2일 전 2,500(높이 비 0.5) · 4일 전 0명(막대 없음 · «0명») · 5일 전 값 없음(막대 없음 · «집계 전») */
const p2 = (n) => String(n).padStart(2, '0');
const dayAgo = (n) => { const d = new Date(Date.now() - n * 86400000); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const md = (ymd) => Number(ymd.slice(5, 7)) + '.' + Number(ymd.slice(8, 10));
const VIS = { 1: 5000, 2: 2500, 3: 3200, 4: 0, 5: null, 6: 4100 };
const citeDoc = (withVisitors) => {
  const rb = [], ry = [], now = new Date().toISOString();
  for (let n = 20; n >= 0; n--) {
    const d = dayAgo(n), at = new Date(Date.now() - n * 86400000).toISOString();
    rb.push({ d, at, cum: 4000000 + (20 - n) * 40000, citations: n ? 40000 : null, span: n ? 1 : null, postsDay: 3, visitors: null, visitorsSrc: null });
    const v = (n === 0 || !withVisitors) ? null : (n in VIS ? VIS[n] : 3000);
    ry.push({ d, at, cum: null, citations: null, span: n ? 1 : null, postsDay: n % 3, visitors: v, visitorsSrc: v == null ? null : 'xml' });
  }
  const latest = (o) => Object.assign({ at: now, selected: false, cum: null, month: null, monthNo: null, sel: null, selMonth: null, totalVisitors: null, dayVisitors: 0, posts: 100 }, o);
  const w = (name, id, L, rows) => ({ name, id, mate: null, latest: latest(L), error: null, postsError: null, postsFrom: dayAgo(20), months: [], rows });
  return { schema: 1, updated: now, keep: 60, writers: [
    w('봄딩', 'bomding', { cum: 4800000, month: 360000, monthNo: 10, sel: 750000, selMonth: 8, totalVisitors: 16000000, posts: 4858 }, rb),
    w('영도', 'kkodug9', { totalVisitors: 17878443, posts: 6885 }, ry)], bench: [] };
};
let CITE_VIS = true;
/* 기대값 — 사이트와 따로 센다(만 단위는 소수 첫째자리 «버림»). 달 합 = 그 달 일별 값의 합, 재야 할 구간에 빈 날이 있으면 라벨에 « *» */
const ko = (n) => n >= 1e4 ? (Math.floor(n / 1e3) / 10).toFixed(1).replace(/\.0$/, '') + '만' : n.toLocaleString('ko-KR');
const citeExpect = () => {
  const y = citeDoc(true).writers[1], tm = dayAgo(0).slice(0, 7), Y = +tm.slice(0, 4), M = +tm.slice(5, 7), pm = M === 1 ? (Y - 1) + '-12' : Y + '-' + p2(M - 1);
  const cell = (ym, whole, none) => {
    const rs = y.rows.filter((r) => r.d.startsWith(ym) && r.visitors != null), lab = Number(ym.slice(5, 7)) + '월 방문자';
    if (!rs.length) return lab + '=' + none;
    const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), last = Math.max(...rs.map((r) => +r.d.slice(8, 10)));
    return lab + (rs.length < (whole ? dim : last) ? ' *' : '') + '=' + ko(rs.reduce((a, r) => a + r.visitors, 0));
  };
  return [md(dayAgo(1)) + ' 방문자=5,000', cell(tm, false, '집계 전'), cell(pm, true, '—'), '누적 방문자=1787.8만'];
};

/* ── 가짜 백엔드 ── */
const api = createServer((req, res) => {
  const u = req.url.split('?')[0];
  const done = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') return done(204, {});
  if (u === '/why') return done(200, { reasons: [], items: [], counts: {} });
  if (u === '/hidden' || u === '/mpub') return done(200, { rels: [] });
  if (u === '/pins') return done(200, { games: [], max: 8, updatedAt: Date.now() });
  if (u === '/requests') return done(200, []);
  return done(200, {});
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
const AP = api.address().port;

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  const json = (o) => { res.writeHead(200, { 'Content-Type': MIME['.json'] }); res.end(JSON.stringify(o)); };
  if (p === '/_trend/trend-lite.json') return json(LITE);
  if (p === '/_trend/trend.json') return json(FULL);
  if (p === '/_trend/_desk-mix.json') return json(MIX);
  if (p === '/_trend/_citations.json') return json(citeDoc(CITE_VIS));
  const abs = normalize(join(ROOT, p));
  if (!existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  if (p === '/index.html') {
    let html = readFileSync(INDEX, 'utf8');
    html = html.replace(/API_BASE\s*:\s*'[^']*'/, "API_BASE:'http://127.0.0.1:" + AP + "'");
    res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(html); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;

const port = 9400 + Math.floor(Math.random() * 500);
const prof = join(tmpdir(), `_deskuiprof${port}`);
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); api.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| site :' + HP, '| fake api :' + AP, '| out ' + OUT);

const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); let logs = []; let loaded = null;
ws.onmessage = (m0) => {
  const m = JSON.parse(m0.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('[console.error] ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Page.loadEventFired' && loaded) loaded();
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }; return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*sslip.io*', '*cheer-splash.js*'] });
const rect = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return{cx:b.left+b.width/2,cy:b.top+b.height/2}})()`);
const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }); await sleep(220); };
const click = async (sel) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center'});return true})()`); await sleep(160); const r = await rect(sel); if (!r) return false; await tap(r.cx, r.cy); return true; };
const hover = async (sel) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center'});return true})()`); await sleep(160); const r = await rect(sel); if (!r) return false; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.cx, y: r.cy, button: 'none' }); await sleep(250); return true; };
const waitFor = async (expr, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return v; await sleep(120); } return null; };
/* ★전체 화면 캡처 전에 한 번 끝까지 내려갔다 온다 — 화면 밖 타일은 «스크롤 등장»(observeRise) 전까지 투명해서
   captureBeyondViewport 로 찍으면 빈칸으로 나온다(1차 실행에서 홈 390 의 「주제 비중」이 통째로 안 찍혔다 — 결함 아님) */
const revealAll = async () => {
  const h = await ev(`document.documentElement.scrollHeight`), vh = await ev(`innerHeight`);
  for (let y = 0; y <= h; y += Math.max(200, Math.floor(vh * 0.6))) { await ev(`window.scrollTo(0,${y})`); await sleep(160); }
  await sleep(700); await ev(`window.scrollTo(0,0)`); await sleep(400);
};
const shot = async (n, full) => {
  let clip;
  if (full) await revealAll();
  if (full) { const m = await send('Page.getLayoutMetrics'); const c = m.result.cssContentSize || m.result.contentSize; clip = { x: 0, y: 0, width: c.width, height: Math.min(c.height, 6000), scale: 1 }; }
  const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' });
  writeFileSync(join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64'));
};

const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const open = async (w, h, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  await Promise.race([p, sleep(10000)]); loaded = null;
  await waitFor(`!document.querySelector('#view .skel')`, 9000);
  await sleep(500);
};
/* ★탭은 맨 위로 올린 뒤 누른다 — 아래로 스크롤된 상태에서 탭 좌표를 치면 섬(고정)이 접혀 있어 헛친다(1차 실행에서 홈 전환 실패) */
const goTab = async (v, ready) => {
  await ev(`window.scrollTo(0,0)`); await sleep(500);
  await click(`.isl-tab[data-v="${v}"]`); await sleep(900);
  let ok = await waitFor(ready, 5000);
  if (!ok) { await ev(`document.querySelector('.isl-tab[data-v="${v}"]').click()`); await sleep(900); ok = await waitFor(ready, 5000); if (ok) console.log('  (주의) ' + v + ' 탭은 좌표 클릭이 아니라 JS click 으로 열렸다'); }
  return ok;
};
const goTrend = () => goTab('trend', `document.querySelectorAll('.tsec').length>0`);
const goHome = () => goTab('home', `!!document.querySelector('#tileMix')`);
/* 대비 — 계산된 색 두 개(rgb 문자열)로 WCAG 비 */
const CONTRAST = `(a,b)=>{const p=s=>s.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v=>v/255).map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));const L=s=>{const [r,g,b]=p(s);return 0.2126*r+0.7152*g+0.0722*b};const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}`;

/* ═════ 1920 — 트렌드 ═════ */
await open(1920, 1080, false); logs = [];
chk('트렌드 탭이 뜬다', !!(await goTrend()));
const secs = await ev(`[...document.querySelectorAll('.tsec .tsec-t')].map(e=>e.textContent)`);
/* ★10-25 결정서 — 8칸(「갱신할 글」 신설) · 공략 칸은 핀 바로 다음(2번째)으로 올렸다. 옛 검사(7칸 · 3번째)는 그날 개편 뒤 FAIL 로 남아 있었다 */
chk('8칸 · 공략 칸이 «꼭 다룰 게임» 바로 다음', Array.isArray(secs) && secs.length === 8 && secs[1] === '지금 검색되는 공략' && secs[7] === '갱신할 글', secs);
const gsec = `[...document.querySelectorAll('.tsec')].find(s=>s.querySelector('.tsec-t').textContent==='지금 검색되는 공략')`;
chk('공략 칸 아이콘이 그려진다(책 — 경로 2개)', (await ev(`(()=>{const s=${gsec};return s?s.querySelectorAll('.tsec-ic svg path').length:0})()`)) === 2);
chk('공략 칸 색 = --s-guide(#5A6E14)', (await ev(`(()=>{const s=${gsec};return getComputedStyle(s.querySelector('.tsec-ic')).color})()`)) === 'rgb(90, 110, 20)',
  await ev(`(()=>{const s=${gsec};return s?getComputedStyle(s.querySelector('.tsec-ic')).color:null})()`));
chk('공략 칸 행 3개', (await ev(`(()=>{const s=${gsec};return s.querySelectorAll('.trow').length})()`)) === 3);
/* 게임명 대비 — 칸마다 첫 행 글자색을 흰 면(#FFF)·hover 면(surface-2 #F6F7F9)에 대고 잰다. 12.5px 글자라 4.5 가 기준.
   ★1차 실행에서 첫 행(꼭 다룰 게임 · #A8720F)이 4.13 으로 걸렸다 — 기존 결함이라 글자 단계 --s-pinned-t 를 새로 뒀다 */
const crs = await ev(`[...document.querySelectorAll('.tsec')].map(s=>{const g=s.querySelector('.trow .tr-g');if(!g)return null;const c=getComputedStyle(g).color;return {sec:s.querySelector('.tsec-t').textContent,w:+(${CONTRAST})(c,'rgb(255, 255, 255)').toFixed(2),h:+(${CONTRAST})(c,'rgb(246, 247, 249)').toFixed(2)}}).filter(Boolean)`);
chk('모든 칸 게임명 대비 ≥4.5(흰 면·hover 면)', Array.isArray(crs) && crs.length >= 5 && crs.every((x) => x.w >= 4.5 && x.h >= 4.5), crs);
chk('꼭 다룰 게임 글자 = 글자 단계(#8F610D) · 아이콘은 원색(#A8720F)', await ev(`(()=>{const s=[...document.querySelectorAll('.tsec')].find(x=>x.querySelector('.tsec-t').textContent==='꼭 다룰 게임');return getComputedStyle(s.querySelector('.tr-g')).color==='rgb(143, 97, 13)'&&getComputedStyle(s.querySelector('.tsec-ic')).color==='rgb(168, 114, 15)'})()`));
/* ★10-25 결정서 4번 — 각도·브리핑 «칩»은 행에 선다(주제 셀 안). 검색 수요 숫자는 여전히 모달에만 */
chk('★행은 3요소 그대로(게임·주제·발주) · 검색 수요는 행에 새지 않는다', await ev(`(()=>{const s=${gsec};const r=s.querySelector('.trow');return r.children.length===3&&!/수요|자동완성/.test(r.textContent)})()`));
chk('지정 게임 0종 문구 = «최대 5개»', (await ev(`(()=>{const s=[...document.querySelectorAll('.tsec')].find(x=>x.querySelector('.tsec-t').textContent==='꼭 다룰 게임');return s?s.textContent:''})()`)).includes('게임마다 주제 최대 5개') || (await ev(`document.querySelectorAll('.tsec')[0].querySelectorAll('.trow').length`)) > 0);
/* 관련 글 작성자 라벨(2026-10-25 사용자 요청) — 10-11 의 중립 태그 «관련 글»(누구 글인지 안 보였다)을 그 글을 쓴 작성자 이름 + 6px 작성자 색 점으로 바꿨다.
   중복은 작성자 단위라 라벨이 없는 작성자는 겹침 없이 발주한다. 자세한 것은 정보 카드(.itip · 옛 title 툴팁 대신).
   색·글자·자리·대비를 «그려진 값»으로 잰다. 합성 판 = core-1(봄딩 1 · 겹친 말 있음) · guide-2(봄딩 2편) · guide-3(봄딩 1 + 영도 1 · 영도는 겹친 말 없는 옛 형식) */
const WR = `(id)=>{const b=document.querySelector('[data-req="'+id+'"]');const r=b&&b.closest('.trow');if(!r)return null;const cb=b.getBoundingClientRect(),rb=r.getBoundingClientRect(),hb=r.querySelector('.tr-h').getBoundingClientRect();
  return {kids:r.children.length,rel:r.querySelectorAll('.tr-rel').length,hw:Math.round(hb.width),labels:[...r.querySelectorAll('.tr-wr')].map(t=>{const cs=getComputedStyle(t),tb=t.getBoundingClientRect(),dot=t.querySelector('i');
    return {tx:t.textContent,tag:t.tagName,aria:t.getAttribute('aria-label'),title:t.getAttribute('title'),color:cs.color,bg:cs.backgroundColor,fs:parseFloat(cs.fontSize),svg:t.querySelectorAll('svg').length,
      dot:dot?getComputedStyle(dot).backgroundColor:null,dotW:dot?Math.round(dot.getBoundingClientRect().width):0,
      inRow:tb.left>=rb.left-0.5&&tb.right<=rb.right+0.5&&tb.top>=rb.top-0.5&&tb.bottom<=rb.bottom+0.5,clearOfCta:tb.right<=cb.left+0.5||tb.bottom<=cb.top+0.5,below:tb.top>=hb.bottom-0.5,h:Math.round(tb.height)}})}}`;
/* 떠 있는 정보 카드 — 내용 · 글자 크기(가장 작은 글자) · 창 안 · 기준 요소에 붙었나(아래 8px 또는 위 8px) */
const TIP = `(()=>{const t=document.querySelector('.itip.on');if(!t)return null;const b=t.getBoundingClientRect(),cs=getComputedStyle(t),a=document.querySelector('[aria-describedby="itip"]'),ab=a?a.getBoundingClientRect():null,q=s=>{const e=t.querySelector(s);return e?e.textContent:''};
  const txt=[...t.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
  return {h:q('.itip-hn'),k:q('.itip-hk'),p:q('.itip-p'),n:q('.itip-n'),list:[...t.querySelectorAll('.itip-l li')].map(li=>({t:li.querySelector('.itip-t').textContent,w:[...li.querySelectorAll('.itip-w b')].map(x=>x.textContent)})),
    rows:[...t.querySelectorAll('.itip-rk')].map(x=>x.textContent+'='+x.nextElementSibling.textContent),dot:t.querySelector('.itip-h i')?getComputedStyle(t.querySelector('.itip-h i')).backgroundColor:null,
    minFs:Math.min(...txt.map(e=>parseFloat(getComputedStyle(e).fontSize))),colors:[...new Set(txt.map(e=>getComputedStyle(e).color))],bg:cs.backgroundColor,
    inView:b.left>=0&&b.top>=0&&b.right<=document.documentElement.clientWidth+0.5&&b.bottom<=innerHeight+0.5,w:Math.round(b.width),
    near:ab?(Math.abs(b.top-ab.bottom-8)<=1.5||Math.abs(ab.top-b.bottom-8)<=1.5):false,anchor:a?a.textContent:null}})()`;
/* 짙은 반투명 면 위 반투명 흰 글자의 «실제» 대비 — 둘 다 흰 바탕(사이트 면)에 합성한 뒤 잰다 */
const mixOn = (fg, bg) => { const p = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; }; const B = p(bg), F = p(fg);
  const bgc = B.c.map((v) => v * B.a + 255 * (1 - B.a)), fgc = F.c.map((v, i) => v * F.a + bgc[i] * (1 - F.a)); return ['rgb(' + fgc.map(Math.round).join(', ') + ')', 'rgb(' + bgc.map(Math.round).join(', ') + ')']; };
const tipMinCr = async (tp) => { let m = 99; for (const c of (tp && tp.colors) || []) { const [f, g] = mixOn(c, tp.bg); m = Math.min(m, await ev(`(${CONTRAST})(${JSON.stringify(f)},${JSON.stringify(g)})`)); } return Math.round(m * 100) / 100; };
const away = async () => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 600, button: 'none' }); await sleep(420); };
const wr1 = await ev(`(${WR})('syn-core-1')`), w1 = wr1 && wr1.labels[0];
chk('관련 글 라벨 = 작성자 이름 + «글»(«봄딩 글») · 버튼 · 아이콘 없음 · 행은 3요소 그대로 · 옛 «관련 글» 태그 없음', wr1 && wr1.labels.length === 1 && w1.tx === '봄딩 글' && w1.tag === 'BUTTON' && w1.svg === 0 && wr1.kids === 3 && wr1.rel === 0 && w1.aria === '봄딩 관련 글 1편', wr1);
chk('라벨 점 = 작성자 색(봄딩 #C43D63) 6px · 글자는 중립(ink-2 · surface-3 면) — alert 색이 아니다', w1 && w1.dot === 'rgb(196, 61, 99)' && w1.dotW === 6 && w1.color === 'rgb(73, 79, 87)' && w1.bg === 'rgb(239, 241, 244)', w1);
const relCr = w1 ? await ev(`(${CONTRAST})(${JSON.stringify(w1.color)},${JSON.stringify(w1.bg)})`) : 0;
chk('라벨 글자 ≥12.5px · 대비 ≥4.5', w1 && w1.fs >= 12.5 && relCr >= 4.5, { fs: w1 && w1.fs, cr: relCr });
chk('라벨이 행 안에 있고 발주 버튼과 안 겹친다', w1 && w1.inRow && w1.clearOfCta, w1);
chk('★브라우저 title 툴팁이 남아 있지 않다(라벨·칩 전부)', await ev(`[...document.querySelectorAll('#view .tr-wr,#view .tr-chip,#view .pin-sug button')].every(e=>!e.hasAttribute('title'))&&document.querySelectorAll('#view .tr-wr').length>=4`));
await hover(`[data-req="syn-core-1"]`); await away();
await hover(`.trow:has([data-req="syn-core-1"]) .tr-wr`);
const tp1 = await ev(TIP);
chk('[정보 카드] 라벨에 마우스를 올리면 뜬다 · 머리 = 작성자 점·이름 + «관련 글 1편»', tp1 && tp1.h === '봄딩' && tp1.k === '관련 글 1편' && tp1.dot === 'rgb(196, 61, 99)', tp1);
chk('[정보 카드] 기존 글 제목 + 겹친 말 낱말 칩', tp1 && tp1.list.length === 1 && tp1.list[0].t === '팰월드 거점 어디에 지을까, 평지 넓은 자리 5곳' && tp1.list[0].w.join('|') === '거점', tp1 && tp1.list);
chk('[정보 카드] 끝 한마디 = 라벨 없는 작성자는 겹침 없이 발주 · 이 작성자로 보내면 겹치지 않게 쓰라는 요청', tp1 && tp1.n === '영도는 겹침 없이 발주할 수 있어요. 봄딩으로 보내면 이 글과 겹치지 않게 쓰라는 요청이 같이 나가요.', tp1 && tp1.n);
const cr1 = await tipMinCr(tp1);
chk('[정보 카드] 가독성 — 가장 작은 글자 ≥12.5px · 가장 옅은 글자 대비 ≥4.5(짙은 면 합성값) · 창 안 · 라벨에 붙어 있다', tp1 && tp1.minFs >= 12.5 && cr1 >= 4.5 && tp1.inView && tp1.near, { minFs: tp1 && tp1.minFs, cr: cr1, inView: tp1 && tp1.inView, near: tp1 && tp1.near });
await shot('01b-itip-label-1920');
await away();
chk('[정보 카드] 마우스가 떠나면 닫힌다', (await ev(TIP)) === null);
const wr2 = await ev(`(${WR})('syn-guide-2')`);
chk('같은 작성자 글 2편 = 라벨 하나 «봄딩 글 2»', wr2 && wr2.labels.length === 1 && wr2.labels[0].tx === '봄딩 글2' && wr2.labels[0].aria === '봄딩 관련 글 2편', wr2 && wr2.labels);
const wr3 = await ev(`(${WR})('syn-guide-3')`);
chk('작성자 둘이면 라벨 둘(봄딩·영도) · 점 색이 각자', wr3 && wr3.labels.map((x) => x.tx).join('|') === '봄딩 글|영도 글' && wr3.labels[1].dot === 'rgb(15, 124, 134)', wr3 && wr3.labels);
await hover(`.trow:has([data-req="syn-guide-3"]) .tr-wr:nth-of-type(2)`);
const tp3 = await ev(TIP);
chk('[정보 카드] 영도 라벨 = 영도 글만 · 겹친 말 없는 옛 항목은 제목만 · 두 작성자 다 있으면 «겹침 없이» 문구 없음', tp3 && tp3.h === '영도' && tp3.list.length === 1 && tp3.list[0].t === '뱀피르 쿠폰 입력하는 곳' && tp3.list[0].w.length === 0 && tp3.n === '영도로 보내면 이 글과 겹치지 않게 쓰라는 요청이 같이 나가요.', tp3);
await away();
chk('옛 빨간 느낌표(.tr-warn)·«이미 다룬 글» 문구가 화면에 없다', await ev(`document.querySelectorAll('.tr-warn').length===0&&!/이미 다룬 글/.test(document.querySelector('#view').textContent)`));
chk('관련 글이 없는 행엔 라벨이 없다', ((await ev(`(${WR})('syn-guide-1')`)) || {}).labels?.length === 0);
/* 칩 정보 카드 — 옛 title 문장을 «머리 + 설명 + 값 줄»로 */
await hover(`.trow:has([data-req="syn-guide-1"]) .tr-chip.aib-on`);
const tpc = await ev(TIP);
chk('[정보 카드] 브리핑 칩 = 머리·설명 + 기준 질의·출처·우리 글 줄', tpc && tpc.h === '브리핑 뜸·미인용' && tpc.k === 'AI 브리핑' && tpc.p.startsWith('AI 브리핑이 뜨는데') && tpc.rows.join('|') === '기준 질의=«메이플 스토리 세팅»|출처=5곳|우리 글=출처에 없음', tpc);
await shot('01c-itip-chip-1920');
await away();
await hover(`.trow:has([data-req="syn-guide-1"]) .tr-chip:not([class*="aib"])`);
const tpa = await ev(TIP);
chk('[정보 카드] 각도 칩 = 각도 뜻(데스크 정본)', tpa && tpa.h === '공략' && tpa.k === '데스크 각도' && tpa.p === '공략·방법·얻는 법·쿠폰을 묻는 질의', tpa);
await away();
/* 키보드 — 라벨은 버튼이라 Tab 으로 닿고, 포커스에 카드가 뜨고 Esc 로 닫힌다(옛 title 은 키보드로 못 봤다) */
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
await ev(`document.querySelector('.trow:has([data-req="syn-core-1"]) .tr-wr').focus()`); await sleep(300);
const tpk = await ev(TIP);
chk('[정보 카드] 키보드 포커스에도 뜬다 · aria-describedby 로 이어진다', tpk && tpk.h === '봄딩' && tpk.anchor === '봄딩 글', tpk);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300);
chk('[정보 카드] Esc 로 닫힌다 · 연결도 풀린다', (await ev(TIP)) === null && (await ev(`document.querySelectorAll('[aria-describedby="itip"]').length`)) === 0);
/* 칩도 키보드로 닿는다(10-25 디자인 게이트 🟡 — 처음 판은 span 이라 라벨만 됐다) */
chk('[정보 카드] 카드가 달린 칩은 전부 Tab 으로 닿는다(tabindex 0)', await ev(`(()=>{const c=[...document.querySelectorAll('#view .tr-chip[data-itip]')];return c.length>=8&&c.every(e=>e.tabIndex===0)})()`));
await ev(`document.querySelector('.trow:has([data-req="syn-guide-1"]) .tr-chip.aib-on').focus()`); await sleep(300);
chk('[정보 카드] 칩 키보드 포커스에도 뜬다', ((await ev(TIP)) || {}).h === '브리핑 뜸·미인용');
/* 스크롤 — 카드(fixed)가 제자리에 남아 아래 행 위에 걸리면 안 된다(10-25 디자인 게이트 🟡). 조금 스크롤 = 따라간다 · 기준이 화면 밖 = 닫힌다.
   ★닫기만 하면 Tab 이 화면 밖 라벨에 닿을 때 브라우저 자동 스크롤이 방금 연 카드를 닫는다 → «따라간다»를 잰다 */
await ev(`document.querySelector('.trow:has([data-req="syn-core-1"]) .tr-wr').scrollIntoView({block:'center'})`); await sleep(300);
await ev(`document.querySelector('.trow:has([data-req="syn-core-1"]) .tr-wr').focus()`); await sleep(300);
await ev(`window.scrollBy(0,120)`); await sleep(350);
const tps = await ev(TIP);
chk('[정보 카드] 조금 스크롤하면 카드가 라벨을 따라간다(떨어져 남지 않는다)', tps && tps.h === '봄딩' && tps.near, tps && { near: tps.near });
await ev(`window.scrollBy(0,4000)`); await sleep(350);
chk('[정보 카드] 라벨이 화면 밖으로 나가면 닫힌다', (await ev(TIP)) === null);
await ev(`document.activeElement.blur()`); await ev(`window.scrollTo(0,0)`); await sleep(300);
/* ★마우스로 연 카드 + 휠 — 커서가 라벨에서 벗어나면 닫혀야 한다(디자인 게이트 2차 🟡: 따라가기가 itipShow 를 불러 닫기 예약을 지워 카드가 고아로 남았다) */
await hover(`.trow:has([data-req="syn-core-1"]) .tr-wr`);
const wh = await rect(`.trow:has([data-req="syn-core-1"]) .tr-wr`);
chk('[정보 카드] (휠 시험 준비) 마우스로 연 카드', ((await ev(TIP)) || {}).h === '봄딩');
await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wh.cx, y: wh.cy, deltaX: 0, deltaY: 150, button: 'none' }); await sleep(250);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: wh.cx, y: wh.cy + 1, button: 'none' }); await sleep(500);
const wtp = await ev(TIP), stillOn = await ev(`(()=>{const a=document.querySelector('.trow:has([data-req="syn-core-1"]) .tr-wr');return a.matches(':hover')})()`);
chk('[정보 카드] 휠로 커서가 라벨을 벗어나면 카드가 닫힌다(고아 카드 없음)', !stillOn && wtp === null, { stillOn, tip: wtp && wtp.h });
await away(); await ev(`window.scrollTo(0,0)`); await sleep(300);
chk('라벨 숫자(«봄딩 글 2»의 2)도 ≥12.5px(Readable-Floor)', (await ev(`parseFloat(getComputedStyle(document.querySelector('.trow:has([data-req="syn-guide-2"]) .tr-wr b')).fontSize)`)) >= 12.5);
await shot('01-trend-1920', true);

/* 발주 모달 — 신호 줄 */
await click(`[data-req="syn-guide-1"]`);
chk('발주 모달이 열린다', !!(await waitFor(`!!document.querySelector('.brief')`, 5000)));
const bf = await ev(`[...document.querySelectorAll('.brief .bf-f')].map(f=>f.querySelector('.bf-k').textContent+'='+f.querySelector('.bf-v').textContent)`);
chk('모달에 «주제 깊이» 줄(실전형)', bf.some((x) => x === '주제 깊이=실전형 — 이미 하는 사람이 찾는 질의'), bf);
chk('모달에 «검색 수요» 줄(자동완성 · 검색량 미연동 표기)', bf.some((x) => x === '검색 수요=보통 · 자동완성 9/10 · 검색량 미연동'), bf);
chk('모달에 «AI 브리핑» 줄(뜸·출처 5곳·우리 글 미인용)', bf.some((x) => x === 'AI 브리핑=뜸 · 출처 5곳 · 우리 글 미인용'), bf);
const ta = await ev(`document.querySelector('#oMaterial').value`);
chk('소재 메모에 [검색 수요]·[AI 브리핑](기준 질의 포함)', ta.includes('[검색 수요] 보통') && ta.includes('[AI 브리핑] 뜸 · 출처 5곳 · 우리 글 미인용 («메이플 스토리 세팅» 기준)'), ta.slice(0, 400));
chk('모달 본문 가로 넘침 없음', await ev(`(()=>{const b=document.querySelector('.mdl-b');return b.scrollWidth<=b.clientWidth+1})()`));
await shot('02-modal-1920');
await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);
await click(`[data-req="syn-core-1"]`); await waitFor(`!!document.querySelector('.brief')`, 5000);
const bf2 = await ev(`[...document.querySelectorAll('.brief .bf-f')].map(f=>f.querySelector('.bf-k').textContent+'='+f.querySelector('.bf-v').textContent)`);
chk('검색량 연동 항목 = 키워드·월 검색수 표기', bf2.includes('검색 수요=낮음 · 「팰월드 거점」 월 3,200회'), bf2);
chk('출처 미열람 표기', bf2.includes('AI 브리핑=뜸 · 출처 미확인'), bf2);
/* 관련 글 줄(2026-10-11) — 옛 문구는 작성자 칩 아래 빨간 «이미 다룬 글 … 같은 각도면 발주하지 마세요»였다(1080 창에서도 모달을 내려야 보였다).
   요약 카드의 한 줄로 올렸다. ★«있다»가 아니라 «모달을 내리지 않고 보이는가»(seen)까지 잰다 */
const RELM = `(()=>{const f=document.querySelector('.brief .bf-f.bf-rel');if(!f)return null;const mb=document.querySelector('.mdl-b').getBoundingClientRect(),fb=f.getBoundingClientRect(),v=f.querySelector('.bf-v');return {k:f.querySelector('.bf-k').textContent,li:[...f.querySelectorAll('.bf-l')].map(x=>x.textContent),color:getComputedStyle(v).color,note:getComputedStyle(f.querySelector('.bf-n')).color,hint:document.querySelectorAll('.mdl .f-hint.warn,.mdl .f-hint.rel').length,inside:fb.right<=mb.right+0.5&&fb.left>=mb.left-0.5,seen:fb.top>=mb.top-0.5&&fb.bottom<=mb.bottom+0.5}})()`;
const relM = await ev(RELM);
chk('모달 요약 카드에 «관련 글» 줄 = 값 글자색(ink-2) · 경고색 힌트 없음 · 모달을 내리지 않아도 보인다', relM && relM.k === '관련 글' && relM.hint === 0 && relM.color === 'rgb(73, 79, 87)' && relM.inside && relM.seen, relM);
chk('관련 글 줄 = 기존 글 제목 + 겹친 말 · 끝에 «발주해도 돼요»(ink-3)', relM && relM.li.length === 2 && relM.li[0] === '봄딩 「팰월드 거점 어디에 지을까, 평지 넓은 자리 5곳」 · 겹친 말 거점' && relM.li[1].startsWith('발주해도 돼요') && relM.note === 'rgb(95, 102, 111)', relM && relM.li);
const taRel = await ev(`document.querySelector('#oMaterial').value`);
chk('소재 메모 = «★기존 글 확인 필요 …(겹친 말: 거점) — 겹치지 않는 각도로» · «취소» 문구 없음', taRel.includes('★기존 글 확인 필요: 봄딩 「팰월드 거점 어디에 지을까, 평지 넓은 자리 5곳」(겹친 말: 거점) — 이 글과 겹치지 않는 각도로 쓸 것') && !taRel.includes('취소'), taRel.slice(-220));
chk('관련 글 줄이 있어도 모달 본문 가로 넘침 없음', await ev(`(()=>{const b=document.querySelector('.mdl-b');return b.scrollWidth<=b.clientWidth+1})()`));
await shot('02b-modal-rel-1920');
await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);
await click(`[data-req="syn-pinned-1"]`); await waitFor(`!!document.querySelector('.brief')`, 5000);
chk('이미 인용 중이면 «봄딩 2위 인용 중»', (await ev(`document.querySelector('.brief').textContent`)).includes('봄딩 2위 인용 중'));
await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);
await click(`[data-req="syn-guide-2"]`); await waitFor(`!!document.querySelector('.brief')`, 5000);
chk('브리핑이 안 뜨면 «인용 기대 0»', (await ev(`document.querySelector('.brief').textContent`)).includes('안 뜸 — 인용 기대 0'));
await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);

/* 육아 주 1회 — 수요일 판(빈 칸) → 월요일 판으로 */
const parSec = `[...document.querySelectorAll('.tsec')].find(s=>s.querySelector('.tsec-t').textContent==='육아 제품')`;
const parTx = await ev(`(()=>{const s=${parSec};return s?s.querySelector('.tsec-empty').textContent:null})()`);
chk('육아 빈 칸 = «주 1회» + 월요일 판 버튼', typeof parTx === 'string' && parTx.includes('주 1회') && parTx.includes('9.21 판 보기'), parTx);
chk('판 보기 버튼 = 날짜 페이저와 같은 어휘(.dpbtn · 32px)', (await ev(`(()=>{const b=document.querySelector('.tsec-go');return b?Math.round(b.getBoundingClientRect().height):0})()`)) === 32);
await shot('03-parenting-weekly', false);
await click('.tsec-go');
await sleep(900);
chk('버튼을 누르면 9.21 판으로 간다', (await ev(`document.querySelector('#dpsel').value`)) === '2026-09-21');
chk('월요일 판엔 육아 행이 있다', (await ev(`(()=>{const s=${parSec};return s?s.querySelectorAll('.trow').length:0})()`)) === 2);
/* ★육아 칸 = 봄딩 쿠팡 제휴 전용 — 카드가 «영도는 겹침 없이 발주할 수 있어요»를 권하면 안 된다(10-25 디자인 게이트 🟡 · 실데이터 10-19 «아기 가습기») */
await hover(`.trow:has([data-req="syn-parenting-1"]) .tr-wr`);
const tpp = await ev(TIP);
chk('[정보 카드] 육아 칸 라벨은 다른 작성자에게 발주를 권하지 않는다', tpp && tpp.h === '봄딩' && tpp.n === '봄딩으로 보내면 이 글과 겹치지 않게 쓰라는 요청이 같이 나가요.', tpp && tpp.n);
await away();
/* 옛 판(시행 전) 빈 칸은 종전 문구 */
await ev(`(()=>{const s=document.querySelector('#dpsel');s.value='2026-09-18';s.dispatchEvent(new Event('change'))})()`);
await waitFor(`document.querySelector('#dpsel')&&document.querySelector('#dpsel').value==='2026-09-18'&&!!document.querySelector('.tsec')`, 9000);
await sleep(700);
chk('시행 전 판의 육아 빈 칸은 종전 문구', (await ev(`(()=>{const s=${parSec};return s?s.querySelector('.tsec-empty').textContent:''})()`)) === '오늘은 이 분류에서 건질 주제가 없었어요.');
await click(`[data-req="syn-new-7"]`); await waitFor(`!!document.querySelector('.brief')`, 5000);
const oldTx = await ev(`document.querySelector('.brief').textContent+'|'+document.querySelector('#oMaterial').value`);
chk('신호 없는 옛 항목엔 «검색 수요»·«AI 브리핑» 줄이 없다', !/검색 수요|AI 브리핑/.test(oldTx), oldTx.slice(0, 200));
await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);
chk('[1920 트렌드] 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth`));
chk('[1920 트렌드] 콘솔 예외 0', logs.length === 0, logs);

/* ═════ 1920 — 홈 「주제 비중」 ═════ */
logs = [];
chk('홈에 「주제 비중」 타일', !!(await goHome()));
const rows = await ev(`[...document.querySelectorAll('#tileMix .mx-row')].map(r=>r.querySelector('.mx-t').textContent+'|'+(r.querySelector('.mx-na')?r.querySelector('.mx-na').textContent:r.querySelector('.mx-v').textContent))`);
chk('막대 3줄(추천·발주·작성 글)', rows.length === 3 && rows[0].startsWith('트렌드 추천|') && rows[1].startsWith('발주|') && rows[2].startsWith('작성 글|'), rows);
chk('발주를 못 읽으면 «미연결»(0% 막대 위장 금지)', rows[1] === '발주|미연결' && (await ev(`!document.querySelectorAll('#tileMix .mx-row')[1].querySelector('.mx-bar')`)), rows[1]);
chk('오른쪽 글자 = 공략·티어 % · 소식 %', rows[0] === '트렌드 추천|공략·티어 55%소식 10%', rows[0]);
const ratio = await ev(`(()=>{const r=document.querySelectorAll('#tileMix .mx-row')[0];const b=r.querySelector('.mx-bar').getBoundingClientRect(),g=r.querySelector('.mx-seg.g').getBoundingClientRect();return {bw:b.width,gw:g.width,r:g.width/b.width}})()`);
chk('★그려진 픽셀: 잉크 칸 폭 = 55% (±1px)', Math.abs(ratio.gw - (ratio.bw * 0.55 - 1)) <= 1, ratio);
const tick = await ev(`(()=>{const b=document.querySelectorAll('#tileMix .mx-bar')[0];const s=getComputedStyle(b,'::after');return {left:parseFloat(s.left),w:b.getBoundingClientRect().width,bg:s.backgroundColor,top:s.top}})()`);
chk('목표 눈금이 50% 에 있고 막대 밖으로 5px 나온다', Math.abs(tick.left - (tick.w / 2 - 1)) <= 0.6 && tick.top === '-5px', tick);
const segGap = await ev(`(()=>{const r=document.querySelectorAll('#tileMix .mx-row')[0];const g=r.querySelector('.mx-seg.g').getBoundingClientRect(),x=r.querySelector('.mx-seg.r').getBoundingClientRect();return Math.round((x.left-g.right)*10)/10})()`);
chk('세그먼트 사이 2px 표면 틈', segGap === 2, segGap);
const radius = await ev(`(()=>{const r=document.querySelectorAll('#tileMix .mx-row')[0];return [getComputedStyle(r.querySelector('.mx-seg.g')).borderTopLeftRadius,getComputedStyle(r.querySelector('.mx-seg.r')).borderTopRightRadius]})()`);
chk('시작(기준선)은 각지고 끝만 4px 둥글다', radius[0] === '0px' && radius[1] === '4px', radius);
const segCr = await ev(`(${CONTRAST})(getComputedStyle(document.querySelector('#tileMix .mx-seg.g')).backgroundColor,getComputedStyle(document.querySelector('#tileMix .mx-seg.r')).backgroundColor)`);
chk('잉크 칸 ↔ 회색 칸 대비 ≥3(비텍스트)', segCr >= 3, segCr);
chk('범례 3개(공략·티어 · 소식·기타 · 목표 50%)', (await ev(`[...document.querySelectorAll('#tileMix .legend span')].map(s=>s.textContent).join('|')`)) === '공략·티어|소식·기타|목표 50%');
chk('표 뷰(sr) 3행 + 머리', (await ev(`document.querySelectorAll('#tileMix table.sr tr').length`)) === 4);
chk('재검 줄(7일 뒤 9질의 · 브리핑 5 · 인용 1)', (await ev(`(()=>{const f=document.querySelector('#tileMix .mx-foot');return f?f.textContent:''})()`)) === '발행 후 재검 · 7일 뒤 9질의 중 브리핑 5 · 우리 인용 1');
/* ★깊이 줄(2026-09-21) — «하는 법»도 공략으로 세는 각도 지표만으로는 기초 쏠림이 안 보인다 */
const depFoot = await ev(`(()=>{const f=[...document.querySelectorAll('#tileMix .mx-foot')].map(x=>x.textContent);return f.find(x=>x.indexOf('진입형')>=0)||''})()`);
chk('진입형 비중 줄(추천 15% · 작성 글 8.3%)', depFoot === '진입형(설치·가입·하는 법) 비중 · 트렌드 추천 15% / 작성 글 8.3%', depFoot);
await hover('#tileMix .mx-row .hit');
const tip = await ev(`(()=>{const t=document.querySelector('.ctip.on');return t?[...t.querySelectorAll('.ctip-r')].map(r=>r.textContent).join('|')+'#'+t.querySelector('.ctip-h').textContent:null})()`);
chk('hover 툴팁 = 네 갈래 + 추정 건수', tip === '공략40%|티어·추천15%|소식10%|기타35%|제목으로 추정4건#트렌드 추천 · 최근 7판20건', tip);
chk('hover 한 행에 배경', await ev(`document.querySelectorAll('#tileMix .mx-row.on').length===1`));
await sleep(350);   /* 행 배경 전환(--t-fast)이 끝난 뒤 잰다 */
const capCr = await ev(`(()=>{const r=document.querySelector('#tileMix .mx-row.on');return (${CONTRAST})(getComputedStyle(r.querySelector('.mx-s')).color,getComputedStyle(r).backgroundColor)})()`);
chk('hover 행 위 캡션 대비 ≥ 4.5 (09-19 🟡: ink-4×surface-2 = 4.47 재발)', capCr >= 4.5, capCr);
/* 툴팁 바탕(잉크) 위 견본 — 공략·티어는 흰색, 소식·기타는 옅은 흰색이라 바탕과 구분돼야 한다 */
const sw = await ev(`[...document.querySelectorAll('.ctip.on .ctip-r i')].map(i=>getComputedStyle(i).backgroundColor)`);
chk('툴팁 견본이 짙은 바탕에서 보인다(진함·옅음 두 단)', Array.isArray(sw) && sw[0] === 'rgb(255, 255, 255)' && sw[2] !== sw[0] && sw[2] !== 'rgba(0, 0, 0, 0)', sw);
chk('모든 타일이 보인다(투명 0)', await ev(`(()=>{window.scrollTo(0,document.documentElement.scrollHeight);return true})()`) && (await waitFor(`getComputedStyle(document.querySelector('#tileMix')).opacity==='1'`, 4000)) === true);
await ev(`window.scrollTo(0,0)`); await sleep(300);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2, button: 'none' }); await sleep(250);
/* ★:focus-visible 은 «마지막 입력이 키보드»일 때만 켜진다 — 마우스로 hover 한 직후 script focus() 는 링을 안 켠다(1차 실행 오탐).
   그래서 실제 키 입력(Shift)으로 입력 방식을 키보드로 바꾼 뒤 포커스를 옮긴다 */
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
await ev(`document.querySelector('#tileMix .mx-row .hit').focus()`); await sleep(250);
chk('키보드 포커스에도 같은 툴팁', await ev(`!!document.querySelector('.ctip.on')`));
const ring = await ev(`(()=>{const a=document.activeElement;const s=getComputedStyle(a);return {fv:a.matches(':focus-visible'),w:s.outlineWidth,st:s.outlineStyle,c:s.outlineColor}})()`);
chk('포커스 링이 보인다(2px 잉크)', ring && ring.fv && ring.w === '2px' && ring.st === 'solid' && ring.c === 'rgb(14, 17, 20)', ring);
await ev(`document.activeElement.blur()`);

/* ═════ 1920 — 홈 「블로그 활동」 방문자 막대 (2026-10-12) ═════
   인용이 비공개인 작성자(영도)는 막대 자리에 일별 방문자를 그린다. ★«있다»가 아니라 그려진 막대의 수·높이 비·색을 잰다 —
   값 없는 날을 0 으로 그리거나(0 위장) 봄딩 칸까지 방문자로 바꾸거나 두 칸 차트가 어긋나면 여기서 걸린다.
   칸 번호: 차트는 «14일 전 ~ 어제» 14칸 → n일 전 = 14−n 번째(0 부터). 어제 13 · 2일 전 12 · 4일 전 10 · 5일 전 9 */
await ev(`document.querySelector('#tileCite').scrollIntoView({block:'center'})`); await sleep(2600);   /* 등장 + 막대 성장 모션이 끝난 뒤에 잰다 */
const CR = `(i)=>{const cr=document.querySelectorAll('#tileCite .cr')[i],svg=cr.querySelector('svg'),sb=svg.getBoundingClientRect(),cols=[...svg.querySelectorAll('g.col')];
  return {bars:cols.map(g=>{const r=g.querySelector('rect:not(.hit)');return r?Math.round(r.getBoundingClientRect().height*10)/10:null}),
    fill:[...new Set([...svg.querySelectorAll('g.col rect:not(.hit)')].map(r=>getComputedStyle(r).fill))],dot:getComputedStyle(cr.querySelector('.cr-dot')).backgroundColor,
    units:[...svg.querySelectorAll('text.axis.unit')].map(t=>t.textContent),tips:cols.map(g=>g.querySelector('.hit').getAttribute('data-tip')),
    legend:[...cr.querySelectorAll('.legend span')].map(s=>s.textContent),
    stats:[...cr.querySelector('.ks-stats').children].map(s=>s.querySelector('.ks-k').textContent+'='+s.querySelector('.ks-v').textContent),
    th:[...cr.querySelectorAll('table.sr th')].map(t=>t.textContent),line:svg.querySelectorAll('path.ln').length,
    w:Math.round(sb.width*10)/10,top:Math.round(sb.top*10)/10,
    noteBelow:(()=>{const n=cr.querySelector('.cr-state'),l=cr.querySelector('.legend');return n&&l?n.getBoundingClientRect().top>=l.getBoundingClientRect().bottom-0.5:null})()}}`;
/* 사이트가 그 칸을 못 그리면(예외) ev 가 {__err} 를 돌려준다 — 그때는 null 로 받아 아래 검사들이 «FAIL» 로 남게 한다(게이트가 죽지 않게) */
const V = (x) => (x && !x.__err) ? x : null;
const cb = V(await ev(`(${CR})(0)`)), cy = V(await ev(`(${CR})(1)`));
const D1 = md(dayAgo(1)), D4 = md(dayAgo(4)), D5 = md(dayAgo(5));
chk('[블로그 활동] 영도 칸 막대 = 값이 있는 날만 12개 · 값 없는 날·0명인 날엔 막대 없음(0 위장 금지)', cy && Array.isArray(cy.bars) && cy.bars.filter((h) => h != null).length === 12 && cy.bars[9] == null && cy.bars[10] == null, cy && cy.bars);
chk('[블로그 활동] ★그려진 픽셀: 막대 높이 비 = 방문자 비(2,500 ÷ 5,000 = 0.5 ±0.02)', cy && cy.bars[13] > 20 && Math.abs(cy.bars[12] / cy.bars[13] - 0.5) <= 0.02, cy && [cy.bars[12], cy.bars[13]]);
chk('[블로그 활동] 막대 색 = 그 칸 작성자 색 하나(영도 ≠ 봄딩)', cy && cb && cy.fill.length === 1 && cy.fill[0] === cy.dot && cb.fill.length === 1 && cb.fill[0] === cb.dot && cy.fill[0] !== cb.fill[0], { y: cy && cy.fill, b: cb && cb.fill });
chk('[블로그 활동] 축 머리 단위 = 방문자·편 (봄딩 칸은 인용·편 그대로)', cy && cb && cy.units.join('|') === '방문자|편' && cb.units.join('|') === '인용|편', { y: cy && cy.units, b: cb && cb.units });
chk('[블로그 활동] 범례 = 방문자 14일 합 + 글 (봄딩 = 인용 + 글)', cy && cb && cy.legend.length === 2 && cy.legend[0] === '방문자3.8만' && cy.legend[1].startsWith('글') && cb.legend[0] === '인용56만', { y: cy && cy.legend, b: cb && cb.legend });
const expStats = citeExpect();
chk('[블로그 활동] 방문자 스탯 4칸(마지막 날 · 이번 달 · 지난달 · 누적) — 달 합 = 일별 합, 빈 날이 있으면 «*»', cy && cb && JSON.stringify(cy.stats) === JSON.stringify(expStats) && cb.stats[3] === '누적 인용=480만', { got: cy && cy.stats, exp: expStats, bomding: cb && cb.stats });
chk('[블로그 활동] 툴팁 = «날짜 | N명» + 글 · 달력일 값엔 스냅샷 줄 없음 · 0명 «0명» · 값 없는 날 «집계 전»', cy && cy.tips[13] === D1 + '|5,000명||글|1편' && cy.tips[10] === D4 + '|0명||글|1편' && cy.tips[9] === D5 + '|집계 전||글|2편', cy && [cy.tips[13], cy.tips[10], cy.tips[9]]);
chk('[블로그 활동] 봄딩 칸 툴팁은 그대로(인용 증분 · 누적 · 스냅샷)', cb && /^\d+\.\d+\|\+4만\|\|글\|3편;누적\|[\d.]+만;스냅샷\|\d\d:\d\d$/.test(cb.tips[13]), cb && cb.tips[13]);
/* ★여기선 hover() 를 쓰지 않는다 — 그 안의 scrollIntoView(center) 가 타일 코어(.core · overflow:hidden · 안에 sr 표가 있다)를 밀어
   타일 머리가 사라진 채 스크린샷이 찍힌다(10-12 디자인 게이트가 짚은 하네스 함정). 타일은 이미 화면 가운데라 좌표만 구해 옮긴다 */
const hr = await rect('#tileCite .cr:nth-child(2) svg g.col:nth-of-type(14) .hit');
if (hr) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hr.cx, y: hr.cy, button: 'none' }); await sleep(300); }
const vtip = await ev(`(()=>{const t=document.querySelector('.ctip.on');return t?t.querySelector('.ctip-h').textContent+'#'+[...t.querySelectorAll('.ctip-r')].map(r=>r.textContent).join('|'):null})()`);
chk('[블로그 활동] hover 툴팁(영도 어제 칸) = 날짜·방문자 + 글 한 줄', vtip === D1 + '5,000명#글1편', vtip);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2, button: 'none' }); await sleep(250);
chk('[블로그 활동] 표 뷰 머리 = 날짜·방문자·글 (봄딩 = 날짜·인용 증분·누적 인용·글)', cy && cb && cy.th.join('|') === '날짜|방문자|글' && cb.th.join('|') === '날짜|인용 증분|누적 인용|글', { y: cy && cy.th, b: cb && cb.th });
chk('[블로그 활동] 글 선은 두 칸 모두 그대로(막대 위 꺾은선 1개)', cy && cb && cy.line === 1 && cb.line === 1, { y: cy && cy.line, b: cb && cb.line });
chk('[블로그 활동] 두 칸 차트의 폭·위 좌표가 같다(나란한 축이 어긋나지 않는다)', cy && cb && Math.abs(cb.w - cy.w) <= 0.5 && Math.abs(cb.top - cy.top) <= 0.5, { b: cb && [cb.w, cb.top], y: cy && [cy.w, cy.top] });
chk('[블로그 활동] «인용수 비공개» 줄은 범례 아래(차트를 밀어내지 않는다) · 인용 공개 칸엔 없다', cy && cb && cy.noteBelow === true && cb.noteBelow === null, { y: cy && cy.noteBelow, b: cb && cb.noteBelow });
/* x축 날짜 라벨 — 이웃 라벨 사이 틈(그려진 픽셀). ★10-12 디자인 게이트 🟡: «칸 폭 30 미만이면 하루 걸러»는 4자 라벨 기준이라
   10~12월의 5자 라벨(«10.10»·«10.11»)이 1920 에서 1.7px · 600 에서 0.2px · 360 에서 1.1px 로 붙었다(사용량·블로그 활동 공용 결함).
   운영 날짜로 그리므로 1~9월 실행엔 느슨한 검사다 — 그래도 주기 공식이 깨지면 여기서 걸린다 */
const XGAP = `(()=>{const g=svg=>{const xs=[...svg.querySelectorAll('text.axis')].filter(t=>t.getAttribute('text-anchor')==='middle').map(t=>t.getBoundingClientRect()).sort((a,b)=>a.left-b.left);let m=999;for(let i=1;i<xs.length;i++)m=Math.min(m,xs[i].left-xs[i-1].right);return {n:xs.length,min:Math.round(m*10)/10}};return [...document.querySelectorAll('#tileCite .cr svg, #tileUsage .chart svg')].map(g)})()`;
const xgOk = (a) => Array.isArray(a) && a.length >= 2 && a.every((x) => x.n >= 2 && x.min >= 3);
const coreTop = await ev(`(()=>{const c=document.querySelector('#tileCite .core'),h=document.querySelector('#tileCite .tile-h').getBoundingClientRect(),b=c.getBoundingClientRect();return {st:c.scrollTop,head:Math.round(h.top-b.top)}})()`);
chk('[블로그 활동] 타일 머리가 제자리(코어가 밀리지 않았다 — 밀리면 스크린샷에서 머리가 사라진다)', coreTop && coreTop.st === 0 && coreTop.head >= 0 && coreTop.head <= 2, coreTop);
const xg1920 = await ev(XGAP);
chk('[1920] 차트 x축 날짜 라벨이 붙지 않는다(이웃 틈 ≥ 3px · 블로그 활동 두 칸 + 사용량)', xgOk(xg1920), xg1920);
await ev(`window.scrollTo(0,0)`); await sleep(300);
await shot('04-home-1920', true);
chk('[1920 홈] 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth`));
chk('[1920 홈] 콘솔 예외 0', logs.length === 0, logs);

/* 두 번째 데이터 — 발주 0건(«건 없음»)·100% 막대·재검 없음 */
MIX = MIX_B; CITE_VIS = false;   /* 영도 방문자 전무(카운터를 닫았거나 수집 실패) */
await open(1920, 1080, false); logs = [];
await goHome();
const cyB = V(await ev(`(${CR})(1)`));
chk('[블로그 활동 B] 방문자가 없으면 막대 없이 글 선 하나(예전 모양 · 빈 막대·0 위장 금지)', cyB && cyB.bars.every((h) => h == null) && cyB.line === 1 && cyB.units.join('|') === '편' && cyB.legend.length === 1 && cyB.legend[0].startsWith('글') && cyB.th.join('|') === '날짜|글' && cyB.stats[0].startsWith('어제 글=') && cyB.noteBelow === true, cyB);
CITE_VIS = true;
const rowsB = await ev(`[...document.querySelectorAll('#tileMix .mx-row')].map(r=>r.querySelector('.mx-t').textContent+'|'+(r.querySelector('.mx-na')?r.querySelector('.mx-na').textContent:'bar'))`);
chk('발주 0건이면 «건 없음»', rowsB[1] === '발주|건 없음', rowsB);
chk('100% 이면 회색 칸 없이 잉크 칸 하나 · 끝만 둥글다', await ev(`(()=>{const r=document.querySelectorAll('#tileMix .mx-row')[2];return r.querySelectorAll('.mx-seg').length===1&&!!r.querySelector('.mx-seg.g')&&getComputedStyle(r.querySelector('.mx-seg.g')).borderTopRightRadius==='4px'})()`));
chk('재검 데이터가 없으면 그 줄 자체가 없다(깊이 줄은 별개)', await ev(`[...document.querySelectorAll('#tileMix .mx-foot')].every(f=>f.textContent.indexOf('발행 후 재검')<0)`));
chk('[1920 홈 B] 콘솔 예외 0', logs.length === 0, logs);
MIX = MIX_A;

/* ═════ 실제 창 — 발주 모달 «관련 글» 줄(10-11 디자인 게이트 🟡) ═════
   1920×1080 만 재면 작은 창을 놓친다 — 주제 칸 자동 포커스가 모달 본문을 끌어내려 요약 카드가 위로 밀려났다(1366×630 에서 4건 중 1건만 보였다).
   작업표시줄·탭·주소창을 뺀 «실제 창» 세 가지에서, 열자마자(0.6초 뒤) 줄 전체가 보이고 본문이 내려가 있지 않은지 잰다 */
for (const [w, h] of [[1920, 940], [1536, 730], [1366, 630]]) {
  await open(w, h, false); logs = [];
  await goTrend();
  await click(`[data-req="syn-guide-3"]`); await waitFor(`!!document.querySelector('.brief')`, 5000); await sleep(600);
  const rs = await ev(RELM);
  const st = await ev(`document.querySelector('.mdl-b').scrollTop`);
  chk(`[${w}×${h}] 발주 모달을 열자마자 «관련 글» 줄(2건+한마디)이 다 보인다 · 본문이 내려가 있지 않다`, rs && rs.seen && rs.li.length === 3 && st === 0, { seen: rs && rs.seen, li: rs && rs.li.length, scrollTop: st });
  chk(`[${w}×${h}] 주제 칸 포커스는 그대로 간다 · 콘솔 예외 0`, (await ev(`!!document.activeElement&&document.activeElement.id==='oTopic'`)) && logs.length === 0, logs);
  await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);
}

/* ═════ 390 — 모바일 ═════ */
await open(390, 844, true); logs = [];
await goHome();
const mob = await ev(`(()=>{const r=document.querySelectorAll('#tileMix .mx-row')[0];const l=r.querySelector('.mx-l').getBoundingClientRect(),b=r.querySelector('.mx-bar').getBoundingClientRect(),v=r.querySelector('.mx-v').getBoundingClientRect(),w=r.getBoundingClientRect();return {barBelow:b.top>=l.bottom-1,barFull:b.width>=w.width-20,vRight:v.right<=w.right+0.5,vTop:Math.abs(v.top-l.top)<14}})()`);
chk('[390] 이름·숫자 한 줄, 막대는 아래 전폭', mob.barBelow && mob.barFull && mob.vRight && mob.vTop, mob);
chk('[390 홈] 가로 넘침 없음', await ev(`innerWidth===390&&document.documentElement.scrollWidth<=390`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
/* ★09-22 디자인 게이트 🟡 — 타일 바닥 줄이 모바일에서 «8.3%» 만 홀로 다음 줄로 떨어졌다.
   textContent 비교로는 안 잡힌다(줄바꿈은 글자에 안 남는다) → 값 묶음(.nw)이 쪼개졌는지 Range 로 잰다. */
/* ★글꼴이 섞인 줄(굵은 숫자 = 모노스페이스)은 같은 줄이어도 rect top 이 1~2px 어긋난다 — 줄 수는 «top 최대-최소»로 본다. */
const nwSplit = await ev(`[...document.querySelectorAll('#tileMix .mx-foot .nw')].map(s=>{const r=document.createRange();r.selectNodeContents(s);const t=[...r.getClientRects()].map(x=>x.top);return t.length?Math.max(...t)-Math.min(...t):0}).filter(d=>d>6).length`);
chk('[390] 타일 바닥 값 묶음이 쪼개지지 않는다(숫자 고아줄 없음)', nwSplit === 0, nwSplit);
/* 「블로그 활동」 — 좁은 폭에선 한 열로 쌓인다: 첫 칸의 오른쪽 여백(두 열일 때 폭 맞춤용)이 남아 있으면 첫 차트만 좁아진다 */
const citeMob = await ev(`(()=>{const over=[...document.querySelectorAll('#tileCite .ks-stats > span')].filter(s=>{const rg=document.createRange();rg.selectNodeContents(s.querySelector('.ks-v'));return rg.getBoundingClientRect().width>s.getBoundingClientRect().width+0.5}).map(s=>s.textContent);return {over,svgs:[...document.querySelectorAll('#tileCite .cr svg')].map(s=>Math.round(s.getBoundingClientRect().width)),crs:[...document.querySelectorAll('#tileCite .cr')].map(c=>Math.round(c.getBoundingClientRect().width))}})()`);
chk('[390] 블로그 활동 — 스탯 값이 칸을 넘지 않고 두 차트가 제 칸 폭을 채운다', citeMob && citeMob.over.length === 0 && citeMob.svgs.length === 2 && citeMob.svgs.every((w, i) => Math.abs(w - citeMob.crs[i]) <= 1) && citeMob.svgs[0] === citeMob.svgs[1], citeMob);
const xg390 = await ev(XGAP);
chk('[390] 차트 x축 날짜 라벨이 붙지 않는다(이웃 틈 ≥ 3px)', xgOk(xg390), xg390);
/* 부제 — 긴 문구(«인용·방문자 막대 · 글 선 · 14일» 140px)는 390 에서 잘려 «선 · 14일» 이 사라졌다(10-12 디자인 게이트 🟡) → ≤520px 은 짧은 문구 */
const sub390 = await ev(`(()=>{const e=document.querySelector('#tileCite .tile-d');return {cut:e.scrollWidth>e.clientWidth+0.5,t:[...e.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.textContent).join('/')}})()`);
chk('[390] 블로그 활동 부제가 잘리지 않는다(좁은 폭 문구 한 벌만 보인다)', sub390 && !sub390.__err && !sub390.cut && sub390.t === '인용·방문자·글 · 14일', sub390);
await shot('05-home-390', true);
await goTrend();
chk('[390] 공략 칸 행이 3개', (await ev(`(()=>{const s=${gsec};return s?s.querySelectorAll('.trow').length:0})()`)) === 3);
/* ★좁은 폭에선 표식을 주제 아랫줄로 내린다 — 같은 줄에 두면 주제 글자가 5자쯤 더 잘린다. «있다»가 아니라 자리(아랫줄·행 안·버튼과 안 겹침)와 주제 폭을 잰다 */
const relMob = await ev(`(${WR})('syn-guide-3')`);
const noRelMob = await ev(`(()=>{const b=document.querySelector('[data-req="syn-guide-1"]');const h=b.closest('.trow').querySelector('.tr-h').getBoundingClientRect();return Math.round(h.width)})()`);
chk('[390] 작성자 라벨 둘 = 주제 아랫줄 · 행 안 · 발주 버튼과 안 겹침', relMob && relMob.labels.length === 2 && relMob.labels.every((x) => x.below && x.inRow && x.clearOfCta), relMob);
chk('[390] 라벨이 붙어도 주제 폭이 줄지 않는다(라벨 없는 행과 같은 폭)', relMob && Math.abs(relMob.hw - noRelMob) <= 1, { withRel: relMob && relMob.hw, without: noRelMob });
/* 손가락 탭 — 터치엔 hover 가 없다. 탭하면 열리고, 다시 탭하거나 다른 곳을 탭하면 닫힌다. 카드는 좁은 창 안(좌우 12px)에 든다 */
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
const touch = async (sel) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center'});return true})()`); await sleep(200); const r = await rect(sel); if (!r) return false;
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.cx, y: r.cy }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(400); return true; };
await touch(`.trow:has([data-req="syn-guide-3"]) .tr-wr`);
const tpm = await ev(TIP);
chk('[390] 라벨을 탭하면 정보 카드가 뜬다 · 창 안(좌우 12px) · 라벨에 붙어 있다', tpm && tpm.h === '봄딩' && tpm.inView && tpm.w <= 390 - 24 && tpm.near, tpm);
await shot('06b-itip-390');
await touch(`.trow:has([data-req="syn-guide-3"]) .tr-wr`);
chk('[390] 같은 라벨을 다시 탭하면 닫힌다', (await ev(TIP)) === null);
await touch(`.trow:has([data-req="syn-guide-1"]) .tr-chip.aib-on`);
chk('[390] 칩도 탭으로 뜬다', ((await ev(TIP)) || {}).h === '브리핑 뜸·미인용');
await touch(`.trow:has([data-req="syn-guide-1"]) .tr-g`);
chk('[390] 다른 곳을 탭하면 닫힌다', (await ev(TIP)) === null);
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
const parMob = await ev(`(()=>{const b=document.querySelector('.tsec-go');if(!b)return null;const r=b.getBoundingClientRect(),c=b.closest('.core').getBoundingClientRect();return {inside:r.right<=c.right+0.5&&r.left>=c.left-0.5,h:Math.round(r.height)}})()`);
chk('[390] 판 보기 버튼이 칸 안에 들어간다', parMob && parMob.inside, parMob);
/* ★칸 머리 줄바꿈 — flex 자식은 blockify 돼 getClientRects 가 늘 1 이다. 글자 Range 의 줄 top 개수로 센다(09-19 게이트 발견) */
const HDR = `(()=>{const lines=el=>{const rg=document.createRange();rg.selectNodeContents(el);return new Set([...rg.getClientRects()].map(r=>Math.round(r.top))).size};return [...document.querySelectorAll('.tsec-h')].map(h=>{const t=h.querySelector('.tsec-t'),d=h.querySelector('.tsec-d');return {k:t?t.textContent:'',h:Math.round(h.getBoundingClientRect().height),t:t?lines(t):0,d:d?lines(d):0,cut:d?d.scrollWidth>d.clientWidth+1:false}})})()`;
const hdr390 = await ev(HDR);
chk('[390] 칸 머리 전부 한 줄 · 높이 같음(09-19 🟡: «공/략» 고아 줄바꿈)', hdr390.length >= 6 && hdr390.every((x) => x.t === 1 && x.d <= 1) && new Set(hdr390.map((x) => x.h)).size === 1, hdr390);
chk('[390] 공략 칸 설명이 잘리지 않는다', (hdr390.find((x) => x.k === '지금 검색되는 공략') || {}).cut === false, hdr390.find((x) => x.k === '지금 검색되는 공략'));
await shot('06-trend-390', true);
await click(`[data-req="syn-guide-1"]`); await waitFor(`!!document.querySelector('.brief')`, 5000);
const mm = await ev(`(()=>{const f=[...document.querySelectorAll('.brief .bf-f')].find(x=>x.querySelector('.bf-k').textContent==='검색 수요');if(!f)return null;const v=f.querySelector('.bf-v').getBoundingClientRect(),b=document.querySelector('.brief').getBoundingClientRect();return {inside:v.right<=b.right+0.5,oneCol:getComputedStyle(f).gridTemplateColumns.split(' ').length===1}})()`);
chk('[390] 모달 신호 줄이 한 열로 접히고 넘치지 않는다', mm && mm.inside && mm.oneCol, mm);
await ev(`document.querySelector('.mdl [data-close]').click()`); await sleep(450);
await click(`[data-req="syn-guide-3"]`); await waitFor(`!!document.querySelector('.brief')`, 5000);
const relMm = await ev(RELM);
chk('[390] 모달 «관련 글» 줄 2건 + 한마디 · 카드 안 · 겹친 말 없는 항목은 제목만', relMm && relMm.li.length === 3 && relMm.inside && relMm.li[1] === '영도 「뱀피르 쿠폰 입력하는 곳」' && relMm.li[0].endsWith('· 겹친 말 쿠폰'), relMm);
await shot('07-modal-390');
chk('[390 모달] 가로 넘침 없음', await ev(`innerWidth===390&&document.documentElement.scrollWidth<=390`));
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

/* ═════ 360 — 좁은 안드로이드(09-19 추가 · 설명 말줄임은 허용, 줄바꿈·넘침은 불허) ═════ */
await open(360, 780, true); logs = [];
await goTrend();
const hdr360 = await ev(HDR);
chk('[360] 칸 머리 전부 한 줄 · 높이 같음', hdr360.length >= 6 && hdr360.every((x) => x.t === 1 && x.d <= 1) && new Set(hdr360.map((x) => x.h)).size === 1, hdr360);
chk('[360 트렌드] 가로 넘침 없음', await ev(`innerWidth===360&&document.documentElement.scrollWidth<=360`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
await shot('08-trend-360', true);
await goHome();
chk('[360 홈] 가로 넘침 없음', await ev(`innerWidth===360&&document.documentElement.scrollWidth<=360`));
const xg360 = await ev(XGAP);
chk('[360] 차트 x축 날짜 라벨이 붙지 않는다(이웃 틈 ≥ 3px)', xgOk(xg360), xg360);
chk('[360] 콘솔 예외 0', logs.length === 0, logs);

/* CSS 구조 — 주석·중괄호(09-14 사고: 닫지 않은 주석 하나가 모바일 규칙 전체를 죽였다) */
const CSSSRC = readFileSync(INDEX, 'utf8');
const CSSBODY = CSSSRC.slice(CSSSRC.indexOf('<style'), CSSSRC.indexOf('</style>'));
chk('CSS 주석이 전부 닫혀 있다', (CSSBODY.match(/\/\*/g) || []).length === (CSSBODY.match(/\*\//g) || []).length);
chk('CSS 중괄호가 맞는다', (CSSBODY.match(/\{/g) || []).length === (CSSBODY.match(/\}/g) || []).length);

/* 아이콘 사전 — 쓰는 이름이 전부 I{} 에 있는가(10-11 디자인 게이트 🔴).
   index.html 에서 안 쓰게 된 alertTri 를 지웠더니 도구함 제목 검사기(_toolbox/title.js)의 «bad» 신호 아이콘이 빈 svg 가 됐다.
   svg() 는 없는 이름에 빈 그림을 돌려줘서 에러 0·콘솔 0 — 그 화면을 열어야만 보였다. 그래서 «쓰는 이름»을 정적으로 모아 사전과 대조한다:
   index.html 의 svg('이름')·icon:'이름' + 지연 로드 스크립트(_toolbox·_cal)의 api.svg('이름')·icon:'이름'·«var icon = 조건?'이름':…» */
const ICON_KEYS = new Set([...CSSSRC.slice(CSSSRC.indexOf('var I={'), CSSSRC.indexOf('function svg(')).matchAll(/^ {2}([A-Za-z]\w*):'/gm)].map((m) => m[1]));
const LAZY = ['_toolbox', '_cal'].flatMap((d) => existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f) : []);
const iconUses = new Map();
const scanIcons = (file, txt, callRe) => {
  for (const m of txt.matchAll(callRe)) iconUses.set(m[1], file);
  for (const m of txt.matchAll(/\bicon\s*:\s*'([A-Za-z]\w*)'/g)) iconUses.set(m[1], file);
  for (const line of txt.split(/\r?\n/)) if (/\bvar icon\s*=/.test(line)) for (const m of line.matchAll(/[?:]\s*'([A-Za-z]\w*)'/g)) iconUses.set(m[1], file);
};
scanIcons('index.html', CSSSRC, /\bsvg\(\s*'([A-Za-z]\w*)'/g);
for (const f of LAZY) scanIcons(f, readFileSync(join(ROOT, f), 'utf8'), /\bapi\.svg\(\s*'([A-Za-z]\w*)'/g);
const missingIcons = [...iconUses].filter(([n]) => !ICON_KEYS.has(n));
chk('쓰는 아이콘 이름이 전부 아이콘 사전(I{})에 있다(index.html + _toolbox·_cal ' + LAZY.length + '파일 · 이름 ' + iconUses.size + '개)', ICON_KEYS.size > 20 && iconUses.size > 10 && missingIcons.length === 0, { missing: missingIcons, keys: ICON_KEYS.size });
chk('★도구함 제목 검사기의 신호 아이콘 넷(alertTri·alert·check·info)이 사전에 있다', ['alertTri', 'alert', 'check', 'info'].every((n) => ICON_KEYS.has(n) && iconUses.has(n)), ['alertTri', 'alert', 'check', 'info'].map((n) => n + ':' + ICON_KEYS.has(n) + '/' + iconUses.has(n)));

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''} · 스크린샷 ${OUT}`);
try { ws.close(); } catch { }
chrome.kill(); srv.close(); api.close();
process.exit(fail ? 1 : 0);
