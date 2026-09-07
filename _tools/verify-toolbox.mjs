// verify-toolbox.mjs — 도구함 탭 + 썸네일 도구(_toolbox/thumb.js) 헤드리스 검증 (2026-09-06)
//   node _tools/verify-toolbox.mjs [--out DIR] [--test-img DIR]
//   · 로컬 정적 서버(의존성 0)로 index.html 을 열고 크롬 헤드리스 CDP 로 «실제로 눌러» 잰다.
//     축하 스플래시는 ?cheer=0 으로 끄고, 라이브 백엔드(/requests)는 차단해 화면이 네트워크에 매이지 않게 한다.
//   · 1920×1080: 탭 진입 → 도구 로드 → 이미지 등록 → 타이틀 → 프리셋 5 → 검사 문구 → 부제 → 색·글꼴 → 확대·드래그
//               → PNG 저장 파일명 → 미리보기(183×185 · 90×90 · 모바일 3열) → 탭 이탈·복귀(상태 유지)
//   · 390×844 / 360×740: 섬(탭 4개) 넘침 0 · 단일 열 · 미리보기 축소 배율
//   · 콘솔 예외 0. 스크린샷은 --out (기본: 임시 폴더) 에 남긴다.
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
const OUT = val('--out', join(tmpdir(), '_toolbox-out'));
const TEST_IMG = val('--test-img', '');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  let abs;
  if (p.startsWith('/__test/') && TEST_IMG) abs = normalize(join(TEST_IMG, p.slice(8)));
  else abs = normalize(join(ROOT, p));
  if (!existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;

const port = 9400 + Math.floor(Math.random() * 500);
const prof = join(tmpdir(), `_tbprof${port}`);
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
const click = async (sel) => {
  await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e&&!e.closest('.back'))e.scrollIntoView({block:'center'});return true})()`);   /* 뷰포트 밖 요소를 허공에 클릭하지 않게(09-06 교훈) — 모달 안은 스크롤 조상이 달라 건드리지 않는다 */
  await sleep(120);
  const r = await rect(sel); if (!r) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.cx, y: r.cy });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.cx, y: r.cy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.cx, y: r.cy, button: 'left', clickCount: 1 });
  return true;
};
const key = async (k, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(200);
};
const setInput = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v) return v; await sleep(120); } return null; };
/* 캔버스 «그려졌나» — 아래쪽 띠(글자 영역)의 픽셀 분산이 0 이면 빈 캔버스 */
const canvasVar = (sel) => ev(`(()=>{const c=document.querySelector(${JSON.stringify(sel)});if(!c)return -1;const x=c.getContext('2d');const d=x.getImageData(0,Math.floor(c.height*.55),c.width,Math.floor(c.height*.4)).data;let s=0,s2=0,n=0;for(let i=0;i<d.length;i+=16){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return Math.round(s2/n-m*m)})()`);

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
const gotoTools = async () => {
  await ev(`window.scrollTo(0,0)`); await sleep(350);   /* 스크롤을 내린 뒤엔 섬이 접혀(tuck) 탭 좌표가 허공이 된다 */
  await click('.isl-tab[data-v="tools"]'); await sleep(700);
  return waitFor(`!!document.querySelector('#thCanvas')`, 8000);
};

/* ══════════ 1920×1080 ══════════ */
console.log('\n[1920×1080]');
await open(1920, 1080, false);
chk('탭 4개(홈·작성 글·트렌드·도구함)', (await ev(`[...document.querySelectorAll('.isl-tab')].map(b=>b.dataset.v).join(',')`)) === 'home,posts,trend,tools');
const t0 = Date.now();
chk('도구함 진입 → 썸네일 도구 로드', await gotoTools(), { ms: Date.now() - t0 });
chk('제목 «도구함»', (await ev(`document.getElementById('ptitle').textContent.trim()`)) === '도구함');
chk('좌측 목록 선택 = 썸네일 제작', await ev(`!!document.querySelector('#tbList .tb-item.on[data-t="thumb"][aria-pressed="true"]')`));
chk('도구 목록 행 = 이름 «썸네일 제작» 한 줄(부제 없음)', await ev(`(()=>{const b=document.querySelector('#tbList .tb-item[data-t="thumb"]');return b.querySelector('b').textContent==='썸네일 제작'&&!b.querySelector('.s')&&b.textContent.trim()==='썸네일 제작'})()`), await ev(`document.querySelector('#tbList .tb-item[data-t="thumb"]').textContent`));
chk('빈 상태: 드롭존 보임 · 저장/복사/미리보기 비활성', await ev(`(()=>{const dz=document.getElementById('thDz');return !dz.hidden&&document.getElementById('thSave').disabled&&document.getElementById('thCopy').disabled&&document.getElementById('thPreview').disabled})()`));
chk('빈 상태에서도 프리셋 타일이 그려짐', (await canvasVar('.th-preset[data-p="band"] canvas')) > 0);
chk('기본값: 면 진하기 90% · 타이틀 16.5% · 부제 5.2%', await ev(`(()=>{const s=window.SseudamTools.thumb.__test.state();return Math.abs(s.op-.9)<.001&&Math.abs(s.nameH-.165)<.0001&&Math.abs(s.subH-.052)<.0001&&document.getElementById('thOpN').value==='90'&&document.getElementById('thOp').value==='90'&&document.getElementById('thNameSzN').value==='16.5'&&document.getElementById('thSubSzN').value==='5.2'})()`), await ev(`JSON.stringify(window.SseudamTools.thumb.__test.state())`));
await shot('01-tools-empty-1920');

/* 이미지 등록 (1000×1000 시험 이미지가 있으면 그걸로, 없으면 리포지토리의 966×360 배너로) */
const imgUrl = (TEST_IMG && existsSync(join(TEST_IMG, 'test_1000.png'))) ? '/__test/test_1000.png' : '/_toolbox/thumb/banner_966x360.webp';
const st1 = await ev(`window.SseudamTools.thumb.__test.setImageURL(${JSON.stringify(imgUrl)},'t').then(()=>window.SseudamTools.thumb.__test.state())`);
chk('이미지 등록 → 상태 반영', st1 && st1.img, st1);
chk('등록 후 드롭존 숨김 · 버튼 활성', await ev(`(()=>{return document.getElementById('thDz').hidden&&!document.getElementById('thSave').disabled&&!document.getElementById('thPreview').disabled&&!document.getElementById('thAdj').hidden})()`));
await setInput('#thName', '메이플키우기'); await sleep(350);
chk('타이틀 카운터 6/6 · 경고 없음', await ev(`(()=>{const c=document.getElementById('thNameCnt');return c.textContent==='6/6'&&!c.classList.contains('bad')})()`), await ev(`document.getElementById('thNameCnt').outerHTML`));
chk('검사 목록에 경고 0', (await ev(`document.querySelectorAll('#thChk li.bad').length`)) === 0, await ev(`document.getElementById('thChk').textContent`));
chk('메인 캔버스 그려짐', (await canvasVar('#thCanvas')) > 30);
chk('90px 미니 캔버스 그려짐', (await canvasVar('#thMini90')) > 30);
chk('183 미니 캔버스 그려짐', (await canvasVar('#thMini183')) > 30);
chk('파일명 = 메이플키우기_1000.png', (await ev(`window.SseudamTools.thumb.__test.fileName()`)) === '메이플키우기_1000.png');
await shot('02-tools-band-1920');

for (const p of ['top', 'plaque', 'tint', 'stripe', 'half', 'cream', 'glass', 'stroke', 'mono', 'band']) {
  await click(`.th-preset[data-p="${p}"]`); await sleep(320);
  const st = await ev(`window.SseudamTools.thumb.__test.state().preset`);
  chk(`프리셋 ${p} 선택·렌더`, st === p && (await canvasVar('#thCanvas')) > 30, { st, v: await canvasVar('#thCanvas') });
  if (p !== 'band') await shot(`03-preset-${p}-1920`);
}
chk('프리셋 aria-pressed 하나만 true', (await ev(`document.querySelectorAll('.th-preset[aria-pressed="true"]').length`)) === 1);
chk('디자인 10종', (await ev(`document.querySelectorAll('.th-preset').length`)) === 10);
await click('.th-preset[data-p="stroke"]'); await sleep(250);
chk('스트로크(면 없음) → 면 진하기 비활성(슬라이더·숫자)', await ev(`document.getElementById('thOp').disabled&&document.getElementById('thOpN').disabled&&document.getElementById('thOpRow').classList.contains('off')`));
await click('.th-preset[data-p="stripe"]'); await sleep(250);
chk('스트라이프 → 면 진하기 활성', await ev(`!document.getElementById('thOp').disabled`));
const vBefore = await canvasVar('#thCanvas');
await setInput('#thOp', '40'); await sleep(300);
chk('면 진하기 슬라이더 40 → 상태 .4 · 숫자칸 40 · 캔버스 변화', Math.abs((await ev(`window.SseudamTools.thumb.__test.state().op`)) - .4) < .001 && (await ev(`document.getElementById('thOpN').value`)) === '40' && (await canvasVar('#thCanvas')) !== vBefore, { op: await ev(`window.SseudamTools.thumb.__test.state().op`) });
await shot('03b-stripe-op40-1920');
await setInput('#thOpN', '63'); await sleep(250);
chk('면 진하기 숫자 입력 63 → 상태 .63 · 슬라이더 63', Math.abs((await ev(`window.SseudamTools.thumb.__test.state().op`)) - .63) < .001 && (await ev(`document.getElementById('thOp').value`)) === '63');
await setInput('#thOpN', '7'); await sleep(250);
chk('숫자 범위 밖(7) 은 change 에 15 로 맞춤', Math.abs((await ev(`window.SseudamTools.thumb.__test.state().op`)) - .15) < .001 && (await ev(`document.getElementById('thOpN').value`)) === '15');
await setInput('#thOpN', '90'); await sleep(200);
await click('.th-preset[data-p="band"]'); await sleep(250);

await setInput('#thName', '메이플키우기업데이트'); await sleep(300);
chk('10자 → 카운터 경고 + 검사 경고', await ev(`(()=>{return document.getElementById('thNameCnt').classList.contains('bad')&&document.querySelectorAll('#thChk li.bad').length===1})()`), await ev(`document.getElementById('thChk').textContent`));
chk('10자여도 글자가 캔버스 폭 안(자동 축소)', (await canvasVar('#thCanvas')) > 30);
await shot('04-longname-1920');
await setInput('#thName', '메이플키우기'); await sleep(200);
const vT = await canvasVar('#thCanvas');
await setInput('#thNameSzN', '12'); await sleep(300);
chk('타이틀 크기 숫자 12 → 상태 .12 · 슬라이더 12 · 검사 «표준 16.5% 미만» 경고', Math.abs((await ev(`window.SseudamTools.thumb.__test.state().nameH`)) - .12) < .0001 && (await ev(`document.getElementById('thNameSz').value`)) === '12' && await ev(`document.getElementById('thChk').textContent.includes('표준 16.5% 미만')`) && (await canvasVar('#thCanvas')) !== vT, await ev(`document.getElementById('thChk').textContent`));
await setInput('#thNameSz', '20'); await sleep(300);
chk('타이틀 크기 슬라이더 20 → 숫자칸 20 · 경고 없음', (await ev(`document.getElementById('thNameSzN').value`)) === '20' && !(await ev(`document.getElementById('thChk').textContent.includes('표준 16.5% 미만')`)));
await shot('04b-titlesize20-1920');
await setInput('#thNameSzN', '16.5'); await sleep(200);

chk('부제 입력칸 항상 보임 · 비면 경고 숨김', await ev(`(()=>{const s=document.getElementById('thSub');return !s.hidden&&s.offsetParent!==null&&document.getElementById('thSubHint').hidden})()`));
await setInput('#thSub', '핑크빈 업데이트'); await sleep(300);
chk('부제 입력 → 경고 문구 표시 + 검사 경고 1', await ev(`!document.getElementById('thSubHint').hidden`) && (await ev(`document.querySelectorAll('#thChk li.bad').length`)) === 1, await ev(`document.getElementById('thChk').textContent`));
chk('부제가 그려짐(캔버스 하단 분산)', (await canvasVar('#thCanvas')) > 30);
await shot('05-subtitle-1920');
await ev(`window.scrollTo(0,0)`); await sleep(200);
const ctlLong = await ev(`document.querySelector('.th-ctl').getBoundingClientRect().bottom`);
chk('가장 긴 상태(부제 경고 표시)에서도 설정 열 bottom ≤1080', ctlLong <= 1080, { ctlBottom: Math.round(ctlLong) });
/* 포커스 링은 실제 마우스 클릭으로 포커스를 준 뒤 잰다 — 헤드리스에서 JS .focus() 는 :focus 스타일을 신뢰성 있게 켜지 않는다(게이트 09-06 교훈) */
await click('#thOpN'); await sleep(450);   /* box-shadow 는 220ms 전환 — 끝난 뒤 잰다 */
const ringN = await ev(`getComputedStyle(document.getElementById('thOpN')).boxShadow`);
await click('#thName'); await sleep(450);
const ringT = await ev(`getComputedStyle(document.getElementById('thName')).boxShadow`);
await ev(`document.activeElement&&document.activeElement.blur()`);
const ring2 = (s) => { const m = String(s).match(/rgba?\(14, 17, 20(?:, ([\d.]+))?\) 0px 0px 0px ([\d.]+)px/); return !!m && (m[1] == null || parseFloat(m[1]) >= .95) && parseFloat(m[2]) >= 1.9; };
chk('숫자칸·텍스트칸 포커스 링 = 2px 잉크', ring2(ringN) && ring2(ringT), { ringN, ringT });
await setInput('#thSubSzN', '8'); await sleep(300);
chk('부제 크기 숫자 8 → 상태 .08 · 슬라이더 8', Math.abs((await ev(`window.SseudamTools.thumb.__test.state().subH`)) - .08) < .0001 && (await ev(`document.getElementById('thSubSz').value`)) === '8');
await shot('05a-subsize8-1920');
await setInput('#thSubSzN', '5.2'); await sleep(200);
await setInput('#thSub', ''); await sleep(250);
chk('부제 비움 → 경고 0 · 문구 숨김', (await ev(`document.querySelectorAll('#thChk li.bad').length`)) === 0 && await ev(`document.getElementById('thSubHint').hidden`));
chk('글 제목 칸 없음', !(await ev(`!!document.getElementById('thTitle')`)));

chk('포인트 색 = 봄딩 3 + 영도 3 + 기타', await ev(`(()=>{const b=[...document.querySelectorAll('#thSws .th-sw')].map(x=>x.dataset.c);return b.join(',')==='bd-rose,bd-pink,bd-plum,yd-green,yd-mint,yd-teal,custom'})()`), await ev(`[...document.querySelectorAll('#thSws .th-sw')].map(x=>x.dataset.c).join(',')`));
await click('.th-sw[data-c="yd-teal"]'); await sleep(250);
chk('색 «영도 틸» 선택 → 이름·HEX 칸 표시', await ev(`(()=>{const t=document.querySelector('#thSwn .nm').textContent;return t==='영도 · 틸'&&document.getElementById('thHex').value==='#0F7C86'&&document.querySelectorAll('#thSws .th-sw[aria-pressed="true"]').length===1&&window.SseudamTools.thumb.__test.state().accent==='yd-teal'})()`), await ev(`document.querySelector('#thSwn .nm').textContent+' / '+document.getElementById('thHex').value`));
await setInput('#thAccentPick', '#3366cc'); await sleep(250);
chk('기타(팔레트) 색 입력 → 커스텀 반영·HEX 칸 동기', await ev(`(()=>{const s=window.SseudamTools.thumb.__test.state();return s.accent==='custom'&&s.accentHex==='#3366cc'&&document.querySelector('#thSws .custom').classList.contains('has')&&document.getElementById('thHex').value==='#3366CC'})()`), await ev(`JSON.stringify(window.SseudamTools.thumb.__test.state())`));
/* ── HEX 직접 입력(09-07) ── */
const vHex = await canvasVar('#thCanvas');
await setInput('#thHex', '#15A05A'); await sleep(300);
chk('HEX 칸 «#15A05A» → 커스텀 색·캔버스 변화', await ev(`(()=>{const s=window.SseudamTools.thumb.__test.state();return s.accent==='custom'&&s.accentHex==='#15A05A'&&document.getElementById('thAccentPick').value==='#15a05a'&&document.querySelector('#thSws .custom').classList.contains('has')})()`) && (await canvasVar('#thCanvas')) !== vHex, await ev(`JSON.stringify(window.SseudamTools.thumb.__test.state())`));
await setInput('#thHex', '#abc'); await sleep(300);
chk('HEX 3자리 «#abc» → #AABBCC 로 펼침', (await ev(`window.SseudamTools.thumb.__test.state().accentHex`)) === '#AABBCC');
await setInput('#thHex', 'C93C7C'); await sleep(300);
chk('HEX # 없이 «C93C7C» 도 받음', (await ev(`window.SseudamTools.thumb.__test.state().accentHex`)) === '#C93C7C');
await ev(`(()=>{const e=document.getElementById('thHex');e.value='zzz';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await sleep(250);
chk('HEX 못 읽는 값 → 값 되돌림·붉은 링·색 유지', await ev(`(()=>{const e=document.getElementById('thHex');return e.value==='#C93C7C'&&e.classList.contains('bad')&&window.SseudamTools.thumb.__test.state().accentHex==='#C93C7C'})()`), await ev(`document.getElementById('thHex').value`));
await sleep(1000);
chk('붉은 링은 잠깐만', !(await ev(`document.getElementById('thHex').classList.contains('bad')`)));
await click('.th-sw[data-c="bd-pink"]'); await sleep(250);
chk('프리셋 스와치 선택 → HEX 칸이 그 색으로', (await ev(`document.getElementById('thHex').value`)) === '#F58AB4');
await click('.th-sw[data-c="bd-rose"]'); await sleep(200);
chk('글자색 = 자동·흰색·플럼·크림·하늘 + 기타', await ev(`(()=>{const b=[...document.querySelectorAll('#thTcs .th-sw')].map(x=>x.dataset.c);return b.join(',')==='auto,white,plum,cream,sky,custom'})()`), await ev(`[...document.querySelectorAll('#thTcs .th-sw')].map(x=>x.dataset.c).join(',')`));
chk('글자색 스와치가 한 줄에(줄바꿈 0)', await ev(`(()=>{const t=[...document.querySelectorAll('#thTcs .th-sw')].map(x=>Math.round(x.getBoundingClientRect().top));return Math.max(...t)-Math.min(...t)<=2})()`), await ev(`[...document.querySelectorAll('#thTcs .th-sw')].map(x=>Math.round(x.getBoundingClientRect().top)).join(',')`));
const vSky = await canvasVar('#thCanvas');
await click('#thTcs .th-sw[data-c="sky"]'); await sleep(300);
chk('글자색 «하늘» → 상태 sky · #58CCFF · 캔버스 변화', await ev(`(()=>{const s=window.SseudamTools.thumb.__test.state();return s.tc==='sky'&&document.getElementById('thTcHex').value==='#58CCFF'&&document.querySelector('#thTcn .nm').textContent==='하늘'})()`) && (await canvasVar('#thCanvas')) !== vSky, await ev(`document.getElementById('thTcHex').value`));
await shot('05d-textcolor-sky-1920');
await click('#thTcs .th-sw[data-c="plum"]'); await sleep(250);
chk('글자색 «플럼» 선택 → 상태·이름·HEX 칸', await ev(`(()=>{return window.SseudamTools.thumb.__test.state().tc==='plum'&&document.querySelector('#thTcn .nm').textContent==='플럼'&&document.getElementById('thTcHex').value==='#2E2038'})()`));
await setInput('#thTcHex', '#ff8800'); await sleep(300);
chk('글자색 HEX 칸 입력 → 커스텀', await ev(`(()=>{const s=window.SseudamTools.thumb.__test.state();return s.tc==='custom'&&s.tcHex==='#FF8800'})()`), await ev(`JSON.stringify(window.SseudamTools.thumb.__test.state())`));
await setInput('#thTextPick', '#ffee00'); await sleep(250);
chk('글자색 기타(팔레트) → 커스텀 반영', await ev(`(()=>{const s=window.SseudamTools.thumb.__test.state();return s.tc==='custom'&&s.tcHex==='#ffee00'})()`));
await shot('05b-textcolor-1920');
await click('#thTcs .th-sw[data-c="auto"]'); await sleep(250);
chk('글자색 «자동» → HEX 칸 비고 placeholder «자동»', await ev(`(()=>{const e=document.getElementById('thTcHex');return e.value===''&&e.placeholder==='자동'})()`), await ev(`document.getElementById('thTcHex').value+' / '+document.getElementById('thTcHex').placeholder`));
chk('글꼴 6종', (await ev(`document.querySelectorAll('#thFont option').length`)) === 6, await ev(`[...document.querySelectorAll('#thFont option')].map(o=>o.value).join(',')`));
for (const f of ['blackhan', 'dohyeon', 'jua', 'songmyung', 'malgun']) {
  await setInput('#thFont', f); await sleep(f === 'malgun' ? 400 : 1600);
  chk('글꼴 ' + f + ' 전환 → 렌더', (await ev(`window.SseudamTools.thumb.__test.state().font`)) === f && (await canvasVar('#thCanvas')) > 30);
  if (f === 'blackhan') await shot('05c-font-blackhan-1920');
}
chk('구글 폰트 로드(검은고딕)', await ev(`document.fonts.check('400 165px "Black Han Sans"','가')`), { note: '네트워크 필요' });
await setInput('#thFont', 'pretendard'); await sleep(600);

await setInput('#thZoom', '1.6'); await sleep(250);
chk('확대 1.6', Math.abs((await ev(`window.SseudamTools.thumb.__test.state().zoom`)) - 1.6) < .001);
const cr = await rect('#thCanvas');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cr.cx, y: cr.cy, button: 'left', clickCount: 1, pointerType: 'mouse' });
for (let i = 1; i <= 6; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cr.cx - i * 12, y: cr.cy - i * 6, button: 'left', pointerType: 'mouse' });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cr.cx - 72, y: cr.cy - 36, button: 'left', clickCount: 1, pointerType: 'mouse' });
await sleep(300);
const stD = await ev(`window.SseudamTools.thumb.__test.state()`);
chk('드래그로 이동(px·py 변함)', stD && (stD.px !== 0 || stD.py !== 0), stD);
await click('#thCenter'); await sleep(250);
const stC = await ev(`window.SseudamTools.thumb.__test.state()`);
chk('가운데 → 확대 1·이동 0', stC && stC.zoom === 1 && stC.px === 0 && stC.py === 0, stC);

