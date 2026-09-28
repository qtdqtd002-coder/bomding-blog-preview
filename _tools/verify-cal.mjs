// verify-cal.mjs — 「캘린더」 탭(봄딩·영도 외주 일감 달력) 헤드리스 게이트 (2026-09-28)
//   node _tools/verify-cal.mjs [--out DIR] [--shots]
//   · verify-why.mjs 와 같은 하네스. ★백엔드는 **가짜 서버**로 가로챈다 — 운영 /cal 에 시험 일감·암호를 남기지 않는다.
//     (운영 암호는 사용자가 처음 열 때 정한다. 게이트가 운영에 setup 을 치면 사용자의 «처음 정하기»를 빼앗는다.)
//   · 보는 것: 탭 자리(맨 오른쪽) · 암호 정하기/열기/잠그기/틀린 암호 · 달력 격자·오늘·공휴일(2026 추석·개천절 대체) ·
//     일감 추가·자동 채움·고치기·완료·지우기·되돌리기 · 판 충돌(409) · 수입 합계(3.3%)·업체별·연간 막대 ·
//     작성자 격리 · 새로고침 뒤 기억 · 1920 한 화면 · 라벨 ≥12.5 · 포커스 링 · 모바일 섬 5탭·넘침·점·목록·40px 표적 · 콘솔 0
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
const OUT = val('--out', join(tmpdir(), '_cal-out'));
const SHOTS = args.includes('--shots');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/* ── 가짜 백엔드 — /cal 계약(blog-company-backend/src/cal.js)을 메모리로 흉내 + 사이트 부팅용 빈 응답 ── */
const PASS = 'test-pass-2026';
const auth = { set: false, tokens: new Set() };
const DB = { bomding: new Map(), yeongdo: new Map() };
const log = [];
let tick = Date.now();
const pubE = (e) => ({ id: e.id, date: e.date, game: e.game, agency: e.agency, price: e.price, done: e.done, memo: e.memo, createdAt: e.createdAt, updatedAt: e.updatedAt });
const api = createServer((req, res) => {
  const [u, qs] = req.url.split('?');
  const q = new URLSearchParams(qs || '');
  const done = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') return done(204, {});
  let raw = ''; req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(raw || '{}'); } catch { }
    const tok = req.headers['x-cal-token'] || '';
    log.push({ m: req.method, u, q: Object.fromEntries(q), b, tok: !!tok });
    if (!u.startsWith('/cal')) {
      if (u === '/why') return done(200, { reasons: [], items: [], counts: {} });
      if (u === '/hidden' || u === '/mpub' || u === '/topic') return done(200, { rels: [] });
      if (u === '/pins') return done(200, { games: [], max: 8, updatedAt: Date.now() });
      if (u === '/requests') return done(200, []);
      return done(200, {});
    }
    if (u === '/cal/auth' && req.method === 'GET') return done(200, { set: auth.set, min: 6 });
    if (u === '/cal/auth/setup') {
      if (auth.set) return done(409, { error: '암호가 이미 정해져 있습니다.', code: 'already' });
      if (String(b.pass || '').length < 6) return done(400, { error: '6자 이상' });
      auth.set = true; auth.pass = b.pass; const t = 'tok' + Math.random().toString(36).slice(2); auth.tokens.add(t);
      return done(201, { ok: true, token: t });
    }
    if (u === '/cal/auth/login') {
      if (!auth.set) return done(409, { code: 'unset', error: 'unset' });
      if (b.pass !== auth.pass) return done(401, { error: '암호가 맞지 않아요.', code: 'wrong', left: 5 });
      const t = 'tok' + Math.random().toString(36).slice(2); auth.tokens.add(t); return done(200, { ok: true, token: t });
    }
    if (u === '/cal/auth/logout') { auth.tokens.delete(tok); return done(200, { ok: true }); }
    const m = /^\/cal\/(bomding|yeongdo)(?:\/([A-Za-z0-9_-]{8,48}))?$/.exec(u);
    if (!m) return done(404, { error: 'nope' });
    if (!auth.tokens.has(tok)) return done(401, { error: 'locked', code: auth.set ? 'locked' : 'unset' });
    const w = m[1], id = m[2], tbl = DB[w];
    if (req.method === 'GET' && !id) return done(200, { writer: w, name: w === 'bomding' ? '봄딩' : '영도', entries: [...tbl.values()].map(pubE).sort((a, c) => a.date < c.date ? -1 : 1) });
    if (req.method === 'PUT' && id) {
      const cur = tbl.get(id);
      if (cur && b.base != null && Number(b.base) !== cur.updatedAt) return done(409, { error: '다른 기기에서 먼저 고친 일감입니다.', code: 'stale', entry: pubE(cur) });
      if (!b.game && !b.agency) return done(400, { error: '게임·업체' });
      tick += 7;
      const e = { id, date: b.date, game: b.game || '', agency: b.agency || '', price: b.price == null || b.price === '' ? null : Number(b.price), done: !!b.done, memo: b.memo || '', createdAt: cur ? cur.createdAt : tick, updatedAt: tick };
      tbl.set(id, e); return done(cur ? 200 : 201, { ok: true, entry: pubE(e) });
    }
    if (req.method === 'DELETE' && id) {
      const cur = tbl.get(id); if (!cur) return done(404, { error: '없는 일감' });
      if (q.get('base') && Number(q.get('base')) !== cur.updatedAt) return done(409, { code: 'stale', entry: pubE(cur) });
      tbl.delete(id); return done(200, { ok: true, id });
    }
    return done(405, { error: 'method' });
  });
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
const AP = api.address().port;

