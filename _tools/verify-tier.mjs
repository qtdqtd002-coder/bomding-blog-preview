// verify-tier.mjs — 도구함 「티어표 제작」 v2(_toolbox/tier.js) 헤드리스 검증 (2026-09-07 · v2 작성자 전용 보드)
//   node _tools/verify-tier.mjs [--out DIR]
//   · verify-toolbox.mjs 와 같은 하네스(로컬 정적 서버 + 크롬 헤드리스 CDP, 의존성 0). 축하 스플래시 ?cheer=0, 라이브 백엔드 차단.
//   · 1920×1080: 사이드 레일(≥1620 · 판 1080 전폭) → 도구 로드(폭 693·2배 캔버스) → 작업대(뷰포트 높이·내보내기 줄 보임) → 기본 보드(S~C·빈 슬롯 14)
//               → 제목·파일명 → 디자인 2종(제목 띠 실색) → 헥스 입력 → 타일 모양 5 → 한 줄 수 → 항목 추가·모노그램 → ▲▼·셀렉트 → 캔버스 드래그(실제 마우스)
//               → 클릭 선택 → 티어 추가/삭제·되돌리기 → 빈 티어 «+» → 리소스 서랍(목록·필터·클릭 추가·끌어 놓기·재방문 유지) → PNG 2배 → 라벨·포커스·히트존 → 탭 이탈/복귀 → 콘솔 0
//   · 1366×768: 레일 없음(열 안 나란히) · 가로 넘침 0   · 390×844: 단일 열 · 넘침 0 · 터치 타깃 · 콘솔 0
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = val('--out', join(tmpdir(), '_tier-out'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  const abs = normalize(join(ROOT, p));
  if (!existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;

const port = 9400 + Math.floor(Math.random() * 500);
const prof = join(tmpdir(), `_tierprof${port}`);
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| http :' + HP, '| out', OUT);

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
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }; return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*sslip.io*', '*cheer-splash.js*'] });

const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };
const rect = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return{x:b.left,y:b.top,w:b.width,h:b.height,cx:b.left+b.width/2,cy:b.top+b.height/2}})()`);
const mouse = async (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
const press = (x, y) => mouse('mousePressed', x, y, { buttons: 1 });
const dragTo = (x, y) => mouse('mouseMoved', x, y, { buttons: 1 });
const release = (x, y) => mouse('mouseReleased', x, y, { buttons: 0 });
const click = async (sel) => {
  await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e&&!e.closest('.back'))e.scrollIntoView({block:'center'});return true})()`);
  await sleep(120);
  const r = await rect(sel); if (!r) return false;
  await mouse('mouseMoved', r.cx, r.cy); await press(r.cx, r.cy); await release(r.cx, r.cy);
  return true;
};
const key = async (k, vk, text) => {
  const p = { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }; if (text) { p.text = text; p.unmodifiedText = text; }
  await send('Input.dispatchKeyEvent', p);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(200);
};
const setInput = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v) return v; await sleep(120); } return null; };
/* 캔버스(논리 693 좌표) 픽셀 — 2배 캔버스라 ×2 */
const px = (x, y) => ev(`(()=>{const c=document.getElementById('tiCanvas');const d=c.getContext('2d').getImageData(${x}*2,${y}*2,1,1).data;return [d[0],d[1],d[2]]})()`);
const cvVar = (x, y, w, h) => ev(`(()=>{const c=document.getElementById('tiCanvas');if(!c)return -1;const d=c.getContext('2d').getImageData(${x}*2,${y}*2,${w}*2,${h}*2).data;let s=0,s2=0,n=0;for(let i=0;i<d.length;i+=16){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return Math.round(s2/n-m*m)})()`);
const near = (c, hex, tol = 14) => { const n = parseInt(hex.slice(1), 16); const t = [n >> 16 & 255, n >> 8 & 255, n & 255]; return c && Math.abs(c[0] - t[0]) <= tol && Math.abs(c[1] - t[1]) <= tol && Math.abs(c[2] - t[2]) <= tol; };
const T = (expr) => ev(`window.SseudamTools.tier.__test.${expr}`);
const state = () => T('state()');

