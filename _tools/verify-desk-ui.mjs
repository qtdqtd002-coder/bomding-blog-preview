// verify-desk-ui.mjs — 트렌드 탭 「지금 검색되는 공략」·발주 모달 신호·육아 주 1회 + 홈 「주제 비중」 헤드리스 검증 (2026-09-18)
//   node _tools/verify-desk-ui.mjs [--out DIR]
//   · verify-why.mjs 와 같은 하네스. ★백엔드는 가짜 서버, 트렌드·주제 비중 데이터는 «합성 판»으로 가로챈다 —
//     운영 trend.json 에는 아직 guide 칸·신호가 없고(첫 판 = 09-19 06:00), 운영 데이터를 고쳐 시험하지 않는다.
//   · 보는 것: 7칸 순서·공략 칸 색/아이콘 · 행에 신호가 새지 않는가(행 = 게임·주제·발주 그대로) · 모달 «검색 수요»·«AI 브리핑» 줄과
//     소재 메모 · 신호 없는 옛 항목엔 줄이 없는가 · 육아 주 1회 빈 칸 문구와 «판 보기» 이동 · 지정 게임 문구 ·
//     홈 타일 막대 비율(그려진 픽셀)·목표 눈금·미연결 표기·툴팁·표 뷰·재검 줄 · 1920/390/360 넘침 0 · 칸 머리 한 줄(390·360) · hover 캡션 대비 · 콘솔 0 · CSS 구조
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, createReadStream, readFileSync } from 'node:fs';
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/* ── 합성 판 ── */
const src = (n) => [{ label: '공식', url: 'https://example.com/' + n }];
const I = (sec, n, o) => Object.assign({ id: 'syn-' + sec + '-' + n, game: 'G' + n, title: sec + ' 주제 ' + n, purpose: '게임 공략', why: '왜 지금', detail: '확인된 사실 한 줄', angle: '각도', heat: 2, keywords: ['G' + n + ' 공략'], sources: src(sec + n) }, o);
const E1 = { date: '2026-09-23', headline: '합성 판 — 수요일', note: ['★육아 제품은 주 1회(월요일 판)'], sections: [
  { key: 'pinned', items: [I('pinned', 1, { game: '롤토체스', title: '롤토체스 초보 덱 추천, 18.2 기준', angleType: 'rank', demand: { tier: 2, src: 'ac', ac: 10 }, aib: { s: 'shown', n: 4, bd: 2, yd: null, q: '롤토체스 초보 덱' } })] },
  { key: 'core', items: [I('core', 1, { game: '팰월드', title: '팰월드 거점 추천 위치', angleType: 'howto', demand: { tier: 1, src: 'searchad', ac: 10, game: 42000, kw: { q: '팰월드 거점', n: 3200 } }, aib: { s: 'async', n: 0, bd: null, yd: null, q: '팰월드 거점' } })] },
  { key: 'guide', items: [
    I('guide', 1, { game: '메이플스토리', title: '메이플스토리 초보 세팅 방법, 사냥 전에 할 것', angleType: 'howto', depth: 'play', demand: { tier: 2, src: 'ac', ac: 9 }, aib: { s: 'shown', n: 5, bd: null, yd: null, q: '메이플 스토리 세팅' } }),
    I('guide', 2, { game: '리그 오브 레전드', title: '리그 오브 레전드 게임 방법, 처음 하는 사람 기준', angleType: 'howto', depth: 'entry', entryOk: '09-20 서비스 이관으로 접속 경로 변경', demand: { tier: 2, src: 'ac', ac: 10 }, aib: { s: 'none', n: 0, bd: null, yd: null, q: '리그 오브 레전드 게임 방법' } }),
    I('guide', 3, { game: '뱀피르', title: '뱀피르 쿠폰 9월 입력 방법', angleType: 'howto', demand: { tier: 2, src: 'ac', ac: 8 } })] },
  { key: 'parenting', items: [] },
  { key: 'new', items: [I('new', 1, { angleType: 'news', demand: { tier: 1, src: 'ac', ac: 2 } })] },
  { key: 'update', items: [I('update', 1, { angleType: 'howto', demand: { tier: 2, src: 'ac', ac: 10 } })] },
  { key: 'hot', items: [I('hot', 1, { angleType: 'howto', demand: { tier: 2, src: 'ac', ac: 10 } })] }] };
