// verify-table.mjs — 도구함 「표 제작」(_toolbox/table.js) 헤드리스 검증 (2026-09-12 · v1 봄딩 스크랩북 표)
//   node _tools/verify-table.mjs [--out DIR]
//   · verify-tier.mjs 와 같은 하네스(로컬 정적 서버 + 크롬 헤드리스 CDP, 의존성 0). 축하 스플래시 ?cheer=0, 라이브 백엔드 차단.
//   · 그림은 리포지토리 안 실파일(봄딩 아기 서큘레이터 img · 티어표 쿠키 리소스) — 합성 드롭(DataTransfer)·파일 선택·붙여넣기·CDP 실제 파일 끌어 놓기 4경로.
//   · 1920×1080: 목록·넓은 작업 영역 → 기본 보드·봄딩 픽셀 → 칸 위 편집(실제 마우스·Tab·Enter 줄바꿈·Esc·방향키) → «+» 열/행 → 편집 열(추가·이동·삭제·되돌리기·너비)
//               → 그림 4경로·지우기 되돌리기 → 크기·틀·맞춤·글자 크기·잘린 글 → 헥스 → PNG 2배(화면 표시 없음) → JSON 왕복(그림 포함·id 새로) → 새로고침 복원(IndexedDB)
//               → 라벨·포커스·히트존 → 탭 이탈/복귀 → 콘솔 0
//   · 1366×768: 판 1072 · 편집 열 340 · 넘침 0   · 390×844: 단일 열 · 넘침 0 · 터치 탭 편집 · 터치 타깃 · 콘솔 0
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
const OUT = val('--out', join(tmpdir(), '_table-out'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
/* 시험 그림 — 리포지토리 실파일(URL 은 서버 경로, FILE 은 CDP 실제 끌어 놓기용 디스크 경로) */
const CIRC = ['lumena_fangrande2.jpg', 'shinil_tw80t.jpg', 'vornado_633dc.jpg', 'xiaomi_bplds06dm.jpg'];
const CURL = (i) => encodeURI('/봄딩/아기 서큘레이터/img/' + CIRC[i]);
const CFILE = (i) => join(ROOT, '봄딩', '아기 서큘레이터', 'img', CIRC[i]);

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
const prof = join(tmpdir(), `_tableprof${port}`);
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
const tap = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, { buttons: 1 }); await mouse('mouseReleased', x, y, { buttons: 0 }); await sleep(160); };
const click = async (sel) => {
  await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e&&!e.closest('.back'))e.scrollIntoView({block:'center'});return true})()`);
  await sleep(120);
  const r = await rect(sel); if (!r) return false;
  await tap(r.cx, r.cy);
  return true;
};
const key = async (k, vk, opt = {}) => {
  const p = { type: 'keyDown', key: k, code: opt.code || k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: opt.mod || 0 }; if (opt.text) { p.text = opt.text; p.unmodifiedText = opt.text; }
  await send('Input.dispatchKeyEvent', p);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: opt.code || k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: opt.mod || 0 });
  await sleep(160);
};
const typeText = async (t) => { await send('Input.insertText', { text: t }); await sleep(160); };
const setInput = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return v; await sleep(120); } return null; };
/* 캔버스(논리 693 좌표) 픽셀 — 2배 캔버스라 ×2 */
const px = (x, y) => ev(`(()=>{const c=document.getElementById('tblCanvas');const d=c.getContext('2d').getImageData(Math.round(${x}*2),Math.round(${y}*2),1,1).data;return [d[0],d[1],d[2]]})()`);
const cvVar = (x, y, w, h) => ev(`(()=>{const c=document.getElementById('tblCanvas');if(!c)return -1;const d=c.getContext('2d').getImageData(Math.round(${x}*2),Math.round(${y}*2),Math.round(${w}*2),Math.round(${h}*2)).data;let s=0,s2=0,n=0;for(let i=0;i<d.length;i+=16){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return Math.round(s2/n-m*m)})()`);
/* 내보내기 PNG(논리 좌표) 픽셀 — dataURL 을 그려서 읽는다 */
const expPx = (pts) => ev(`new Promise(r=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);r(${JSON.stringify(pts)}.map(p=>{const d=x.getImageData(Math.round(p[0]*2),Math.round(p[1]*2),1,1).data;return [d[0],d[1],d[2]]}))};i.src=window.SseudamTools.table.__test.dataURL()})`);
const near = (c, hex, tol = 14) => { const n = parseInt(hex.slice(1), 16); const t = [n >> 16 & 255, n >> 8 & 255, n & 255]; return !!c && Array.isArray(c) && Math.abs(c[0] - t[0]) <= tol && Math.abs(c[1] - t[1]) <= tol && Math.abs(c[2] - t[2]) <= tol; };
const T = (expr) => ev(`window.SseudamTools.table.__test.${expr}`);
const state = () => T('state()');
const lay = () => T('layout()');

const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok, got }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const open = async (w, h, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); else await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/index.html?cheer=0` });
  await Promise.race([p, sleep(10000)]); loaded = null;
  await waitFor(`!document.querySelector('#view .skel')`, 9000);
  await sleep(400);
};
const gotoTable = async () => {
  await ev(`window.scrollTo(0,0)`); await sleep(350);
  await click('.isl-tab[data-v="tools"]'); await sleep(700);
  await waitFor(`!!document.querySelector('#tbList .tb-item[data-t="table"]')`, 8000);
  await click('#tbList .tb-item[data-t="table"]'); await sleep(500);
  return waitFor(`!!document.querySelector('#tblCanvas')&&!!window.SseudamTools&&!!window.SseudamTools.table&&!!window.SseudamTools.table.__test.layout()`, 8000);
};
/* 논리 y 가 보드 스테이지(내부 스크롤) 가운데 오게 → 그 점의 화면 좌표 */
const scrollCv = async (cy) => { await ev(`(()=>{const st=document.querySelector('.tbl-stage'),c=document.getElementById('tblCanvas');const k=c.getBoundingClientRect().width/693;const top=c.getBoundingClientRect().top-st.getBoundingClientRect().top+st.scrollTop;st.scrollTop=Math.max(0,top+${cy}*k-st.clientHeight/2);window.scrollTo(0,Math.max(0,c.getBoundingClientRect().top+scrollY+${cy}*k-innerHeight/2))})()`); await sleep(220); };
const cvToClient = async (x, y) => { const r = await rect('#tblCanvas'); const k = r.w / 693; return { x: r.x + x * k, y: r.y + y * k }; };
const at = async (x, y) => { await scrollCv(y); return cvToClient(x, y); };
/* 칸 가운데(논리) — kind: head / label / cell / img */
const spot = async (kind, ri, ci) => {
  const L = await lay();
  if (kind === 'head') { const h = L.head[ci]; return { x: h.x + h.w / 2, y: h.y + h.h / 2 }; }
  const r = L.rows[ri];
  if (kind === 'img') return { x: r.img.x + r.img.w / 2, y: r.img.y + r.img.h / 2 };
  if (kind === 'label') return { x: r.lab.x + r.lab.w / 2, y: r.lab.y + r.lab.h / 2 };
  const c = r.cells[ci - 1]; return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
};
const clickSpot = async (kind, ri, ci) => { const s = await spot(kind, ri, ci); const p = await at(s.x, s.y); await tap(p.x, p.y); await sleep(120); return p; };
/* 합성 파일 드롭 — 실제 브라우저 DragEvent + DataTransfer(File) 를 그 화면 좌표의 요소에 보낸다 */
const dropFiles = (list, x, y) => ev(`(async()=>{const dt=new DataTransfer();for(const [u,n] of ${JSON.stringify(list)}){const b=await (await fetch(u)).blob();dt.items.add(new File([b],n,{type:b.type||'image/jpeg'}));}const el=document.elementFromPoint(${x},${y});if(!el)return 'no-el';const o={bubbles:true,cancelable:true,clientX:${x},clientY:${y},dataTransfer:dt};el.dispatchEvent(new DragEvent('dragenter',o));el.dispatchEvent(new DragEvent('dragover',o));el.dispatchEvent(new DragEvent('drop',o));return el.id||el.className||el.tagName})()`);

