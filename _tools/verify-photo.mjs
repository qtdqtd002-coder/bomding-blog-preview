// verify-photo.mjs — 도구함 「이미지 편집」(_toolbox/photo.js) 헤드리스 검증 (2026-09-12 · v2)
//   node _tools/verify-photo.mjs [--out DIR] [--page index.html]
//   · verify-tier.mjs 와 같은 하네스(로컬 정적 서버 + 크롬 헤드리스 CDP, 의존성 0). 축하 스플래시 ?cheer=0, 라이브 백엔드 차단.
//   · 시험 사진은 페이지 안에서 만든다(1200×800 · 네 칸 색 + 흑백 줄무늬 띠) — 픽셀 검사가 결정적이다.
//   · 1920×1080: 작업대(판에 꽉 참) · 레일 12(스마트에디터 순서) · 빈 상태 · 열기 · 크기 · 자르기(실제 드래그·90°·반전·수평) · 필터 · 보정
//                · 액자·마스크(출력 크기·투명) · 서명(9칸) · 텍스트(캔버스 클릭) · 스티커(봄딩 12·끌어 놓기) · 도형·돋보기·번호(실제 드래그)
//                · 선택 이동·크기·회전 · 그리기·지우개 · 모자이크(분산 감소) · 키보드 · 레이어 · 되돌리기 · 내보내기(PNG/JPG) · 자동 보관 → 이어서 편집
//   · v2(09-12 사용자 피드백 4건): 작성자 팩(봄딩·영도 스티커/팔레트/서명) · 도형 15종+손그림 · 사진 밖에선 안 만든다 · 레이어 서랍(항상 보임·숨김·접기)
//   · 1366×768: 판 폭·넘침 0   · 390×844: 단일 열·넘침 0
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, createReadStream, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = val('--out', join(tmpdir(), '_photo-out'));
const PAGE = val('--page', 'index.html');
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
const prof = join(tmpdir(), `_photoprof${port}`);
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| http :' + HP, '| page', PAGE, '| out', OUT);

const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); let logs = []; let loaded = null; const dlEv = [];
ws.onmessage = (m0) => {
  const m = JSON.parse(m0.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('[console.error] ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Network.loadingFailed' && /_toolbox\/photo/.test(m.params.requestId ? (pendingUrls.get(m.params.requestId) || '') : '')) logs.push('[net] ' + pendingUrls.get(m.params.requestId));
  else if (m.method === 'Network.requestWillBeSent') pendingUrls.set(m.params.requestId, m.params.request.url);
  else if (m.method === 'Network.responseReceived' && /_toolbox\/photo\//.test(m.params.response.url)) netPhoto.push([m.params.response.url.replace(/^.*_toolbox\//, ''), m.params.response.status]);
  else if (/^Browser\.download/.test(m.method || '')) dlEv.push(m.method.replace('Browser.download','') + ':' + (m.params.state || m.params.suggestedFilename || ''));
  else if (m.method === 'Page.loadEventFired' && loaded) loaded();
};
const pendingUrls = new Map(); const netPhoto = [];
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }; return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*sslip.io*', '*cheer-splash.js*'] });
await send('Browser.grantPermissions', { origin: `http://127.0.0.1:${HP}`, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});

const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };
const rect = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return{x:b.left,y:b.top,w:b.width,h:b.height,cx:b.left+b.width/2,cy:b.top+b.height/2,r:b.right,b:b.bottom}})()`);
const mouse = async (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
const click = async (sel) => {
  await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e&&!e.closest('.back'))e.scrollIntoView({block:'nearest'});return true})()`);
  await sleep(80);
  const r = await rect(sel); if (!r) return false;
  await mouse('mouseMoved', r.cx, r.cy); await mouse('mousePressed', r.cx, r.cy, { buttons: 1 }); await mouse('mouseReleased', r.cx, r.cy);
  await sleep(120);
  return true;
};
const clickXY = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, { buttons: 1 }); await mouse('mouseReleased', x, y); await sleep(150); };
const drag = async (x0, y0, x1, y1, steps = 10, modifiers = 0) => {
  await mouse('mouseMoved', x0, y0, { modifiers }); await mouse('mousePressed', x0, y0, { buttons: 1, modifiers });
  for (let i = 1; i <= steps; i++) { await mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, { buttons: 1, modifiers }); await sleep(14); }
  await mouse('mouseReleased', x1, y1, { buttons: 0, modifiers }); await sleep(180);
};
const key = async (k, vk, text, modifiers = 0) => {
  const p = { type: 'keyDown', key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }; if (text) { p.text = text; p.unmodifiedText = text; }
  await send('Input.dispatchKeyEvent', p);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: p.code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
  await sleep(160);
};
const setInput = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return v; await sleep(120); } return null; };
const T = (expr) => ev(`window.SseudamTools.photo.__test.${expr}`);
const S = () => T('state()');
const R = []; let fail = 0;
const chk = (name, ok, got) => { R.push({ name, ok: !!ok, got }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  → ' + JSON.stringify(got)}`); if (!ok) fail++; };
const open = async (w, h, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: `http://127.0.0.1:${HP}/${PAGE}?cheer=0` });
  await Promise.race([p, sleep(10000)]); loaded = null;
  await waitFor(`!document.querySelector('#view .skel')`, 9000);
  await sleep(400);
};
const gotoPhoto = async () => {
  await ev(`window.scrollTo(0,0)`); await sleep(300);
  await click('.isl-tab[data-v="tools"]'); await sleep(700);
  await waitFor(`!!document.querySelector('#tbList .tb-item[data-t="photo"]')`, 8000);
  await click('#tbList .tb-item[data-t="photo"]'); await sleep(500);
  return waitFor(`!!document.getElementById('phStage')&&!!(window.SseudamTools&&window.SseudamTools.photo)`, 8000);
};
/* 시험 사진 — 왼쪽 위 파랑 · 오른쪽 위 빨강 · 왼쪽 아래 초록 · 오른쪽 아래 밝은 회색 + 가운데 흑백 줄무늬 띠(높이 45~55%) */
const makeImg = (w, h, type = 'image/png') => ev(`(async()=>{const c=document.createElement('canvas');c.width=${w};c.height=${h};const x=c.getContext('2d');
  x.fillStyle='#3366CC';x.fillRect(0,0,${w / 2},${h / 2});x.fillStyle='#CC3333';x.fillRect(${w / 2},0,${w / 2},${h / 2});
  x.fillStyle='#33AA55';x.fillRect(0,${h / 2},${w / 2},${h / 2});x.fillStyle='#EEEEEE';x.fillRect(${w / 2},${h / 2},${w / 2},${h / 2});
  for(let i=0;i<${w};i+=8){x.fillStyle=(i/8)%2?'#000000':'#FFFFFF';x.fillRect(i,${Math.round(h * .45)},8,${Math.round(h * .1)});}
  const b=await new Promise(r=>c.toBlob(r,'${type}',.95));return URL.createObjectURL(b);})()`);