const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok, got }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const open = async (w, h, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  await Promise.race([p, sleep(10000)]); loaded = null;
  await waitFor(`!document.querySelector('#view .skel')`, 9000);
  await sleep(400);
};
const gotoTier = async () => {
  await ev(`window.scrollTo(0,0)`); await sleep(350);
  await click('.isl-tab[data-v="tools"]'); await sleep(700);
  await waitFor(`!!document.querySelector('#tbList .tb-item[data-t="tier"]')`, 8000);
  await click('#tbList .tb-item[data-t="tier"]'); await sleep(500);
  return waitFor(`!!document.querySelector('#tiCanvas')&&!!window.SseudamTools&&!!window.SseudamTools.tier.__test.layout()`, 8000);
};
/* 캔버스 y 가 보드 스테이지(내부 스크롤) 가운데 오게 */
const scrollCv = async (cy) => { await ev(`(()=>{const st=document.querySelector('.tier-stage'),c=document.getElementById('tiCanvas');const k=c.getBoundingClientRect().width/693;const top=c.getBoundingClientRect().top-st.getBoundingClientRect().top+st.scrollTop;st.scrollTop=Math.max(0,top+${cy}*k-st.clientHeight/2)})()`); await sleep(220); };
const cvToClient = async (x, y) => { const r = await rect('#tiCanvas'); const k = r.w / 693; return { x: r.x + x * k, y: r.y + y * k }; };

/* ══════════ 1920×1080 ══════════ */
console.log('\n[1920×1080]');
await open(1920, 1080, false);
await ev(`localStorage.removeItem('sseudam_tier_v2');localStorage.removeItem('sseudam_tier_v1')`);
chk('탭 4개', (await ev(`[...document.querySelectorAll('.isl-tab')].map(b=>b.dataset.v).join(',')`)) === 'home,posts,trend,tools');
const t0 = Date.now();
chk('도구함 진입 → 티어 도구 로드', await gotoTier(), { ms: Date.now() - t0 });
chk('도구 목록 2개 · 메타 «2 도구»', await ev(`[...document.querySelectorAll('#tbList .tb-item')].map(b=>b.dataset.t).join(',')==='thumb,tier'&&document.getElementById('pmeta').textContent.includes('2')`));
const rail = await ev(`(()=>{const tb=document.querySelector('.tb'),side=document.querySelector('.tb-side'),main=document.querySelector('.tb-main'),m=document.querySelector('.main');return{ml:getComputedStyle(tb).marginLeft,pos:getComputedStyle(side).position,top:getComputedStyle(side).top,sideRight:Math.round(side.getBoundingClientRect().right),mainLeft:Math.round(main.getBoundingClientRect().left),mainW:Math.round(main.getBoundingClientRect().width),contentW:m.clientWidth-48,contentLeft:Math.round(m.getBoundingClientRect().left)+24}})()`);
chk('≥1620: 도구 목록 = 본문 왼쪽 여백의 sticky 레일(margin -246 · sticky top 84)', rail && rail.ml === '-246px' && rail.pos === 'sticky' && rail.top === '84px', rail);
chk('≥1620: 도구 판 폭 = 작성 글·트렌드와 같은 본문 폭(1080) · 판 왼쪽 = 본문 왼쪽', rail && Math.abs(rail.mainW - rail.contentW) <= 1 && Math.abs(rail.mainLeft - rail.contentLeft) <= 1 && rail.sideRight <= rail.mainLeft, rail);
await T('reset()'); await sleep(350);
const s0 = await state();
chk('기본 보드 = S·A·B·C 4단계 · 빈 슬롯 14 · 프리셋 없음', s0 && s0.board.tiers.length === 4 && s0.board.tiers.map(t => t.letter).join('') === 'SABC' && s0.board.tiers.reduce((a, t) => a + t.items.length, 0) === 14 && !(await ev(`!!document.querySelector('#tiPresets')`)), s0 && s0.board.tiers.map(t => t.letter + t.items.length));
chk('기본 디자인 = 봄딩 · 색 자동 · 4열 · 둥근 사각 · 부제/순위 없음', s0.design.design === 'bomding' && s0.design.accent === 'auto' && s0.design.cols === 4 && s0.design.shape === 'round' && !(await ev(`!!document.querySelector('#tiSub')||!!document.querySelector('#tiOpts')`)), s0.design);
const L0 = await T('layout()');
chk('보드 논리 폭 693 · 캔버스 2배(1386) · 타일 135', s0.W === 693 && (await ev(`document.getElementById('tiCanvas').width`)) === 1386 && L0.tw === 135, { W: s0.W, tw: L0.tw });
const ws0 = await ev(`(()=>{const t=document.querySelector('.tier'),st=document.querySelector('.tier-stage'),ct=document.querySelector('.tier-ctl'),save=document.getElementById('tiSave').getBoundingClientRect(),cv=document.getElementById('tiCanvas').getBoundingClientRect(),core=document.querySelector('.tb-main .core');return{h:Math.round(t.getBoundingClientRect().height),so:getComputedStyle(st).overflowY,co:getComputedStyle(ct).overflowY,saveIn:save.top>0&&save.bottom<=innerHeight,cvW:Math.round(cv.width),pageScroll:document.documentElement.scrollHeight-innerHeight,tierW:Math.round(t.getBoundingClientRect().width),stageW:st.clientWidth,ctlW:ct.getBoundingClientRect().width,coreW:core.clientWidth,cols:getComputedStyle(t).gridTemplateColumns}})()`);
chk('작업대 = 뷰포트에 맞는 높이(866) · 보드/편집 열 내부 스크롤 · PNG 저장 버튼이 첫 화면에', ws0 && ws0.h === 866 && ws0.so === 'auto' && ws0.co === 'auto' && ws0.saveIn, ws0);
/* 본문 열은 1080 − 패딩 48 = 1032 → 코어 1020 → 편집 열 340 을 두면 보드 표시 폭은 648(실제 크기의 93%). 내보내기는 693 논리 그대로 */
chk('보드 표시 폭 ≥ 실제 크기의 92%(648/693)', ws0 && ws0.cvW >= 640 && ws0.cvW <= 693, ws0);
chk('제목 띠(플럼) 그려짐', near(await px(30, L0.hd.y + 10), '#2E2038', 18), await px(30, L0.hd.y + 10));
chk('S 플라크 = 로즈(농도 1.0)', near(await px(24 + 30, L0.bands[0].pl.y + 10), '#C93C7C', 18), await px(54, L0.bands[0].pl.y + 10));
chk('빈 슬롯 그려짐', (await cvVar(96, L0.bands[0].pl.y + 4, 135, 120)) > 0);
chk('검사 문구에 «양식»·«빈 슬롯 14»', await ev(`(()=>{const t=document.getElementById('tiChk').textContent;return t.includes('양식')&&t.includes('14')})()`), await ev(`document.getElementById('tiChk').textContent`));
await shot('01-tier-default-1920');