/* ══════════ 1920×1080 ══════════ */
console.log('\n[1920×1080]');
await open(1920, 1080, false);
await ev(`localStorage.removeItem('sseudam_table_v1')`);
await ev(`new Promise(r=>{const q=indexedDB.deleteDatabase('sseudam-table');q.onsuccess=q.onerror=q.onblocked=()=>r(true)})`);
chk('탭 4개', (await ev(`[...document.querySelectorAll('.isl-tab')].map(b=>b.dataset.v).join(',')`)) === 'home,posts,trend,tools');
const t0 = Date.now();
chk('도구함 진입 → 표 도구 로드', await gotoTable(), { ms: Date.now() - t0 });
const list = await ev(`(()=>{const it=[...document.querySelectorAll('#tbList .tb-item')];const on=document.querySelector('#tbList .tb-item.on');return{ids:it.map(b=>b.dataset.t).join(','),on:on&&on.dataset.t,name:on&&on.textContent.trim(),meta:document.getElementById('pmeta').textContent,svg:!!(on&&on.querySelector('svg rect'))}})()`);
const toolIds = list ? list.ids.split(',') : [];
chk('도구 목록에 썸네일·티어표·표가 있음 · «표 제작» 선택 · 메타 = 도구 수 · 표 아이콘', !!list && ['thumb', 'tier', 'table'].every(t => toolIds.includes(t)) && list.on === 'table' && list.name === '표 제작' && list.meta.includes(String(toolIds.length)) && list.svg, list);   /* 순서·개수 고정 금지 — 09-12 «이미지 편집» 세션이 photo 를 table 앞에 넣는다(thumb, tier, photo, table) */
const rail = await ev(`(()=>{const side=document.querySelector('.tb-side'),main=document.querySelector('.tb-main'),m=document.querySelector('.main');return{wide:m.classList.contains('wide'),mW:Math.round(m.getBoundingClientRect().width),pos:getComputedStyle(side).position,sideW:Math.round(side.getBoundingClientRect().width),panelW:Math.round(main.getBoundingClientRect().width)}})()`);
chk('도구함 넓은 작업 영역(1620) · 레일 sticky 232 · 판 1326', rail && rail.wide && rail.mW === 1620 && rail.pos === 'sticky' && rail.sideW === 232 && rail.panelW === 1326, rail);
const wb = await ev(`(()=>{const t=document.querySelector('.tbl'),st=document.querySelector('.tbl-stage'),ct=document.querySelector('.tbl-ctl'),save=document.getElementById('tblSave').getBoundingClientRect(),cv=document.getElementById('tblCanvas').getBoundingClientRect();return{h:Math.round(t.getBoundingClientRect().height),so:getComputedStyle(st).overflowY,co:getComputedStyle(ct).overflowY,saveIn:save.top>0&&save.bottom<=innerHeight,cvW:Math.round(cv.width),ctlW:Math.round(ct.getBoundingClientRect().width)}})()`);
chk('작업대 = 뷰포트 높이(866) · 보드/편집 열 내부 스크롤 · PNG 저장 첫 화면', wb && wb.h === 866 && wb.so === 'auto' && wb.co === 'auto' && wb.saveIn, wb);
chk('보드 실제 크기 693 · 편집 열 400', wb && wb.cvW === 693 && wb.ctlW === 400, wb);
await T('reset()'); await sleep(350);
const s0 = await state(), L0 = await lay();
chk('기본 보드 = 열 2(그림 열 + 글 열) · 행 3 · 제목 없음(태그 안 그림)', s0.board.cols.length === 2 && s0.board.rows.length === 3 && s0.board.title === '' && !L0.hd, { cols: s0.board.cols.length, rows: s0.board.rows.length, hd: L0.hd });
chk('기본 디자인 = 로즈 · 그림 보통 · 폴라로이드 · 채우기 · 글자 19px', s0.design.accent === 'rose' && s0.design.size === 'm' && s0.design.shape === 'polaroid' && s0.design.fit === 'cover' && s0.design.fs === 19, s0.design);
chk('보드 논리 폭 693 · 캔버스 2배(1386)', s0.W === 693 && (await ev(`document.getElementById('tblCanvas').width`)) === 1386);
chk('머리 띠 = 로즈', near(await px(L0.xs[1] + 14, L0.card.y + L0.card.headH - 8), '#C93C7C', 16), await px(L0.xs[1] + 14, L0.card.y + L0.card.headH - 8));
chk('사진 열 = 포인트 색을 옅게 깐 틴트', near(await px(L0.xs[0] + 8, L0.rows[0].y + 8), '#FBEFF5', 6), await px(L0.xs[0] + 8, L0.rows[0].y + 8));
chk('글 칸 = 흰 종이', near(await px(L0.xs[1] + 30, L0.rows[0].y + 30), '#FFFFFF', 3), await px(L0.xs[1] + 30, L0.rows[0].y + 30));
chk('모눈 바탕(격자선)', await ev(`(()=>{const L=window.SseudamTools.table.__test.layout();const c=document.getElementById('tblCanvas').getContext('2d');const y=Math.round((L.ft.y+8)*2);let seen=0;for(let x=60;x<600;x++){const d=c.getImageData(x,y,1,1).data;if(d[0]>240&&d[1]<246&&d[1]>225)seen++;}return seen>0})()`));
const sig0 = L0.ft.sig, cardB0 = L0.card.y + L0.card.h;
chk('시그니처 스티커 = 오른쪽 아래 · 카드 모서리에 걸침', !!sig0 && sig0.x + sig0.w <= 693 - 6 && sig0.y < cardB0 && sig0.y + sig0.h > cardB0, { sig: sig0, cardB: cardB0 });
const sigVar = sig0 ? await cvVar(sig0.x + 4, sig0.y + 4, sig0.w - 8, sig0.h - 8) : -1;   /* 한 점 대신 상자 분산 — 가운데 점은 흰 클립보드에 떨어져 바탕과 같았다(09-12) */
chk('시그니처 스티커가 실제로 그려짐(상자 분산 큼)', sigVar > 600, sigVar);
const r0 = L0.rows[0], ix = r0.img.x + r0.img.w / 2 - Math.round(r0.img.w * .3) / 2, iy = r0.img.y + r0.img.h / 2;
const scrSlot = await px(ix, iy), [expSlot] = await expPx([[ix, iy]]);
chk('빈 그림 자리(점선·아이콘)는 화면에만 — PNG 에는 틴트만', !near(scrSlot, '#FBEFF5', 10) && near(expSlot, '#FBEFF5', 6), { scrSlot, expSlot });
const chkText = await ev(`document.getElementById('tblChk').textContent`);
chk('검사 칩 = 열 2·행 3 · 그림 없음 3 · 빈 칸 8 · 폰 글자 9.9px', /열 2 · 행 3/.test(chkText) && chkText.includes('그림 없음 3') && chkText.includes('빈 칸 8') && chkText.includes('9.9'), chkText);
await shot('01-table-default-1920');
/* 제목 · 기준 · 서명 */
await setInput('#tblTitle', '아기 서큘레이터 4종 비교'); await sleep(300);
const L1 = await lay();
chk('제목 입력 → 종이 태그 그림 · 표가 그만큼 내려감', !!L1.hd && L1.card.y > L0.card.y && near(await px(346, L1.hd.y + 12), '#FFFFFF', 8), { hd: L1.hd, cardY: [L0.card.y, L1.card.y], px: await px(346, L1.hd.y + 12) });
chk('파일명 = <제목>_표.png', (await T('fileName()')) === '아기_서큘레이터_4종_비교_표.png', await T('fileName()'));
await setInput('#tblNote', '9월 쿠팡가 기준'); await sleep(250);
const L2 = await lay();
const noteVar = await cvVar(L2.x0, L2.ft.y + 10, 180, L2.ft.h - 20);
chk('기준·출처 → 바닥 왼쪽에 글자', noteVar > 150, noteVar);
chk('서명을 비우면 «봄딩»', (await ev(`document.getElementById('tblSign').placeholder`)) === '봄딩' && (await state()).board.sign === '');