const pickShape = async (k) => {
  for (let i = 0; i < 3; i++) {
    await click(`[data-tile="shape"] .ph-tile[data-v="${k}"]`); await sleep(180);
    if ((await S()).pref.shape === k) return true;
  }
  return false;
};
/* WCAG 대비 — 팩 색이 바뀌어도 «바탕 위 글자»가 읽히는지(09-12 검수 🟡1: 영도 그린+흰 글자 3.38:1) */
const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  .reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0);
const CR = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
const near = (c, t, tol = 16) => c && Math.abs(c[0] - t[0]) <= tol && Math.abs(c[1] - t[1]) <= tol && Math.abs(c[2] - t[2]) <= tol;
const panelScroll = () => ev(`(()=>{const p=document.getElementById('phScroll')||document.getElementById('phPanel');if(p)p.scrollTop=0;return true})()`);

/* ══════════ 1920×1080 ══════════ */
console.log('\n[1920×1080]');
await open(1920, 1080, false);
await ev(`localStorage.removeItem('sseudam_photo_v1')`);
chk('도구함 진입 → 이미지 편집 로드', await gotoPhoto());
await T('clearSaved()'); await T('reset()'); await sleep(1200);
const lay0 = await ev(`(()=>{const ph=document.querySelector('.ph').getBoundingClientRect(),core=document.getElementById('tbHost').getBoundingClientRect();return{phW:Math.round(ph.width),phH:Math.round(ph.height),coreW:Math.round(core.width),coreH:Math.round(core.height),dx:Math.round(ph.left-core.left),dy:Math.round(ph.top-core.top)}})()`);
chk('작업대가 도구 판을 꽉 채운다(빈 상태 · 높이 = 뷰포트 − 214)', lay0 && lay0.dx === 0 && lay0.dy === 0 && lay0.phW === lay0.coreW && lay0.phH === 866, lay0);
chk('레일 12 = 스마트에디터 사진 편집 순서 + 도형·그리기', (await ev(`[...document.querySelectorAll('.ph-ri')].map(b=>b.dataset.tool).join(',')`)) === 'size,crop,filter,adjust,frame,sig,mosaic,text,sticker,shape,draw,mask');
chk('레일 라벨 ≥ 12.5px · 버튼 ≥ 40px', await ev(`[...document.querySelectorAll('.ph-ri')].every(b=>parseFloat(getComputedStyle(b.querySelector('b')).fontSize)>=12.5&&b.getBoundingClientRect().height>=40&&b.getBoundingClientRect().width>=40)`));
chk('빈 상태: 드롭존 보임 · 저장/복사/되돌리기 비활성 · 레일 흐림 · 저장본 없으면 «이어서 편집» 실제로 안 보임', await ev(`(()=>{const dz=document.getElementById('phDz');return !dz.hidden&&document.getElementById('phSave').disabled&&document.getElementById('phCopy').disabled&&document.getElementById('phUndo').disabled&&document.querySelector('.ph').classList.contains('empty')&&getComputedStyle(document.getElementById('phResume')).display==='none'})()`), await ev(`getComputedStyle(document.getElementById('phResume')).display`));
await shot('01-empty-1920');

const img1 = await makeImg(1200, 800);
chk('시험 사진 열기(1200×800 PNG)', await T(`setImageURL(${JSON.stringify(img1)},'시험사진.png')`));
await sleep(700);
let s = await S();
chk('문서: 방향 원본 · 자르기 창 = 전체 · 출력 1200×800', s.doc && s.odim.w === 1200 && s.odim.h === 800 && s.crop.w === 1200 && s.out.W === 1200 && s.out.H === 800, s.out);
chk('열면: 드롭존 숨김 · 저장 활성 · 되돌리기는 비활성(첫 칸)', await ev(`document.getElementById('phDz').hidden&&!document.getElementById('phSave').disabled&&document.getElementById('phUndo').disabled`));
const cvR = await rect('#phCanvas');
chk('캔버스가 스테이지 안 가운데(맞춤)', cvR && cvR.w > 600 && Math.abs((cvR.cx) - (await rect('#phStage')).cx) < 2, cvR);
chk('파일 표시 «1200×800 · PNG»', (await ev(`document.getElementById('phFn').textContent`)) === '1200×800 · PNG', await ev(`document.getElementById('phFn').textContent`));

/* 크기 */
await T(`setTool('size')`); await sleep(250);
await click('[data-chip="out.preset"] .chip[data-v="693"]'); s = await S();
chk('크기 693 본문 → 693×462', s.out.W === 693 && s.out.H === 462, s.out);
await click('[data-chip="out.preset"] .chip[data-v="1386"]'); s = await S();
chk('크기 1386 본문 2배 → 1386×924', s.out.W === 1386 && s.out.H === 924, s.out);
await click('[data-chip="out.preset"] .chip[data-v="custom"]'); await setInput('#phOutW', '800'); await sleep(200); s = await S();
chk('직접 입력 800 → 800×533', s.out.W === 800 && s.out.H === 533, s.out);
await click('[data-chip="out.preset"] .chip[data-v="orig"]'); s = await S();
chk('원본으로 → 1200×800 · 되돌리기 활성', s.out.W === 1200 && !(await ev(`document.getElementById('phUndo').disabled`)), s.hist);

/* 자르기·회전 */
await T(`setTool('crop')`); await sleep(300);
chk('자르기 화면: 상자·손잡이 8', await ev(`!!document.getElementById('phCrop')&&document.querySelectorAll('#phCrop .ph-h').length===8`));
await click('[data-chip="crop.ar"] .chip[data-v="1:1"]'); s = await S();
chk('비율 1:1 → 800×800 가운데', Math.round(s.crop.w) === 800 && Math.round(s.crop.h) === 800 && Math.round(s.crop.x) === 200, s.crop);
let hse = await rect('#phCrop .ph-h[data-h="cse"]');
await drag(hse.cx, hse.cy, hse.cx - 120, hse.cy - 60); s = await S();
chk('모서리 끌기(실제 마우스) → 줄어들고 1:1 유지', s.crop.w < 790 && Math.abs(s.crop.w - s.crop.h) < 1, s.crop);
const box = await rect('#phCrop'); const cx0 = s.crop.x;
await drag(box.cx, box.cy, box.cx + 60, box.cy + 20); s = await S();
chk('상자 안 끌기 → 창 이동(크기 그대로)', s.crop.x > cx0 + 20 && Math.abs(s.crop.w - s.crop.h) < 1, { from: cx0, to: s.crop.x });
await click('[data-chip="crop.ar"] .chip[data-v="free"]');
await click('[data-act="rotR"]'); s = await S();
chk('오른쪽 90° → 방향 행렬 [0,1,-1,0] · 800×1200', s.m.join(',') === '0,1,-1,0' && s.odim.w === 800 && s.odim.h === 1200, { m: s.m, o: s.odim });
await click('[data-act="flipH"]'); s = await S();
chk('좌우 반전 → 행렬식 −1', s.m[0] * s.m[3] - s.m[1] * s.m[2] === -1, s.m);
await setInput('.ph-sl[data-sl="st"] input[type=number]', '12'); s = await S();
chk('수평 맞춤 12°', s.st === 12, s.st);
await shot('02-crop-rotated');
await click('#phReset'); await sleep(250); s = await S();
chk('초기화 → 방향·수평·창 원래대로', s.m.join(',') === '1,0,0,1' && s.st === 0 && s.crop.w === 1200 && s.crop.h === 800, { m: s.m, st: s.st, c: s.crop });
chk('초기화 토스트 «자르기·회전을 처음으로…» + «되돌리기»', await waitFor(`/자르기·회전을 처음으로/.test((document.querySelector('.toast.on')||{}).textContent||'')&&/되돌리기/.test(document.querySelector('.toast.on').textContent)`, 2000), await ev(`(document.querySelector('.toast.on')||{}).textContent`));