/* 제목 · 기준 · 서명 */
await setInput('#tiTitle', '쿠키런: 크럼블'); await setInput('#tiStamp', 'v1.2 패치 · 9.7 기준'); await sleep(300);
const s1 = await state();
chk('제목·기준 반영 · 서명은 비우면 디자인 이름(봄딩)', s1.board.title === '쿠키런: 크럼블' && s1.board.stamp === 'v1.2 패치 · 9.7 기준' && s1.board.sign === '' && (await ev(`document.getElementById('tiSign').placeholder`)) === '봄딩', s1.board);
chk('파일명 = <제목>_티어표.png', (await T('fileName()')) === '쿠키런_크럼블_티어표.png', await T('fileName()'));

/* 디자인 2종 */
await click('#tiDesign .chip[data-v="yeongdo"]'); await sleep(400);
const Ly = await T('layout()');
chk('영도 디자인 → 제목 띠 틸 · S 플라크 그린 · 서명 자리 «영도»', (await state()).design.design === 'yeongdo' && near(await px(30, Ly.hd.y + 10), '#0F7C86', 18) && near(await px(54, Ly.bands[0].pl.y + 10), '#15A05A', 18) && (await ev(`document.getElementById('tiSign').placeholder`)) === '영도', { band: await px(30, Ly.hd.y + 10), pl: await px(54, Ly.bands[0].pl.y + 10) });
/* 플라크 글자 대비(게이트 🔴 09-07): 티어 전부, 두 디자인, 7단계까지 ≥ 4.5:1 */
for (const dsg of ['yeongdo', 'bomding']) {
  await click(`#tiDesign .chip[data-v="${dsg}"]`); await sleep(250);
  for (let k = 0; k < 3; k++) { await click('#tiTierAdd'); await sleep(120); }
  const pq = await T('plaques()');
  chk(`${dsg} 7단계 플라크 글자 대비 전부 ≥ 4.5:1`, Array.isArray(pq) && pq.length === 7 && pq.every(p => p.contrast >= 4.5), pq);
  for (let k = 0; k < 3; k++) { const s = await state(); await click(`.tier-row[data-tid="${s.board.tiers[s.board.tiers.length - 1].id}"] [data-act="tierDel"]`); await sleep(120); }
  chk(`${dsg} 4단계 복귀`, (await state()).board.tiers.length === 4);
}
await click('#tiDesign .chip[data-v="yeongdo"]'); await sleep(250);
const pq4 = await T('plaques()');
chk('영도 기본 4단계: S 플라크 글자 = 대비가 큰 쪽(잉크 5.5:1 > 흰 3.38:1)', pq4 && pq4[0].text !== '#FFFFFF' && pq4[0].contrast >= 4.5 && pq4[1].contrast >= 4.5, pq4);
chk('영도 스와치 = 그린·민트·틸 3 + 팔레트 + 헥스칸', await ev(`(()=>{const s=[...document.querySelectorAll('#tiSws .tier-sw')].map(b=>b.dataset.c);return s.join(',')==='green,mint,teal,custom'&&!!document.getElementById('tiHex')})()`), await ev(`[...document.querySelectorAll('#tiSws .tier-sw')].map(b=>b.dataset.c).join(',')`));
await shot('02-tier-yeongdo-1920');
await click('#tiDesign .chip[data-v="bomding"]'); await sleep(400);
chk('봄딩 복귀 → 플럼 띠', near(await px(30, (await T('layout()')).hd.y + 10), '#2E2038', 18));