/* 칸 위 편집 — 실제 마우스로 누른다 */
const pH = await clickSpot('head', 0, 1);
const ed1 = await ev(`(()=>{const t=document.getElementById('tblEd');const r=t.getBoundingClientRect();return{hidden:t.hidden,focus:document.activeElement===t,x:r.left,y:r.top,w:r.width,h:r.height,ph:t.placeholder}})()`);
const edS1 = (await state()).editing;
chk('머리 칸 클릭 → 그 자리에 입력칸(포커스 · 자리표시 «열 이름»)', ed1 && !ed1.hidden && ed1.focus && edS1 && edS1.kind === 'head' && ed1.ph === '열 이름' && Math.abs(ed1.x + ed1.w / 2 - pH.x) < 30 && Math.abs(ed1.y + ed1.h / 2 - pH.y) < 30, { ed1, edS1, pH });
await typeText('가격');
chk('타자 → 열 이름 반영 · 편집 열 입력칸 동기', (await state()).board.cols[1].name === '가격' && (await ev(`document.querySelector('#tblCols .tbl-col:nth-child(2) [data-f="name"]').value`)) === '가격');
await key('Tab', 9);
const st2 = await state();
chk('Tab → 다음 칸(1행 이름) 편집', !!st2.editing && st2.editing.kind === 'label' && st2.editing.rid === st2.board.rows[0].id, st2.editing);
await typeText('루메나 팬그란데2');
await key('Tab', 9); await typeText('8만 원대');
const st3 = await state();
chk('Tab → 1행 글 칸 · 두 값 반영', st3.board.rows[0].label === '루메나 팬그란데2' && st3.board.rows[0].cells[st3.board.cols[1].id] === '8만 원대', st3.board.rows[0]);
await key('Enter', 13, { text: '\r' }); await typeText('(9월 기준)');
const st4 = await state(), L4 = await lay();
chk('Enter = 칸 안 줄바꿈(네이버 표와 같은 손버릇) · 2줄로 그림', /8만 원대\n\(9월 기준\)/.test(st4.board.rows[0].cells[st4.board.cols[1].id] || '') && L4.rows[0].cells[0].lines === 2, { v: st4.board.rows[0].cells[st4.board.cols[1].id], lines: L4.rows[0].cells[0].lines });
const ed2 = await ev(`document.getElementById('tblEd').getBoundingClientRect().height`);
chk('입력칸이 2줄 높이로 따라 자람', ed2 >= 2 * L4.lh - 2, { h: ed2, lh: L4.lh });
await key('Escape', 27);
const st5 = await state();
chk('Esc → 편집 끝 · 캔버스로 포커스 · 값 유지', !st5.editing && (await ev(`document.activeElement===document.getElementById('tblCanvas')&&document.getElementById('tblEd').hidden`)) && /\(9월 기준\)/.test(st5.board.rows[0].cells[st5.board.cols[1].id] || ''), st5.editing);
await key('ArrowDown', 40);
const st6 = await state();
chk('방향키 ↓ → 현재 칸 = 2행 같은 열', !!st6.cur && st6.cur.rid === st6.board.rows[1].id && st6.cur.cid === st6.board.cols[1].id, st6.cur);
await key('ArrowLeft', 37); await key('Enter', 13, { text: '\r' });
const st7 = await state();
chk('← 뒤 Enter → 2행 이름 편집', !!st7.editing && st7.editing.kind === 'label' && st7.editing.rid === st7.board.rows[1].id, st7.editing);
await typeText('신일 TW80T'); await key('Escape', 27);
await clickSpot('cell', 1, 1); await typeText('5만 원대');
await clickSpot('head', 0, 0); await typeText('제품');
const st8 = await state();
chk('칸에서 칸으로 클릭 이동 → 둘 다 반영(편집이 끊기지 않음)', st8.board.rows[1].cells[st8.board.cols[1].id] === '5만 원대' && st8.board.cols[0].name === '제품' && !!st8.editing && st8.editing.kind === 'head', { r1: st8.board.rows[1], c0: st8.board.cols[0], ed: st8.editing });
await key('Escape', 27);
await shot('02-table-edited-1920');