/* 필터 */
await T(`setTool('filter')`); await sleep(400); await panelScroll();
chk('필터 타일 10 · 미리보기 그려짐', await ev(`(()=>{const c=[...document.querySelectorAll('[data-tile="flt"] canvas')];if(c.length!==10)return false;return c.every(cv=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let a=0;for(let i=3;i<d.length;i+=40)a+=d[i];return a>0})})()`));
const blue0 = (await T('exportRegion(100,100,20,20)')).px;
await click('[data-tile="flt"] .ph-tile[data-v="mono"]');
const mono = (await T('exportRegion(100,100,20,20)')).px;
chk('흑백 → 파랑 칸이 회색(R≈G≈B)', near(blue0, [51, 102, 204], 6) && Math.abs(mono[0] - mono[1]) < 6 && Math.abs(mono[1] - mono[2]) < 6, { blue0, mono });
await setInput('.ph-sl[data-sl="flt.amt"] input[type=number]', '0');
chk('세기 0 → 원래 색', near((await T('exportRegion(100,100,20,20)')).px, [51, 102, 204], 6));
await click('#phReset'); await sleep(200);

/* 보정 */
await T(`setTool('adjust')`); await sleep(300); await panelScroll();
chk('보정 슬라이더 8(밝기·대비·채도·색온도·하이라이트·그림자·선명도·비네팅)', (await ev(`[...document.querySelectorAll('.ph-sl')].map(e=>e.dataset.sl).join(',')`)) === 'adj.bri,adj.con,adj.sat,adj.tmp,adj.hil,adj.sha,adj.shr,adj.vig');
const g0 = (await T('exportRegion(100,500,40,40)')).mean;
await setInput('.ph-sl[data-sl="adj.bri"] input[type=number]', '60');
const g1 = (await T('exportRegion(100,500,40,40)')).mean;
chk('밝기 +60 → 초록 칸이 밝아짐', g1 > g0 + 15, { g0, g1 });
const v0 = (await T('exportRegion(0,380,400,40)')).vari;
await setInput('.ph-sl[data-sl="adj.bri"] input[type=number]', '0');
await click('[data-chip="auto"] .chip'); s = await S();
chk('자동 보정 켬 → 레벨 값 생김', !!s.auto && typeof s.auto.lo === 'number', s.auto);
await click('[data-chip="auto"] .chip'); s = await S();
chk('자동 보정 끔', s.auto === null, s.auto);

/* 액자·마스크 */
await T(`setTool('frame')`); await sleep(400); await panelScroll();
chk('액자 타일 10', (await ev(`document.querySelectorAll('[data-tile="frame"] .ph-tile').length`)) === 10);
await click('[data-tile="frame"] .ph-tile[data-v="polaroid"]'); s = await S();
chk('폴라로이드 → 출력이 사진보다 크고 아래 여백이 두껍다', s.out.W > 1200 && s.out.H > 800 && s.out.pd.b > s.out.pd.t * 1.5, s.out);
chk('폴라로이드 글귀 칸', await ev(`!!document.getElementById('phCaption')`));
await setInput('#phCaption', '2026.09 봄딩'); await sleep(200);
const pol = await T('exportRegion(2,2,6,6)');
chk('폴라로이드 종이 = 흰색(모서리)', near(pol.px, [255, 255, 255], 6), pol.px);
await click('[data-tile="frame"] .ph-tile[data-v="round"]');
chk('둥근 모서리 → 모서리 투명 · 자동 형식 PNG', (await T('exportRegion(0,0,3,3)')).clear === 1 && (await ev(`document.getElementById('phFn').textContent`)).includes('PNG'));
await click('#phReset'); await sleep(200);
chk('초기화 토스트 조사 «액자를»(받침 없음)', await waitFor(`/액자를 처음으로/.test((document.querySelector('.toast.on')||{}).textContent||'')`, 2000), await ev(`(document.querySelector('.toast.on')||{}).textContent`));
await T(`setTool('mask')`); await sleep(400); await panelScroll();
await click('[data-tile="mask"] .ph-tile[data-v="heart"]');
chk('하트 마스크 → 모서리 투명', (await T('exportRegion(0,0,4,4)')).clear === 1);
await click('[data-chip="mask.bg"] .chip[data-v="white"]');
const mw = await T('exportRegion(0,0,4,4)');
chk('바깥 흰색 → 모서리 흰색', mw.clear === 0 && near(mw.px, [255, 255, 255], 4), mw);
await shot('03-mask-heart');
await click('#phReset'); await sleep(200);

/* 서명 */
await T(`setTool('sig')`); await sleep(400); await panelScroll();
chk('서명 템플릿 6', (await ev(`document.querySelectorAll('[data-tile="sig.tpl"] .ph-tile').length`)) === 6);
await click('[data-tile="sig.tpl"] .ph-tile[data-v="pill"]'); await sleep(300); s = await S();
let sg = s.objs.find(o => o.t === 'sig');
chk('배지 서명 → 오른쪽 아래(9칸 br)', sg && sg.anchor === 'br' && sg.x > 900 && sg.y > 650, sg);
await click('.ph-anc button[data-anc="tl"]'); s = await S(); sg = s.objs.find(o => o.t === 'sig');
chk('위치 왼쪽 위', sg.anchor === 'tl' && sg.x < 300 && sg.y < 150, sg);
await setInput('#phSigTx', 'blog.naver.com/bomding'); await sleep(700); s = await S(); sg = s.objs.find(o => o.t === 'sig');
chk('서명 글자 바꾸기', sg.tx === 'blog.naver.com/bomding', sg.tx);
await click('[data-tile="sig.tpl"] .ph-tile[data-v="stamp"]'); s = await S();
chk('템플릿을 바꿔도 서명은 1개', s.objs.filter(o => o.t === 'sig').length === 1 && s.objs.find(o => o.t === 'sig').tpl === 'stamp');
await click('[data-act="delSig"]'); s = await S();
chk('서명 빼기', !s.objs.some(o => o.t === 'sig'));