/* 헥스 입력 */
await ev(`document.getElementById('tiHex').focus()`);
await setInput('#tiHex', '#6B45C9'); await sleep(300);
const sh = await state();
chk('헥스 입력 → 기타 색 적용 · 플라크 색 바뀜', sh.design.accent === 'custom' && sh.design.accentHex === '#6B45C9' && near(await px(54, (await T('layout()')).bands[0].pl.y + 10), '#6B45C9', 18), { d: sh.design, pl: await px(54, (await T('layout()')).bands[0].pl.y + 10) });
await ev(`(()=>{const e=document.getElementById('tiHex');e.value='zzzzzz';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await sleep(200);   /* 타자 중(input 만) */
chk('잘못된 헥스 → 경고 링 · 값 유지', await ev(`document.getElementById('tiHex').classList.contains('bad')`) && (await state()).design.accentHex === '#6B45C9');
await ev(`(()=>{const e=document.getElementById('tiHex');e.blur();e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await sleep(200);   /* 사람이 타자 뒤 포커스를 옮기면 change 가 난다 — 프로그램 blur 는 change 를 안 내므로 직접 */
chk('blur → 유효값으로 정정', (await ev(`document.getElementById('tiHex').value`)) === '#6B45C9' && !(await ev(`document.getElementById('tiHex').classList.contains('bad')`)));
await click('#tiSws .tier-sw[data-c="rose"]'); await sleep(200);
chk('스와치 로즈 → accent rose', (await state()).design.accent === 'rose');

/* 타일 모양 5 · 한 줄 수 */
const shapes = await T('shapes');
chk('타일 모양 5종(둥근 사각·원·스쿼클·육각·세로 카드)', Array.isArray(shapes) && shapes.join(',') === 'round,circle,squircle,hex,card' && (await ev(`document.querySelectorAll('#tiShape .chip').length`)) === 5);
for (const sName of shapes) { await click(`#tiShape .chip[data-v="${sName}"]`); await sleep(160); }
const Lc = await T('layout()');
chk('세로 카드 → 타일 높이 = 폭×1.28', (await state()).design.shape === 'card' && Lc.th === Math.round(Lc.tw * 1.28), Lc);
await click('#tiShape .chip[data-v="circle"]'); await sleep(150);
chk('원 → 정사각', (await T('layout()')).th === (await T('layout()')).tw);
await click('#tiShape .chip[data-v="round"]'); await sleep(150);
await click('#tiCols .chip[data-v="3"]'); await sleep(200);
chk('3열 → 타일 184', (await T('layout()')).tw === 184, await T('layout()'));
await click('#tiCols .chip[data-v="6"]'); await sleep(200);
chk('6열 → 타일 87 · 폰 이름 경고', (await T('layout()')).tw === 87 && await ev(`(()=>{const li=[...document.querySelectorAll('#tiChk li')].find(l=>l.textContent.includes('폰 이름'));return !!li&&li.classList.contains('bad')})()`));
await click('#tiCols .chip[data-v="4"]'); await sleep(200);
chk('4열 복귀 · 폰 이름 9.9px 통과', (await T('layout()')).tw === 135 && await ev(`(()=>{const li=[...document.querySelectorAll('#tiChk li')].find(l=>l.textContent.includes('폰 이름'));return !!li&&!li.classList.contains('bad')&&li.textContent.includes('9.9')})()`), await ev(`document.getElementById('tiChk').textContent`));

/* 항목 추가 — 쉼표 */
await click('#tiNew'); await setInput('#tiNew', '아델, 카데나, 제로'); await key('Enter', 13, '\r'); await sleep(350);
const s2 = await state();
chk('쉼표 3개 → S 티어 3+3=6 · 마지막 선택', s2.board.tiers[0].items.length === 6 && s2.board.tiers[0].items.slice(3).map(i => i.name).join(',') === '아델,카데나,제로' && s2.sel === s2.board.tiers[0].items[5].id, s2.board.tiers[0].items.map(i => i.name));
const hits1 = await T('hits()');
const adel = hits1.find(h => h.i === 3 && h.ti === 0);
chk('모노그램 타일(아델) 그려짐 · 순위 배지 없음(모서리 = 슬롯색)', adel && (await cvVar(adel.x + 10, adel.y + 10, adel.w - 20, adel.h - 20)) > 0 && near(await px(adel.x + 14, adel.y + 14), '#F8F1F4', 12), { adel, corner: adel && await px(adel.x + 14, adel.y + 14) });
chk('편집 열 행 = 17개 · 아델 행 모노그램', await ev(`(()=>{const rows=[...document.querySelectorAll('.tier-it')];const r=rows.find(x=>x.querySelector('input').value==='아델');return rows.length===17&&!!r&&r.querySelector('.tier-th').textContent.trim()==='아'})()`), await ev(`document.querySelectorAll('.tier-it').length`));
await shot('03-tier-items-1920');

/* ▲▼ · 셀렉트 */
const zeroId = s2.board.tiers[0].items[5].id;
await click('.tier-it[data-id="' + zeroId + '"] [data-act="down"]'); await sleep(300);
chk('S 마지막 ▼ → A 첫', (await state()).board.tiers[1].items[0].id === zeroId);
await click('.tier-it[data-id="' + zeroId + '"] [data-act="up"]'); await sleep(300);
chk('A 첫 ▲ → S 마지막', (await state()).board.tiers[0].items[5].id === zeroId);
await setInput('.tier-it[data-id="' + zeroId + '"] .tier-sel', '2'); await sleep(300);
chk('셀렉트 B → B 마지막', (await state()).board.tiers[2].items.slice(-1)[0].id === zeroId);

/* 캔버스 드래그 — 카데나 → C 첫 자리 (보드 스테이지 내부 스크롤) */
const cadId = (await state()).board.tiers[0].items[4].id;
let hits2 = await T('hits()');
const cad = hits2.find(h => h.id === cadId), cB = (await T('layout()')).bands[3];
await scrollCv((cad.y + cB.y) / 2);
const from = await cvToClient(cad.x + cad.w / 2, cad.y + cad.h / 2);
const to = await cvToClient(96 + 10, cB.pl.y + 40);
chk('드래그 시작·끝점이 뷰포트 안', from.y > 60 && to.y < 1070, { from, to });
await mouse('mouseMoved', from.x, from.y); await press(from.x, from.y);
for (let i = 1; i <= 8; i++) { await dragTo(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8); await sleep(40); }
await sleep(120);
chk('드래그 중 grabbing', await ev(`document.getElementById('tiCanvas').classList.contains('drag')`));
await shot('04-tier-dragging-1920');
await release(to.x, to.y); await sleep(350);
const s5 = await state();
chk('캔버스 드래그 → 카데나 = C 첫 자리 · 선택', s5.board.tiers[3].items[0].id === cadId && s5.sel === cadId && s5.board.tiers[0].items.length === 4, { c: s5.board.tiers[3].items.map(i => i.name) });
hits2 = await T('hits()');
const first = hits2[0]; await scrollCv(first.y);
const c1 = await cvToClient(first.x + first.w / 2, first.y + first.h / 2);
await mouse('mouseMoved', c1.x, c1.y); await press(c1.x, c1.y); await release(c1.x, c1.y); await sleep(250);
chk('타일 클릭 → 선택', (await state()).sel === first.id);
await press(c1.x, c1.y); await release(c1.x, c1.y); await sleep(250);
chk('다시 클릭 → 해제', (await state()).sel === null);

/* 티어 추가/삭제 · 빈 티어 «+» */
await click('#tiTierAdd'); await sleep(300);
const sE = await state(), eTi = sE.board.tiers.length - 1, eBand = (await T('layout()')).bands[eTi];
chk('티어 추가 → 5단계 · 글자 D · 빈 티어 자리 1개', sE.board.tiers.length === 5 && sE.board.tiers[eTi].letter === 'D' && eBand.tiles === 0);
await scrollCv(eBand.pl.y + 40);
const eP = await cvToClient(96 + 60, eBand.pl.y + 60);
await mouse('mouseMoved', eP.x, eP.y); await sleep(80);
chk('빈 티어 자리 위 커서 add', await ev(`document.getElementById('tiCanvas').classList.contains('add')`));
await press(eP.x, eP.y); await release(eP.x, eP.y); await sleep(300);
chk('빈 티어 자리 클릭 → 슬롯 추가', (await state()).board.tiers[eTi].items.length === 1);
await click('.tier-row[data-tid="' + sE.board.tiers[eTi].id + '"] [data-act="tierDel"]'); await sleep(300);
chk('티어 삭제 → 4단계 · 토스트 되돌리기', (await state()).board.tiers.length === 4 && await ev(`!!document.querySelector('.toast.on .toast-act')`));
await click('.toast.on .toast-act'); await sleep(350);
chk('되돌리기 → 5단계', (await state()).board.tiers.length === 5);
await click('.tier-row[data-tid="' + sE.board.tiers[eTi].id + '"] [data-act="tierDel"]'); await sleep(300);
chk('정리 → 4단계', (await state()).board.tiers.length === 4);

/* 리소스 서랍 */
await click('#tiResOpen'); await sleep(200);
await waitFor(`document.querySelectorAll('#tiResG .tier-rc').length>0`, 8000);
const rs = await ev(`(()=>{const sel=document.getElementById('tiResB');return{hidden:document.getElementById('tiRes').hidden,opts:[...sel.options].map(o=>o.textContent),cards:document.querySelectorAll('#tiResG .tier-rc').length,chips:[...document.querySelectorAll('#tiResF .chip')].map(c=>c.textContent.trim()),firstImgW:document.querySelector('#tiResG .tier-rc img').getBoundingClientRect().width}})()`);
chk('리소스 서랍 열림 · 쿠키런: 크럼블 26 · 카드 26 · 희귀도 칩', rs && !rs.hidden && rs.opts.length === 1 && rs.opts[0].includes('쿠키런: 크럼블') && rs.cards === 26 && rs.chips.length === 3 && rs.firstImgW === 64, rs);
await shot('05-tier-resources-1920');
await click('#tiResF .chip[data-r="TSSR"]'); await sleep(300);
chk('TSSR 필터 → 3장', (await ev(`document.querySelectorAll('#tiResG .tier-rc').length`)) === 3);
await click('#tiResG .tier-rc[data-c="cookie4012"]'); await sleep(500);
const sr = await state();
const ovIt = sr.board.tiers.flatMap(t => t.items).find(i => i.res && i.res.c === 'cookie4012');
chk('카드 클릭 → «넣을 티어»에 오븐방랑자 추가(res 참조) · 카드 used', !!ovIt && ovIt.name === '오븐방랑자 쿠키' && await ev(`document.querySelector('#tiResG .tier-rc[data-c="cookie4012"]').classList.contains('used')`), ovIt);
chk('리소스 그림 로드', await waitFor(`window.SseudamTools.tier.__test.state().images>=1`, 6000));
/* 끌어 놓기: 바람궁수 → S 티어 첫 자리 */
const cardR = await rect('#tiResG .tier-rc[data-c="cookie0070"]');
const LS0 = await T('layout()'); await scrollCv(LS0.bands[0].pl.y + 40);
const dropP = await cvToClient(96 + 20, LS0.bands[0].pl.y + 50);
await mouse('mouseMoved', cardR.cx, cardR.cy); await press(cardR.cx, cardR.cy);
for (let i = 1; i <= 10; i++) { await dragTo(cardR.cx + (dropP.x - cardR.cx) * i / 10, cardR.cy + (dropP.y - cardR.cy) * i / 10); await sleep(40); }
await sleep(120);
chk('서랍에서 끌면 고스트 + 보드 over', await ev(`!!document.querySelector('.tier-ghost')&&document.getElementById('tiCv').classList.contains('over')`));
await shot('06-tier-res-drag-1920');
await release(dropP.x, dropP.y); await sleep(500);
const sd = await state();
chk('놓기 → S 첫 자리 = 바람궁수(res)', sd.board.tiers[0].items[0].res && sd.board.tiers[0].items[0].res.c === 'cookie0070' && sd.board.tiers[0].items[0].name === '바람궁수 쿠키', sd.board.tiers[0].items.slice(0, 2));
chk('고스트 제거 · over 해제', !(await ev(`!!document.querySelector('.tier-ghost')||document.getElementById('tiCv').classList.contains('over')`)));
chk('그림 2장 로드', await waitFor(`window.SseudamTools.tier.__test.state().images>=2`, 6000));
await click('#tiResBack'); await sleep(200);
chk('돌아가기 → 서랍 닫힘', await ev(`document.getElementById('tiRes').hidden`));
const h0 = (await T('hits()')).find(h => h.id === sd.board.tiers[0].items[0].id);
chk('리소스 타일 그려짐(분산 큼)', h0 && (await cvVar(h0.x + 10, h0.y + 10, h0.w - 20, h0.h - 20)) > 150);
await shot('07-tier-with-res-1920');

/* PNG 2배 · 내보내기에 선택 링 없음 · JSON */
const dims = await ev(`new Promise(r=>{const i=new Image();i.onload=()=>r([i.naturalWidth,i.naturalHeight]);i.src=window.SseudamTools.tier.__test.dataURL()})`);
const Lx = await T('layout()');
chk('내보내기 PNG = 1386 × H×2', dims && dims[0] === 1386 && dims[1] === Lx.H * 2, { dims, H: Lx.H });
const du = await T('dataURL()');
if (typeof du === 'string') writeFileSync(join(OUT, 'board-export.png'), Buffer.from(du.slice(22), 'base64'));
chk('내보내기에 선택 링 없음', await ev(`(()=>{const t=window.SseudamTools.tier.__test;const s=t.state();const id=s.board.tiers[0].items[0].id;t.select(id);const on=document.getElementById('tiCanvas').toDataURL();const ex=t.dataURL();t.select(null);return on!==ex})()`));
const blob = await T('blob()');
chk('PNG blob(≥ 40KB)', blob && blob.type === 'image/png' && blob.size > 40000, blob);
chk('localStorage v2 저장 · res 참조 포함', await ev(`(()=>{try{const s=JSON.parse(localStorage.getItem('sseudam_tier_v2'));return s&&s.v===2&&s.board.title==='쿠키런: 크럼블'&&s.board.tiers.some(t=>t.items.some(i=>i.res&&i.res.b==='cookierun-crumble'))}catch(e){return false}})()`));

/* 라벨 · 포커스 · 히트존 · 칩 */
const small = await ev(`(()=>{const q=[...document.querySelectorAll('.tier *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));return q.map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(v=>v<12.5)})()`);
chk('도구 안 글자 12.5px 미만 0개', small.length === 0, small);
await ev(`document.querySelector('.tier-it .tier-in').focus()`); await sleep(450);
chk('행 입력 포커스 링 2px 잉크', await ev(`getComputedStyle(document.activeElement).boxShadow.includes('0px 0px 0px 2px')`), await ev(`getComputedStyle(document.activeElement).boxShadow`));
await ev(`document.activeElement.blur()`);
const ov = await ev(`(()=>{const ex=6;const bs=[...document.querySelectorAll('.tier-ib')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return{l:r.left-ex,t:r.top-ex,r:r.right+ex,b:r.bottom+ex}});let n=0;for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],c=bs[j];const w=Math.min(a.r,c.r)-Math.max(a.l,c.l),h=Math.min(a.b,c.b)-Math.max(a.t,c.t);if(w>0&&h>0)n++;}return{n,count:bs.length}})()`);
chk('아이콘 버튼 히트존(±6) 겹침 0', ov && ov.n === 0 && ov.count > 20, ov);
chk('칩 = 사이트 기본 32px', await ev(`getComputedStyle(document.querySelector('#tiCols .chip')).height==='32px'`));

/* 탭 이탈 → 복귀 · 새로고침 뒤 res 그림 복원 */
const sLeave = await state();
await ev(`window.scrollTo(0,0)`); await click('.isl-tab[data-v="home"]'); await sleep(800);
chk('홈으로 → 도구 DOM 제거', !(await ev(`!!document.querySelector('.tier')`)));
await ev(`window.scrollTo(0,0)`); await click('.isl-tab[data-v="tools"]'); await sleep(900);
chk('복귀 → 티어 도구 그대로', await waitFor(`!!document.querySelector('#tiCanvas')&&document.querySelector('#tbList .tb-item.on').dataset.t==='tier'`, 6000));
const s8 = await state();
chk('복귀 후 보드·그림 유지', JSON.stringify(s8.board) === JSON.stringify(sLeave.board) && s8.images >= 2, { img: s8.images });
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);
logs = [];
await open(1920, 1080, false); chk('새로고침 → 티어 도구', await gotoTier());
chk('새로고침 뒤 리소스 항목 그림 복원(2장)', await waitFor(`window.SseudamTools.tier.__test.state().images>=2`, 8000), await state().then(s => s.images));
chk('[1920 재로드] 콘솔 예외 0', logs.length === 0, logs);

/* ══════════ 1366×768 ══════════ */
console.log('\n[1366×768]');
logs = [];
await open(1366, 768, false);
chk('도구함 진입(1366)', await gotoTier());
const rail2 = await ev(`(()=>{const tb=document.querySelector('.tb'),side=document.querySelector('.tb-side');return{ml:getComputedStyle(tb).marginLeft,pos:getComputedStyle(side).position,cols:getComputedStyle(tb).gridTemplateColumns.split(' ').length}})()`);
chk('1366: 레일 없음 · 목록이 열 안에 나란히(2열)', rail2 && rail2.ml === '0px' && rail2.pos !== 'sticky' && rail2.cols === 2, rail2);
chk('1366 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth+1`));
await shot('08-tier-1366');
chk('[1366] 콘솔 예외 0', logs.length === 0, logs);

/* ══════════ 390×844 ══════════ */
console.log('\n[390×844]');
logs = [];
await open(390, 844, true);
chk('도구함 진입(모바일)', await gotoTier());
chk('모바일 단일 열', (await ev(`getComputedStyle(document.querySelector('.tier')).gridTemplateColumns.split(' ').length`)) === 1);
chk('모바일 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth+1`), await ev(`document.documentElement.scrollWidth`));
chk('캔버스 폭 ≤ 390 · pan-y', await ev(`(()=>{const c=document.getElementById('tiCanvas');return c.getBoundingClientRect().width<=390&&getComputedStyle(c).touchAction==='pan-y'})()`));
const tapMin = await ev(`(()=>{const q=[...document.querySelectorAll('.tier-sw,.tier-th,.tier-ib,#tiAdd,#tiSave,#tiCopy,#tiJson,#tiLoad,#tiClear,#tiTierAdd,#tiResOpen,.chip')].filter(e=>e.offsetParent);return Math.min(...q.map(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e,'::after');const pad=cs.content!=='none'&&cs.inset!=='auto'?12:0;return Math.min(r.width,r.height)+pad}))})()`);   /* 보이는 것만(숨긴 서랍 안 버튼은 0) */
chk('모바일 터치 타깃 ≥ 28', tapMin >= 28, { tapMin });
const thHit = await ev(`(()=>{const e=document.querySelector('.tier-th');const r=e.getBoundingClientRect();const cs=getComputedStyle(e,'::after');const m=(cs.inset||'').split(' ').map(v=>Math.abs(parseFloat(v))||0);const t=m[0]||0,rr=m[1]!==undefined?m[1]:t,b=m[2]!==undefined?m[2]:t,l=m[3]!==undefined?m[3]:rr;return{w:r.width+l+rr,h:r.height+t+b,inset:cs.inset}})()`);
chk('항목 그림 버튼 히트존 ≥ 40×40(오른쪽 입력칸 쪽은 안 넓힘)', thHit && thHit.w >= 40 && thHit.h >= 40, thHit);
await shot('09-tier-390');
await click('#tiResOpen'); await sleep(300); await waitFor(`document.querySelectorAll('#tiResG .tier-rc').length>0`, 8000);
chk('모바일 리소스 서랍(정적 배치) 카드 보임', (await ev(`document.querySelectorAll('#tiResG .tier-rc').length`)) === 26 && await ev(`getComputedStyle(document.getElementById('tiRes')).position==='static'`));
await shot('10-tier-390-res');
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch {}
chrome.kill(); srv.close();
process.exit(fail ? 1 : 0);