/* ── 정적 서버 — index.html 만 CFG.API_BASE 를 가짜 서버로 바꿔 내려준다 ── */
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
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
const prof = join(tmpdir(), `_calprof${port}`);
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
const rect = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return{cx:b.left+b.width/2,cy:b.top+b.height/2,w:b.width,h:b.height,l:b.left,r:b.right,t:b.top,b:b.bottom}})()`);
const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }); await sleep(240); };
const click = async (sel) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center'});return true})()`); await sleep(160); const r = await rect(sel); if (!r) return false; await tap(r.cx, r.cy); return true; };
const waitFor = async (expr, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return v; await sleep(120); } return null; };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64')); };
const typeInto = async (sel, text) => {
  await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.focus();e.select&&e.select();return true})()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  if (text) await send('Input.insertText', { text });
  await sleep(90);
};
const pressEnter = async () => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(300); };

const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const open = async (w, h, mobile, touchMedia) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  await send('Emulation.setEmulatedMedia', touchMedia
    ? { media: 'screen', features: [{ name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] }
    : { media: 'screen', features: [] });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  await Promise.race([p, sleep(10000)]); loaded = null;
  await waitFor(`!document.querySelector('#view .skel')`, 9000);
  await sleep(400);
};
const goCal = async () => { await click('.isl-tab[data-v="cal"]'); await sleep(700); return waitFor(`!!(document.querySelector('.cal-grid')||document.querySelector('.cal-lk'))`, 9000); };

/* 오늘(시험을 도는 날) 기준 — 달력은 늘 이번 달로 연다 */
const NOW = new Date();
const p2 = (n) => (n < 10 ? '0' : '') + n;
const TODAY = `${NOW.getFullYear()}-${p2(NOW.getMonth() + 1)}-${p2(NOW.getDate())}`;
const CUR_YM = TODAY.slice(0, 7);
const DIM = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();
const D1 = CUR_YM + '-' + p2(Math.min(12, DIM));      // 이번 달 안의 고정 날짜 둘
const D2 = CUR_YM + '-' + p2(Math.min(14, DIM));
/* 지금 보고 있는 달(라벨) → 목표 달까지 ‹ › 를 눌러 간다 */
const navTo = async (ym) => {
  const cur = await ev(`(()=>{const m=/(\\d+)년 (\\d+)월/.exec(document.getElementById('calYm').textContent);return m?{y:+m[1],m:+m[2]}:null})()`);
  const diff = (+ym.slice(0, 4) - cur.y) * 12 + (+ym.slice(5, 7) - cur.m);
  for (let i = 0; i < Math.abs(diff); i++) { await click(`.cal-nav .dpbtn[data-go="${diff > 0 ? 'newer' : 'older'}"]`); await sleep(120); }
  await sleep(700);
};
const puts = () => log.filter((x) => x.m === 'PUT');

/* ════════ 1920 ════════ */
await open(1920, 1080, false, false); logs = [];
chk('탭 5개 · 캘린더가 맨 오른쪽', await ev(`(()=>{const t=[...document.querySelectorAll('#tabs .isl-tab')];return t.length===5&&t[4].dataset.v==='cal'&&t[4].textContent.trim()==='캘린더'&&t[4].getBoundingClientRect().left>t[3].getBoundingClientRect().right})()`));
chk('캘린더 탭이 열린다(모듈 지연 로드)', !!(await goCal()));
chk('모듈 파일은 ?v= 가 붙은 _cal/cal.js', await ev(`[...document.scripts].some(s=>/_cal\\/cal\\.js\\?v=\\d{8}[a-z]$/.test(s.src))`));
chk('제목 = 캘린더', (await ev(`document.getElementById('ptitle').textContent`)) === '캘린더');
await sleep(300);
chk('캘린더 탭에선 «새 글 요청» FAB 를 거둔다(수입 패널 가림 방지)', (await ev(`getComputedStyle(document.getElementById('fab')).visibility`)) === 'hidden');
chk('암호가 없으면 «암호 정하기» + 확인 칸', await ev(`document.querySelector('.cal-lk-t').textContent==='캘린더 암호 정하기'&&!!document.getElementById('calPw2')`));
chk('잠금 화면에선 달력·금액이 안 보인다', await ev(`!document.querySelector('.cal-grid')&&!document.querySelector('.cal-side')&&document.getElementById('pmeta').textContent.trim()===''`));
if (SHOTS) await shot('00-setup-1920');
await typeInto('#calPw', 'abc'); await typeInto('#calPw2', 'abc'); await click('#calLkGo');
chk('6자 미만은 막는다', /6자/.test(await ev(`document.getElementById('calLkMsg').textContent`)));
await typeInto('#calPw', PASS); await typeInto('#calPw2', PASS + 'x'); await click('#calLkGo');
chk('두 칸이 다르면 막는다', /달라/.test(await ev(`document.getElementById('calLkMsg').textContent`)));
await typeInto('#calPw2', PASS); await click('#calLkGo');
chk('정하면 달력이 열린다', !!(await waitFor(`!!document.querySelector('.cal-grid .cal-d')`, 6000)));
chk('토큰을 이 기기에 기억한다', !!(await ev(`localStorage.getItem('sseudam_cal_tok_v1')`)));
chk('★평문 암호는 브라우저에 남지 않는다', await ev(`!Object.keys(localStorage).some(k=>String(localStorage.getItem(k)).includes(${JSON.stringify(PASS)}))`));
await sleep(500);