await ev(`window.scrollTo(0,0)`); await sleep(250);
const saveR = await rect('#thSave'), ctlB = await ev(`document.querySelector('.th-ctl').getBoundingClientRect().bottom`);
chk('1920×1080: PNG 저장 버튼·설정 열이 첫 화면 안(스크롤 0)', saveR && saveR.y + saveR.h <= 1080 && ctlB <= 1080, { saveBottom: saveR && Math.round(saveR.y + saveR.h), ctlBottom: Math.round(ctlB) });
await ev(`window.__dls=[];HTMLAnchorElement.prototype.click=function(){if(this.download)window.__dls.push(this.download);};`);
await click('#thSave'); await sleep(900);
chk('PNG 저장 → 파일명', (await ev(`window.__dls[0]`)) === '메이플키우기_1000.png', await ev(`window.__dls`));
const blobSize = await ev(`new Promise(r=>document.getElementById('thCanvas').toBlob(b=>r(b?b.size:0),'image/png'))`);
chk('PNG 1000×1000 blob 생성(>50KB)', blobSize > 50000, { blobSize });
chk('저장 토스트', await ev(`!!document.querySelector('.toast.on')`));
await sleep(2500);

/* 미리보기 */
await click('#thPreview'); await sleep(900);
chk('미리보기 모달(wide) 열림', await ev(`!!document.querySelector('.back .mdl.wide .th-pv')`));
const big = await rect('.th-pc .big img');
chk('PC 메인 큰 카드 = 183×185', big && Math.round(big.w) === 183 && Math.round(big.h) === 185, big);
const g0 = await rect('.th-pc .gr img');
chk('PC 이미지목록 첫 칸 = 90×90', g0 && Math.round(g0.w) === 90 && Math.round(g0.h) === 90, g0);
const li = await rect('.th-pc .li img');
chk('PC 목록 썸네일 = 90×90', li && Math.round(li.w) === 90 && Math.round(li.h) === 90, li);
chk('PC 판 축소 없음(1920)', (await ev(`getComputedStyle(document.querySelector('.th-pv-pane[data-pane="pc"] .th-fit')).transform`)) === 'none' || (await ev(`document.querySelector('.th-pv-pane[data-pane="pc"] .th-fit').style.transform`)) === 'scale(1)');
chk('새 썸네일이 큰 카드·목록 첫 칸에 실림', await ev(`(()=>{const a=document.querySelector('.th-pc .big img').src,b=document.querySelector('.th-pc .gr img').src;return a.startsWith('data:image/png')&&b.startsWith('data:image/png')})()`));
await shot('06-preview-pc-top-1920');
await ev(`(()=>{const b=document.querySelector('.mdl.wide .mdl-b');b.scrollTop=b.scrollHeight;return b.scrollTop})()`); await sleep(300);
await shot('07-preview-pc-bottom-1920');
await click('.th-pv-bar [data-pv="mo"]'); await sleep(500);
const mo = await rect('.th-mo .pg img');
chk('모바일 사진 목록 첫 칸 = 3열 33.3%(폭 ≈128 · 네이버 규칙대로 세로 +2)', mo && Math.abs(mo.w - 128) <= 2 && Math.abs(mo.h - 130) <= 2, mo);
const cov = await rect('.th-mo .cv');
chk('모바일 커버 390×430', cov && Math.round(cov.w) === 390 && Math.round(cov.h) === 430, cov);
await shot('08-preview-mo-1920');
await key('Escape', 27); await sleep(500);
chk('Esc 로 닫힘', !(await ev(`!!document.querySelector('.back')`)));
chk('미리보기 닫은 뒤 포커스 = 미리보기 버튼', (await ev(`document.activeElement&&document.activeElement.id`)) === 'thPreview');

