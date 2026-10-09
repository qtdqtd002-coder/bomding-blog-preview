// verify-reopen.mjs — 작성 글 «다시 꺼낸 글»(reopen.json) 헤드리스 검증 (2026-10-09)
//   node _tools/verify-reopen.mjs [--out DIR]
//   · verify-why.mjs 와 같은 하네스. ★백엔드는 **가짜 서버**로 가로챈다 — 운영 /hidden 을 건드리지 않는다.
//   · 이 기능이 낼 수 있는 사고는 하나다: «끝낸 글이 통째로 되살아난다»(v5 초안이 13편을 171편으로 띄웠다).
//     그래서 화면이 아니라 **편수**를 잰다 — 목록 행 수 = (끝났다는 신호가 없는 글) + (reopen.json 에 적힌 글) 이어야 한다.
//   · 보는 것: 적힌 글만 되살아나는가 · ①자동 게시확인 ②수동 발행완료를 이기는가 · ③아카이브는 못 이기는가 ·
//     되살아난 행을 아카이브하면 서버로 가고 내려가는가 · 파일이 없거나 깨져도 평소 목록 그대로인가 · 3폭 넘침 0 · 콘솔 0
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
const OUT = val('--out', join(tmpdir(), '_reopen-out'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/* ── 기대값은 Node 쪽에서 원본 파일로 센다(브라우저가 낸 수를 브라우저에 되묻지 않는다) ── */
const readJSON = (f, fb) => { try { return JSON.parse(readFileSync(join(ROOT, f), 'utf8')); } catch { return fb; } };
const POSTS = (readJSON('posts.json', []) || []).filter((p) => p && p.rel && !p.rel.split('/').some((s) => s[0] === '.' || s[0] === '_'));
const PUB = new Set(((readJSON('published.json', {}) || {}).publishedRels) || []);
const isPub = (p) => p.published === true || PUB.has(p.rel);
const REAL = readJSON('reopen.json', null);
const realRels = ((REAL && Array.isArray(REAL.rels)) ? REAL.rels : []).map((x) => (x && typeof x === 'object') ? x.rel : x).filter((x) => typeof x === 'string' && x);
const BASE = POSTS.filter((p) => !isPub(p)).length;                       /* 평소 목록(가짜 백엔드 = 아카이브·수동 0건) */
const pubPosts = POSTS.filter(isPub);
if (pubPosts.length < 3) { console.error('발행 확인된 글이 3편 미만이라 시험할 수 없다'); process.exit(2); }
const T1 = pubPosts[0].rel, T2 = pubPosts[1].rel;                        /* 시험용 «이미 올린 글» 두 편 */
const GHOST = '없는작성자/없는글/없는파일.html';                          /* posts.json 에 없는 rel — 적혀 있어도 행이 생기면 안 된다 */

/* ── 가짜 백엔드 ── */
let HIDDEN = [], MPUB = [];
const posted = [];
const api = createServer((req, res) => {
  const u = req.url.split('?')[0];
  const done = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') return done(204, {});
  if (req.method === 'GET') {
    if (u === '/hidden') return done(200, { rels: HIDDEN });
    if (u === '/mpub') return done(200, { rels: MPUB });
    if (u === '/why') return done(200, { reasons: [], items: [], counts: {} });
    if (u === '/pins') return done(200, { games: [], max: 8, updatedAt: Date.now() });
    if (u === '/requests') return done(200, []);
    if (u === '/topic') return done(200, { rels: [] });
    return done(200, {});
  }
  let raw = ''; req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(raw || '{}'); } catch { }
    posted.push({ url: u, body: b });
    if (u === '/hidden') { if (b.rel && !HIDDEN.includes(b.rel)) HIDDEN.push(b.rel); return done(201, { ok: true, rels: HIDDEN }); }
    if (u === '/hidden/unhide') { HIDDEN = HIDDEN.filter((x) => x !== b.rel); return done(200, { ok: true, rels: HIDDEN }); }
    return done(200, { ok: true });
  });
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
const AP = api.address().port;

/* ── 정적 서버 — index.html 은 API_BASE 만 바꾸고, reopen.json 은 장면마다 갈아 끼운다 ──
   REOPEN_MODE: 'real' = 저장소 파일 그대로 · 'none' = 404 · 그 밖의 문자열 = 그 본문을 그대로 내려준다 */
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let REOPEN_MODE = 'real';
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  if (p === '/reopen.json' && REOPEN_MODE !== 'real') {
    if (REOPEN_MODE === 'none') { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': MIME['.json'] }); res.end(REOPEN_MODE); return;
  }
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
const prof = join(tmpdir(), `_reopenprof${port}`);
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); api.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| site :' + HP, '| fake api :' + AP);
console.log(`글 ${POSTS.length}편 · 올린 글 ${pubPosts.length}편 · 평소 목록 ${BASE}편 · reopen.json ${realRels.length}건`);

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
const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
const click = async (sel) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center'});return true})()`); await sleep(140); const r = await rect(sel); if (!r) return false; await tap(r.cx, r.cy); return true; };
const waitFor = async (expr, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return v; await sleep(120); } return null; };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64')); };