/* 격자 */
const g = await ev(`(()=>{const c=[...document.querySelectorAll('#calGrid .cal-d')];return{all:c.length,inm:c.filter(x=>!x.classList.contains('out')).length,wk:document.querySelectorAll('.cal-wk span').length,today:(document.querySelector('.cal-d.today')||{}).dataset?.d||null,label:document.getElementById('calYm').textContent}})()`);
chk('격자 = 7의 배수 · 이달 날수만큼 칸 · 요일 7', g && g.all % 7 === 0 && g.inm === DIM && g.wk === 7, g);
chk('이번 달로 열리고 오늘 칸이 표시된다', g && g.today === TODAY && g.label === `${NOW.getFullYear()}년 ${NOW.getMonth() + 1}월`, g);
chk('오늘 버튼은 이번 달에선 꺼져 있다', await ev(`document.querySelector('.cal-nav .dpbtn[data-go="today"]').disabled===true`));
chk('7열이 같은 폭', await ev(`(()=>{const c=[...document.querySelectorAll('#calGrid .cal-d')].slice(0,7).map(x=>Math.round(x.getBoundingClientRect().width));return Math.max(...c)-Math.min(...c)<=1})()`));
if (SHOTS) await shot('01-empty-1920');

/* 일감 추가 */
await click('#calAdd');
chk('«일감 추가» 모달', !!(await waitFor(`!!document.getElementById('cfGame')`, 4000)));
chk('날짜 칸 기본값 = 오늘(이번 달)', (await ev(`document.getElementById('cfDate').value`)) === TODAY);
await typeInto('#cfGame', '리니지M'); await typeInto('#cfAgency', '플랜비'); await typeInto('#cfPrice', '50000');
chk('단가를 치면 쉼표가 붙는다', (await ev(`document.getElementById('cfPrice').value`)) === '50,000');
chk('3.3% 뗀 금액 힌트', (await ev(`document.getElementById('cfNet').textContent`)) === '3.3% 떼면 48,350원');
if (SHOTS) await shot('06-modal-1920');
await ev(`(()=>{const d=document.getElementById('cfDate');d.value=${JSON.stringify(D1)};d.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`);
await click('#cfSave');
await waitFor(`!document.getElementById('cfGame')`, 4000);
await sleep(400);
const p1 = puts().at(-1);
chk('PUT /cal/bomding/<id> · 단가 숫자 · 판 없음(새 일감)', p1 && /^\/cal\/bomding\/e[a-z0-9]{8,}$/.test(p1.u) && p1.b.price === 50000 && p1.b.date === D1 && p1.b.base === undefined && p1.tok, p1);
chk('칸에 «게임 (업체)» 로 뜬다', (await ev(`(()=>{const c=document.querySelector('.cal-d[data-d="${D1}"] .cal-et .tx');return c?c.querySelector('.g').textContent+' '+c.querySelector('.ag').textContent:null})()`)) === '리니지M (플랜비)');
chk('짧은 «게임 (업체)» 는 한 줄', await ev(`(()=>{const g=document.querySelector('.cal-d[data-d="${D1}"] .cal-et .g').getBoundingClientRect(),a=document.querySelector('.cal-d[data-d="${D1}"] .cal-et .ag').getBoundingClientRect();return Math.abs(g.top-a.top)<2})()`));

/* 자동 채움 — 같은 게임을 다시 넣으면 지난번 업체·단가 */
await ev(`(()=>{const b=document.querySelector('.cal-d[data-d="${D2}"] .cal-plus');b.click();return 1})()`);
await waitFor(`!!document.getElementById('cfGame')`, 4000);
chk('칸의 «+» = 그 날짜로 연다', (await ev(`document.getElementById('cfDate').value`)) === D2);
chk('게임 이름 제안 목록(datalist)에 지난 게임', await ev(`[...document.querySelectorAll('#cfGames option')].some(o=>o.value==='리니지M')`));
await typeInto('#cfGame', '리니지M');
await ev(`document.getElementById('cfGame').dispatchEvent(new Event('change',{bubbles:true}))`); await sleep(200);
chk('같은 게임 → 업체·단가 자동 채움', (await ev(`document.getElementById('cfAgency').value+'|'+document.getElementById('cfPrice').value`)) === '플랜비|50,000');
await typeInto('#cfGame', '애니모'); await typeInto('#cfAgency', '애드너트'); await typeInto('#cfPrice', '55000');
await pressEnter();
await waitFor(`!document.getElementById('cfGame')`, 4000); await sleep(400);
chk('Enter 로 저장', (await ev(`document.querySelectorAll('.cal-d[data-d="${D2}"] .cal-e').length`)) === 1);

/* 업체 없이 · 단가 미입력 */
await click('#calAdd'); await waitFor(`!!document.getElementById('cfGame')`, 4000);
await click('#cfSave');
chk('게임·업체 둘 다 비면 저장 안 됨', /하나는/.test(await ev(`document.getElementById('cfMsg').textContent`)) && !!(await ev(`document.getElementById('cfGame')`)));
await typeInto('#cfGame', '도깨비의 세계');
await ev(`(()=>{const d=document.getElementById('cfDate');d.value=${JSON.stringify(D2)};d.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`);
await click('#cfSave'); await waitFor(`!document.getElementById('cfGame')`, 4000); await sleep(400);
chk('업체 없는 일감은 게임 이름만', (await ev(`(()=>{const x=[...document.querySelectorAll('.cal-d[data-d="${D2}"] .cal-et .tx')].map(e=>e.textContent);return x.join('|')})()`)).includes('도깨비의 세계'));

