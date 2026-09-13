// verify-title.mjs — 도구함 「제목 검사기」(_toolbox/title.js) 헤드리스 검증 (2026-09-14 · v1)
//   node _tools/verify-title.mjs [--out DIR]
//   · verify-table.mjs 와 같은 하네스(로컬 정적 서버 + 크롬 헤드리스 CDP, 의존성 0). 축하 스플래시 ?cheer=0, 라이브 백엔드 차단.
//   · ★이 게이트의 핵심은 «작성자 격리»다 — 같은 제목이 작성자를 바꾸면 다른 판정을 내야 한다.
//       봄딩 대시 부제 → 지적 / 영도 같은 제목 → 지적 없음      (봄딩 전용 규칙이 영도로 새지 않는지)
//       영도 D-n·괄호 영문 → 지적 / 봄딩 같은 제목 → 지적 없음  (영도 전용 규칙이 봄딩으로 새지 않는지)
//     규칙이 서로 새면 한 사람의 정본이 다른 사람 글을 망친다. 코드 리뷰로는 안 보여서 여기서 못 박는다.
//   · 1920×1080: 목록 등록 → 마운트 → 각도 사다리 → 작성자별 규칙 → 격리 → 겹침(실제 라이브 제목) → 길이 → 저장·복원 → 버튼 → 콘솔 0
//   · 1366×768 · 390×844: 넘침 0 · 단일 열 · 터치 타깃
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
const OUT = val('--out', join(tmpdir(), '_title-out'));
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
const prof = join(tmpdir(), `_titleprof${port}`);
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
  await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center'});return true})()`);
  await sleep(120);
  const r = await rect(sel); if (!r) return false;
  await tap(r.cx, r.cy);
  return true;
};
const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !v.__err) return v; await sleep(120); } return null; };
/* 실키보드 — 포커스 검증은 JS .focus() 가 아니라 이쪽으로 도달시켜야 :focus-visible 까지 진짜다(design-review-learnings 09-06) */
const key = async (k, vk, opt = {}) => {
  const p = { type: 'keyDown', key: k, code: opt.code || k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: opt.mod || 0 };
  await send('Input.dispatchKeyEvent', p);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: opt.code || k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: opt.mod || 0 });
  await sleep(140);
};

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
const gotoTitle = async () => {
  await ev(`window.scrollTo(0,0)`); await sleep(300);
  await click('.isl-tab[data-v="tools"]'); await sleep(700);
  await waitFor(`!!document.querySelector('#tbList .tb-item[data-t="title"]')`, 8000);
  await click('#tbList .tb-item[data-t="title"]'); await sleep(500);
  return waitFor(`!!document.getElementById('ttlIn')&&!!window.SseudamTools&&!!window.SseudamTools.title`, 8000);
};
const T = (expr) => ev(`window.SseudamTools.title.__test.${expr}`);
/* 제목을 실제 입력 경로로 넣는다(값만 바꾸면 input 이벤트·디바운스를 건너뛰어 실제와 다르다) */
const put = async (t) => {
  await ev(`(()=>{const e=document.getElementById('ttlIn');e.value=${JSON.stringify(t)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await sleep(260);
  return T('state()');
};
const pickWriter = async (w) => { await click(`.ttl-chip[data-w="${w}"]`); await sleep(320); };
const sigIds = (s) => (s && s.signals ? s.signals.map(x => x.id) : []);
const kindOf = (s, id) => { const f = (s.signals || []).find(x => x.id === id); return f ? f.kind : null; };

/* 실제 라이브 제목 하나 — 겹침 검사의 «참값»(지어낸 문자열이 아니라 대조 대상 그 자체) */
const LIVE = JSON.parse(readFileSync(join(ROOT, '_trend', '_live-titles.json'), 'utf8'));
const BOM_TITLE = (LIVE.byAuthor['봄딩'] || [])[0];
const YD_TITLE = (LIVE.byAuthor['영도'] || [])[0];

/* ═════════ 1920×1080 ═════════ */
await open(1920, 1080, false);
logs = [];
chk('도구 목록에 「제목 검사기」 행이 있다', !!(await waitFor(`(async()=>{document.querySelector('.isl-tab[data-v="tools"]').click();await new Promise(r=>setTimeout(r,700));return !!document.querySelector('#tbList .tb-item[data-t="title"]')})()`, 9000)));
chk('도구가 마운트된다', !!(await gotoTitle()));
chk('버전 쿼리가 붙어 있다(캐시 버스트)', await ev(`[...document.querySelectorAll('script')].some(s=>/_toolbox\\/title\\.js\\?v=/.test(s.src))`));

let st = await T('state()');
chk('기본 작성자 = 봄딩', st && st.writer === '봄딩', st);
chk('작성자 칩 2개(봄딩·영도)', (await ev(`[...document.querySelectorAll('.ttl-chip')].map(b=>b.dataset.w).join(',')`)) === '봄딩,영도');
chk('빈 입력 = 빈 상태 문구', await ev(`/제목을 쓰면/.test(document.getElementById('ttlList').textContent)`));
chk('대조 자료를 받았다(라이브 420편)', !!(await waitFor(`window.SseudamTools.title.__test.state().loaded&&window.SseudamTools.title.__test.state().live>0`, 9000)));
chk('라이브 편수가 실제 파일과 같다', (await T('state()')).live === (LIVE.byAuthor['봄딩'] || []).length, { got: (await T('state()')).live, want: (LIVE.byAuthor['봄딩'] || []).length });

/* ── 각도 사다리 — angle-mix.py 부록 A 와 같은 결과여야 한다 ── */
chk('각도 ①공략·방법형', (await T(`angleOf('팰월드 전투팰 얻는 법')`)) === '공략·방법형');
chk('각도 ②쿠폰형(공략 어휘가 없을 때)', (await T(`angleOf('리니지M 쿠폰 모아보기')`)) === '쿠폰형', await T(`angleOf('리니지M 쿠폰 모아보기')`));
chk('각도 ③추천·티어·비교형', (await T(`angleOf('애니모 캐릭터 티어')`)) === '추천·티어·비교형');
chk('각도 ④후기·리뷰형', (await T(`angleOf('우도 출시 첫인상')`)) === '후기·리뷰형');
chk('각도 ⑤뉴스·소식형', (await T(`angleOf('애니모 정식 출시 발표')`)) === '뉴스·소식형');
chk('각도 ⑥정리·모음형', (await T(`angleOf('메이플 직업 총정리')`)) === '정리·모음형', await T(`angleOf('메이플 직업 총정리')`));
chk('각도 ⑦기타', (await T(`angleOf('팰월드 팰')`)) === '기타');
/* 「이벤트」(뉴스)가 「총정리」(정리)보다 위라서 뉴스로 간다 — 사다리의 설계 그대로다(angle-mix.py 와 같은 결과) */
chk('사다리 순서: 뉴스가 정리를 이긴다', (await T(`angleOf('메이플 이벤트 총정리')`)) === '뉴스·소식형', await T(`angleOf('메이플 이벤트 총정리')`));
chk('사다리 순서: 공략이 뉴스를 이긴다', (await T(`angleOf('애니모 출시 기념 보상 얻는 법')`)) === '공략·방법형', await T(`angleOf('애니모 출시 기념 보상 얻는 법')`));
/* ★사다리에 없는 «받는 법»은 공략으로 안 잡힌다(angle-mix.py 부록 A 의 실제 동작) — 도구가 정본을 임의로 고치지 않았다는 증거 */
chk('사다리는 정본 그대로(«받는 법» 은 공략 어휘가 아니다)', (await T(`angleOf('애니모 보상 받는 법')`)) === '기타', await T(`angleOf('애니모 보상 받는 법')`));
/* 반면 «검색 질의형» 신호는 별개라 «~는 법» 형태를 전부 잡는다 */
chk('검색 질의형 신호는 «올리는 법»도 잡는다', kindOf(await put('쿠키런 크럼블 길드 점수 올리는 법'), 'query') === 'ok', sigIds(await T('state()')));

/* ── 봄딩 규칙 ── */
st = await put('아이온2 대규모 업데이트 — 28년 만에 원작자가 돌아왔다');
chk('[봄딩] 기사형 대시 부제 → 지적', kindOf(st, 'dash') === 'bad', sigIds(st));
chk('[봄딩] 대시 지적에 고칠 방향이 붙는다', await ev(`/쉼표로 잇는다/.test(document.getElementById('ttlList').textContent)`));
chk('[봄딩] 뉴스·소식형 → 확인 신호', kindOf(st, 'news') === 'warn', sigIds(st));
chk('[봄딩] 뉴스형 힌트에 how-to 뒤집기가 있다', await ev(`/얻는 법|대응 세팅/.test(document.getElementById('ttlList').textContent)`));
await shot('01-bomding-bad');

st = await put('아이온2 인장 제작 재료 공략, 키나 비용까지');
chk('[봄딩] 쉼표 부제는 지적하지 않는다(라이브 21.2%가 쓴다)', sigIds(st).indexOf('dash') < 0, sigIds(st));
chk('[봄딩] 검색 질의형 → 좋은 신호', kindOf(st, 'query') === 'ok', sigIds(st));
chk('[봄딩] 뉴스형 아님', sigIds(st).indexOf('news') < 0, st.angle);
chk('각도 칩이 화면에 그려진다', (await ev(`document.querySelector('.ttl-ang').textContent`)) === st.angle);
await shot('02-bomding-good');

st = await put('메이플스토리 신규 이벤트 보상 정리 그리고 아주 길게 늘어놓은 제목의 예시로 쓰는 문장입니다');
chk('[봄딩] 길면 실측 대비 위치를 알려 준다', kindOf(st, 'len') === 'info', { len: st.len, ids: sigIds(st) });
st = await put('두근두근타운 고래 탐사 직접 해보니 이렇더라');
chk('[봄딩] 경험 신호는 알려만 준다(경고 아님)', kindOf(st, 'exp') === 'info', sigIds(st));

/* ── 겹침 — 실제 라이브 제목을 그대로 넣으면 반드시 잡혀야 한다 ── */
st = await put(BOM_TITLE);
chk('[봄딩] 라이브 제목 그대로 → 겹침 잡힘', st.dupes >= 1, { dupes: st.dupes, t: BOM_TITLE });
chk('[봄딩] 겹침은 확인 신호로 뜬다', kindOf(st, 'dup') === 'warn', sigIds(st));
chk('겹침 목록에 그 제목이 보인다', await ev(`document.getElementById('ttlDup').textContent.indexOf(${JSON.stringify(BOM_TITLE.slice(0, 12))})>=0`));
chk('겹침 100% 표시', await ev(`/겹침 100%/.test(document.getElementById('ttlDup').textContent)`));
st = await put('전혀 상관없는 문장 고양이 구름 사다리 우산');
chk('무관한 제목은 겹침 0', st.dupes === 0, st.dupes);
await shot('03-dupe');

/* ── ★격리: 작성자를 바꾸면 규칙이 바뀐다 ── */
const DASH_T = '아이온2 대규모 업데이트 — 28년 만에 원작자가 돌아왔다';
const DN_T = '압솔룸 스위치2 에디션 사전예약 D-8, 가격 특전 정리';
const ENG_T = '헤일로 캠페인 이볼브드 (Halo Campaign Evolved) PS5 출시일';

st = await put(DN_T);
chk('[봄딩] D-n 은 봄딩 규칙이 아니다 → 지적 없음', sigIds(st).indexOf('dn') < 0, sigIds(st));
st = await put(ENG_T);
chk('[봄딩] 괄호 영문은 봄딩 규칙이 아니다 → 지적 없음', sigIds(st).indexOf('engp') < 0, sigIds(st));

await pickWriter('영도');
st = await T('state()');
chk('영도로 바뀐다', st.writer === '영도', st);
chk('영도 라이브 편수로 대조 대상이 바뀐다', await waitFor(`window.SseudamTools.title.__test.state().live===${(LIVE.byAuthor['영도'] || []).length}`, 4000) !== null, (await T('state()')).live);

st = await put(DASH_T);
chk('★[영도] 봄딩 전용 대시 규칙이 새지 않는다', sigIds(st).indexOf('dash') < 0, sigIds(st));
st = await put(DN_T);
chk('[영도] D-n 시한부 표기 → 지적', kindOf(st, 'dn') === 'bad', sigIds(st));
chk('[영도] D-n 지적 근거에 07-24 델타가 있다', await ev(`/2026-07-24|헤일로/.test(document.getElementById('ttlList').textContent)`));
st = await put(ENG_T);
chk('[영도] 괄호 영문 원문 병기 → 지적', kindOf(st, 'engp') === 'bad', sigIds(st));
st = await put('림버스컴퍼니 유파우 파우스트 스킬 공략');
chk('[영도] 검색 질의형 → 좋은 신호', kindOf(st, 'query') === 'ok', sigIds(st));
chk('[영도] 쉼표·물음표는 지적하지 않는다(라이브 30.7%가 쉼표를 쓴다)',
  sigIds(await put('아스달 연대기 뉴월드 시즌2, 전설 정령 받는 법은?')).every(x => x !== 'comma' && x !== 'q'), sigIds(await T('state()')));
st = await put(YD_TITLE);
chk('[영도] 라이브 제목 그대로 → 겹침 잡힘', st.dupes >= 1, { dupes: st.dupes, t: YD_TITLE });
await shot('04-yeongdo');

chk('규칙 목록이 작성자별로 분리돼 있다', await ev(`(()=>{const r=window.SseudamTools.title.__test.rules();return r['봄딩'].indexOf('dn')<0&&r['봄딩'].indexOf('engp')<0&&r['영도'].indexOf('dash')<0&&r['영도'].indexOf('news')<0})()`),
  await T('rules()'));

/* ── 버튼·저장 ── */
await put('팰월드 전투팰 추천 조합 정리');
await click('#ttlClear'); await sleep(260);
chk('지우기 → 입력·판정 비움', (await ev(`document.getElementById('ttlIn').value===''`)) && (await T('state()')).len === 0);
await put('팰월드 전투팰 추천 조합 정리');
chk('localStorage 에 작성자·제목이 남는다', await ev(`(()=>{const d=JSON.parse(localStorage.getItem('sseudam_title_v1')||'{}');return d.writer==='영도'&&/팰월드/.test(d.text||'')})()`),
  await ev(`localStorage.getItem('sseudam_title_v1')`));
await click('.isl-tab[data-v="home"]'); await sleep(600);
await gotoTitle(); await sleep(300);
st = await T('state()');
chk('탭을 떠났다 돌아와도 그대로 복원', st.writer === '영도' && /팰월드/.test(st.text), st);
chk('복원 뒤에도 판정이 그려져 있다', await ev(`document.querySelectorAll('.ttl-sig').length>0`));

/* ── 접근성·위계 (2026-09-14 디자인 검수 지적 → 게이트로 못 박음) ──
   포커스 링은 09-06 에 전역 통일된 «2px 잉크»가 정본이다(DESIGN.md §Inputs). 1px hair-3 조합은 1.6:1 로 안 보여
   이미 폐기됐는데 이 도구가 그걸 되살렸다(검수 🔴). «이미 고친 버그의 재발»이라 사람 눈이 아니라 게이트가 잡아야 한다. */
await ev(`document.getElementById('ttlIn').blur()`);
await key('Tab', 9); await sleep(120);
await ev(`document.getElementById('ttlIn').focus()`); await sleep(200);
const ring = await ev(`(()=>{const e=document.getElementById('ttlIn');const cs=getComputedStyle(e);return {outline:cs.outlineWidth,shadow:cs.boxShadow}})()`);
chk('제목 입력 포커스 링 = 2px(폭)', /0px 0px 0px 2px/.test(String(ring && ring.shadow)), ring);
chk('제목 입력 포커스 링 색 = 잉크(옅은 헤일로 금지)', /rgb\(14,\s*17,\s*20\)/.test(String(ring && ring.shadow)), ring);

await pickWriter('봄딩');                                            /* 대시(bad)+뉴스형(warn) 은 봄딩 규칙이다 */
await put('아이온2 대규모 업데이트 — 28년 만에 원작자가 돌아왔다');   /* bad + warn 동시 */
const faces = await ev(`(()=>{const g=(k)=>{const e=document.querySelector('.ttl-sig.'+k);return e?getComputedStyle(e).backgroundColor:null};return {bad:g('bad'),warn:g('warn'),ok:g('ok'),info:g('info')}})()`);
chk('신호 3단 위계 — bad ≠ warn', !!faces.bad && !!faces.warn && faces.bad !== faces.warn, faces);
chk('신호 3단 위계 — warn 은 흰 면이 아니다', !!faces.warn && faces.warn !== 'rgb(255, 255, 255)', faces);

chk('가로 넘침 없음(1920)', await ev(`document.documentElement.scrollWidth<=innerWidth`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
chk('[1920] 콘솔 예외 0', logs.length === 0, logs);

/* ═════════ 1366×768 ═════════ */
await open(1366, 768, false); logs = [];
await gotoTitle();
await put('메이플플래닛 나이트로드 사냥터 추천');
chk('[1366] 두 열 유지', (await ev(`getComputedStyle(document.querySelector('.ttl')).gridTemplateColumns.split(' ').length`)) === 2);
chk('[1366] 가로 넘침 없음', await ev(`innerWidth===1366&&document.documentElement.scrollWidth<=1366`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
await shot('05-1366');
chk('[1366] 콘솔 예외 0', logs.length === 0, logs);

/* ═════════ 390×844 ═════════ */
await open(390, 844, true); logs = [];
await gotoTitle();
await pickWriter('영도');   /* D-n 은 영도 규칙 — 앞 검사에서 봄딩으로 바뀐 채 복원되므로 여기서 다시 고른다 */
st = await put('압솔룸 스위치2 에디션 사전예약 D-8, 가격 특전 정리');
chk('[390] 단일 열',(await ev(`getComputedStyle(document.querySelector('.ttl')).gridTemplateColumns.split(' ').length`)) === 1);
chk('[390] 가로 넘침 없음(레이아웃 뷰포트가 390 그대로)', await ev(`innerWidth===390&&document.documentElement.scrollWidth<=390`), await ev(`({iw:innerWidth,sw:document.documentElement.scrollWidth})`));
const tapMin = await ev(`(()=>{const q=[...document.querySelectorAll('.ttl-chip,.ttl-btn')].filter(e=>e.offsetParent);return Math.min(...q.map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height)}))})()`);
chk('[390] 터치 타깃 ≥ 28', tapMin >= 28, { tapMin });
chk('[390] 판정이 그려진다(영도 D-n 지적)', (await ev(`document.querySelectorAll('.ttl-sig').length>0`)) && sigIds(st).indexOf('dn') >= 0, sigIds(st));
await shot('06-390');
chk('[390] 콘솔 예외 0', logs.length === 0, logs);

console.log(`\n${R.length - fail}/${R.length} PASS${fail ? ' · FAIL ' + fail : ''}`);
try { ws.close(); } catch {}
chrome.kill(); srv.close();
process.exit(fail ? 1 : 0);