/* 텍스트 — 캔버스 클릭으로 추가 */
await T(`setTool('text')`); await sleep(300);
let pt = await T('d2c(300,300)'); await clickXY(pt.x, pt.y); await sleep(300); s = await S();
let tx = s.objs.find(o => o.t === 'text');
chk('텍스트: 빈 곳 클릭 → 그 자리에 추가·선택', tx && Math.abs(tx.x - 300) < 4 && Math.abs(tx.y - 300) < 4 && s.sel === tx.id, tx);
chk('추가하면 내용 칸에 포커스', await waitFor(`document.activeElement&&document.activeElement.id==='phTx'`, 1500));
await setInput('#phTx', '봄딩 추천템'); await sleep(650); s = await S(); tx = s.objs.find(o => o.t === 'text');
chk('내용 입력 반영 · 상자 크기 갱신', tx.tx === '봄딩 추천템' && tx.w > 50, tx);
await click('[data-tile="text.st"] .ph-tile[data-v="bubble"]'); s = await S(); tx = s.objs.find(o => o.t === 'text');
chk('스타일 말풍선 → 바탕 흰색', tx.st === 'bubble' && tx.bg === '#FFFFFF', tx);
await setInput('#phFont', 'jua'); await sleep(300); s = await S(); tx = s.objs.find(o => o.t === 'text');
chk('글꼴 주아', tx.font === 'jua', tx.font);
await T('fontsReady()'); await T('paint()'); await sleep(250);
s = await S(); tx = s.objs.find(o => o.t === 'text');
let c0 = await T(`d2c(${tx.x},${tx.y})`);
await drag(c0.x, c0.y, c0.x + 80, c0.y + 40); s = await S(); const tx2 = s.objs.find(o => o.t === 'text');
chk('선택 개체 끌어 이동(실제 마우스)', tx2.x > tx.x + 60 && tx2.y > tx.y + 25, { from: [tx.x, tx.y], to: [tx2.x, tx2.y] });
const hSe = await rect('.ph-sel .ph-h[data-h="se"]');
await drag(hSe.cx, hSe.cy, hSe.cx + 60, hSe.cy + 30); s = await S(); const tx3 = s.objs.find(o => o.t === 'text');
chk('모서리 손잡이 → 글자 커짐', tx3.fs > tx2.fs * 1.1, { fs0: tx2.fs, fs1: tx3.fs });
const hRot = await rect('.ph-sel .ph-h[data-h="rot"]'); c0 = await T(`d2c(${tx3.x},${tx3.y})`);
await drag(hRot.cx, hRot.cy, c0.x + 220, c0.y, 12); s = await S(); const tx4 = s.objs.find(o => o.t === 'text');
chk('회전 손잡이 → 90° 스냅', Math.abs(tx4.r - 90) < 1, tx4.r);
await setInput('.ph-sl[data-sl="obj.r"] input[type=number]', '0');

/* 키보드 */
await ev(`document.getElementById('phStage').focus()`);
const n0 = (await S()).objs.length;
await key('d', 68, null, 2);
chk('Ctrl+D → 복제', (await S()).objs.length === n0 + 1);
await key('Delete', 46);
chk('Delete → 삭제', (await S()).objs.length === n0);
await key('z', 90, null, 2);
chk('Ctrl+Z → 되살림', (await S()).objs.length === n0 + 1);
await key('z', 90, null, 10);
chk('Ctrl+Shift+Z → 다시 하기', (await S()).objs.length === n0);
s = await S(); tx = s.objs.find(o => o.t === 'text'); await T(`select('${tx.id}')`); await ev(`document.getElementById('phStage').focus()`);
await key('ArrowRight', 39); await sleep(450);
chk('→ 화살표 → 오른쪽으로 조금', (await S()).objs.find(o => o.id === tx.id).x > tx.x);

/* 스티커 */
await T(`setTool('sticker')`); await sleep(400); await panelScroll();
await click('[data-chip="stk.cat"] .chip[data-v="bomding"]'); await sleep(300);
chk('봄딩 스티커 12 · 목록 그림 로드', await waitFor(`(()=>{const im=[...document.querySelectorAll('#phStk img')];return im.length===12&&im.every(i=>i.complete&&i.naturalWidth>0)})()`, 6000));
chk('스티커 타일 크기 균일(세로로 긴 그림도 칸 안)', await ev(`(()=>{const t=[...document.querySelectorAll('#phStk .ph-sk')].map(e=>Math.round(e.getBoundingClientRect().height));return Math.max(...t)-Math.min(...t)<=1})()`));
const nS = (await S()).objs.length;
await click('#phStk .ph-sk[data-stk="thumbs"]'); await sleep(800); s = await S();
chk('봄딩 스티커 누르기 → 넣고 선택', s.objs.length === nS + 1 && s.objs[s.objs.length - 1].t === 'stk' && s.sel === s.objs[s.objs.length - 1].id);
chk('스티커 원본 webp 200', netPhoto.some(([u, st]) => /stk\/thumbs\.webp/.test(u) && st === 200), netPhoto.slice(-3));
await click('[data-chip="stk.cat"] .chip[data-v="label"]'); await sleep(300);
const skR = await rect('#phStk .ph-sk[data-vec]'); const dst = await T('d2c(900,600)');
await drag(skR.cx, skR.cy, dst.x, dst.y, 16); await sleep(200); s = await S(); const lastV = s.objs[s.objs.length - 1];
chk('라벨 스티커 끌어 놓기 → 놓은 자리', lastV.t === 'vec' && Math.abs(lastV.x - 900) < 6 && Math.abs(lastV.y - 600) < 6, lastV);
await setInput('#phVecTx', '꿀팁'); await sleep(650); s = await S();
chk('라벨 글자 바꾸기', s.objs[s.objs.length - 1].tx === '꿀팁');
await shot('04-stickers');