/* 수입 */
const side = async () => ev(`(()=>{const q=k=>{const n=document.querySelector('[data-k="'+k+'"]');return n?n.textContent:null};return{net:q('mnet'),gross:q('mgross'),tax:q('mtax'),ynet:q('ynet'),warn:(document.querySelector('.cal-kv.warn')||{}).textContent||'',meta:document.getElementById('pmeta').textContent}})()`);
await sleep(700);
let sd = await side();
chk('이달 세전 105,000 · 3.3% −3,465 · 실수령 101,535', sd.gross === '105,000' && sd.tax === '−3,465' && sd.net === '101,535', sd);
chk('단가 미입력 1건 경고', /단가 미입력\s*1건/.test(sd.warn), sd.warn);
chk('연간 실수령 = 달 합', sd.ynet === '101,535', sd);
chk('머리 메타 = 이달 건수·실수령', /3건/.test(sd.meta) && /101,535/.test(sd.meta), sd.meta);
chk('업체별 = 플랜비·애드너트·업체 미입력(세전 큰 순)', (await ev(`[...document.querySelectorAll('.cal-agr .nm')].map(x=>x.textContent).join('|')`)) === '애드너트|플랜비|업체 미입력');
const yr = await ev(`(()=>{const r=document.querySelector('.cal-yrow.on');const i=r&&r.querySelector('.bar i');return r?{ym:r.dataset.ym,w:i?i.getBoundingClientRect().width:0,v:r.querySelector('.v').textContent,n:document.querySelectorAll('.cal-yrow').length}:null})()`);
chk('연간 12줄 · 이번 달 줄 강조 · 막대·값', yr && yr.n === 12 && yr.ym === CUR_YM && yr.w > 20 && yr.v === '101,535', yr);
chk('★막대 색은 글자색 토큰이 아니라 잉크(선택 달)', (await ev(`getComputedStyle(document.querySelector('.cal-yrow.on .bar i')).backgroundColor`)) === 'rgb(14, 17, 20)');

/* 완료 */
const e1id = await ev(`document.querySelector('.cal-d[data-d="${D1}"] .cal-e').dataset.id`);
await ev(`document.querySelector('[data-chk="${e1id}"]').click()`);
await sleep(600);
const pd = puts().at(-1);
chk('완료 → PUT done:true + 판(base)', pd && pd.b.done === true && typeof pd.b.base === 'number', pd);
chk('완료 = 취소선(게임·업체 둘 다)', (await ev(`['.g','.ag'].map(s=>getComputedStyle(document.querySelector('.cal-e[data-id="${e1id}"] '+s)).textDecorationLine).join('|')`)) === 'line-through|line-through');
chk('완료 = 채운 체크박스(늘 보임) · 안 한 일 = 빈 칸', await ev(`(()=>{const d=document.querySelector('[data-chk="${e1id}"]'),n=[...document.querySelectorAll('#calGrid .cal-chk')].find(x=>x.getAttribute('aria-pressed')==='false');return getComputedStyle(d).opacity==='1'&&getComputedStyle(d.querySelector('.ic')).opacity==='1'&&!!n&&getComputedStyle(n.querySelector('.ic')).opacity==='0'})()`));
chk('완료해도 수입은 그대로', (await side()).net === '101,535');
await ev(`document.querySelector('[data-chk="${e1id}"]').click()`); await sleep(120);
await ev(`document.querySelector('[data-chk="${e1id}"]').click()`); await sleep(900);
chk('연달아 두 번 눌러도 서버 = 마지막 상태(완료)', DB.bomding.get(e1id).done === true && (await ev(`document.querySelector('.cal-e[data-id="${e1id}"]').classList.contains('done')`)) === true, DB.bomding.get(e1id));

/* 고치기 + 판 충돌 */
await click(`.cal-e[data-id="${e1id}"] .cal-et`);
await waitFor(`!!document.getElementById('cfGame')`, 4000);
chk('고치기 모달에 값이 채워져 있다', (await ev(`document.getElementById('cfGame').value+'|'+document.getElementById('cfPrice').value+'|'+document.getElementById('cfDone').getAttribute('aria-pressed')`)) === '리니지M|50,000|true');
{ const cur = DB.bomding.get(e1id); tick += 7; DB.bomding.set(e1id, Object.assign({}, cur, { memo: '다른 기기', updatedAt: tick })); }   // 다른 기기가 그새 고쳤다
await typeInto('#cfPrice', '60000'); await click('#cfSave'); await sleep(500);
chk('★판이 낡으면 409 → 모달에 경고, 닫히지 않음', /다른 기기/.test(await ev(`document.getElementById('cfMsg').textContent`)) && !!(await ev(`document.getElementById('cfGame')`)));
await click('#cfSave'); await waitFor(`!document.getElementById('cfGame')`, 4000); await sleep(600);
chk('한 번 더 누르면 새 판으로 덮어쓴다', DB.bomding.get(e1id).price === 60000);
sd = await side();
chk('단가를 고치면 합계가 따라온다(115,000 → 111,205)', sd.gross === '115,000' && sd.net === '111,205', sd);

/* 지우기 + 되돌리기 */
await click(`.cal-e[data-id="${e1id}"] .cal-et`); await waitFor(`!!document.getElementById('cfDel')`, 4000);
await click('#cfDel'); await sleep(700);
chk('지우기 → DELETE(판 포함) · 칸에서 사라짐', log.some((x) => x.m === 'DELETE' && x.u.endsWith(e1id) && x.q.base) && !DB.bomding.has(e1id) && (await ev(`!document.querySelector('.cal-e[data-id="${e1id}"]')`)));
chk('토스트 «되돌리기»', (await ev(`(()=>{const b=document.querySelector('.toast.on .toast-act');return b?b.textContent:null})()`)) === '되돌리기');
await ev(`document.querySelector('.toast.on .toast-act').click()`); await sleep(800);
chk('되돌리면 다시 생긴다', DB.bomding.has(e1id) && (await ev(`!!document.querySelector('.cal-e[data-id="${e1id}"]')`)));