const E2 = { date: '2026-09-22', headline: '합성 판 — 화요일', note: [], sections: [
  { key: 'core', items: [I('core', 2, {})] }, { key: 'parenting', items: [] }] };
const E3 = { date: '2026-09-21', headline: '합성 판 — 월요일', note: [], sections: [
  { key: 'guide', items: [I('guide', 9, { angleType: 'rank', demand: { tier: 1, src: 'ac', ac: 3 } })] },
  { key: 'parenting', items: [I('parenting', 1, { game: '아기 가습기', title: '아기 가습기 추천 5종', purpose: '제품 비교·추천', lane: '봄딩' }),
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
  const abs = normalize(join(ROOT, p));
  if (!existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  if (p === '/index.html') {
    let html = readFileSync(abs, 'utf8');
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
chk('7칸 · 공략 칸이 «주로 다루는 게임» 바로 다음', Array.isArray(secs) && secs.length === 7 && secs[2] === '지금 검색되는 공략', secs);
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
chk('★행에 신호가 새지 않는다(게임·주제·발주 3요소 그대로)', await ev(`(()=>{const s=${gsec};const r=s.querySelector('.trow');return r.children.length===3&&!/수요|브리핑|자동완성/.test(r.textContent)})()`));
chk('지정 게임 0종 문구 = «최대 5개»', (await ev(`(()=>{const s=[...document.querySelectorAll('.tsec')].find(x=>x.querySelector('.tsec-t').textContent==='꼭 다룰 게임');return s?s.textContent:''})()`)).includes('게임마다 주제 최대 5개') || (await ev(`document.querySelectorAll('.tsec')[0].querySelectorAll('.trow').length`)) > 0);
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
await shot('04-home-1920', true);
chk('[1920 홈] 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth`));
chk('[1920 홈] 콘솔 예외 0', logs.length === 0, logs);

/* 두 번째 데이터 — 발주 0건(«건 없음»)·100% 막대·재검 없음 */
MIX = MIX_B;
await open(1920, 1080, false); logs = [];
await goHome();
const rowsB = await ev(`[...document.querySelectorAll('#tileMix .mx-row')].map(r=>r.querySelector('.mx-t').textContent+'|'+(r.querySelector('.mx-na')?r.querySelector('.mx-na').textContent:'bar'))`);
chk('발주 0건이면 «건 없음»', rowsB[1] === '발주|건 없음', rowsB);
chk('100% 이면 회색 칸 없이 잉크 칸 하나 · 끝만 둥글다', await ev(`(()=>{const r=document.querySelectorAll('#tileMix .mx-row')[2];return r.querySelectorAll('.mx-seg').length===1&&!!r.querySelector('.mx-seg.g')&&getComputedStyle(r.querySelector('.mx-seg.g')).borderTopRightRadius==='4px'})()`));
chk('재검 데이터가 없으면 그 줄 자체가 없다(깊이 줄은 별개)', await ev(`[...document.querySelectorAll('#tileMix .mx-foot')].every(f=>f.textContent.indexOf('발행 후 재검')<0)`));
chk('[1920 홈 B] 콘솔 예외 0', logs.length === 0, logs);
MIX = MIX_A;

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
await shot('05-home-390', true);
await goTrend();
chk('[390] 공략 칸 행이 3개', (await ev(`(()=>{const s=${gsec};return s?s.querySelectorAll('.trow').length:0})()`)) === 3);
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
chk('[360] 콘솔 예외 0', logs.length === 0, logs);

/* CSS 구조 — 주석·중괄호(09-14 사고: 닫지 않은 주석 하나가 모바일 규칙 전체를 죽였다) */
const CSSSRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const CSSBODY = CSSSRC.slice(CSSSRC.indexOf('<style'), CSSSRC.indexOf('</style>'));
chk('CSS 주석이 전부 닫혀 있다', (CSSBODY.match(/\/\*/g) || []).length === (CSSBODY.match(/\*\//g) || []).length);
chk('CSS 중괄호가 맞는다', (CSSBODY.match(/\{/g) || []).length === (CSSBODY.match(/\}/g) || []).length);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''} · 스크린샷 ${OUT}`);
try { ws.close(); } catch { }
chrome.kill(); srv.close(); api.close();
process.exit(fail ? 1 : 0);