/* 보드 가장자리 «+» */
const tapEl = async (sel) => { await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'center'})`); await sleep(160); const r = await rect(sel); await tap(r.cx, r.cy); await sleep(220); };
await tapEl('#tblPlusCol');
const st9 = await state();
chk('열 «+» → 열 3 · 새 머리 칸을 바로 편집', st9.board.cols.length === 3 && !!st9.editing && st9.editing.kind === 'head' && st9.editing.cid === st9.board.cols[2].id, { n: st9.board.cols.length, ed: st9.editing });
await typeText('소음'); await key('Escape', 27);
await tapEl('#tblPlusRow');
const st10 = await state();
chk('행 «+» → 행 4 · 새 행 이름을 바로 편집', st10.board.rows.length === 4 && !!st10.editing && st10.editing.kind === 'label' && st10.editing.rid === st10.board.rows[3].id, { n: st10.board.rows.length, ed: st10.editing });
await typeText('보네이도 633DC'); await key('Escape', 27);
chk('«+» 는 캔버스 밖 DOM 버튼(PNG 에 안 들어감)', await ev(`(()=>{const a=document.getElementById('tblPlusCol'),b=document.getElementById('tblPlusRow');return a.tagName==='BUTTON'&&b.tagName==='BUTTON'&&a.parentElement.id==='tblCv'&&!!a.getAttribute('aria-label')})()`));

/* 편집 열 — 열 추가·이름·최대·삭제/되돌리기·이동·너비 */
await click('#tblColAdd'); await sleep(250);
let s = await state();
chk('«열 추가» → 열 4 · 새 이름칸 포커스', s.board.cols.length === 4 && (await ev(`(()=>{const a=document.activeElement;return a&&a.dataset.f==='name'?a.closest('.tbl-col').dataset.cid:null})()`)) === s.board.cols[3].id);
await typeText('이런 집에 추천');
chk('편집 열 입력 → 머리 칸 반영', (await state()).board.cols[3].name === '이런 집에 추천');
await click('#tblColAdd'); await click('#tblColAdd'); await sleep(250);
s = await state();
chk('열 최대 6 → «열 추가» 비활성 · 보드 «+» 숨김', s.board.cols.length === 6 && (await ev(`document.getElementById('tblColAdd').disabled&&document.getElementById('tblPlusCol').hidden`)), s.board.cols.length);
const rowHead = await ev(`(()=>{scrollTo(0,0);const ct=document.querySelector('.tbl-ctl');ct.scrollTop=0;const h=document.getElementById('tblRowN').closest('.tbl-st').getBoundingClientRect();const g=document.getElementById('tblSize').parentElement.getBoundingClientRect();return{bottom:Math.round(h.bottom),vh:innerHeight,chipRowH:Math.round(g.height)}})()`);
chk('열 6개(최대)에서도 편집 열 «행» 머리가 1080 첫 화면 안 · «그림 크기 · 맞춤» 한 줄', !!rowHead && rowHead.bottom <= rowHead.vh && rowHead.chipRowH <= 34, rowHead);   /* 게이트 🟡 09-12: 6열에서 −36px */
const c6 = s.board.cols[5].id;
await click(`#tblCols [data-cid="${c6}"] [data-act="del"]`); await sleep(300);
chk('열 삭제 → 5 · 토스트 «되돌리기»', (await state()).board.cols.length === 5 && await ev(`!!document.querySelector('.toast.on .toast-act')`));
await click('.toast.on .toast-act'); await sleep(350);
chk('되돌리기 → 6 · 같은 id 로 복원', (await state()).board.cols.map(c => c.id).includes(c6));
await click(`#tblCols [data-cid="${c6}"] [data-act="del"]`); await sleep(300);
const c5 = (await state()).board.cols[4].id;
await click(`#tblCols [data-cid="${c5}"] [data-act="del"]`); await sleep(300);
s = await state();
chk('정리 → 열 4', s.board.cols.length === 4, s.board.cols.length);
const cPrice = s.board.cols[1].id, cNoise = s.board.cols[2].id;
await T(`edit('cell','${s.board.rows[0].id}','${cNoise}')`); await typeText('22dB'); await T('endEdit()');
await click(`#tblCols [data-cid="${cNoise}"] [data-act="left"]`); await sleep(300);
s = await state();
chk('열 ◀ → 순서 바뀜 · 칸 값은 열을 따라감', s.board.cols[1].id === cNoise && s.board.cols[2].id === cPrice && s.board.rows[0].cells[cNoise] === '22dB' && /8만 원대/.test(s.board.rows[0].cells[cPrice] || ''), s.board.cols.map(c => c.name));
chk('이동 뒤 포커스가 그 열 버튼에 남음', await ev(`(()=>{const a=document.activeElement;return !!a&&!!a.closest('.tbl-col')&&a.closest('.tbl-col').dataset.cid===${JSON.stringify(cNoise)}})()`));
await click(`#tblCols [data-cid="${cNoise}"] [data-act="right"]`); await sleep(300);
chk('열 ▶ → 원래 순서', (await state()).board.cols[2].id === cNoise);
chk('그림 열(1열)은 이동·삭제·너비 없음', await ev(`(()=>{const r=document.querySelector('#tblCols .tbl-col');return !r.querySelector('[data-act]')&&!r.querySelector('select')})()`));
const w0 = (await lay()).ws.slice();
await setInput(`#tblCols [data-cid="${s.board.cols[3].id}"] [data-f="w"]`, 'w'); await sleep(250);
const w1 = (await lay()).ws;
chk('너비 «넓게» → 그 열이 가장 넓어짐 · 합은 그대로', w1[3] > w0[3] && w1[3] > w1[1] && w1.reduce((a, b) => a + b, 0) === w0.reduce((a, b) => a + b, 0), { w0, w1 });
/* 편집 열 — 행 */
s = await state();
const rOld = s.board.rows.map(r => r.id);
await click('#tblRows [data-rid="' + rOld[3] + '"] [data-act="up"]'); await sleep(300);
s = await state();
chk('행 ▲ → 한 칸 위 · 포커스가 그 행에 남음', s.board.rows[2].id === rOld[3] && await ev(`(()=>{const a=document.activeElement;return !!a&&!!a.closest('.tbl-it')&&a.closest('.tbl-it').dataset.rid===${JSON.stringify(rOld[3])}})()`), s.board.rows.map(r => r.label));
await click('#tblRows [data-rid="' + rOld[3] + '"] [data-act="down"]'); await sleep(300);
chk('행 ▼ → 원래 자리', (await state()).board.rows[3].id === rOld[3]);
await click('#tblNew'); await typeText('샤오미 BPLDS06DM, 테스트 둘, 테스트 셋'); await key('Enter', 13, { text: '\r' }); await sleep(300);
s = await state();
chk('쉼표로 여러 행 추가 → 행 7 · 이름 3개', s.board.rows.length === 7 && s.board.rows.slice(4).map(r => r.label).join('|') === '샤오미 BPLDS06DM|테스트 둘|테스트 셋', s.board.rows.map(r => r.label));
const rDel = s.board.rows[6].id, rDel2 = s.board.rows[5].id;
await click('#tblRows [data-rid="' + rDel + '"] [data-act="del"]'); await sleep(300);
chk('행 삭제 → 6 · 토스트 «되돌리기»', (await state()).board.rows.length === 6 && await ev(`!!document.querySelector('.toast.on .toast-act')`));
await click('.toast.on .toast-act'); await sleep(350);
chk('되돌리기 → 7 · 같은 id', (await state()).board.rows.some(r => r.id === rDel));
for (const rid of [rDel, rDel2]) { await click('#tblRows [data-rid="' + rid + '"] [data-act="del"]'); await sleep(300); }
s = await state();
chk('정리 → 행 5', s.board.rows.length === 5, s.board.rows.map(r => r.label));

