// verify-tier.mjs — 도구함 「티어표 제작」(_toolbox/tier.js) 헤드리스 검증 (2026-09-07)
//   node _tools/verify-tier.mjs [--out DIR]
//   · verify-toolbox.mjs 와 같은 하네스(로컬 정적 서버 + 크롬 헤드리스 CDP, 의존성 0). 축하 스플래시 ?cheer=0, 라이브 백엔드 차단.
//   · 1920×1080: 도구 목록 2개 → 티어 도구 로드 → 기본 보드(5단계·빈 슬롯 16) → 제목·파일명 → 항목 추가(쉼표) → 모노그램 →
//                이름 편집 → ▲▼(티어 경계 넘김) → 티어 선택 이동 → 캔버스 드래그(실제 마우스) → 클릭 선택 → 프리셋 → 티어 추가/삭제 →
//                한 줄 수·순위·이름·모양 → 포인트 색 → 이미지 등록 → PNG blob → 탭 이탈·복귀(상태 유지) → 라벨 12.5px 하한 → 콘솔 0
//   · 390×844: 단일 열 · 가로 넘침 0 · 터치 타깃 · 콘솔 0
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
  await mouse('mouseMoved', r.cx, r.cy); await mouse('mousePressed', r.cx, r.cy); await mouse('mouseReleased', r.cx, r.cy);
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
/* 캔버스 영역의 픽셀 분산 — 0 이면 빈 캔버스(캔버스 좌표 x,y,w,h) */
const cvVar = (x, y, w, h) => ev(`(()=>{const c=document.getElementById('tiCanvas');if(!c)return -1;const d=c.getContext('2d').getImageData(${x},${y},${w},${h}).data;let s=0,s2=0,n=0;for(let i=0;i<d.length;i+=16){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return Math.round(s2/n-m*m)})()`);
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
/* 캔버스 좌표 → 화면 좌표. 편집 열의 scrollIntoView 가 캔버스를 뷰포트 밖으로 밀어 두므로, 먼저 그 캔버스 y 가 화면 가운데 오게 스크롤한다 */
const scrollCv = async (cy) => { await ev(`(()=>{const r=document.getElementById('tiCanvas').getBoundingClientRect();const k=r.width/1000;scrollTo(0,Math.max(0,r.top+scrollY+${cy}*k-innerHeight/2))})()`); await sleep(200); };
const cvToClient = async (x, y) => { const r = await rect('#tiCanvas'); const k = r.w / 1000; return { x: r.x + x * k, y: r.y + y * k }; };

