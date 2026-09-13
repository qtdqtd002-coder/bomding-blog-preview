// verify-why.mjs — 작성 글 「안 올린 이유」(영도 전용) 헤드리스 검증 (2026-09-14)
//   node _tools/verify-why.mjs [--out DIR]
//   · verify-title.mjs 와 같은 하네스. ★백엔드는 **가짜 서버**로 가로챈다 — 운영 /why 에 시험 데이터를 남기지 않는다.
//     (라이브 백엔드를 때리면 «영도/시험글» 같은 쓰레기가 집계에 섞인다. 이 기능의 값은 집계라 오염이 곧 기능 파괴다.)
//   · 보는 것: 영도 행에만 버튼이 뜨는가(★격리) · 사유를 고르면 서버로 가는가 · 행에 라벨이 남는가 ·
//     다시 열면 그 사유가 선택돼 있는가 · 지우기 · 백엔드 미연결이면 버튼이 사라지는가 · 3폭 넘침 0 · 콘솔 0
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
const OUT = val('--out', join(tmpdir(), '_why-out'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/* ── 가짜 백엔드 — 사이트가 CFG.API_BASE 로 부르는 것들을 전부 여기서 받는다 ── */
const REASONS = [
  { id: 'long', label: '너무 길다', fix: '분량 밴드 하향' },
  { id: 'wrong', label: '사실이 틀렸다', fix: 'qa-fact 강화' },
  { id: 'offtopic', label: '주제가 안 맞다', fix: '발주 각도 재조정' },
  { id: 'dup', label: '이미 쓴 내용', fix: '중복 판정 강화' },
  { id: 'voice', label: '문체가 다르다', fix: 'style-guide 보강' },
  { id: 'notime', label: '시간이 없었다', fix: '붙여넣기 마찰 감소' },
];
const store = new Map();
const posted = [];
const gets = [];
const whyBody = () => {
  const items = [...store.entries()].map(([rel, reason]) => ({ rel, reason, by: null, at: Date.now() }));
  const counts = {}; items.forEach((x) => { counts[x.reason] = (counts[x.reason] || 0) + 1; });
  return { reasons: REASONS, items, counts };
};
const api = createServer((req, res) => {
  const u = req.url.split('?')[0];
  const done = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') return done(204, {});
  if (req.method === 'GET') {
    gets.push(u);
    if (u === '/why') return done(200, whyBody());
    if (u === '/hidden' || u === '/mpub') return done(200, { rels: [] });
    if (u === '/pins') return done(200, { games: [], max: 8, updatedAt: Date.now() });
    if (u === '/requests') return done(200, []);
    if (u === '/topic') return done(200, { rels: [] });
    return done(200, {});
  }
  let raw = ''; req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(raw || '{}'); } catch { }
    posted.push({ url: u, body: b });
    if (u === '/why') {
      if (!b.rel) return done(400, { error: 'rel 필수' });
      if (!REASONS.some((x) => x.id === b.reason)) return done(400, { error: '사유 목록 밖' });
      store.set(b.rel, b.reason); return done(201, Object.assign({ ok: true }, whyBody()));
    }
    if (u === '/why/clear') { store.delete(b.rel); return done(200, Object.assign({ ok: true }, whyBody())); }
    return done(200, { ok: true });
  });
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
const AP = api.address().port;

/* ── 정적 서버 — index.html 만 CFG.API_BASE 를 가짜 서버로 바꿔 내려준다 ── */
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let NOAPI = false;
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  const abs = normalize(join(ROOT, p));
  if (!existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  if (p === '/index.html') {
    let html = readFileSync(abs, 'utf8');
    html = html.replace(/API_BASE\s*:\s*'[^']*'/, "API_BASE:'" + (NOAPI ? '' : 'http://127.0.0.1:' + AP) + "'");
    res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(html); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;

const port = 9400 + Math.floor(Math.random() * 500);
const prof = join(tmpdir(), `_whyprof${port}`);
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); api.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| site :' + HP, '| fake api :' + AP);

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
const goPosts = async () => { await click('.isl-tab[data-v="posts"]'); await sleep(800); return waitFor(`document.querySelectorAll('#listCore .row').length>0`, 9000); };
/* 그 작성자의 첫 행으로 좁힌다(검색창에 작성자 칩을 쓰면 목록이 그 사람 것만 남는다) */
const pickWriter = async (name) => { await click(`#filters .chip[data-w="${name}"]`); await sleep(600); };

await open(1920, 1080, false); logs = [];
chk('작성 글 목록이 뜬다', !!(await goPosts()));
chk('부팅에 /why 를 불렀다(사유 어휘 적재)', gets.includes('/why'), gets);

await pickWriter('영도');
chk('영도 행에 「안 올린 이유」 버튼이 있다', (await ev(`document.querySelectorAll('#listCore .row .whyb').length`)) > 0);
await pickWriter('봄딩');
chk('★봄딩 행에는 버튼이 없다(영도 전용 격리)', (await ev(`document.querySelectorAll('#listCore .row .whyb').length`)) === 0);

await pickWriter('영도');
const rel = await ev(`document.querySelector('#listCore .row .whyb').getAttribute('data-rel')`);
chk('버튼이 그 행의 rel 을 들고 있다', !!rel && typeof rel === 'string', rel);
await click('#listCore .row .whyb');
chk('모달이 열린다', !!(await waitFor(`!!document.querySelector('.why-grid')`, 5000)));
chk('사유 6칸 · 각 칸에 처방이 붙는다',
  (await ev(`document.querySelectorAll('.why-chip').length`)) === 6 && (await ev(`document.querySelectorAll('.why-chip .why-fix').length`)) === 6);
chk('아직 고른 것이 없다', (await ev(`document.querySelectorAll('.why-chip.on').length`)) === 0);
await shot('01-modal');

await click('.why-chip[data-r="long"]');
await sleep(500);
chk('서버로 POST 됐다', posted.some((p) => p.url === '/why' && p.body.rel === rel && p.body.reason === 'long'), posted);
chk('모달이 닫힌다', (await ev(`!document.querySelector('.why-grid')`)) === true);
chk('행 제목 칸에 사유 태그가 남는다', (await ev(`(()=>{const b=document.querySelector('#listCore .row .row-t .tag-why');return b?b.textContent:null})()`)) === '너무 길다',
  await ev(`(()=>{const b=document.querySelector('#listCore .row .row-t .tag-why');return b?b.textContent:null})()`));
chk('★태그가 잘리지 않는다(행 안에 들어간다)', await ev(`(()=>{const t=document.querySelector('#listCore .row .tag-why');if(!t)return false;const r=t.getBoundingClientRect(),w=t.closest('.row').getBoundingClientRect();return r.right<=w.right+0.5&&r.width>0})()`));
chk('사유가 남은 버튼은 hover 없이도 보인다', (await ev(`getComputedStyle(document.querySelector('.whyb.on')).opacity`)) === '1');
await shot('02-after');

await click('#listCore .row .whyb.on');
await waitFor(`!!document.querySelector('.why-grid')`, 5000);
chk('다시 열면 고른 사유가 선택돼 있다', (await ev(`(()=>{const a=document.querySelector('.why-chip.on');return a?a.getAttribute('data-r'):null})()`)) === 'long');
chk('사유가 있을 때만 「지우기」가 있다', (await ev(`!!document.querySelector('.why-clear')`)) === true);
await click('.why-clear');
await sleep(500);
chk('지우면 서버로 간다', posted.some((p) => p.url === '/why/clear' && p.body.rel === rel));
chk('지우면 행 태그도 사라진다', (await ev(`document.querySelectorAll('#listCore .row .whyb.on').length`)) === 0 && (await ev(`document.querySelectorAll('#listCore .row .tag-why').length`)) === 0);

chk('가로 넘침 없음(1920)', await ev(`document.documentElement.scrollWidth<=innerWidth`));
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);

/* 390 — 좁은 폭에서는 라벨을 접고 아이콘만 */
await open(390, 844, true); logs = [];
await goPosts(); await pickWriter('영도');
await click('#listCore .row .whyb');
await waitFor(`!!document.querySelector('.why-grid')`, 5000);
chk('[390] 모달이 열리고 칸이 접힌다', (await ev(`document.querySelectorAll('.why-chip').length`)) === 6);
chk('[390] 가로 넘침 없음', await ev(`innerWidth===390&&document.documentElement.scrollWidth<=390`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
await shot('03-390');
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

/* 백엔드 미연결 — 버튼이 아예 없어야 한다(누르면 실패할 버튼을 보여 주지 않는다) */
NOAPI = true;
await open(1920, 1080, false); logs = [];
await goPosts(); await pickWriter('영도');
chk('백엔드 미연결이면 버튼을 숨긴다', (await ev(`document.querySelectorAll('#listCore .row .whyb').length`)) === 0);
chk('[미연결] 콘솔 예외 0', logs.length === 0, logs);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch { }
chrome.kill(); srv.close(); api.close();
process.exit(fail ? 1 : 0);