/* 그림 ① 합성 파일 드롭(사진 열 칸 = 그 행) */
let Lg = await lay();
const pImg = await at(Lg.rows[0].img.x + Lg.rows[0].img.w / 2, Lg.rows[0].img.y + Lg.rows[0].img.h / 2);
const dz = await dropFiles([[CURL(0), 'lumena.jpg']], pImg.x, pImg.y);
chk('① 파일 끌어 놓기(사진 열 칸) → 그 행 그림', await waitFor(`window.SseudamTools.table.__test.state().images>=1`, 6000), dz);
Lg = await lay();
chk('그림이 캔버스에 그려짐', (await cvVar(Lg.rows[0].img.x + 8, Lg.rows[0].img.y + 8, Lg.rows[0].img.w - 16, Lg.rows[0].img.h - 16)) > 150);
chk('편집 열 썸네일에도 그림', await ev(`!!document.querySelector('#tblRows [data-rid="${s.board.rows[0].id}"] .tbl-th img')`));
chk('IndexedDB 에 그 행 그림 저장', ((await T('idbKeys()')) || []).includes(s.board.rows[0].id), await T('idbKeys()'));
/* ② 여러 장을 머리 띠에 → 맨 위에 새 행(이름 = 파일 이름) */
const pHead = await at(Lg.xs[1] + 40, Lg.card.y + Lg.card.headH / 2);
await dropFiles([[CURL(1), '신일_선풍기_A.jpg'], [CURL(2), '보네이도-B.jpg']], pHead.x, pHead.y);
await sleep(600);
s = await state();
chk('② 여러 장 드롭(머리 띠) → 맨 위 새 행 2 · 이름 = 파일 이름', s.board.rows.length === 7 && s.board.rows[0].label === '신일 선풍기 A' && s.board.rows[1].label === '보네이도 B', s.board.rows.map(r => r.label));
chk('새 행 그림 로드', await waitFor(`window.SseudamTools.table.__test.state().images>=3`, 6000), (await state()).images);
/* ③ 파일 선택 — 편집 열 그림 버튼 → change */
const rPick = s.board.rows[3].id;
await ev(`(()=>{window.__pick=0;document.getElementById('tblFile').addEventListener('click',e=>{e.preventDefault();window.__pick++;},{once:true});return true})()`);
await click('#tblRows [data-rid="' + rPick + '"] [data-act="img"]'); await sleep(200);
chk('편집 열 그림 버튼 → 파일 선택 요청', (await ev(`window.__pick`)) === 1);
await ev(`(async()=>{const dt=new DataTransfer();const b=await (await fetch(${JSON.stringify(CURL(1))})).blob();dt.items.add(new File([b],'shinil.jpg',{type:'image/jpeg'}));const f=document.getElementById('tblFile');f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
chk('③ 파일 선택 → 그 행 그림', await waitFor(`!!document.querySelector('#tblRows [data-rid="${rPick}"] .tbl-th img')`, 6000));
/* 보드의 빈 그림 자리 클릭 → 파일 선택 요청 */
s = await state();
const emptyRid = await ev(`(()=>{const r=[...document.querySelectorAll('#tblRows .tbl-it')].find(x=>!x.querySelector('.tbl-th img'));return r?r.dataset.rid:null})()`);
const eri = s.board.rows.findIndex(r => r.id === emptyRid);
await ev(`(()=>{window.__pick=0;document.getElementById('tblFile').addEventListener('click',e=>{e.preventDefault();window.__pick++;},{once:true});return true})()`);
await clickSpot('img', eri, 0);
chk('보드 빈 그림 자리 클릭 → 파일 선택 요청 · 현재 행', (await ev(`window.__pick`)) === 1 && ((await state()).cur || {}).rid === emptyRid, { pick: await ev(`window.__pick`), cur: (await state()).cur, emptyRid });
/* ④ CDP 실제 파일 끌어 놓기(OS 탐색기에서 끌어 온 것과 같은 경로) */
Lg = await lay();
const r4 = Lg.rows[eri], p4 = await at(r4.img.x + r4.img.w / 2, r4.img.y + r4.img.h / 2);
const dd = { items: [], files: [CFILE(3)], dragOperationsMask: 1 };
const e1 = await send('Input.dispatchDragEvent', { type: 'dragEnter', x: p4.x, y: p4.y, data: dd });
await send('Input.dispatchDragEvent', { type: 'dragOver', x: p4.x, y: p4.y, data: dd });
await sleep(150);
const overMark = await ev(`document.getElementById('tblCv').classList.contains('over')`);
await send('Input.dispatchDragEvent', { type: 'drop', x: p4.x, y: p4.y, data: dd });
chk('④ 실제 파일 끌어 놓기(CDP) → 끄는 동안 보드 강조 · 놓으면 그 행 그림', overMark && await waitFor(`!!document.querySelector('#tblRows [data-rid="${emptyRid}"] .tbl-th img')`, 6000), { err: e1.error, overMark });
chk('놓은 뒤 강조 해제', !(await ev(`document.getElementById('tblCv').classList.contains('over')`)));
/* 붙여넣기 → 현재 행 */
s = await state();
const rP = s.board.rows[5].id;
await T(`edit('label','${rP}')`); await T('endEdit()');
await ev(`(async()=>{const dt=new DataTransfer();const b=await (await fetch(${JSON.stringify(CURL(2))})).blob();dt.items.add(new File([b],'paste.jpg',{type:'image/jpeg'}));document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return true})()`);
chk('붙여넣기(Ctrl+V) 이미지 → 현재 행 그림', await waitFor(`!!document.querySelector('#tblRows [data-rid="${rP}"] .tbl-th img')`, 6000));
await click('#tblRows [data-rid="' + rP + '"] [data-act="imgDel"]'); await sleep(300);
chk('그림 지우기 → 사라짐 · 토스트 «되돌리기»', !(await ev(`!!document.querySelector('#tblRows [data-rid="${rP}"] .tbl-th img')`)) && await ev(`!!document.querySelector('.toast.on .toast-act')`));
await click('.toast.on .toast-act');
chk('되돌리기 → 그림 복원', await waitFor(`!!document.querySelector('#tblRows [data-rid="${rP}"] .tbl-th img')`, 6000));
await shot('03-table-images-1920');

/* 그림 크기 · 틀 · 맞춤 */
const Lsz = await lay();
await click('#tblSize .chip[data-v="s"]'); await sleep(250); const Lsm = await lay();
await click('#tblSize .chip[data-v="l"]'); await sleep(250); const Llg = await lay();
chk('그림 크기 작게/보통/크게 → 68/92/120 · 사진 열 폭(작게 ≥ 120)', Lsm.rows[0].img.w === 68 && Lsz.rows[0].img.w === 92 && Llg.rows[0].img.w === 120 && Lsm.ws[0] >= 120 && Llg.ws[0] > Lsz.ws[0], { s: Lsm.ws[0], m: Lsz.ws[0], l: Llg.ws[0] });
await click('#tblSize .chip[data-v="m"]'); await sleep(250);
const imgRi = (await state()).board.rows.findIndex(r => r.label === '루메나 팬그란데2');
await click('#tblShape .chip[data-v="circle"]'); await sleep(250);
let Lc = await lay();
const cc = await px(Lc.rows[imgRi].img.x + 4, Lc.rows[imgRi].img.y + 4);
chk('틀 «원» → 사각 모서리는 사진 열 틴트', near(cc, '#FBEFF5', 12), cc);
await click('#tblShape .chip[data-v="round"]'); await sleep(250);
Lc = await lay();
chk('틀 «둥근 사각» → 그림 그대로', (await cvVar(Lc.rows[imgRi].img.x + 12, Lc.rows[imgRi].img.y + 12, Lc.rows[imgRi].img.w - 24, Lc.rows[imgRi].img.h - 24)) > 150);
const expCover = await T('dataURL()');
await click('#tblFit .chip[data-v="contain"]'); await sleep(250);
chk('맞춤 «맞추기» → 저장 · 그림이 달라짐', (await state()).design.fit === 'contain' && (await T('dataURL()')) !== expCover);
await click('#tblFit .chip[data-v="cover"]'); await click('#tblShape .chip[data-v="polaroid"]'); await sleep(250);
/* 글자 크기 — 슬라이더 + 숫자 */
await setInput('#tblFsN', '18'); await sleep(250);
chk('글자 18 → 폰 9.4px 경고', (await state()).design.fs === 18 && (await lay()).fs === 18 && await ev(`(()=>{const li=[...document.querySelectorAll('#tblChk li')].find(l=>l.textContent.includes('폰 글자'));return !!li&&li.classList.contains('bad')&&li.textContent.includes('9.4')})()`), await ev(`document.getElementById('tblChk').textContent`));
chk('숫자칸 → 슬라이더 동기', (await ev(`document.getElementById('tblFs').value`)) === '18');
await setInput('#tblFs', '19'); await sleep(250);
chk('슬라이더 19 → 숫자칸 동기 · 경고 해제', (await ev(`document.getElementById('tblFsN').value`)) === '19' && await ev(`(()=>{const li=[...document.querySelectorAll('#tblChk li')].find(l=>l.textContent.includes('폰 글자'));return !!li&&!li.classList.contains('bad')})()`));
await setInput('#tblFsN', '99'); await sleep(200);
chk('범위 밖 숫자(99) → 24 로 정정', (await state()).design.fs === 24 && (await ev(`document.getElementById('tblFsN').value`)) === '24');
await setInput('#tblFsN', '19'); await sleep(200);
/* 잘린 글 */
s = await state();
await T(`edit('cell','${s.board.rows[6].id}','${s.board.cols[3].id}')`);
await typeText('아주 긴 설명을 일부러 여러 번 이어서 씁니다. 아주 긴 설명을 일부러 여러 번 이어서 씁니다. 아주 긴 설명을 일부러 여러 번 이어서 씁니다. 아주 긴 설명을 이어서 끝');   /* 3번만 쓰면 넓은 열에서 딱 6줄이라 안 잘렸다(09-12) — 8줄 이상 되게 */
await T('endEdit()'); await sleep(250);
chk('긴 글 → 6줄에서 말줄임 · 검사 «잘린 글»', (await lay()).cut >= 1 && (await ev(`document.getElementById('tblChk').textContent`)).includes('잘린 글'), (await lay()).cut);
/* 헥스 */
await ev(`document.getElementById('tblHex').focus()`);
await setInput('#tblHex', '#6B45C9'); await sleep(250);
Lg = await lay();
chk('헥스 입력 → 기타 색 · 머리 띠 색 바뀜', (await state()).design.accent === 'custom' && (await state()).design.accentHex === '#6B45C9' && near(await px(Lg.xs[1] + 14, Lg.card.y + Lg.card.headH - 8), '#6B45C9', 16), await px(Lg.xs[1] + 14, Lg.card.y + Lg.card.headH - 8));
await ev(`(()=>{const e=document.getElementById('tblHex');e.value='zzzzzz';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await sleep(150);
chk('잘못된 헥스 → 경고 링 · 색 유지', await ev(`document.getElementById('tblHex').classList.contains('bad')`) && (await state()).design.accentHex === '#6B45C9');
await ev(`(()=>{const e=document.getElementById('tblHex');e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();return true})()`); await sleep(150);
chk('칸을 떠나면 유효값으로 정정', (await ev(`document.getElementById('tblHex').value`)) === '#6B45C9' && !(await ev(`document.getElementById('tblHex').classList.contains('bad')`)));
await ev(`(()=>{const e=document.getElementById('tblHex');e.focus();e.value='fe5';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();return true})()`); await sleep(150);
const hiY = await T('headInk()');
chk('세 자리(fe5) → #FFEE55 · 머리 글자는 4.5:1 넘는 잉크', (await state()).design.accentHex === '#FFEE55' && hiY.contrast >= 4.5 && hiY.ink !== '#FFFFFF', hiY);
for (const c of ['pink', 'plum', 'rose']) { await click(`#tblSws .tbl-sw[data-c="${c}"]`); await sleep(150); const hi = await T('headInk()'); chk(`스와치 ${c} → 머리 글자 대비 ≥ 4.5`, (await state()).design.accent === c && hi.contrast >= 4.5, hi); }

/* 내보내기 */
const Lx = await lay();
const dims = await ev(`new Promise(r=>{const i=new Image();i.onload=()=>r([i.naturalWidth,i.naturalHeight]);i.src=window.SseudamTools.table.__test.dataURL()})`);
chk('PNG = 1386 × H×2', !!dims && dims[0] === 1386 && dims[1] === Lx.H * 2, { dims, H: Lx.H });
const du = await T('dataURL()'); if (typeof du === 'string') writeFileSync(join(OUT, 'table-export.png'), Buffer.from(du.split(',')[1], 'base64'));
chk('화면 캔버스 ≠ PNG(자리 표시·호버·링은 화면에만)', await ev(`document.getElementById('tblCanvas').toDataURL()!==window.SseudamTools.table.__test.dataURL()`));
const blob = await T('blob()');
chk('PNG blob(image/png · ≥ 150KB)', !!blob && blob.type === 'image/png' && blob.size > 150000, blob);
chk('편집 중 내보내기 → 입력칸 글자도 PNG 에 구움', await ev(`(()=>{const t=window.SseudamTools.table.__test;const s=t.state();t.edit('label',s.board.rows[0].id);const a=t.dataURL();t.endEdit();const b=t.dataURL();return a===b})()`));
/* JSON 왕복 — 그림 포함 · 행 id 새로 */
await ev(`(async()=>{window.__js=await window.SseudamTools.table.__test.json();return true})()`);
const jsInfo = await ev(`(()=>{const j=window.__js;return{app:j.app,n:Object.keys(j.images||{}).length,ok:Object.values(j.images||{}).every(u=>/^data:image\\//.test(u))}})()`);
const before = await state();
chk('JSON = 쓰담 표 · 그림 data URL 포함', jsInfo.app === 'sseudam-table' && jsInfo.n === before.images && jsInfo.n >= 5 && jsInfo.ok, jsInfo);
await T('reset()'); await sleep(300);
chk('비운 뒤 그림 0', (await state()).images === 0);
const okLoad = await ev(`window.SseudamTools.table.__test.loadJson(window.__js)`);
await sleep(250);
const after = await state();
chk('JSON 불러오기 → 제목·행·칸 복원 · 행 id 는 새로 매김', okLoad === true && after.board.title === before.board.title && after.board.rows.map(r => r.label).join('|') === before.board.rows.map(r => r.label).join('|') && JSON.stringify(after.board.rows).includes('8만 원대') && after.board.rows.every(r => !before.board.rows.some(b => b.id === r.id)), { t: after.board.title, n: after.board.rows.length });
chk('JSON 그림 복원', await waitFor(`window.SseudamTools.table.__test.state().images>=${before.images}`, 8000), { want: before.images, got: (await state()).images });
chk('불러오기 토스트 «되돌리기»', await ev(`!!document.querySelector('.toast.on .toast-act')`));
await sleep(400);
const sSaved = await state();
chk('localStorage 저장(v1)', await ev(`(()=>{try{const s=JSON.parse(localStorage.getItem('sseudam_table_v1'));return !!s&&s.app==='sseudam-table'&&s.v===1&&s.board.rows.length===${sSaved.board.rows.length}}catch(e){return false}})()`));

/* 라벨 · 포커스 · 히트존 · 칩 */
const small = await ev(`(()=>{const q=[...document.querySelectorAll('.tbl *')].filter(e=>e.offsetParent&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));return q.map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(v=>v<12.5)})()`);
chk('도구 안 글자 12.5px 미만 0개', small.length === 0, small);
await ev(`document.querySelector('#tblRows .tbl-in').focus()`); await sleep(350);
chk('입력 포커스 링 2px 잉크', await ev(`getComputedStyle(document.activeElement).boxShadow.includes('0px 0px 0px 2px')`), await ev(`getComputedStyle(document.activeElement).boxShadow`));
await ev(`document.activeElement.blur()`);
const ov = await ev(`(()=>{const ex=6;const bs=[...document.querySelectorAll('.tbl-ib')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return{l:r.left-ex,t:r.top-ex,r:r.right+ex,b:r.bottom+ex}});let n=0;for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],c=bs[j];const w=Math.min(a.r,c.r)-Math.max(a.l,c.l),h=Math.min(a.b,c.b)-Math.max(a.t,c.t);if(w>0&&h>0)n++;}return{n,count:bs.length}})()`);
chk('아이콘 버튼 히트존(±6) 겹침 0', !!ov && ov.n === 0 && ov.count > 15, ov);
chk('칩 = 사이트 기본 32px', await ev(`getComputedStyle(document.querySelector('#tblSize .chip')).height==='32px'`));
chk('편집기·«+»에 접근 가능한 이름', await ev(`!!document.getElementById('tblEd').getAttribute('aria-label')&&document.getElementById('tblPlusRow').getAttribute('aria-label')==='행 추가'&&!!document.getElementById('tblLive')`));

/* 탭 이탈 → 복귀 · 새로고침 복원 */
const sLeave = await state();
await T(`edit('cell','${sLeave.board.rows[0].id}','${sLeave.board.cols[1].id}')`);
await ev(`window.scrollTo(0,0)`); await click('.isl-tab[data-v="home"]'); await sleep(800);
chk('홈으로 → 도구 DOM 제거', !(await ev(`!!document.querySelector('.tbl')`)));
await click('.isl-tab[data-v="tools"]'); await sleep(900);
chk('복귀 → 표 도구 그대로', await waitFor(`!!document.querySelector('#tblCanvas')&&document.querySelector('#tbList .tb-item.on').dataset.t==='table'`, 6000));
const sBack = await state();
chk('복귀 후 보드·그림 유지 · 편집기는 닫힘', JSON.stringify(sBack.board) === JSON.stringify(sLeave.board) && sBack.images === sLeave.images && !sBack.editing, { img: [sLeave.images, sBack.images], ed: sBack.editing });
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);
logs = [];
await open(1920, 1080, false);
chk('새로고침 → 표 도구', await gotoTable());
chk('새로고침 뒤 보드 복원(localStorage)', JSON.stringify((await state()).board) === JSON.stringify(sBack.board));
chk('새로고침 뒤 그림 복원(IndexedDB)', await waitFor(`window.SseudamTools.table.__test.state().images>=${sBack.images}`, 8000), { want: sBack.images, got: (await state()).images });
await sleep(600);
chk('지운 행의 그림은 새로고침 때 저장소에서 치움', ((await T('idbKeys()')) || []).length === (await state()).images, { keys: ((await T('idbKeys()')) || []).length, images: (await state()).images });
await shot('04-table-reloaded-1920');
chk('[1920 재로드] 콘솔 예외 0', logs.length === 0, logs);
/* ══════════ 1366×768 ══════════ */
console.log('\n[1366×768]');
logs = [];
await open(1366, 768, false);
chk('도구함 진입(1366)', await gotoTable());
const g1366 = await ev(`(()=>{const main=document.querySelector('.tb-main'),cv=document.getElementById('tblCanvas').getBoundingClientRect(),ct=document.querySelector('.tbl-ctl'),pc=document.getElementById('tblPlusCol').getBoundingClientRect(),st=document.querySelector('.tbl-stage').getBoundingClientRect();return{panelW:Math.round(main.getBoundingClientRect().width),cvW:Math.round(cv.width),ctlW:Math.round(ct.getBoundingClientRect().width),plusIn:pc.right<=st.right+1&&pc.left>=st.left-1}})()`);
chk('1366: 판 1072 · 편집 열 340 · 보드 ≥ 680 · 열 «+» 가 스테이지 안', !!g1366 && g1366.panelW === 1072 && g1366.ctlW === 340 && g1366.cvW >= 680 && g1366.plusIn, g1366);
chk('1366 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth+1`));
const p13 = await clickSpot('cell', 0, 1);
const ed13 = await ev(`(()=>{const t=document.getElementById('tblEd'),r=t.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,hidden:t.hidden}})()`);
chk('1366: 칸 클릭 → 입력칸이 그 칸 위(표시 배율 반영)', !!ed13 && !ed13.hidden && Math.abs(ed13.x - p13.x) < 30 && Math.abs(ed13.y - p13.y) < 40, { ed13, p13 });
await key('Escape', 27);
await shot('05-table-1366');
chk('[1366] 콘솔 예외 0', logs.length === 0, logs);

/* ══════════ 390×844 ══════════ */
console.log('\n[390×844]');
logs = [];
await open(390, 844, true);
chk('도구함 진입(모바일)', await gotoTable());
await sleep(300);
const lst390 = await ev(`(()=>{const l=document.getElementById('tbList'),on=l.querySelector('.tb-item.on'),lr=l.getBoundingClientRect(),r=on.getBoundingClientRect(),cs=getComputedStyle(l);return{sw:l.scrollWidth,cw:l.clientWidth,sl:Math.round(l.scrollLeft),onIn:r.left>=lr.left-1&&r.right<=lr.right+1,moreL:l.classList.contains('more-l'),moreR:l.classList.contains('more-r'),mask:cs.maskImage||cs.webkitMaskImage||'none'}})()`);
chk('390 도구 목록: 고른 «표 제작»이 줄 안에 다 보임 · 넘치면 가장자리 페이드', !!lst390 && lst390.onIn && (lst390.sw <= lst390.cw + 1 || ((lst390.moreL || lst390.moreR) && lst390.mask !== 'none')), lst390);   /* 게이트 🟡 09-12: 글자 중간에서 잘려 보였다 */
const lstStart = await ev(`new Promise(res=>{const l=document.getElementById('tbList');l.scrollLeft=0;l.dispatchEvent(new Event('scroll'));requestAnimationFrame(()=>res({sw:l.scrollWidth,cw:l.clientWidth,moreL:l.classList.contains('more-l'),moreR:l.classList.contains('more-r')}))})`);
chk('390 도구 목록 맨 앞 → 오른쪽 페이드(더 있음) · 왼쪽은 없음', !!lstStart && (lstStart.sw <= lstStart.cw + 1 || (lstStart.moreR && !lstStart.moreL)), lstStart);
chk('모바일 단일 열', (await ev(`getComputedStyle(document.querySelector('.tbl')).gridTemplateColumns.split(' ').length`)) === 1);
chk('모바일 가로 넘침 없음(레이아웃 뷰포트가 390 그대로)', await ev(`innerWidth===390&&document.documentElement.scrollWidth<=390`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));   /* scrollWidth<=innerWidth 만 보면 넘친 만큼 innerWidth 도 커져(402≤402) 통과해 버린다 — 09-12 실측 */
chk('캔버스 폭 ≤ 390 · pan-y(세로 스크롤 보존)', await ev(`(()=>{const c=document.getElementById('tblCanvas');return c.getBoundingClientRect().width<=390&&getComputedStyle(c).touchAction==='pan-y'})()`));
const tapMin = await ev(`(()=>{const q=[...document.querySelectorAll('.tbl-sw,.tbl-th,.tbl-ib,.tbl-plus,#tblRowAdd,#tblColAdd,#tblSave,#tblCopy,#tblJson,#tblLoad,#tblClear,.tbl .chip')].filter(e=>e.offsetParent&&!e.disabled);return Math.min(...q.map(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e,'::after');const pad=cs.content!=='none'&&cs.inset!=='auto'?12:0;return Math.min(r.width,r.height)+pad}))})()`);
chk('모바일 터치 타깃 ≥ 28(히트존 포함)', tapMin >= 28, { tapMin });
const sp390 = await spot('cell', 0, 1), tp = await at(sp390.x, sp390.y);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tp.x, y: tp.y }] });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(400);
chk('모바일: 칸 탭 → 입력칸 열림', await ev(`!document.getElementById('tblEd').hidden&&document.activeElement===document.getElementById('tblEd')`), await ev(`({hidden:document.getElementById('tblEd').hidden,active:document.activeElement&&document.activeElement.id})`));
await key('Escape', 27);
chk('모바일 «+» 버튼 보임(28px)', await ev(`(()=>{const a=document.getElementById('tblPlusRow');return !a.hidden&&Math.round(a.getBoundingClientRect().width)===28})()`));
await shot('06-table-390');
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch {}
chrome.kill(); srv.close();
process.exit(fail ? 1 : 0);
