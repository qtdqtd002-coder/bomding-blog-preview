// verify-api-hang.mjs — 백엔드 «무응답»에서도 사이트가 뜨는가 헤드리스 검증 (2026-10-15)
//   node _tools/verify-api-hang.mjs [--out DIR] [--index FILE]
//   · 왜: 10-15 GCP 결제가 닫혀 VM 이 꺼지자 서버가 거부가 아니라 «무응답»이 됐고, 부팅 Promise.all 이
//     백엔드 GET 5개를 끝없이 기다려 사이트 전체가 «불러오는 중»에 멈췄다(탭 전환도 불가 · 실측 3분+).
//     index.html 의 apiGet() 이 «응답 머리»를 API_HEAD_MS(8초) 안에 못 받으면 포기하게 고쳤다.
//   · 보는 것 둘:
//     [무응답] 가짜 백엔드가 연결만 받고 영원히 답하지 않는다 → 부팅이 BOOT_MAX_MS 안에 끝나고, 작성 글 목록이 뜨고,
//       캘린더 탭이 «여는 중»에 머물지 않고 «불러오지 못했어요 / 다시 시도»로 넘어가고(_cal/cal.js 자체 fetch — 10-15 게이트 🟡), 콘솔 예외 0.
//     [느린 본문] 머리는 바로 오고 /requests 본문이 11초에 걸쳐 온다(정상 서버의 1.5MB·5.3초를 과장) →
//       ★끊기지 않고 끝까지 받는다(상한이 «전체 시간»이면 여기서 FAIL — 느린 회선에서 멀쩡한 서버를 끊는 회귀).
//   · `--index FILE` = 그 파일을 index.html 로 서빙(변이 시험: 수리 전 판은 [무응답]에서 FAIL 해야 한다).
//   · `--cal FILE` = 그 파일을 _cal/cal.js 로 서빙(같은 변이 시험의 캘린더 판).
//   · 운영 백엔드는 부르지 않는다(가짜 서버 · sslip.io 차단).
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
const OUT = val('--out', join(tmpdir(), '_apihang-out'));
const INDEX = val('--index', null) ? resolve(val('--index', null)) : join(ROOT, 'index.html');
const CALJS = val('--cal', null) ? resolve(val('--cal', null)) : join(ROOT, '_cal', 'cal.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const BOOT_MAX_MS = 14000;   /* 머리 상한 8초 + 정적 파일·렌더 여유 */
const SLOW_BODY_MS = 11000;  /* 머리 상한(8초)보다 길게 — 전체 시간 상한이면 끊긴다 */

/* ── 가짜 백엔드 — MODE 에 따라 «무응답» 또는 «느린 본문» ── */
let MODE = 'hang';
const held = [];
const api = createServer((req, res) => {
  if (MODE === 'hang') { held.push(res); return; }           /* 연결만 받고 영원히 답하지 않는다 */
  const p = req.url.split('?')[0];
  const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (p === '/requests') {
    res.writeHead(200, H); res.write('[');
    let n = 0; const steps = 11;
    const t = setInterval(() => {
      n++;
      if (n < steps) { res.write(' '); return; }
      clearInterval(t); res.end(']');
    }, SLOW_BODY_MS / steps);
    return;
  }
  res.writeHead(200, H);
  if (p === '/hidden' || p === '/mpub') res.end('{"rels":[]}');
  else if (p === '/why') res.end('{"reasons":[],"items":[]}');
  else if (p === '/pins') res.end('{"games":[]}');
  else res.end('{}');
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
const AP = api.address().port;

/* ── 정적 서버 — index.html 만 CFG.API_BASE 를 가짜 서버로 바꿔 내려준다 ── */
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  if (p === '/index.html') {
    let html = readFileSync(INDEX, 'utf8');
    html = html.replace(/API_BASE\s*:\s*'[^']*'/, "API_BASE:'http://127.0.0.1:" + AP + "'");
    res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(html); return;
  }
  if (p === '/_cal/cal.js') { res.writeHead(200, { 'Content-Type': MIME['.js'] }); res.end(readFileSync(CALJS)); return; }
  const abs = normalize(join(ROOT, p));
  if (!existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;

const port = 9400 + Math.floor(Math.random() * 500);
const prof = join(tmpdir(), `_apihangprof${port}`);
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); api.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| site :' + HP, '| fake api :' + AP, '| index', INDEX);

const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); let logs = [];
/* ★요청은 «보낸 시점의 단계»로 묶는다 — 앞 단계에서 매달린 요청이 뒤늦게 끊긴 기록(ERR_EMPTY_RESPONSE)이 다음 단계 판정에 섞이지 않게 */
let PHASE = 'hang';
const reqUrl = new Map(); const finished = []; const failed = [];
ws.onmessage = (m0) => {
  const m = JSON.parse(m0.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('[console.error] ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Network.requestWillBeSent') reqUrl.set(m.params.requestId, { url: m.params.request.url, phase: PHASE });
  else if (m.method === 'Network.loadingFinished') { const q = reqUrl.get(m.params.requestId); if (q && q.phase === PHASE) finished.push(q.url); }
  else if (m.method === 'Network.loadingFailed') { const q = reqUrl.get(m.params.requestId); if (q && q.phase === PHASE) failed.push(q.url + ' ' + m.params.errorText); }
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }; return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*sslip.io*', '*cheer-splash.js*'] });
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return Date.now() - t0; await sleep(150); } return null; };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64')); };
const isApi = (u) => u.startsWith('http://127.0.0.1:' + AP);

const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const BOOTED = `!!document.querySelector('#view') && !document.querySelector('#view .skel') && document.querySelectorAll('.isl-tab').length>0`;

try {
  /* ── [무응답] ── */
  MODE = 'hang'; logs = [];
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  const bootMs = await waitFor(BOOTED, BOOT_MAX_MS + 6000);
  chk(`[무응답] 부팅이 ${BOOT_MAX_MS / 1000}초 안에 끝난다(«불러오는 중» 해제)`, bootMs !== null && bootMs <= BOOT_MAX_MS, bootMs);
  await shot('hang-home');
  await ev(`(()=>{const t=document.querySelector('.isl-tab[data-v="posts"]');if(t)t.click();return !!t})()`);
  const rowsMs = await waitFor(`document.querySelectorAll('#listCore .row').length>0`, 6000);
  chk('[무응답] 작성 글 탭으로 넘어가 목록이 뜬다', rowsMs !== null, rowsMs);
  await shot('hang-posts');
  await ev(`(()=>{const t=document.querySelector('.isl-tab[data-v="cal"]');if(t)t.click();return !!t})()`);
  const calMs = await waitFor(`/불러오지 못했어요/.test((document.querySelector('#view')||document.body).innerText) && !!document.querySelector('#calRetry')`, 14000);
  chk('[무응답] 캘린더 탭이 «여는 중»에 머물지 않고 «불러오지 못했어요 / 다시 시도»로 넘어간다', calMs !== null, calMs === null ? await ev(`(document.querySelector('#view')||document.body).innerText.slice(0,80)`) : calMs);
  await shot('hang-cal');
  chk('[무응답] 콘솔 예외 0', logs.length === 0, logs.slice(0, 4));
  held.splice(0).forEach(r => { try { r.destroy(); } catch {} });

  /* ── [느린 본문] ── */
  MODE = 'slow'; PHASE = 'slow'; logs = []; finished.length = 0; failed.length = 0;
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  const t0 = Date.now();
  let got = null;
  while (Date.now() - t0 < SLOW_BODY_MS + 9000) {
    got = finished.find(u => isApi(u) && u.includes('/requests')) || failed.find(u => isApi(u) && u.includes('/requests'));
    if (got) break;
    await sleep(200);
  }
  const reqFailed = failed.filter(u => isApi(u));
  chk(`[느린 본문] /requests 가 ${SLOW_BODY_MS / 1000}초 본문을 끝까지 받는다(머리 상한이 본문을 자르지 않는다)`,
    !!got && finished.some(u => isApi(u) && u.includes('/requests')) && reqFailed.length === 0, { got, reqFailed });
  chk('[느린 본문] 부팅이 끝난다', (await waitFor(BOOTED, 6000)) !== null, null);
  chk('[느린 본문] 콘솔 예외 0', logs.length === 0, logs.slice(0, 4));
} finally {
  held.splice(0).forEach(r => { try { r.destroy(); } catch {} });
  try { ws.close(); } catch {}
  chrome.kill(); srv.close(); api.close();
}

writeFileSync(join(OUT, 'result.json'), JSON.stringify({ at: new Date().toISOString(), index: INDEX, results: R }, null, 2));
console.log(`\n${R.length - fail}/${R.length} ${fail ? 'FAIL' : 'PASS'} · 스크린샷 ${OUT}`);
process.exit(fail ? 1 : 0);