/* 작성자 디자인 팩 — 봄딩 ↔ 영도 (09-12 사용자 요청 1) */
chk('팩 고르개 2(봄딩·영도) · 기본 봄딩', await ev(`(()=>{const b=[...document.querySelectorAll('#phPks .ph-pk')];return b.length===2&&b[0].dataset.pack==='bomding'&&b[1].dataset.pack==='yeongdo'&&b[0].classList.contains('on')})()`));
chk('스티커 분류에 봄딩·영도 둘 다', (await ev(`[...document.querySelectorAll('[data-chip="stk.cat"] .chip')].map(b=>b.dataset.v).join(',')`)) === 'bomding,yeongdo,deco,label,point,paper,photo');
const keepId = (await S()).objs.find(o => o.t === 'stk').id;
const keepCol = (await S()).objs.find(o => o.t === 'vec').col;
await click('#phPks .ph-pk[data-pack="yeongdo"]'); await sleep(500);
s = await S();
chk('영도로 바꾸면 기본색이 영도 그린 · 서명 글자 «영도»', s.pref.pack === 'yeongdo' && s.pref.lineCol === '#15A05A' && s.pref.penCol === '#15A05A' && s.pref.sigTx === '영도', s.pref);
chk('이미 올린 개체는 그대로(팩은 앞으로 만들 것만 바꾼다)', s.objs.find(o => o.id === keepId) && s.objs.find(o => o.t === 'vec').col === keepCol, { keepCol, now: s.objs.find(o => o.t === 'vec').col });
chk('팔레트가 영도 색(그린·민트·틸)', await ev(`(()=>{const c=[...document.querySelectorAll('#phPb [data-color] .ph-sw')].map(b=>b.dataset.c);return c.includes('#15A05A')&&c.includes('#14B8A6')&&c.includes('#0F7C86')&&!c.includes('#C93C7C')})()`), await ev(`[...document.querySelectorAll('#phPb [data-color] .ph-sw')].map(b=>b.dataset.c).join(',')`));
await click('[data-chip="stk.cat"] .chip[data-v="yeongdo"]'); await sleep(300);
chk('영도 스티커 12 · 목록 그림 로드', await waitFor(`(()=>{const im=[...document.querySelectorAll('#phStk img')];return im.length===12&&im.every(i=>i.complete&&i.naturalWidth>0)&&im.every(i=>/\\/yd_/.test(i.src))})()`, 8000), await ev(`[...document.querySelectorAll('#phStk img')].map(i=>i.src.split('/').pop()).join(',')`));
const nY = (await S()).objs.length;
await click('#phStk .ph-sk[data-stk="yd_thumbs"]'); await sleep(900); s = await S();
const ydObj = s.objs[s.objs.length - 1];
chk('영도 스티커 넣기 → 개체·팩 기록', s.objs.length === nY + 1 && ydObj.t === 'stk' && ydObj.src === 'yd_thumbs', ydObj);
chk('영도 스티커 원본 webp 200', netPhoto.some(([u, st]) => /stk\/yd_thumbs\.webp/.test(u) && st === 200), netPhoto.slice(-3));
/* 텍스트 스타일도 팩을 따른다 */
await T(`setTool('text')`); await sleep(300); await panelScroll();
chk('텍스트 스타일 12', (await ev(`document.querySelectorAll('[data-tile="text.st"] .ph-tile').length`)) === 12);
await T(`addText('영도 한 줄')`); await sleep(400);
await click('[data-tile="text.st"] .ph-tile[data-v="label"]'); await sleep(300); s = await S();
const ydTx = s.objs.find(o => o.t === 'text' && o.tx === '영도 한 줄');
chk('영도 팩 라벨 텍스트 = 그린 바탕', ydTx && ydTx.bg === '#15A05A' && ydTx.pk === 'yeongdo', ydTx);
chk('영도 라벨 글자색은 대비로 고른다(≥4.5:1 — 흰 글자면 3.38 로 AA 미달)', !!ydTx && CR(ydTx.col, ydTx.bg) >= 4.5, ydTx && { col: ydTx.col, bg: ydTx.bg, cr: CR(ydTx.col, ydTx.bg) });
/* 영도 서명(캐릭터 얼굴) */
await T(`setTool('sig')`); await sleep(300); await panelScroll();
await T(`addSig('mascot')`); await sleep(900); s = await S();
const ydSig = s.objs.find(o => o.t === 'sig');
chk('영도 서명 = 캐릭터 · 글자 «영도»', ydSig && ydSig.pk === 'yeongdo' && ydSig.tx === '영도', ydSig);
chk('영도 얼굴 yd_face.webp 200', netPhoto.some(([u, st]) => /stk\/yd_face\.webp/.test(u) && st === 200), netPhoto.slice(-3));
await T(`select(${JSON.stringify(ydSig ? ydSig.id : '')})`);
await click('#phPb [data-act="delSig"]'); await sleep(200);
await T(`select(${JSON.stringify(ydTx ? ydTx.id : '')})`); await sleep(200);
await click('#phPb [data-act="del"]'); await sleep(200);
await T(`select(${JSON.stringify(ydObj.id)})`); await sleep(200);
await click('#phPb [data-act="del"]'); await sleep(250);
await click('#phPks .ph-pk[data-pack="bomding"]'); await sleep(400);
chk('봄딩으로 되돌리기', (await S()).pref.pack === 'bomding');
await T(`setTool('text')`); await sleep(300); await panelScroll();
await T(`addText('봄딩 라벨 대비')`); await sleep(350);
await click('[data-tile="text.st"] .ph-tile[data-v="label"]'); await sleep(250);
s = await S(); const bdTx = s.objs.find(o => o.t === 'text' && o.tx === '봄딩 라벨 대비');
chk('봄딩 라벨은 흰 글자 그대로(4.75:1)', !!bdTx && bdTx.col === '#FFFFFF' && bdTx.bg === '#C93C7C' && CR(bdTx.col, bdTx.bg) >= 4.5, bdTx && { col: bdTx.col, bg: bdTx.bg, cr: CR(bdTx.col, bdTx.bg) });
await T(`select(${JSON.stringify(bdTx ? bdTx.id : '')})`); await sleep(150);
await click('#phPb [data-act="del"]'); await sleep(200);
await T(`setTool('sticker')`); await sleep(250);
await shot('04b-yeongdo');

/* 도형 · 돋보기 · 번호 */
await T(`setTool('shape')`); await sleep(300); await panelScroll();
await click('[data-tile="shape"] .ph-tile[data-v="rect"]');
let a = await T('d2c(80,480)'), b = await T('d2c(380,680)');
await drag(a.x, a.y, b.x, b.y); s = await S(); const rc = s.objs[s.objs.length - 1];
chk('사각형 끌어 그리기 → 300×200 근처', rc.t === 'shape' && rc.k === 'rect' && Math.abs(rc.w - 300) < 8 && Math.abs(rc.h - 200) < 8, rc);
await click('[data-tile="shape"] .ph-tile[data-v="arrow"]');
a = await T('d2c(500,700)'); b = await T('d2c(760,560)'); await drag(a.x, a.y, b.x, b.y); s = await S(); const arw = s.objs[s.objs.length - 1];
chk('화살표 → 끝점', arw.t === 'arrow' && Math.abs(arw.x2 - 760) < 6 && Math.abs(arw.y2 - 560) < 6, arw);
const p2h = await rect('.ph-h[data-h="p2"]'); await drag(p2h.cx, p2h.cy, p2h.cx + 30, p2h.cy + 30); s = await S();
chk('화살표 끝점 손잡이 끌기', s.objs.find(o => o.id === arw.id).x2 > arw.x2 + 10);
await click('[data-tile="shape"] .ph-tile[data-v="lens"]');
a = await T('d2c(150,120)'); b = await T('d2c(190,120)'); await drag(a.x, a.y, b.x, b.y); s = await S(); const lns = s.objs[s.objs.length - 1];
chk('돋보기 → 원본 원(반지름≈40) + 2배 렌즈', lns.t === 'lens' && Math.abs(lns.sr - 40) < 5 && Math.abs(lns.w / 2 - 2 * lns.sr) < 2, lns);
await click('[data-tile="shape"] .ph-tile[data-v="num"]');
a = await T('d2c(1000,120)'); await clickXY(a.x, a.y); a = await T('d2c(1100,120)'); await clickXY(a.x, a.y); s = await S();
const nums = s.objs.filter(o => o.t === 'vec' && o.k === 'num').map(o => o.tx);
chk('번호 → 누를 때마다 1, 2', nums.join(',') === '1,2', nums);

/* 도형 15종 · 손그림 (09-12 사용자 요청 2) */
chk('도형 타일 15(사각·둥근·원·삼각·별·하트·말풍선·구름·폭탄·물결·선·화살표·형광·돋보기·번호)',
  (await ev(`[...document.querySelectorAll('[data-tile="shape"] .ph-tile')].map(b=>b.dataset.v).join(',')`)) === 'rect,round,ellipse,tri,star,heart,bubble,thought,burst,wave,line,arrow,hl,lens,num',
  await ev(`[...document.querySelectorAll('[data-tile="shape"] .ph-tile')].map(b=>b.dataset.v).join(',')`));