/* 달 이동 · 공휴일(2026 추석·개천절 대체) */
await navTo('2026-09');
chk('2026-09 로 이동', (await ev(`document.getElementById('calYm').textContent`)) === '2026년 9월');
const hol = await ev(`['2026-09-24','2026-09-25','2026-09-26'].map(d=>{const c=document.querySelector('.cal-d[data-d="'+d+'"]');return c&&c.classList.contains('hol')?c.querySelector('.cal-hn').textContent:null}).join('|')`);
chk('추석 연휴 3일 = 빨간 날 + 이름', hol === '추석 연휴|추석|추석 연휴', hol);
chk('공휴일 숫자는 경고색', (await ev(`getComputedStyle(document.querySelector('.cal-d[data-d="2026-09-25"] .cal-dn')).color`)) === 'rgb(196, 54, 42)');
await navTo('2026-10');
chk('10/3 개천절(토) → 10/5 대체공휴일', (await ev(`(document.querySelector('.cal-d[data-d="2026-10-03"] .cal-hn')||{}).textContent+'|'+(document.querySelector('.cal-d[data-d="2026-10-05"] .cal-hn')||{}).textContent`)) === '개천절|대체공휴일');
if (SHOTS) await shot('02-oct-1920');

/* ── 밀집 달(09-28 디자인 게이트 🟡 A·B·C) — 6주짜리 2027-01, 한 날 6건(긴 이름 섞임) ── */
const DD = '2027-01-15';
const dense = [['아쿠아랜드:크레이지서바이벌', '플랜비'], ['스페셜포스 리마스터', '디앤앱-양경모띠'], ['던전앤파이터 모바일', '픽셀크루'], ['리니지M', '플랜비'], ['피망포커', '애드너트'], ['도깨비의 세계', '디앤앱']];
dense.forEach(([g0, a0], i) => { tick += 7; DB.bomding.set('d_dense0' + i, { id: 'd_dense0' + i, date: DD, game: g0, agency: a0, price: 50000 + i * 1000, done: i % 2 === 1, memo: '', createdAt: tick, updatedAt: tick }); });
await navTo('2027-01');
await click('.cal-ws .chip[data-w="yeongdo"]'); await sleep(700); await click('.cal-ws .chip[data-w="bomding"]'); await sleep(900);   /* 작성자를 오가면 원장을 다시 받는다 */
chk('6주짜리 달 = 칸 기본 높이를 줄인다(r6)', await ev(`document.getElementById('calGrid').classList.contains('r6')&&document.querySelectorAll('#calGrid .cal-d').length===42`));
chk('한 칸 4건 초과 → 3건 + «+3건 더»', (await ev(`(()=>{const c=document.querySelector('.cal-d[data-d="${DD}"]');return c.querySelectorAll('.cal-e').length+'|'+(c.querySelector('.cal-more')||{}).textContent})()`)) === '3|+3건 더');
chk('★6주 + 몰린 날이어도 1920×1080 첫 화면 안(달력 판 바닥)', await ev(`(()=>{window.scrollTo(0,0);return document.querySelector('.cal-main').getBoundingClientRect().bottom<=1080})()`), await ev(`document.querySelector('.cal-main').getBoundingClientRect().bottom`));
const agVis = () => ev(`(()=>{const e=[...document.querySelectorAll('.cal-d[data-d="${DD}"] .cal-e')].find(x=>x.querySelector('.g').textContent.startsWith('아쿠아랜드'));if(!e)return null;const a=e.querySelector('.ag').getBoundingClientRect(),b=e.querySelector('.cal-et').getBoundingClientRect(),g=e.querySelector('.g').getBoundingClientRect();return{agW:Math.round(a.width),agH:Math.round(a.height),inside:a.bottom<=b.bottom+0.5&&a.right<=b.right+0.5,gLines:Math.round(g.height/17),chipH:Math.round(b.height)}})()`);
let av = await agVis();
chk('★긴 게임명이어도 업체가 보인다(1920 · 게임은 한 줄 말줄임)', av && av.agW > 20 && av.agH > 10 && av.inside && av.gLines === 1, av);
await ev(`window.scrollTo(0,0)`); await sleep(200);
await click(`.cal-d[data-d="${DD}"] .cal-more`);
chk('«+N건 더» = 그날 목록 창(6건 전부)', !!(await waitFor(`document.querySelectorAll('#calDayB .cal-ar').length===6`, 4000)));
if (SHOTS) await shot('07-day-1920');
const dchk = await ev(`document.querySelector('#calDayB .cal-ar:not(.done) [data-chk]').dataset.chk`);
await ev(`document.querySelector('#calDayB [data-chk="${dchk}"]').click()`); await sleep(700);
chk('창에서 완료 → PUT + 창 목록이 바로 바뀐다', puts().at(-1).u.endsWith(dchk) && puts().at(-1).b.done === true && (await ev(`document.querySelector('#calDayB .cal-ar[data-id="${dchk}"]').classList.contains('done')`)));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(500);
chk('창을 닫으면 포커스가 (다시 그려진) «+N건 더» 로 돌아온다', await ev(`!!document.activeElement&&document.activeElement.matches('.cal-more[data-day="${DD}"]')`));
/* 연간 12월 줄 툴팁이 제 줄·카드 아래 합계를 가리지 않는다 */
await ev(`window.scrollTo(0,0)`); await sleep(200);
const r12 = await rect('.cal-yrow[data-ym="2027-12"]');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r12.cx, y: r12.cy }); await sleep(300);
const tipOv = await ev(`(()=>{const t=document.getElementById('calTip');if(!t||!t.classList.contains('on'))return null;const a=t.getBoundingClientRect(),hit=(b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);const row=document.querySelector('.cal-yrow[data-ym="2027-12"]').getBoundingClientRect(),yf=document.querySelector('.cal-yf').getBoundingClientRect(),card=document.querySelector('.cal-yrow[data-ym="2027-12"]').closest('.tray').getBoundingClientRect();return{row:hit(row),yf:hit(yf),card:hit(card)}})()`);
chk('★12월 줄 툴팁이 제 줄·합계·카드를 안 가린다(카드 바깥 왼쪽)', tipOv && !tipOv.row && !tipOv.yf && !tipOv.card, tipOv);
if (SHOTS) await shot('08-tip-1920');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(200);