/* ══════════ 1920×1080 ══════════ */
console.log('\n[1920×1080]');
await open(1920, 1080, false);
await ev(`localStorage.removeItem('sseudam_tier_v1')`);
chk('탭 4개', (await ev(`[...document.querySelectorAll('.isl-tab')].map(b=>b.dataset.v).join(',')`)) === 'home,posts,trend,tools');
const t0 = Date.now();
chk('도구함 진입 → 티어 도구 로드', await gotoTier(), { ms: Date.now() - t0 });
chk('도구 목록 2개(썸네일·티어표) · 메타 «2 도구»', await ev(`[...document.querySelectorAll('#tbList .tb-item')].map(b=>b.dataset.t).join(',')==='thumb,tier'&&document.getElementById('pmeta').textContent.includes('2')`), await ev(`document.getElementById('pmeta').textContent`));
chk('목록 행 = 아이콘 + «티어표 제작» 한 줄 · 선택 표시', await ev(`(()=>{const b=document.querySelector('#tbList .tb-item.on[data-t="tier"][aria-pressed="true"]');return !!b&&b.textContent.trim()==='티어표 제작'&&!!b.querySelector('.tb-ic svg')})()`));
await T('reset()'); await sleep(300);
const s0 = await state();
chk('기본 보드 = 5단계(S A B C D) · 빈 슬롯 16', s0 && s0.board.tiers.length === 5 && s0.board.tiers.map(t => t.letter).join('') === 'SABCD' && s0.board.tiers.reduce((a, t) => a + t.items.length, 0) === 16 && s0.board.tiers.every(t => t.items.every(i => !i.name)), s0 && s0.board.tiers.map(t => t.letter + t.items.length));
chk('기본 디자인 = 로즈 · 4열 · 순위 · 이름 · 둥근 사각', s0 && s0.design.accent === 'bd-rose' && s0.design.cols === 4 && s0.design.rank === true && s0.design.names === true && s0.design.shape === 'square', s0 && s0.design);
const L0 = await T('layout()');
chk('캔버스 높이 자동(> 900) · 타일 179', L0 && L0.H > 900 && L0.tile === 179, L0);
chk('캔버스 크기 속성 = 1000×H', await ev(`(()=>{const c=document.getElementById('tiCanvas');return c.width===1000&&c.height===${L0 && L0.H}})()`));
chk('플라크가 그려짐(S 띠 왼쪽 분산 > 0)', (await cvVar(46, L0.bands[0].y + 24, 112, 100)) > 0);
chk('빈 슬롯(점선)이 그려짐', (await cvVar(184, L0.bands[0].y + 24, 179, 179)) > 0);
chk('검사 목록: 항목 16 · 양식 상태', await ev(`document.getElementById('tiChk').textContent`), await ev(`document.getElementById('tiChk').textContent`));
chk('검사 문구에 «양식 상태»·«빈 슬롯 16»', await ev(`(()=>{const t=document.getElementById('tiChk').textContent;return t.includes('양식 상태')&&t.includes('16')})()`));
await shot('01-tier-default-1920');

/* 제목 · 부제 · 기준 · 서명 */
await setInput('#tiTitle', '메이플 전직업 티어표'); await setInput('#tiSub', '2026년 9월 · 보스 딜 기준'); await setInput('#tiStamp', 'v1.2 패치 · 9.7 기준'); await sleep(300);
const s1 = await state();
chk('보드 문구 반영', s1.board.title === '메이플 전직업 티어표' && s1.board.sub === '2026년 9월 · 보스 딜 기준' && s1.board.stamp === 'v1.2 패치 · 9.7 기준' && s1.board.sign === '봄딩', s1.board);
chk('제목 글자수 카운터', (await ev(`document.getElementById('tiTitleCnt').textContent`)) === '11/40', await ev(`document.getElementById('tiTitleCnt').textContent`));
const fn1 = await T('fileName()');
chk('파일명 = <제목>_1000x<H>.png', /^메이플_전직업_티어표_1000x\d+\.png$/.test(fn1), fn1);
chk('파일명이 화면에', (await ev(`document.getElementById('tiFn').textContent`)) === fn1);

/* 항목 추가 — 쉼표 여러 개, Enter */
await click('#tiNew'); await setInput('#tiNew', '아델, 카데나, 제로'); await key('Enter', 13, '\r'); await sleep(350);
const s2 = await state();
chk('쉼표 3개 → S 티어에 3항목 추가(3+3=6) · 마지막이 선택', s2.board.tiers[0].items.length === 6 && s2.board.tiers[0].items.slice(3).map(i => i.name).join(',') === '아델,카데나,제로' && s2.sel === s2.board.tiers[0].items[5].id, s2.board.tiers[0].items);
chk('추가 후 입력칸 비움 · 포커스 유지', await ev(`document.getElementById('tiNew').value===''&&document.activeElement===document.getElementById('tiNew')`));
const L1 = await T('layout()');
chk('S 띠가 2줄(6/4)로 자라 높이 증가', L1.H > L0.H && L1.bands[0].tiles === 6, { H0: L0.H, H1: L1.H, b: L1.bands[0] });
const hits1 = await T('hits()');
const adel = hits1.find(h => h.i === 3 && h.ti === 0);
chk('모노그램 타일(아델) 그려짐', adel && (await cvVar(adel.x + 20, adel.y + 20, adel.w - 40, adel.h - 40)) > 0, adel);
chk('순위 번호 = 전체 통산(아델=4)', adel && adel.rank === 4, adel);
chk('편집 열 행 = 19개(16+3) · 아델 행에 모노그램 «아»', await ev(`(()=>{const rows=[...document.querySelectorAll('.tier-it')];const r=rows.find(x=>x.querySelector('input').value==='아델');return rows.length===19&&!!r&&r.querySelector('.tier-th').textContent.trim()==='아'})()`), await ev(`document.querySelectorAll('.tier-it').length`));
await shot('02-tier-items-1920');