for (const [kind, label] of [['heart', '하트'], ['bubble', '말풍선'], ['thought', '구름 말풍선'], ['star', '별'], ['wave', '물결선'], ['tri', '삼각형'], ['burst', '폭탄 말풍선']]) {
  const picked = await pickShape(kind);
  const before = await T('exportRegion(440,140,240,180)');
  a = await T('d2c(450,150)'); b = await T('d2c(670,310)'); await drag(a.x, a.y, b.x, b.y); await sleep(150);
  s = await S(); const ob = s.objs[s.objs.length - 1];
  const after = await T('exportRegion(440,140,240,180)');
  chk(`${label} 끌어 그리기 → 개체 + 실제로 그려짐`, picked && ob.t === 'shape' && ob.k === kind && (after.mean !== before.mean || after.vari !== before.vari),
    { picked, k: ob.k, before: [before.mean, before.vari], after: [after.mean, after.vari] });
  await click('#phPb [data-act="del"]'); await sleep(150);
}
await pickShape('ellipse');
a = await T('d2c(450,150)'); b = await T('d2c(670,310)'); await drag(a.x, a.y, b.x, b.y); await sleep(150);
s = await S(); const smoothOb = s.objs[s.objs.length - 1];
const smoothPx = await T('exportRegion(440,140,240,180)');
await click('[data-chip="shape.hand"] .chip[data-v="on"]'); await sleep(250);
s = await S(); const handOb = s.objs.find(o => o.id === smoothOb.id);
const handPx = await T('exportRegion(440,140,240,180)');
chk('손그림 칩 → 고른 도형이 손그림으로 · 그림이 실제로 달라진다', handOb && handOb.hand === true && (handPx.mean !== smoothPx.mean || handPx.vari !== smoothPx.vari), { hand: handOb && handOb.hand, smooth: [smoothPx.mean, smoothPx.vari], hand2: [handPx.mean, handPx.vari] });
chk('손그림은 개체마다 고정(다시 그려도 같은 그림)', (await T('exportRegion(440,140,240,180)')).vari === handPx.vari);
await click('#phPb [data-act="del"]'); await sleep(200);
await click('[data-chip="shape.hand"] .chip[data-v="off"]'); await sleep(200);
chk('손그림 끄기(다음에 만들 도형은 매끈)', (await S()).pref.hand === false);

/* 사진 밖에서는 아무것도 만들지 않는다 (09-12 사용자 지적 3) */
await pickShape('rect');
const nOut = (await S()).objs.length;
chk('사진 밖 판정', (await T('inPhoto(600,400)')) === true && (await T('inPhoto(600,-160)')) === false);
let o1 = await T('d2c(600,-170)'), o2 = await T('d2c(900,-40)');
await drag(o1.x, o1.y, o2.x, o2.y); await sleep(200);
chk('사진 위쪽 바깥에서 끌어도 도형이 안 생긴다', (await S()).objs.length === nOut, { n0: nOut, n1: (await S()).objs.length });
await T(`setTool('text')`); await sleep(250);
o1 = await T('d2c(600,-170)'); await clickXY(o1.x, o1.y); await sleep(300);
chk('사진 밖을 눌러도 텍스트가 안 생긴다', (await S()).objs.length === nOut, { n: (await S()).objs.length });
await T(`setTool('mosaic')`); await sleep(250);
o1 = await T('d2c(200,-170)'); o2 = await T('d2c(500,-40)'); await drag(o1.x, o1.y, o2.x, o2.y); await sleep(200);
chk('사진 밖에서 끌어도 모자이크가 안 생긴다', (await S()).objs.length === nOut);
await T(`setTool('draw')`); await sleep(250);
o1 = await T('d2c(200,-170)'); o2 = await T('d2c(500,-150)'); await drag(o1.x, o1.y, o2.x, o2.y, 8); await sleep(200);
chk('사진 밖에서 그어도 획이 안 생긴다', (await S()).objs.length === nOut);
/* 이미 올린 개체를 밖으로 끌면 가운데는 사진 안에 남는다 */
await T(`setTool('sticker')`); await sleep(250);
s = await S(); const mv = s.objs.find(o => o.t === 'stk');
await T(`select(${JSON.stringify(mv.id)})`); await sleep(200);
let m1 = await T(`d2c(${mv.x},${mv.y})`), m2 = await T('d2c(600,-300)');
await drag(m1.x, m1.y, m2.x, m2.y, 10); await sleep(200);
s = await S(); const mv2 = s.objs.find(o => o.id === mv.id);
chk('개체를 사진 밖으로 끌어도 가운데는 사진 안', mv2.y >= 0 && mv2.y <= 800 && mv2.x >= 0 && mv2.x <= 1200, mv2);
await shot('05b-bounds');