await click('.cal-nav .dpbtn[data-go="today"]'); await sleep(700);
chk('«오늘» = 이번 달로', (await ev(`document.getElementById('calYm').textContent`)) === `${NOW.getFullYear()}년 ${NOW.getMonth() + 1}월`);
/* 연간 줄 클릭 = 그 달로 */
const otherYm = CUR_YM.slice(0, 5) + (CUR_YM.slice(5) === '01' ? '02' : '01');
await click(`.cal-yrow[data-ym="${otherYm}"]`); await sleep(700);
chk('연간 줄을 누르면 그 달로 간다', (await ev(`document.getElementById('calYm').textContent`)) === `${NOW.getFullYear()}년 ${+otherYm.slice(5)}월`);
chk('연간 줄 호버 = 툴팁(세전·3.3%·일감)', await ev(`(()=>{const t=document.getElementById('calTip');return !!t&&/세전/.test(t.textContent)&&/3\\.3%/.test(t.textContent)})()`));
await click('.cal-nav .dpbtn[data-go="today"]'); await sleep(700);

/* 1920 한 화면 · 넘침 · 라벨 · 포커스 링 */
if (SHOTS) await shot('03-filled-1920');
chk('1920×1080: 달력 판 바닥이 한 화면 안(6주 달 기준 여유)', await ev(`(()=>{window.scrollTo(0,0);const b=document.querySelector('.cal-main').getBoundingClientRect().bottom;const rows=document.querySelectorAll('#calGrid .cal-d').length/7;return b+(6-rows)*124<=1080})()`), await ev(`document.querySelector('.cal-main').getBoundingClientRect().bottom`));
chk('수입 패널 폭 340', Math.round(await ev(`document.querySelector('.cal-side').getBoundingClientRect().width`)) === 340);
chk('가로 넘침 없음(1920)', await ev(`innerWidth===1920&&document.documentElement.scrollWidth<=1920`));
const small = await ev(`(()=>{const out=[];document.querySelectorAll('.cal *').forEach(n=>{if(n.closest('svg'))return;const t=[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim());if(!t)return;const s=parseFloat(getComputedStyle(n).fontSize);if(s<12.5)out.push(n.className+':'+s)});return out.slice(0,6)})()`);
chk('글자 12.5px 이상(라벨 하한)', small.length === 0, small);
chk('★연간 실수령 합계가 1920×1080 첫 화면 안', await ev(`(()=>{window.scrollTo(0,0);const n=document.querySelector('[data-k="ynet"]');return !!n&&n.getBoundingClientRect().bottom<=1080})()`), await ev(`document.querySelector('[data-k="ynet"]').getBoundingClientRect().bottom`));
chk('패널 순서 = 이달 → 연간 → 업체별', (await ev(`[...document.querySelectorAll('.cal-side > .tray')].map(x=>x.getAttribute('aria-label').replace(/\\d+/g,'#')).join('|')`)) === '#월 수입|#년 수입|#월 업체별');
await click('#calAdd'); await waitFor(`!!document.getElementById('cfGame')`, 4000);
await sleep(600);   /* 모달 등장 모션이 끝난 뒤 — 실클릭 + 300ms 뒤에 잰다(도구함 게이트 교훈) */
await click('#cfPrice'); await sleep(320);
const ring = await ev(`getComputedStyle(document.getElementById('cfPrice')).boxShadow`);
chk('입력 포커스 링 = 2px 잉크', /rgb\(14, 17, 20\) 0px 0px 0px 2px/.test(ring), ring);
await ev(`document.querySelector('.mdl-x').click()`); await sleep(400);