/* 이름 편집(행 입력) */
await setInput('.tier-it[data-id="' + adel.id + '"] .tier-in', '아델(보스)'); await sleep(250);
chk('행 이름 입력 → 상태·모노그램 갱신', (await state()).board.tiers[0].items[3].name === '아델(보스)' && (await ev(`document.querySelector('.tier-it[data-id="${adel.id}"] .tier-th').textContent.trim()`)) === '아');

/* ▲▼ — 티어 경계를 넘는다 */
const zeroId = s2.board.tiers[0].items[5].id;
await click('.tier-it[data-id="' + zeroId + '"] [data-act="down"]'); await sleep(300);
const s3 = await state();
chk('S 마지막 항목 ▼ → A 첫 항목으로', s3.board.tiers[0].items.length === 5 && s3.board.tiers[1].items[0].id === zeroId, { s: s3.board.tiers[0].items.length, a0: s3.board.tiers[1].items[0] });
chk('이동 후 포커스가 그 행 ▼에', await ev(`document.activeElement&&document.activeElement.dataset.act==='down'&&document.activeElement.closest('.tier-it').dataset.id==='${zeroId}'`));
await click('.tier-it[data-id="' + zeroId + '"] [data-act="up"]'); await sleep(300);
chk('A 첫 항목 ▲ → S 마지막으로 복귀', (await state()).board.tiers[0].items[5].id === zeroId);
chk('맨 위 항목의 ▲·맨 아래 항목의 ▼ 는 비활성', await ev(`(()=>{const rows=[...document.querySelectorAll('.tier-it')];return rows[0].querySelector('[data-act="up"]').disabled&&rows[rows.length-1].querySelector('[data-act="down"]').disabled&&!rows[1].querySelector('[data-act="up"]').disabled})()`));

/* 티어 선택(셀렉트)으로 이동 */
await setInput('.tier-it[data-id="' + zeroId + '"] .tier-sel', '2'); await sleep(300);
const s4 = await state();
chk('티어 선택 B → B 마지막으로 이동', s4.board.tiers[2].items[s4.board.tiers[2].items.length - 1].id === zeroId && s4.board.tiers[0].items.length === 5, s4.board.tiers.map(t => t.items.length));

/* 캔버스 드래그 — 실제 마우스로 «카데나»를 D 티어 첫 자리로 */
const cadId = (await state()).board.tiers[0].items[4].id;
let hits2 = await T('hits()');
const cad = hits2.find(h => h.id === cadId), dTier = (await T('layout()')).bands[4];
await scrollCv((cad.y + dTier.y) / 2);
const from = await cvToClient(cad.x + cad.w / 2, cad.y + cad.h / 2);
const to = await cvToClient(184 + 10, dTier.y + 24 + 60);
chk('드래그 시작·끝점이 뷰포트 안', from.y > 90 && to.y < 1070, { from, to });
await mouse('mouseMoved', from.x, from.y); await press(from.x, from.y);
for (let i = 1; i <= 8; i++) { await dragTo(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8); await sleep(40); }
await sleep(120);
chk('드래그 중 커서 = grabbing · 고스트 상태', await ev(`document.getElementById('tiCanvas').classList.contains('drag')`));
await shot('03-tier-dragging-1920');
await release(to.x, to.y); await sleep(350);
const s5 = await state();
chk('캔버스 드래그 → 카데나가 D 티어 첫 자리로', s5.board.tiers[4].items[0].id === cadId && s5.board.tiers[0].items.length === 4, { d: s5.board.tiers[4].items.map(i => i.name), s: s5.board.tiers[0].items.length });
chk('드래그 후 선택 = 옮긴 항목 · 편집 행 .sel', s5.sel === cadId && await ev(`!!document.querySelector('.tier-it.sel[data-id="${cadId}"]')`));
chk('순위 번호가 재계산됨(D 첫 항목 = 19개 중 17)', (await T('hits()')).find(h => h.id === cadId).rank === 17, (await T('hits()')).find(h => h.id === cadId));
await shot('04-tier-after-drag-1920');

