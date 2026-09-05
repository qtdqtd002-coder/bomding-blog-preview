// verify-imagebox.mjs — 봄딩 이미지함 뷰어(_design/bomding-imagebox.js) 헤드리스 검증
//   node _tools/verify-imagebox.mjs [--limit N] [--all] [--shots K] [--out DIR] [파일.html ...]
//   · 이미지함은 전 글이 «절대 URL로 참조하는 단일 파일»이라 한 번 깨지면 봄딩 전 글이 같이 깨진다.
//     그래서 고칠 때마다 이 검증을 돌린다(verify-npaste.mjs 와 같은 자리).
//   · 로컬 정적 서버로 미리보기를 연다 — file:// 이면 fetch 가 CORS 로 막혀 «저장» 경로가 진짜로 돌지 않는다.
//     라이브(구버전) 스크립트·다른 위젯은 차단하고 로컬 파일을 주입한다.
//   · 새 탭 0회 / 오버레이 1개 / ← → 이동·순환 / 저장버튼 위치(큰 사진=안쪽, 작은 사진=바로 밑) /
//     저장 파일명 / 카드 「받기」 회귀 / 좁은 화면 클릭 가능 / 콘솔 예외 0 을 잰다.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SCRIPT = readFileSync(join(ROOT, '_design', 'bomding-imagebox.js'), 'utf8');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHOTS = Number(val('--shots', 0)) || 0;
const OUT = val('--out', join(ROOT, '_tools', '_imagebox-out'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (SHOTS) mkdirSync(OUT, { recursive: true });

/* 대상 고르기: 인자로 준 파일 → 없으면 이미지가 많은 봄딩 글 순(기본 5편) */
let files = args.filter(a => a.endsWith('.html'));
if (!files.length) {
  const posts = JSON.parse(readFileSync(join(ROOT, 'posts.json'), 'utf8'));
  const cand = posts.filter(p => p.author === '봄딩' && existsSync(join(ROOT, p.rel)))
    .map(p => { const h = readFileSync(join(ROOT, p.rel), 'utf8'); return { rel: p.rel, n: (h.match(/<img /g) || []).length, has: h.includes('bomding-imagebox.js') }; })
    .filter(p => p.has && p.n >= 3).sort((a, b) => b.n - a.n);
  files = cand.map(p => p.rel);
  if (!flag('--all')) files = files.slice(0, Number(val('--limit', 5)) || 5);
}
console.log(`files: ${files.length}`);

/* ── 로컬 정적 서버(의존성 0) ── */
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  const abs = normalize(join(ROOT, p));
  if (!abs.startsWith(ROOT) || !existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;

const port = 9400 + Math.floor(Math.random() * 500);
const prof = join(tmpdir(), `_ibprof${port}`);   /* 크롬 프로필은 저장소 밖에 — _tools 를 더럽히지 않는다 */
mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser, '| http :' + HP);

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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*bomding-imagebox.js*', '*naver-npaste.js*', '*bomding-npaste.js*', '*cheer-splash.js*'] });

const clickSel = async (sel) => {
  const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  if (!r) return false;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  return true;
};
const key = async (k, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(260);
};
const state = () => ev(`(()=>{const l=document.getElementById('bdLb');if(!l)return{none:1};
  const i=l.querySelector('.bd-lb-fig img'),b=l.querySelector('.bd-lb-act .dl');
  const ir=i.getBoundingClientRect(),br=b.getBoundingClientRect();
  return{on:l.classList.contains('on'),ct:l.querySelector('.ct').textContent,src:i.getAttribute('src')||'',
    foot:l.querySelector('.bd-lb-foot').textContent,lbs:document.querySelectorAll('#bdLb').length,
    out:l.querySelector('.bd-lb-act').classList.contains('out'),lock:document.body.classList.contains('bd-lb-lock'),
    inside:br.right<=ir.right+1&&br.bottom<=ir.bottom+1&&br.left>=ir.left-1&&br.top>=ir.top-1,
    rightHalf:br.left>ir.left+ir.width/2,bottomHalf:br.top>ir.top+ir.height/2,
    rightEdge:Math.abs(br.right-ir.right)<=2,below:br.top>=ir.bottom-1,
    covers:(br.width*br.height)/Math.max(1,ir.width*ir.height),opens:window.__opens.length,
    ir:[Math.round(ir.left),Math.round(ir.top),Math.round(ir.width),Math.round(ir.height)]}})()`);

let bad = 0; const rows = [];
for (let f = 0; f < files.length; f++) {
  const rel = files[f];
  if (!existsSync(join(ROOT, rel))) { console.log(`  ! missing ${rel}`); bad++; continue; }
  logs = [];
  const R = []; let fail = 0;
  const chk = (name, ok, got) => { R.push({ name, ok: !!ok, got }); if (!ok) { fail++; console.log(`     FAIL ${name}  → ${JSON.stringify(got)}`); } };

  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: 'http://127.0.0.1:' + HP + '/' + encodeURI(rel) });
  await Promise.race([p, sleep(10000)]); loaded = null; await sleep(300);
  await ev(`window.__opens=[];window.__dls=[];window.open=function(u){window.__opens.push(String(u));return null;};
    HTMLAnchorElement.prototype.click=function(){if(this.download)window.__dls.push(this.download);};`);
  await ev(SCRIPT); await sleep(400);

  const base = await ev(`({box:!!document.getElementById('bdBox'),cards:document.querySelectorAll('.bd-it').length,lb:!!document.getElementById('bdLb')})`);
  chk('패널이 그려진다', base.box && base.cards > 1, base);
  chk('뷰어는 열기 전엔 DOM 에 없다', base.lb === false);

  await clickSel('.bd-it[data-i="0"] .th'); await sleep(700);
  let s = await state();
  chk('썸네일 클릭 = 새 탭이 아니라 오버레이', s.on === true && s.opens === 0, { on: s.on, opens: s.opens });
  chk('오버레이는 1개뿐', s.lbs === 1, s.lbs);
  chk('카운터 1 / N', /^1 \/ \d+$/.test(s.ct), s.ct);
  chk('배경 스크롤 잠금', s.lock === true);
  const first = s.src;

  await key('ArrowRight', 39); s = await state();
  chk('→ 다음 사진', s.ct.startsWith('2 /') && s.src !== first, { ct: s.ct, moved: s.src !== first });
  await key('ArrowLeft', 37); s = await state();
  chk('← 이전 사진', s.ct.startsWith('1 /') && s.src === first, s.ct);
  await key('ArrowLeft', 37); s = await state();
  chk('첫 장에서 ← 는 마지막 장으로 순환', s.ct.startsWith(base.cards + ' /'), s.ct);
  await key('Home', 36); s = await state();
  chk('Home = 첫 장', s.ct.startsWith('1 /'), s.ct);

  {   /* 저장 버튼 위치는 사진 크기에 따라 두 모드 */
    const small = !(s.ir[2] >= 240 && s.ir[3] >= 140);
    chk(`1번 사진(${s.ir[2]}×${s.ir[3]}) 저장 버튼 위치`,
      small ? (s.out && s.rightEdge && s.below) : (!s.out && s.inside && s.rightHalf && s.bottomHalf),
      { mode: small ? '밑으로' : '안쪽', out: s.out, rightEdge: s.rightEdge, below: s.below, inside: s.inside, img: s.ir });
  }
  let big = null;
  for (let i = 0; i < base.cards; i++) { const t = await state(); if (t.ir[2] >= 240 && t.ir[3] >= 140) { big = t; break; } await key('ArrowRight', 39); }
  if (big) {
    chk('큰 사진 = 버튼이 이미지 안쪽 우측하단', big.inside && big.rightHalf && big.bottomHalf && !big.out, { img: big.ir });
    chk('버튼이 사진을 3% 넘게 가리지 않는다', big.covers < 0.03, +big.covers.toFixed(4));
  }
  await key('Home', 36); s = await state();
  chk('뷰어에 출처가 보인다', /출처/.test(s.foot), s.foot.slice(0, 50));

  if (f < SHOTS) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = join(OUT, `shot-${String(f + 1).padStart(2, '0')}.png`);
    writeFileSync(name, Buffer.from(shot.result.data, 'base64'));
  }

  await clickSel('#bdLb .bd-lb-act .dl'); await sleep(900);
  const dl = await ev(`({dls:window.__dls.slice(),opens:window.__opens.slice(),save:document.querySelector('#bdLb .bd-lb-act .dl').textContent})`);
  chk('저장 클릭 → 파일 1건 저장(새 탭 폴백 아님)', dl.dls.length === 1 && dl.opens.length === 0, dl);
  chk('파일명에 순번·출처 슬러그', /^\d\d_/.test(dl.dls[0] || ''), dl.dls[0]);
  chk('저장 후 「저장됨」 표시', /저장됨/.test(dl.save), dl.save);
  await sleep(1800);
  chk('버튼 라벨 복귀(💾 저장)', /저장$/.test(await ev(`document.querySelector('#bdLb .bd-lb-act .dl').textContent`)));

  await key('Escape', 27); s = await state();
  chk('Esc 로 닫힌다 + 스크롤 잠금 해제', s.on === false && s.lock === false, { on: s.on, lock: s.lock });

  await clickSel('.bd-it[data-i="2"] .th'); await sleep(600);
  s = await state();
  chk('다른 카드로 열면 그 사진부터', s.on && s.ct.startsWith('3 /'), s.ct);
  const bg = await ev(`(()=>{const l=document.getElementById('bdLb');
    for(let y=70;y<window.innerHeight-70;y+=20)for(let x=6;x<window.innerWidth-6;x+=20){if(document.elementFromPoint(x,y)===l)return{x,y};}return null})()`);
  if (bg) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bg.x, y: bg.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bg.x, y: bg.y, button: 'left', clickCount: 1 });
    await sleep(300); s = await state();
    chk('배경 클릭으로 닫힌다', s.on === false, s.on);
  }

  await ev(`window.__dls=[]`);
  await clickSel('.bd-it[data-i="0"] .bt button.go'); await sleep(900);
  const card = await ev(`(()=>{const b=document.querySelector('.bd-it[data-i="0"] .bt button.go');return{o:b.dataset.o,dls:window.__dls.length,opens:window.__opens.length}})()`);
  chk('카드 「받기」도 그대로 저장된다', card.dls === 1 && card.opens === 0, card);
  chk('카드 버튼 원래 라벨 = 받기', card.o === '받기', card.o);

  /* 좁은 화면: 사진이 화살표를 덮어도 전부 집히는지 */
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 860, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  await clickSel('.bd-it[data-i="1"] .th'); await sleep(900);
  const hit = await ev(`(()=>{const g=(sel)=>{const e=document.querySelector(sel);const r=e.getBoundingClientRect();
    const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return t?(t.className||t.tagName).toString().slice(0,20):'null'};
    return{prev:g('#bdLb .nv.pv'),next:g('#bdLb .nv.nx'),save:g('#bdLb .bd-lb-act .dl'),close:g('#bdLb .bd-lb-top .cl')}})()`);
  chk('좁은 화면에서 ‹ › 저장 ✕ 전부 클릭 가능', /nv pv/.test(hit.prev) && /nv nx/.test(hit.next) && /dl/.test(hit.save) && /cl/.test(hit.close), hit);
  await key('Escape', 27);

  const opens = await ev(`window.__opens.slice()`);
  chk('★전 과정에서 새 탭 0회', opens.length === 0, opens);
  chk('콘솔 예외 0', logs.length === 0, logs.slice(0, 2));

  rows.push({ rel, pass: R.length - fail, total: R.length, fail });
  if (fail) bad++;
  console.log(`${String(f + 1).padStart(3)} ${fail ? 'FAIL' : ' OK '} ${R.length - fail}/${R.length}  ${rel.slice(0, 78)}`);
}

console.log(`\nsummary: files=${rows.length} flagged=${bad}`);
ws.close(); chrome.kill(); srv.close();
process.exit(bad ? 1 : 0);