/* 탭 이탈·복귀 — 상태 유지 */
await ev(`window.scrollTo(0,0)`); await sleep(350);
await click('.isl-tab[data-v="home"]'); await sleep(900);
chk('홈으로 → 도구 DOM 제거', !(await ev(`!!document.querySelector('#th')`)));
await gotoTools(); await sleep(400);
const st2 = await ev(`window.SseudamTools.thumb.__test.state()`);
chk('도구함 복귀 → 이미지·타이틀 유지', st2 && st2.img && st2.name === '메이플키우기', st2);
chk('복귀 후 입력값 복원', (await ev(`document.getElementById('thName').value`)) === '메이플키우기');
chk('복귀 후 캔버스 그려짐', (await canvasVar('#thCanvas')) > 30);
await shot('09-tools-return-1920');
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);

/* ══════════ 390×844 ══════════ */
console.log('\n[390×844]');
logs = [];
await open(390, 844, true);
const islInfo = () => ev(`(()=>{const i=document.getElementById('island'),s=i.querySelector('.isl-tabs'),b=document.getElementById('bell');const r=i.getBoundingClientRect(),br=b.getBoundingClientRect();const tabs=[...i.querySelectorAll('.isl-tab')].map(t=>{const x=t.getBoundingClientRect();return{v:t.dataset.v,l:Math.round(x.left),r:Math.round(x.right),n:(t.querySelector('.n')||{}).textContent||''}});return{sw:s.scrollWidth,cw:s.clientWidth,r:Math.round(r.right),bell:[Math.round(br.left),Math.round(br.right)],vw:innerWidth,tabs}})()`);
const isl = await islInfo();
chk('섬 넘침 없음(탭 4개 · 탭 줄 스크롤 0)', isl && isl.sw <= isl.cw + 1 && isl.tabs.every(t => t.r <= isl.r + 1), isl);
chk('탭이 종(알림) 밑에 깔리지 않음', isl && isl.tabs.every(t => t.r <= isl.bell[0] - 4), isl);
chk('도구함 진입(모바일)', await gotoTools());
chk('모바일 단일 열(.tb)', (await ev(`getComputedStyle(document.querySelector('.tb')).gridTemplateColumns.split(' ').length`)) === 1);
chk('모바일 도구 판 가로 넘침 없음', await ev(`document.documentElement.scrollWidth<=innerWidth+1`), await ev(`document.documentElement.scrollWidth`));
await shot('10-tools-empty-390');
await ev(`window.SseudamTools.thumb.__test.setImageURL(${JSON.stringify(imgUrl)},'t')`); await sleep(400);
await setInput('#thName', '메이플키우기'); await sleep(400);
chk('모바일 캔버스 그려짐', (await canvasVar('#thCanvas')) > 30);
const tapMin = await ev(`(()=>{const q=[...document.querySelectorAll('.th-preset,.th-sw,#thSave,#thCopy,#thPreview,#thCenter,#thReplace,.tb-item')];return Math.min(...q.map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height)}))})()`);
chk('모바일 터치 타깃 최소 ≥28px(색 스와치 28·나머지 ≥32)', tapMin >= 28, { tapMin });
await shot('11-tools-390');
await ev(`window.scrollTo(0,document.body.scrollHeight)`); await sleep(300);
await shot('12-tools-390-bottom');
await click('#thPreview'); await sleep(900);
const k = await ev(`(()=>{const f=document.querySelector('.th-pv-pane[data-pane="pc"] .th-fit');const m=f.style.transform.match(/scale\\(([\\d.]+)\\)/);return m?parseFloat(m[1]):null})()`);
chk('모바일 미리보기: PC 판 축소 배율 <1', k !== null && k < 1, { k });
chk('모바일 미리보기: 판이 모달 안에 들어감', await ev(`(()=>{const w=document.querySelector('.th-pv-pane[data-pane="pc"] .th-fitw').getBoundingClientRect();const p=document.querySelector('.th-pv-pane[data-pane="pc"]').getBoundingClientRect();return w.right<=p.right+1&&w.left>=p.left-1})()`));
const fitPc = await ev(`(()=>{const p=document.querySelector('.th-pv-pane[data-pane="pc"]');const w=p.querySelector('.th-fitw').getBoundingClientRect(),f=p.querySelector('.th-fit').getBoundingClientRect();return{pane:p.clientWidth,w:Math.round(w.width),f:Math.round(f.width),fh:Math.round(f.height),wh:Math.round(w.height)}})()`);
chk('모바일 미리보기: PC 판 전체 폭이 축소돼 보임(잘림 0)', fitPc && Math.abs(fitPc.f - fitPc.w) <= 2 && fitPc.w >= fitPc.pane - 40 && Math.abs(fitPc.fh - fitPc.wh) <= 2, fitPc);
await shot('13-preview-390');
await click('.th-pv-bar [data-pv="mo"]'); await sleep(500);
const km = await ev(`(()=>{const f=document.querySelector('.th-pv-pane[data-pane="mo"] .th-fit');const m=f.style.transform.match(/scale\\(([\\d.]+)\\)/);return m?parseFloat(m[1]):null})()`);
chk('모바일 미리보기: 모바일 판 배율 <1(390 판이 354 모달 안에)', km !== null && km < 1, { km });
const fitMo = await ev(`(()=>{const p=document.querySelector('.th-pv-pane[data-pane="mo"]');const w=p.querySelector('.th-fitw').getBoundingClientRect(),f=p.querySelector('.th-fit').getBoundingClientRect();return{pane:p.clientWidth,w:Math.round(w.width),f:Math.round(f.width)}})()`);
chk('모바일 미리보기: 모바일 판 잘림 0', fitMo && Math.abs(fitMo.f - fitMo.w) <= 2 && fitMo.w >= fitMo.pane - 40, fitMo);
await shot('14-preview-mo-390');
await key('Escape', 27); await sleep(400);
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

/* ══════════ 360×740 — 섬만 ══════════ */
console.log('\n[360×740]');
logs = [];
await open(360, 740, true);
const isl2 = await islInfo();
chk('360px 섬 넘침 없음(탭 줄 스크롤 0 · 숫자 유지)', isl2 && isl2.sw <= isl2.cw + 1 && isl2.tabs.every(t => t.r <= isl2.r + 1) && isl2.tabs.some(t => t.n), isl2);
chk('360px 탭이 종 밑에 깔리지 않음', isl2 && isl2.tabs.every(t => t.r <= isl2.bell[0] - 4), isl2);
await shot('15-island-360');
chk('[360] 콘솔 예외 0', logs.length === 0, logs);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch {}
chrome.kill(); srv.close();
process.exit(fail ? 1 : 0);