/* 클릭 선택 / Esc 해제 */
hits2 = await T('hits()');
const first = hits2[0];
await scrollCv(first.y);
const c1 = await cvToClient(first.x + first.w / 2, first.y + first.h / 2);
await mouse('mouseMoved', c1.x, c1.y); await press(c1.x, c1.y); await release(c1.x, c1.y); await sleep(250);
chk('타일 클릭 → 선택', (await state()).sel === first.id);
await press(c1.x, c1.y); await release(c1.x, c1.y); await sleep(250);
chk('같은 타일 다시 클릭 → 선택 해제', (await state()).sel === null);
chk('타일 위 커서 = grab', await ev(`document.getElementById('tiCanvas').classList.contains('grab')`));

/* 프리셋 · 티어 추가/삭제 */
await click('#tiPresets .chip[data-v="g3"]'); await sleep(350);
const s6 = await state();
chk('프리셋 1~3군 → 3단계 · 항목은 남고(넘친 티어는 마지막으로)', s6.board.tiers.length === 3 && s6.board.tiers.map(t => t.letter).join(',') === '1군,2군,3군' && s6.board.tiers.reduce((a, t) => a + t.items.length, 0) === 19, s6.board.tiers.map(t => t.letter + ':' + t.items.length));
chk('토스트 «되돌리기» 노출', await ev(`(()=>{const t=document.querySelector('.toast.on');return !!t&&t.textContent.includes('1~3군')&&!!t.querySelector('.toast-act')})()`));
await click('.toast.on .toast-act'); await sleep(400);
chk('되돌리기 → 5단계 복귀', (await state()).board.tiers.length === 5 && (await state()).board.tiers.map(t => t.letter).join('') === 'SABCD');
await click('#tiTierAdd'); await sleep(300);
const s7 = await state();
chk('티어 추가 → 6단계 · 글자 E · 새 행 글자칸 포커스', s7.board.tiers.length === 6 && s7.board.tiers[5].letter === 'E' && await ev(`document.activeElement.classList.contains('tier-in-l')`), s7.board.tiers.map(t => t.letter));
chk('플라크 농도 6단계(농도 띠 6칸)', (await ev(`document.querySelectorAll('#tiRamp span').length`)) === 6);
await setInput('.tier-row[data-tid="' + s7.board.tiers[5].id + '"] [data-f="note"]', '아직 판단 보류'); await sleep(250);
chk('티어 한 줄 입력 반영', (await state()).board.tiers[5].note === '아직 판단 보류');
const L2 = await T('layout()');
chk('한 줄 있는 빈 띠 = 24 + (40 한 줄 + 179 빈 슬롯) + 24 = 267', L2.bands[5].h === 267, L2.bands[5]);
await click('.tier-row[data-tid="' + s7.board.tiers[5].id + '"] [data-act="tierDel"]'); await sleep(300);
chk('티어 삭제 → 5단계', (await state()).board.tiers.length === 5);
chk('티어가 1개면 삭제 비활성(아님) · 지금은 활성', await ev(`!document.querySelector('.tier-row [data-act="tierDel"]').disabled`));