/* 그리기 · 지우개 */
await T(`setTool('draw')`); await sleep(300); await panelScroll();
a = await T('d2c(650,120)'); b = await T('d2c(1050,300)');
await drag(a.x, a.y, b.x, b.y, 16); s = await S(); const pen = s.objs[s.objs.length - 1];
chk('펜 긋기 → 획', pen.t === 'pen' && pen.n > 5, pen);
await click('[data-chip="pen.mode"] .chip[data-v="erase"]');
a = await T('d2c(850,110)'); b = await T('d2c(850,330)'); await drag(a.x, a.y, b.x, b.y, 12); s = await S();
chk('지우개 → 지나간 획 삭제', !s.objs.some(o => o.id === pen.id));
/* 펜 모드 칩을 누른 뒤에도 색·두께·획이 살아 있어야 한다(09-12 리뷰어 🔴 — PREF.pen 이 모드 문자열과 설정 객체를 겸용해 칩 한 번에 설정이 깨졌다) */
await click('[data-chip="pen.mode"] .chip[data-v="hl"]'); await sleep(250);
chk('형광펜 칩 → 색 줄·두께 숫자 칸 살아 있음', await ev(`(()=>{const n=document.querySelector('.ph-sl[data-sl="pen.hlw"] input[type=number]');return !!document.querySelector('[data-color="pen.hl"]')&&!!n&&n.value!==''&&+n.value>0})()`), await ev(`(()=>{const n=document.querySelector('.ph-sl[data-sl="pen.hlw"] input[type=number]');return n&&n.value})()`));
await click('[data-color="pen.hl"] .ph-sw[data-c="#34C79A"]');
await setInput('.ph-sl[data-sl="pen.hlw"] input[type=number]', '40'); await sleep(200);
const hlBefore = await T('exportRegion(660,215,200,30)');
a = await T('d2c(650,230)'); b = await T('d2c(870,230)'); await drag(a.x, a.y, b.x, b.y, 12); s = await S(); const hl2 = s.objs[s.objs.length - 1];
const hlAfter = await T('exportRegion(660,215,200,30)');
chk('형광펜 획 = 고른 색·유효 두께·실제로 그려짐', hl2.t === 'pen' && hl2.hl === true && hl2.col === '#34C79A' && hl2.sw > 1 && Math.abs(hlAfter.mean - hlBefore.mean) > 3, { t: hl2.t, hl: hl2.hl, col: hl2.col, sw: hl2.sw, before: hlBefore.mean, after: hlAfter.mean });
await click('[data-chip="pen.mode"] .chip[data-v="pen"]'); await sleep(250);
a = await T('d2c(650,300)'); b = await T('d2c(870,300)'); await drag(a.x, a.y, b.x, b.y, 12); s = await S(); const pen3 = s.objs[s.objs.length - 1];
chk('펜으로 돌아와도 펜 색·두께 그대로', pen3.t === 'pen' && pen3.hl === false && /^#[0-9A-F]{6}$/i.test(pen3.col) && pen3.sw > 1, { t: pen3.t, hl: pen3.hl, col: pen3.col, sw: pen3.sw });

/* 모자이크 */
await T(`setTool('mosaic')`); await sleep(300); await panelScroll();
const vBefore = (await T('exportRegion(620,370,160,60)')).vari;
a = await T('d2c(600,340)'); b = await T('d2c(800,460)'); await drag(a.x, a.y, b.x, b.y); s = await S(); const mo = s.objs[s.objs.length - 1];
chk('모자이크 끌기(봄딩 스티커 위에서 시작) → 새 영역 · 도구 유지', mo.t === 'mosaic' && Math.abs(mo.w - 200) < 8 && s.tool === 'mosaic', { t: mo.t, w: mo.w, tool: s.tool });
const vAfter = (await T('exportRegion(620,370,160,60)')).vari;
chk('모자이크 → 줄무늬 분산 감소', vAfter < vBefore * 0.6, { vBefore, vAfter });
await click('[data-chip="mos.mode"] .chip[data-v="blur"]'); s = await S();
chk('흐림으로 바꾸면 선택 영역에 반영', s.objs.find(o => o.id === mo.id).mode === 'blur');

/* 레이어 · 되돌리기 버튼 */
s = await S();
const layN = await ev(`document.querySelectorAll('#phLays .ph-lay').length`);
chk('레이어 목록 = 개체 수 · 맨 위가 가장 앞', layN === s.objs.length && (await ev(`document.querySelector('#phLays .lsel').dataset.lsel`)) === s.objs[s.objs.length - 1].id, { layN, n: s.objs.length });
const topId = s.objs[s.objs.length - 1].id;
await click(`#phLays .lb[data-lmove="down"][data-id="${topId}"]`); s = await S();
chk('레이어 ↓ → 한 칸 뒤로', s.objs[s.objs.length - 2].id === topId);
/* 레이어 서랍 — 설정이 길어도 늘 보인다 · 숨김 · 접기 (09-12 사용자 지적 4) */
chk('레이어가 설정 열 바닥에 고정(설정만 스크롤)', await ev(`(()=>{const p=document.getElementById('phPanel'),sc=document.getElementById('phScroll'),ly=document.getElementById('phLaySec');
  if(!sc||!ly||ly.hidden)return false;
  const pr=p.getBoundingClientRect(), lr=ly.getBoundingClientRect();
  return Math.abs(lr.bottom-pr.bottom)<2&&lr.top>pr.top&&p.scrollHeight<=p.clientHeight+1})()`));
const longTools = ['sig', 'text', 'shape'];
let alwaysOn = true, seen = [];
for (const tl of longTools) {
  await T(`setTool('${tl}')`); await sleep(300);
  const v = await ev(`(()=>{const p=document.getElementById('phPanel'),ly=document.getElementById('phLaySec');const pr=p.getBoundingClientRect(),lr=ly.getBoundingClientRect();
    return {vis:lr.height>40&&lr.bottom<=pr.bottom+1&&lr.top>=pr.top, top:Math.round(lr.top-pr.top), h:Math.round(lr.height)}})()`);
  seen.push([tl, v.top, v.h]); if (!v.vis) alwaysOn = false;
}
chk('설정이 긴 도구(서명·텍스트·도형)에서도 레이어가 그대로 보인다', alwaysOn, seen);
chk('도구를 바꾸면 설정은 맨 위부터', await ev(`document.getElementById('phScroll').scrollTop===0`));
await T(`setTool('sticker')`); await sleep(300);
s = await S(); const hideId = s.objs[s.objs.length - 1].id;
const beforeHide = await T('exportInfo()');
await click(`#phLays .lb[data-lmove="hide"][data-id="${hideId}"]`); await sleep(300);
s = await S();
chk('레이어 눈 → 잠깐 숨김(목록에는 남는다)', (await ev(`document.querySelectorAll('#phLays .ph-lay').length`)) === s.objs.length && (await ev(`!!document.querySelector('#phLays .ph-lay.off')`)));
const afterHide = await T('exportInfo()');
chk('숨긴 개체는 내보내기에도 안 나온다', afterHide.size !== beforeHide.size, { before: beforeHide.size, after: afterHide.size });
await click(`#phLays .lb[data-lmove="hide"][data-id="${hideId}"]`); await sleep(300);
chk('다시 보이기', !(await ev(`!!document.querySelector('#phLays .ph-lay.off')`)));
await click('#phLayH'); await sleep(250);
chk('레이어 접기 → 목록 감춤(머리는 남는다)', await ev(`(()=>{const ly=document.getElementById('phLaySec');return ly.classList.contains('closed')&&getComputedStyle(document.getElementById('phLays')).display==='none'&&document.getElementById('phLayH').offsetHeight>20})()`));
await click('#phLayH'); await sleep(250);
chk('다시 펼치기', await ev(`!document.getElementById('phLaySec').classList.contains('closed')`));

const hi0 = (await S()).hist.i;
await click('#phUndo'); chk('되돌리기 버튼', (await S()).hist.i === hi0 - 1);
await click('#phRedo'); chk('다시 하기 버튼', (await S()).hist.i === hi0);

/* 내보내기 */
let ex = await T('exportInfo()');
chk('PNG · 파일명 <원본>_편집_1200.png', ex.type === 'image/png' && ex.W === 1200 && ex.H === 800 && ex.name === '시험사진_편집_1200.png' && ex.size > 1000, ex);
await ev(`(()=>{const e=document.getElementById('phFmt');e.value='jpg';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
ex = await T('exportInfo()');
chk('JPG 선택 → image/jpeg · .jpg', ex.type === 'image/jpeg' && /\.jpg$/.test(ex.name), ex);
await T(`setTool('mask')`); await sleep(300); await click('[data-tile="mask"] .ph-tile[data-v="circle"]'); await click('[data-chip="mask.bg"] .chip[data-v="clear"]');
ex = await T('exportInfo()');
chk('투명 마스크면 JPG 선택이어도 PNG', ex.type === 'image/png', ex);
await click('#phReset'); await sleep(200);
await ev(`(()=>{const e=document.getElementById('phFmt');e.value='auto';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const dlSet = await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT, eventsEnabled: true });
await click('#phSave');
chk('저장 → 토스트(파일명·크기)', await waitFor(`/시험사진_편집_1200\\.png/.test((document.querySelector('.toast.on')||{}).textContent||'')`, 6000), await ev(`(document.querySelector('.toast.on')||{}).textContent`));
let saved = false;
for (let i = 0; i < 30 && !saved; i++) { saved = existsSync(join(OUT, '시험사진_편집_1200.png')); if (!saved) await sleep(200); }
chk('저장 파일 실제로 떨어짐', saved, { OUT, dl: dlSet && dlSet.error ? dlSet.error : 'ok', ev: dlEv.join(' | '), ls: readdirSync(OUT).join(',') });
await click('#phCopy');
chk('복사 → «클립보드에 복사했어요»', await waitFor(`/클립보드에 복사/.test((document.querySelector('.toast.on')||{}).textContent||'')`, 6000), await ev(`(document.querySelector('.toast.on')||{}).textContent`));

/* 포커스 링 */
await T(`setTool('text')`); await sleep(300);
/* 포커스는 실제 클릭으로 준다 — 헤드리스에서 JS focus() 만으로는 :focus 가 안 잡힌다(verify-tier 와 같은 방식) */
await click('#phPb .ph-hex'); await sleep(320);   /* box-shadow 전환 220ms 가 끝난 뒤 잰다 */
chk('HEX 칸 포커스 링 2px 잉크(실클릭)', /0px 0px 0px 2px/.test(await ev(`getComputedStyle(document.querySelector('#phPb .ph-hex')).boxShadow`)), await ev(`getComputedStyle(document.querySelector('#phPb .ph-hex')).boxShadow`));
await click('#phPb .ph-nm input'); await sleep(320);
chk('숫자 칸 포커스 링 2px 잉크(실클릭)', /0px 0px 0px 2px/.test(await ev(`getComputedStyle(document.querySelector('#phPb .ph-nm input')).boxShadow`)), await ev(`getComputedStyle(document.querySelector('#phPb .ph-nm input')).boxShadow`));
await shot('05-full-1920');

/* 자동 보관 → 새로고침 → 이어서 편집 · 탭 이탈/복귀 */
s = await S(); const nObj = s.objs.length;
await T('flushSave()');
/* v1 문서 이어받기 — 보관본을 옛 형태(도형이 t:'rect' · 팩 표시 없음)로 바꿔 두고 복원되는지 본다 */
const v1id = await ev(`(async()=>{
  const db=await new Promise((res,rej)=>{const r=indexedDB.open('sseudam_photo',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const rec=await new Promise((res,rej)=>{const q=db.transaction('work','readonly').objectStore('work').get('cur');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
  if(!rec||!rec.doc)return '';
  const sh=rec.doc.objs.filter(o=>o.t==='shape')[0]; if(!sh)return '';
  sh.t = sh.k==='ellipse'?'ellipse':'rect'; sh.rad = sh.k==='round'?0.2:0; delete sh.k; delete sh.pk;
  rec.doc.objs.forEach(o=>{ delete o.pk; });
  await new Promise((res,rej)=>{const q=db.transaction('work','readwrite').objectStore('work').put(rec,'cur');q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});
  return sh.id;
})()`);
await open(1920, 1080, false); await gotoPhoto(); await sleep(600);
chk('새로고침 뒤 «이어서 편집»(이름·시간)', await waitFor(`(()=>{const b=document.getElementById('phResume');return b&&!b.hidden&&getComputedStyle(b).display!=='none'&&/시험사진/.test(b.textContent)})()`, 5000), await ev(`(document.getElementById('phResume')||{}).textContent`));
await click('#phResume'); await sleep(1000); s = await S();
chk('이어서 편집 → 사진·개체 복원', s.doc && s.objs.length === nObj && s.odim.w === 1200, { n: s.objs.length, nObj });
await click('.isl-tab[data-v="home"]'); await sleep(700); await gotoPhoto(); await sleep(400); s = await S();
chk('탭 이탈/복귀 → 작업 그대로', s.doc && s.objs.length === nObj);
const v1ob = v1id ? s.objs.find(o => o.id === v1id) : null;
chk('v1 문서 이어받기 — 옛 도형(t:rect)이 shape 로 옮겨지고 팩 없는 개체도 살아난다', !!v1id && !!v1ob && v1ob.t === 'shape' && !!v1ob.k, { v1id, v1ob });
chk('콘솔 오류 0(1920)', logs.length === 0, logs.slice(0, 5));

/* ══════════ 1366×768 ══════════ */
console.log('\n[1366×768]');
await open(1366, 768, false); await gotoPhoto(); await sleep(500);
await click('#phResume'); await sleep(900);
/* 넘침은 innerWidth 가 뷰포트 폭 그대로인지까지 본다 — 넘치면 innerWidth 도 같이 커져 scrollWidth<=innerWidth 가 통과해 버린다(표 제작 게이트 09-12 교훈) */
const l2 = await ev(`(()=>{const ph=document.querySelector('.ph').getBoundingClientRect(),core=document.getElementById('tbHost').getBoundingClientRect(),st=document.getElementById('phStage').getBoundingClientRect(),pn=document.getElementById('phPanel').getBoundingClientRect(),act=document.getElementById('phAct').getBoundingClientRect();return{phW:Math.round(ph.width),coreW:Math.round(core.width),stW:Math.round(st.width),pnW:Math.round(pn.width),actH:Math.round(act.height),ovf:document.documentElement.scrollWidth-innerWidth,iw:innerWidth}})()`);
chk('1366: 작업대 = 판 폭 · 설정 열 320 · 스테이지 ≥ 560 · 넘침 0', l2.phW === l2.coreW && l2.pnW === 320 && l2.stW >= 560 && l2.ovf <= 0 && l2.iw === 1366, l2);
chk('1366: 내보내기 줄 한 줄(≤ 56px)', l2.actH <= 56, l2);
chk('1366: 레일 12개가 스크롤 없이 다 보인다', await ev(`(()=>{const r=document.getElementById('phRail');return r.scrollHeight<=r.clientHeight+1&&document.querySelectorAll('.ph-ri').length===12})()`), await ev(`(()=>{const r=document.getElementById('phRail');return [r.scrollHeight,r.clientHeight]})()`));
await shot('06-1366');

/* ══════════ 390×844 ══════════ */
console.log('\n[390×844]');
await open(390, 844, true); await gotoPhoto(); await sleep(600);
await click('#phResume'); await sleep(900);
const l3 = await ev(`(()=>{const r=document.getElementById('phRail').getBoundingClientRect(),st=document.getElementById('phStage').getBoundingClientRect(),pn=document.getElementById('phPanel').getBoundingClientRect(),rail=document.getElementById('phRail');return{railAbove:r.bottom<=st.top+1,panelBelow:pn.top>=st.bottom,railScroll:rail.scrollWidth>rail.clientWidth,ovf:document.documentElement.scrollWidth-innerWidth,stH:Math.round(st.height)}})()`);
chk('390: 레일(가로 스크롤) → 스테이지 → 설정 · 넘침 0', l3.railAbove && l3.panelBelow && l3.railScroll && l3.ovf <= 0 && l3.stH >= 300, l3);
await shot('07-mobile-390');
chk('콘솔 오류 0(전체)', logs.length === 0, logs.slice(0, 5));

console.log(`\n${R.length - fail}/${R.length} 통과`);
writeFileSync(join(OUT, 'verify-photo.json'), JSON.stringify({ at: new Date().toISOString(), pass: R.length - fail, total: R.length, results: R, logs, netPhoto }, null, 1));
ws.close(); chrome.kill(); srv.close();
process.exit(fail ? 1 : 0);