/* 작성자 격리 */
await click('.cal-ws .chip[data-w="yeongdo"]'); await sleep(900);
chk('영도로 바꾸면 GET /cal/yeongdo', log.some((x) => x.m === 'GET' && x.u === '/cal/yeongdo'));
chk('★영도 달력엔 봄딩 일감이 없다', (await ev(`document.querySelectorAll('#calGrid .cal-e').length`)) === 0 && (await ev(`document.querySelector('.cal-ws .chip.on').dataset.w`)) === 'yeongdo');
chk('영도 칩으로 포커스가 돌아온다', (await ev(`document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.w`)) === 'yeongdo');
await click('#calAdd'); await waitFor(`!!document.getElementById('cfGame')`, 4000);
chk('영도 모달엔 봄딩 게임 제안이 없다', (await ev(`document.querySelectorAll('#cfGames option').length`)) === 0);
await typeInto('#cfGame', '스페셜포스 리마스터'); await typeInto('#cfAgency', '디앤앱'); await typeInto('#cfPrice', '70000');
await click('#cfSave'); await waitFor(`!document.getElementById('cfGame')`, 4000); await sleep(500);
chk('영도 일감은 /cal/yeongdo 로 간다', /^\/cal\/yeongdo\//.test(puts().at(-1).u) && DB.yeongdo.size === 1 && DB.bomding.size === 3 + 6);   /* 봄딩 = 이번 달 3 + 밀집 달 6 */
await click('.cal-ws .chip[data-w="bomding"]'); await sleep(900);
chk('봄딩으로 돌아오면 봄딩 합계', (await side()).net === '111,205');

/* 새로고침 = 기억 */
await open(1920, 1080, false, false); logs = [];
await goCal();
chk('새로고침해도 암호를 다시 묻지 않는다', !!(await waitFor(`!!document.querySelector('.cal-grid')`, 6000)) && !(await ev(`document.querySelector('.cal-lk')`)));
chk('마지막으로 본 작성자(봄딩) 유지', (await ev(`document.querySelector('.cal-ws .chip.on').dataset.w`)) === 'bomding');

/* 탭 이탈/복귀 */
await click('.isl-tab[data-v="home"]'); await sleep(700);
chk('다른 탭에선 FAB 가 돌아온다', (await ev(`getComputedStyle(document.getElementById('fab')).visibility`)) === 'visible');
await goCal(); await sleep(500);
chk('탭을 나갔다 와도 달력 그대로', (await ev(`document.querySelectorAll('#calGrid .cal-e').length`)) === 3);

/* 잠그기 · 틀린 암호 · 다시 열기 */
await click('#calLock'); await sleep(500);
chk('잠그면 잠금 화면 + 토큰·캐시 지움', (await ev(`document.querySelector('.cal-lk-t').textContent`)) === '캘린더 잠금' && !(await ev(`localStorage.getItem('sseudam_cal_tok_v1')`)) && !(await ev(`localStorage.getItem('sseudam_cal_cache_v1')`)));
chk('잠그기 = 서버 토큰도 폐기(logout)', log.some((x) => x.u === '/cal/auth/logout'));
await typeInto('#calPw', 'wrong-one'); await click('#calLkGo'); await sleep(400);
chk('틀린 암호 = 안내', /맞지 않/.test(await ev(`document.getElementById('calLkMsg').textContent`)));
await typeInto('#calPw', PASS); await click('#calLkGo');
chk('맞는 암호 = 다시 열림', !!(await waitFor(`!!document.querySelector('.cal-grid .cal-e')`, 6000)));
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);

/* ════════ 1366 · 태블릿 ════════ */
await open(1366, 768, false, false); logs = [];
await goCal(); await sleep(600);
chk('[1366] 두 열(달력 | 패널 340)', await ev(`(()=>{const a=document.querySelector('.cal-main').getBoundingClientRect(),b=document.querySelector('.cal-side').getBoundingClientRect();return b.left>a.right&&Math.round(b.width)===340})()`));
chk('[1366] 가로 넘침 없음', await ev(`innerWidth===1366&&document.documentElement.scrollWidth<=1366`));
if (SHOTS) await shot('04-1366');
await navTo('2027-01');
av = await agVis();
chk('[1366] ★긴 게임명이어도 업체가 보인다(칸이 좁을수록 잘 걸리던 자리)', av && av.agW > 20 && av.agH > 10 && av.inside && av.gLines === 1, av);
/* 게이트 🟡 A 가 1366 에서 잡은 두 번째 사례 — «던전앤파이터 모바일 (픽셀크루)» 는 1920 에선 온전했고 1366 에서 업체가 잘렸다 */
const dnf = await ev(`(()=>{const e=[...document.querySelectorAll('.cal-d[data-d="${DD}"] .cal-e')].find(x=>x.querySelector('.g').textContent.startsWith('던전앤파이터'));if(!e)return null;const a=e.querySelector('.ag').getBoundingClientRect(),b=e.querySelector('.cal-et').getBoundingClientRect();return{w:Math.round(a.width),h:Math.round(a.height),inside:a.bottom<=b.bottom+0.5}})()`);
chk('[1366] «던전앤파이터 모바일 (픽셀크루)» 의 업체도 보인다', dnf && dnf.w > 20 && dnf.h > 10 && dnf.inside, dnf);
if (SHOTS) await shot('04-1366-dense');
await open(1024, 900, false, false); logs = [];
await goCal(); await sleep(600);
chk('[1024] 패널은 달력 아래 세 칸', await ev(`(()=>{const a=document.querySelector('.cal-main').getBoundingClientRect(),c=[...document.querySelectorAll('.cal-side > .tray')].map(x=>x.getBoundingClientRect());return c.length===3&&c.every(r=>r.top>a.bottom)&&Math.abs(c[0].top-c[2].top)<2})()`));
chk('[1024] 가로 넘침 없음', await ev(`innerWidth===1024&&document.documentElement.scrollWidth<=1024`));
chk('[1024·1366] 콘솔 예외 0', logs.length === 0, logs);

/* ════════ 모바일 섬 — 탭 5개가 «한 줄로» 들어가는가 ════════
   ★«넘침 없음»만 보면 안 된다 — 09-28 첫 판은 탭이 줄어들며 글자를 두 줄로 접어(«작성/글») 스크롤 검사를 통과했다.
   그래서 탭 높이(38 = 한 줄)·탭 줄 스크롤·종과의 겹침을 폭 구간마다(여백·로고·숫자를 덜어 내는 경계 앞뒤) 잰다. */