/* 디자인 — 한 줄 수 · 순위 · 이름 · 모양 · 색 */
await click('#tiCols .chip[data-v="6"]'); await sleep(300);
const L3 = await T('layout()');
chk('6열 → 타일 113 · 이름 26', L3.tile === 113 && L3.nfs === 26, L3);
chk('검사: 폰에서 이름 9.1px 경고', await ev(`(()=>{const li=[...document.querySelectorAll('#tiChk li')].find(l=>l.textContent.includes('폰에서'));return !!li&&li.classList.contains('bad')&&li.textContent.includes('9.1')})()`), await ev(`document.getElementById('tiChk').textContent`));
await click('#tiCols .chip[data-v="4"]'); await sleep(250);
chk('4열 복귀 · 폰 이름 11.9px 통과', (await T('layout()')).tile === 179 && await ev(`(()=>{const li=[...document.querySelectorAll('#tiChk li')].find(l=>l.textContent.includes('폰에서'));return !!li&&!li.classList.contains('bad')})()`));
await click('#tiOpts .chip[data-v="rank"]'); await sleep(250);
chk('순위 번호 끄기', (await state()).design.rank === false && await ev(`document.querySelector('#tiOpts .chip[data-v="rank"]').getAttribute('aria-pressed')==='false'`));
await click('#tiOpts .chip[data-v="rank"]'); await sleep(200);
await click('#tiOpts .chip[data-v="names"]'); await sleep(250);
const L4 = await T('layout()');
chk('이름 끄기 → S 띠(4항목 1줄) 높이 = 24+179+24', (await state()).design.names === false && L4.bands[0].h === 24 + 179 + 24, L4.bands[0]);
await click('#tiOpts .chip[data-v="names"]'); await sleep(200);
await click('#tiShape .chip[data-v="circle"]'); await sleep(250);
chk('원형 타일 · 편집 열 썸네일도 원형', (await state()).design.shape === 'circle' && await ev(`document.querySelector('.tier-th').classList.contains('circle')`));
await click('#tiShape .chip[data-v="square"]'); await sleep(200);
await click('#tiSws .tier-sw[data-c="yd-teal"]'); await sleep(250);
chk('포인트 색 영도 틸', (await state()).design.accent === 'yd-teal' && (await ev(`document.getElementById('tiSwn').textContent`)).includes('영도 · 틸'));
const Lt = await T('layout()');
const plPx = await ev(`(()=>{const c=document.getElementById('tiCanvas');return [...c.getContext('2d').getImageData(46+56,${Lt.bands[0].y}+24+120,1,1).data]})()`);
chk('S 플라크 = 틸 실색(#0F7C86)', plPx && plPx[0] < 40 && plPx[1] > 100 && plPx[2] > 110, plPx);
await click('#tiSws .tier-sw[data-c="bd-rose"]'); await sleep(200);

/* 이미지 등록(헤드리스 — 저장소 이미지) · 행 표시 · 지우기 */
const imgId = (await state()).board.tiers[0].items[0].id;
await ev(`window.SseudamTools.tier.__test.setImageURL(${JSON.stringify(imgId)},'/_toolbox/thumb/b0_183.webp')`); await sleep(400);
chk('이미지 등록 → 상태 images 1 · 행 has-img + 지우기 버튼', (await state()).images === 1 && await ev(`(()=>{const r=document.querySelector('.tier-it[data-id="${imgId}"]');return r.classList.contains('has-img')&&!!r.querySelector('.tier-th img')&&!!r.querySelector('[data-act="imgDel"]')})()`));
const h0 = (await T('hits()')).find(h => h.id === imgId);
chk('이미지 타일이 그려짐(분산 큼)', (await cvVar(h0.x + 10, h0.y + 10, h0.w - 20, h0.h - 20)) > 200);
chk('검사: 이미지 없는 항목 = 전체-1', await ev(`document.getElementById('tiChk').textContent.includes('이미지 없는 항목')&&!document.getElementById('tiChk').textContent.includes('양식 상태')`));
await shot('05-tier-image-1920');
await click('.tier-it[data-id="' + imgId + '"] [data-act="imgDel"]'); await sleep(300);
chk('이미지 지우기 → images 0', (await state()).images === 0);