const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const open = async (w, h, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  await Promise.race([p, sleep(10000)]); loaded = null;
  await waitFor(`!document.querySelector('#view .skel')`, 9000);
  await sleep(400);
};
const goPosts = async () => { await click('.isl-tab[data-v="posts"]'); await sleep(800); return waitFor(`!!document.querySelector('#filters')`, 9000); };
/* 목록 편수 = «전체» 칩의 숫자(페이지로 잘린 행 수가 아니라 걸러진 전체 수) */
const total = () => ev(`(()=>{const c=document.querySelector('#filters .chip[data-w=""] .n');return c?Number(c.textContent.replace(/[^0-9]/g,'')):null})()`);
/* 그 글이 목록에 있는가 — 페이지 뒤쪽에 있을 수 있으니 제목 검색으로 좁힌 뒤 행을 찾는다 */
const titleOf = (rel) => (POSTS.find((p) => p.rel === rel) || {}).title || '';
const hasRow = async (rel) => {
  const q = titleOf(rel).slice(0, 14);
  await ev(`(()=>{const i=document.querySelector('#q');if(!i)return false;i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await sleep(700);
  const got = await ev(`[...document.querySelectorAll('#listCore .row')].some(r=>r.getAttribute('data-rel')===${JSON.stringify(rel)})`);
  await ev(`(()=>{const i=document.querySelector('#q');if(!i)return false;i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await sleep(500);
  return got === true;
};
const scene = async (name, mode, hidden, mpub, w = 1920, h = 1080, mobile = false) => {
  REOPEN_MODE = mode; HIDDEN = hidden.slice(); MPUB = mpub.slice(); posted.length = 0;
  await open(w, h, mobile); logs = [];
  const ok = await goPosts();
  if (!ok) chk(`[${name}] 작성 글 목록이 뜬다`, false);
};
const J = (rels) => JSON.stringify({ rels });

/* ── 0) 적힌 rel 이 실제 글인가 — 오타·폴더 이동은 화면에서 «조용히 안 뜬다»(사고는 아니지만 알 길이 없다). 여기서 센다 ── */
const lost = realRels.filter((r) => !POSTS.some((p) => p.rel === r));
chk(`[실파일] reopen.json 에 적힌 rel ${realRels.length}건이 전부 posts.json 에 있다`, lost.length === 0, lost);

/* ── 1) 저장소의 reopen.json 그대로 — 적힌 글만 되살아난다 ── */
await scene('실파일', 'real', [], []);
const realHit = realRels.filter((r) => POSTS.some((p) => p.rel === r && isPub(p)));
chk(`[실파일] 목록 편수 = 평소 ${BASE} + 다시 꺼낸 글 ${realHit.length}`, (await total()) === BASE + realHit.length, { got: await total(), want: BASE + realHit.length });
for (const r of realHit) chk(`[실파일] 다시 꺼낸 글이 목록에 있다 — ${r.split('/').slice(0, 3).join('/')}`, await hasRow(r));
chk('[실파일] 상단 «작성 글» 숫자도 같다', (await ev(`(()=>{const e=document.querySelector('#nPosts');return e?Number(e.textContent.replace(/[^0-9]/g,'')):null})()`)) === BASE + realHit.length,
  await ev(`(()=>{const e=document.querySelector('#nPosts');return e?e.textContent:null})()`));
chk('[실파일] 가로 넘침 없음(1920)', await ev(`innerWidth===1920&&document.documentElement.scrollWidth<=1920`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
await shot('01-real-1920');
chk('[실파일] 콘솔 예외 0', logs.length === 0, logs);

/* ── 2) 파일이 없으면(404) 평소 목록 그대로 ── */
await scene('없음', 'none', [], []);
chk(`[없음] 목록 편수 = 평소 ${BASE}`, (await total()) === BASE, { got: await total() });
chk('[없음] 이미 올린 글은 목록에 없다', (await hasRow(T1)) === false);
chk('[없음] 콘솔 예외 0', logs.length === 0, logs);

/* ── 3) 깨진 파일·엉뚱한 모양 — 예외 0건으로 떨어진다(되살아나는 글 0) ── */
for (const [nm, body] of [['JSON 아님', '{ 이건 JSON 이 아니다'], ['빈 객체', '{}'], ['rels 가 배열 아님', '{"rels":"' + T1 + '"}'], ['rels 안에 쓰레기', JSON.stringify({ rels: [null, 0, {}, { rel: 7 }, [], ''] })]]) {
  await scene(nm, body, [], []);
  chk(`[깨짐·${nm}] 목록 편수 = 평소 ${BASE}`, (await total()) === BASE, { got: await total() });
  chk(`[깨짐·${nm}] 콘솔 예외 0`, logs.length === 0, logs);
}

/* ── 4) ① 자동 게시확인을 이긴다 · 적힌 글만 · 없는 rel 은 행을 만들지 않는다(문자열·객체 두 꼴 다 받는다) ── */
await scene('둘+유령', J([T1, { rel: T2, at: '2026-10-09', why: '시험' }, GHOST]), [], []);
chk(`[예외 2건] 목록 편수 = 평소 ${BASE} + 2 (없는 rel 은 0)`, (await total()) === BASE + 2, { got: await total() });
chk('[예외 2건] 문자열로 적은 글이 있다', await hasRow(T1));
chk('[예외 2건] 객체로 적은 글이 있다', await hasRow(T2));
chk('[예외 2건] 콘솔 예외 0', logs.length === 0, logs);

/* ── 5) ② 수동 발행완료도 이긴다 ── */
const U = POSTS.find((p) => !isPub(p));                                   /* 평소 목록에 있는 글 하나를 수동 발행완료로 내린 뒤 다시 꺼낸다 */
await scene('수동', 'none', [], [U.rel]);
chk(`[수동 발행완료] 그 글이 내려가 ${BASE - 1}편`, (await total()) === BASE - 1, { got: await total() });
await scene('수동+예외', J([U.rel]), [], [U.rel]);
chk(`[수동 발행완료+예외] 다시 올라와 ${BASE}편`, (await total()) === BASE && (await hasRow(U.rel)), { got: await total() });

/* ── 6) ③ 아카이브는 못 이긴다 ── */
await scene('아카이브', J([T1, T2]), [T1], []);
chk(`[아카이브] 아카이브한 글은 예외에 적혀 있어도 없다 — ${BASE} + 1`, (await total()) === BASE + 1, { got: await total() });
chk('[아카이브] 아카이브한 글 행 없음', (await hasRow(T1)) === false);
chk('[아카이브] 나머지 예외 글은 있다', await hasRow(T2));

/* ── 7) 되살아난 행을 아카이브하면 서버로 가고 내려간다(닫는 길) · 되돌리기 ── */
await scene('닫기', J([T1]), [], []);
const q1 = titleOf(T1).slice(0, 14);
await ev(`(()=>{const i=document.querySelector('#q');i.value=${JSON.stringify(q1)};i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
await sleep(700);
const sel = `#listCore .row[data-rel="${T1.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
chk('[닫기] 되살아난 행이 보인다', (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) === true);
const rr = await rect(sel);
if (rr) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rr.cx, y: rr.cy, button: 'none' });
await sleep(300);
await click(sel + ' .arch');
await sleep(1500);
chk('[닫기] 서버로 POST /hidden 이 갔다', posted.some((p) => p.url === '/hidden' && p.body.rel === T1), posted);
chk('[닫기] 행이 내려갔다', (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) === false);
await ev(`(()=>{const i=document.querySelector('#q');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
await sleep(600);
chk(`[닫기] 목록 편수가 평소 ${BASE} 로 돌아왔다`, (await total()) === BASE, { got: await total() });
chk('[닫기] 콘솔 예외 0', logs.length === 0, logs);

/* ── 8) 좁은 폭 — 행이 하나 늘 뿐이라 배치는 그대로여야 한다 ── */
for (const [w, h] of [[860, 900], [390, 844]]) {
  await scene('폭' + w, 'real', [], [], w, h, w <= 860);
  chk(`[${w}] 목록 편수 = ${BASE + realHit.length}`, (await total()) === BASE + realHit.length, { got: await total() });
  chk(`[${w}] 가로 넘침 없음`, await ev(`innerWidth===${w}&&document.documentElement.scrollWidth<=${w}`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
  if (realHit[0]) chk(`[${w}] 다시 꺼낸 글 행이 있다`, await hasRow(realHit[0]));
  await shot('02-real-' + w);
  chk(`[${w}] 콘솔 예외 0`, logs.length === 0, logs);
}

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch { }
chrome.kill(); srv.close(); api.close();
process.exit(fail ? 1 : 0);