const islAt = async () => ev(`(()=>{const t=document.getElementById('tabs'),tabs=[...t.querySelectorAll('.isl-tab')],c=tabs[4].getBoundingClientRect(),i=document.getElementById('island').getBoundingClientRect(),b=document.getElementById('bell').getBoundingClientRect();return{n:tabs.length,h:Math.max(...tabs.map(x=>Math.round(x.getBoundingClientRect().height))),scroll:t.scrollWidth>t.clientWidth+1,calR:Math.round(c.right),islR:Math.round(i.right),bellL:Math.round(b.left),minW:Math.min(...tabs.map(x=>Math.round(x.getBoundingClientRect().width)))}})()`);
for (const W of [860, 600, 561, 560, 480, 471, 470, 431, 430, 414, 390, 386, 385, 375, 360, 340]) {
  await open(W, 800, true, true);
  const s = await islAt();
  chk(`[섬 ${W}] 탭 5개 한 줄(높이 38) · 스크롤 없음 · 종과 안 겹침${W <= 470 ? ' · 탭 ≥40px' : ''}`,
    s && s.n === 5 && s.h === 38 && !s.scroll && s.calR <= s.islR && s.islR <= s.bellL && (W > 470 || s.minW >= 40), s);
}

/* ════════ 모바일 390 · 360 ════════ */
for (const W of [390, 360]) {
  await open(W, 844, true, true); logs = [];
  await goCal(); await sleep(700);
  if (SHOTS) await shot(`05-${W}-top`);
  chk(`[${W}] 가로 넘침 없음(innerWidth 까지)`, await ev(`innerWidth===${W}&&document.documentElement.scrollWidth<=${W}`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
  chk(`[${W}] 칸엔 칩 대신 점`, await ev(`(()=>{const d=document.querySelector('#calGrid .cal-d .cal-dots');const e=document.querySelector('#calGrid .cal-es');return !!d&&getComputedStyle(d).display==='flex'&&getComputedStyle(e).display==='none'})()`));
  await click(`#calGrid .cal-d[data-d="${D2}"]`); await sleep(400);
  chk(`[${W}] 날을 누르면 고른 표시 + 아래 목록`, await ev(`document.querySelector('.cal-d[data-d="${D2}"]').classList.contains('sel')&&document.querySelectorAll('#calAg .cal-ar').length===2`));
  chk(`[${W}] 목록의 안 한 일 = 빈 체크박스(✓ 안 보임)`, await ev(`[...document.querySelectorAll('#calAg .cal-ar:not(.done) .cal-chk .ic')].every(i=>getComputedStyle(i).opacity==='0')`));
  const tg = await ev(`(()=>{const a=[...document.querySelectorAll('#calAg .cal-chk, #calAg .cal-art, .cal-bar button, .cal-ag-h .ghost')].filter(x=>x.offsetParent).map(x=>{const r=x.getBoundingClientRect();return Math.min(r.width,r.height)});return Math.min(...a)})()`);
  chk(`[${W}] 손가락 표적 ≥ 40px`, tg >= 40, tg);
  const ar = await ev(`document.querySelector('#calAg .cal-ar [data-chk]').dataset.chk`);
  await click(`#calAg [data-chk="${ar}"]`); await sleep(700);
  chk(`[${W}] 목록에서 완료 체크 · 포커스는 목록 쪽에 남는다`, (await ev(`document.querySelector('#calAg .cal-ar[data-id="${ar}"]').classList.contains('done')`)) && (await ev(`document.activeElement&&!!document.activeElement.closest('#calAg')`)));
  await click(`#calAg [data-chk="${ar}"]`); await sleep(700);
  await click('.cal-ag-h .ghost'); await waitFor(`!!document.getElementById('cfGame')`, 4000);
  chk(`[${W}] 목록의 «추가» = 고른 날짜`, (await ev(`document.getElementById('cfDate').value`)) === D2);
  chk(`[${W}] 모달 입력칸이 화면 안`, await ev(`(()=>{const r=document.getElementById('cfDate').getBoundingClientRect();return r.right<=innerWidth&&r.left>=0})()`));
  await ev(`document.querySelector('.mdl-x').click()`); await sleep(400);
  const small2 = await ev(`(()=>{const out=[];document.querySelectorAll('.cal *').forEach(n=>{if(n.closest('svg')||!n.offsetParent)return;const t=[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim());if(!t)return;const s=parseFloat(getComputedStyle(n).fontSize);if(s<12.5)out.push(n.className+':'+s)});return out.slice(0,6)})()`);
  chk(`[${W}] 글자 12.5px 이상`, small2.length === 0, small2);
  if (SHOTS) await shot(`05-${W}`);
  chk(`[${W}] 콘솔 예외 0`, logs.length === 0, logs);
}

/* CSS 구조(주석·중괄호) — 주석 하나 안 닫으면 뒤 규칙이 통째로 죽는다(09-14 사고) */
const SRC = readFileSync(join(ROOT, '_cal', 'cal.js'), 'utf8');
const cssPart = SRC.slice(SRC.indexOf('var CSS=['), SRC.indexOf("].join('\\n');"));
chk('cal.js CSS 중괄호가 맞는다', (cssPart.match(/\{/g) || []).length === (cssPart.match(/\}/g) || []).length);
const IDX = readFileSync(join(ROOT, 'index.html'), 'utf8');
chk('index.html CAL_SRC 가 실제 파일을 가리킨다', /CAL_SRC='_cal\/cal\.js\?v=\d{8}[a-z]'/.test(IDX));

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}${SHOTS ? '  (shots: ' + OUT + ')' : ''}`);
try { ws.close(); } catch { }
chrome.kill(); srv.close(); api.close();
process.exit(fail ? 1 : 0);