/* PNG blob · JSON 형태 */
const blob = await T('blob()');
chk('PNG blob 생성(≥ 20KB · image/png)', blob && blob.type === 'image/png' && blob.size > 20000, blob);
const du = await T('dataURL()');
if (typeof du === 'string' && du.startsWith('data:image/png;base64,')) writeFileSync(join(OUT, 'board-export.png'), Buffer.from(du.slice(22), 'base64'));
chk('내보내기 PNG 에 선택 링 없음(선택 상태에서 export 와 화면이 다름)', await ev(`(()=>{const t=window.SseudamTools.tier.__test;const s=t.state();const id=s.board.tiers[0].items[0].id;t.select(id);const on=document.getElementById('tiCanvas').toDataURL();const ex=t.dataURL();t.select(null);return on!==ex})()`));
const d0 = await state();
chk('보드 JSON 형태(app·v·board·design)', d0.app === 'sseudam-tier' && d0.v === 1 && Array.isArray(d0.board.tiers) && typeof d0.design.cols === 'number');
chk('localStorage 저장됨', await ev(`(()=>{try{const s=JSON.parse(localStorage.getItem('sseudam_tier_v1'));return s&&s.v===1&&s.board.title==='메이플 전직업 티어표'}catch(e){return false}})()`));

/* 항목 삭제 + 되돌리기 */
const delId = (await state()).board.tiers[1].items[0].id, before = (await state()).board.tiers[1].items.length;
await click('.tier-it[data-id="' + delId + '"] [data-act="del"]'); await sleep(300);
chk('항목 삭제', (await state()).board.tiers[1].items.length === before - 1);
await click('.toast.on .toast-act'); await sleep(400);
chk('삭제 되돌리기 → 같은 자리', (await state()).board.tiers[1].items[0].id === delId);

/* 디자인 게이트 🟡3(09-07) 재측정 — 아이콘 버튼 히트존 겹침 0 · 칩 32px · 빈 티어 자리 클릭 = 슬롯 추가 */
const ov = await ev(`(()=>{const ex=6;const bs=[...document.querySelectorAll('.tier-ib')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return{l:r.left-ex,t:r.top-ex,r:r.right+ex,b:r.bottom+ex}});let n=0,worst=0;for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],c=bs[j];const w=Math.min(a.r,c.r)-Math.max(a.l,c.l),h=Math.min(a.b,c.b)-Math.max(a.t,c.t);if(w>0&&h>0){n++;worst=Math.max(worst,Math.min(w,h));}}return{n,worst,count:bs.length}})()`);
chk('아이콘 버튼 히트존(±6px) 서로 겹침 0(가로·세로 전부)', ov && ov.n === 0 && ov.count > 20, ov);
chk('칩 = 사이트 기본 32px·13px', await ev(`(()=>{const c=document.querySelector('#tiCols .chip');const s=getComputedStyle(c);return s.height==='32px'&&s.fontSize==='13px'})()`), await ev(`(()=>{const s=getComputedStyle(document.querySelector('#tiCols .chip'));return s.height+'/'+s.fontSize})()`));
await click('#tiTierAdd'); await sleep(300);
const sE = await state(), eTi = sE.board.tiers.length - 1, eBand = (await T('layout()')).bands[eTi];
chk('새 티어는 항목 0개 · 점선 자리 1개', sE.board.tiers[eTi].items.length === 0 && eBand.tiles === 0);
await scrollCv(eBand.y + 24 + 90);
const eP = await cvToClient(184 + 89, eBand.y + 24 + 89);
await mouse('mouseMoved', eP.x, eP.y); await sleep(80);
chk('빈 티어 자리 위 커서 = pointer(add)', await ev(`document.getElementById('tiCanvas').classList.contains('add')`));
await press(eP.x, eP.y); await release(eP.x, eP.y); await sleep(300);
const sE2 = await state();
chk('빈 티어 자리 클릭 → 그 티어에 슬롯 1개 추가·선택', sE2.board.tiers[eTi].items.length === 1 && sE2.sel === sE2.board.tiers[eTi].items[0].id, sE2.board.tiers[eTi]);
await click('.tier-row[data-tid="' + sE2.board.tiers[eTi].id + '"] [data-act="tierDel"]'); await sleep(300);
await click('.toast.on .toast-act'); await sleep(300);
chk('티어 삭제 → 되돌리기 → 6단계 복원', (await state()).board.tiers.length === 6);
await click('.tier-row[data-tid="' + sE2.board.tiers[eTi].id + '"] [data-act="tierDel"]'); await sleep(300);
chk('검수용 티어 정리 → 5단계', (await state()).board.tiers.length === 5);

