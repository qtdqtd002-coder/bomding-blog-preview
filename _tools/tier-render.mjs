// tier-render.mjs — 도구함 「티어표 제작」(_toolbox/tier.js) 보드 JSON → PNG 를 헤드리스로 굽는다 (2026-09-18)
//   node _tools/tier-render.mjs --board <board.json> --out <file.png> [--scale 2]
//   · 글 파이프라인(봄딩·영도 티어표 글)이 «도구함 양식 그대로»의 티어표 이미지를 사람 손 없이 얻기 위한 도구.
//     사이트의 도구를 실제로 띄워(index.html → 도구함 → 티어표) __test.setBoard 로 보드를 넣고 exportCanvas 결과를 저장한다.
//     그리는 코드는 tier.js 하나뿐이다 — 이 스크립트는 양식을 복제하지 않는다(디자인이 바뀌면 PNG 도 따라 바뀜).
//   · board.json = 도구의 「JSON 저장」 형식 그대로 {app:'sseudam-tier', v:2, board:{title,stamp,sign,tiers:[{letter,label,note,items:[{name,res:{b,c}}]}]}, design:{design,accent,cols,shape}}
//     res.b = _toolbox/tier/res/index.json 에 등록된 묶음 id, res.c = 그 묶음 manifest 의 캐릭터 id.
//   · 출력 = 폭 693×2(=1386, 네이버 PC 본문 실폭의 2배) × 높이 자동. 모든 리소스 그림이 실제로 그려졌는지(이미지 수 = res 항목 수) 확인하고, 아니면 exit 1.
//   · verify-tier.mjs 와 같은 하네스(로컬 정적 서버 + 크롬 헤드리스 CDP, 의존성 0). 축하 스플래시 ?cheer=0.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BOARD = val('--board', ''), OUTF = val('--out', '');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const step = (m) => { if (args.includes('--verbose')) console.error('[tier-render] ' + m); };
/* 어느 단계에서 멈춰도 90초 뒤엔 반드시 끝난다(크롬·서버 정리 후 exit 1) */
let killAll = () => {};
setTimeout(() => { console.error('시간 초과(90초) — 단계 로그는 --verbose'); killAll(); process.exit(1); }, 90000).unref();
if (!BOARD || !existsSync(BOARD) || !OUTF) { console.error('사용법: node _tools/tier-render.mjs --board <board.json> --out <file.png>'); process.exit(1); }
const board = JSON.parse(readFileSync(BOARD, 'utf8').replace(/^\uFEFF/, ''));
if (board.app !== 'sseudam-tier' || !board.board || !Array.isArray(board.board.tiers)) { console.error('쓰담 티어표 JSON 이 아닙니다(app·board.tiers)'); process.exit(1); }
const resCount = board.board.tiers.reduce((n, t) => n + (t.items || []).filter(i => i && i.res).length, 0);

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  const abs = normalize(join(ROOT, p));
  if (!abs.startsWith(ROOT) || !existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;
const port = 9300 + Math.floor(Math.random() * 90);
const prof = join(tmpdir(), `_tierrender${port}`); mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const done = (code) => { try { chrome.kill(); } catch {} srv.close(); process.exit(code); };
killAll = () => { try { chrome.kill(); } catch {} try { srv.close(); } catch {} };
step('chrome spawn :' + port);
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { console.error('chrome did not start'); done(1); }
step('chrome up');
const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const logs = []; let loaded = null;
ws.onmessage = (m0) => {
  const m = JSON.parse(m0.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Page.loadEventFired' && loaded) loaded();
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
const waitFor = async (expr, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { let v = null; try { v = await ev(expr); } catch {} if (v) return v; await sleep(150); } return null; };
step('ws open');
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
/* 라이브 백엔드 호출은 막는다(렌더에 불필요 · 부작용 0) */
await send('Network.setBlockedURLs', { urls: ['*sslip.io*'] });
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const p0 = new Promise(r => loaded = r);
await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
await Promise.race([p0, sleep(12000)]); loaded = null;
await waitFor(`!document.querySelector('#view .skel')`, 9000);
step('page loaded');
/* 도구함 → 티어표 (DOM 클릭 — 좌표 불필요) */
await ev(`document.querySelector('.isl-tab[data-v="tools"]').click(),true`);
await waitFor(`!!document.querySelector('#tbList .tb-item[data-t="tier"]')`, 9000);
await ev(`document.querySelector('#tbList .tb-item[data-t="tier"]').click(),true`);
if (!await waitFor(`!!document.querySelector('#tiCanvas')&&!!window.SseudamTools&&!!window.SseudamTools.tier.__test.layout()`, 10000)) { console.error('티어 도구 로드 실패', logs); done(1); }
step('tier tool ready');
await ev(`window.SseudamTools.tier.__test.setBoard(${JSON.stringify(board)}),true`);
/* 리소스 그림·글꼴·시그니처가 다 들어올 때까지 */
const ok = await waitFor(`(()=>{const s=window.SseudamTools.tier.__test.state();return s.images>=${resCount}&&s.fonts})()`, 20000);
step('images wait ' + ok);
const st = await ev(`window.SseudamTools.tier.__test.state()`);
if (!ok) { console.error(`그림 ${st.images}/${resCount} · 글꼴 ${st.fonts} — 다 그려지지 않았습니다`, logs); done(1); }
await waitFor(`!!window.SseudamTools.tier.__test.sigSrc()`, 4000);
step('sig ok');
await sleep(600);
await ev(`window.SseudamTools.tier.__test.paint()`);
step('painted');
const L = await ev(`window.SseudamTools.tier.__test.layout()`);
step('layout H ' + (L && L.H));
/* 큰 PNG 를 CDP 한 메시지로 받으면 멈춘다(세로 1600+ 보드 실측) → 페이지에 두고 512KB 조각으로 받는다 */
const len = await ev(`(window.__tierDU=window.SseudamTools.tier.__test.dataURL()).length`);
let du = '';
for (let o = 0; o < len; o += 524288) du += await ev(`window.__tierDU.slice(${o},${o + 524288})`);
step('dataURL ' + (du && du.length));
if (typeof du !== 'string' || !du.startsWith('data:image/png')) { console.error('PNG 추출 실패'); done(1); }
mkdirSync(dirname(resolve(OUTF)), { recursive: true });
const buf = Buffer.from(du.slice(22), 'base64'); writeFileSync(OUTF, buf);
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
console.log(JSON.stringify({ out: resolve(OUTF), w, h, logicalH: L.H, tiers: L.bands.map(b => b.tiles), images: st.images, res: resCount, design: st.design.design, kb: Math.round(buf.length / 1024), errors: logs }));
done(logs.length ? 2 : 0);