/* 라벨 하한 · 포커스 링 · 터치 타깃(PC) */
const small = await ev(`(()=>{const q=[...document.querySelectorAll('.tier *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));return q.map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(v=>v<12.5)})()`);
chk('도구 안 글자 12.5px 미만 0개', small.length === 0, small);
await ev(`document.querySelector('.tier-it .tier-in').focus()`); await sleep(450);   /* box-shadow 전환 220ms 이 끝난 뒤 잰다 */
chk('행 입력 포커스 링 2px 잉크', await ev(`getComputedStyle(document.activeElement).boxShadow.includes('0px 0px 0px 2px')`), await ev(`getComputedStyle(document.activeElement).boxShadow`));
await ev(`document.activeElement.blur()`);

/* 탭 이탈 → 복귀 (상태·이미지 유지) */
await ev(`window.SseudamTools.tier.__test.setImageURL(${JSON.stringify(imgId)},'/_toolbox/thumb/b1_183.webp')`); await sleep(400);
const sLeave = await state();
await ev(`window.scrollTo(0,0)`); await sleep(200);
await click('.isl-tab[data-v="home"]'); await sleep(900);
chk('홈으로 → 도구 DOM 제거', !(await ev(`!!document.querySelector('.tier')`)));
await ev(`window.scrollTo(0,0)`); await sleep(200);
await click('.isl-tab[data-v="tools"]'); await sleep(900);
chk('도구함 복귀 → 티어 도구가 그대로 선택·마운트', await waitFor(`!!document.querySelector('#tiCanvas')&&document.querySelector('#tbList .tb-item.on').dataset.t==='tier'`, 6000));
const s8 = await state();
chk('복귀 후 제목·항목·이미지 유지', s8.board.title === '메이플 전직업 티어표' && JSON.stringify(s8.board) === JSON.stringify(sLeave.board) && s8.images === 1 && (await ev(`document.getElementById('tiTitle').value`)) === '메이플 전직업 티어표', { t: s8.board.title, n: s8.board.tiers.map(t => t.items.length), img: s8.images });
await shot('06-tier-return-1920');
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);

/* ══════════ 390×844 ══════════ */
console.log('\n[390×844]');
logs = [];
await open(390, 844, true);
chk('도구함 진입(모바일) → 티어 도구', await gotoTier());
chk('모바일 단일 열(.tier grid 1열)', (await ev(`getComputedStyle(document.querySelector('.tier')).gridTemplateColumns.split(' ').length`)) === 1);
chk('모바일 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth+1`), await ev(`document.documentElement.scrollWidth`));
chk('캔버스가 열 폭 안(≤ 390)', await ev(`document.getElementById('tiCanvas').getBoundingClientRect().width<=390`));
chk('캔버스 touch-action = pan-y(페이지 세로 스크롤 유지)', (await ev(`getComputedStyle(document.getElementById('tiCanvas')).touchAction`)) === 'pan-y');
const tapMin = await ev(`(()=>{const q=[...document.querySelectorAll('.tier-sw,.tier-th,.tier-ib,#tiAdd,#tiSave,#tiCopy,#tiJson,#tiLoad,#tiClear,#tiTierAdd,.chip')];return Math.min(...q.map(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e,'::after');const pad=cs.content!=='none'&&cs.inset!=='auto'?12:0;return Math.min(r.width,r.height)+pad}))})()`);
chk('모바일 터치 타깃 ≥ 28(스와치 28 · 아이콘 버튼 28+히트 12)', tapMin >= 28, { tapMin });
await shot('07-tier-390');
await ev(`window.scrollTo(0,document.body.scrollHeight)`); await sleep(300);
await shot('08-tier-390-bottom');
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch {}
chrome.kill(); srv.close();
process.exit(fail ? 1 : 0);
