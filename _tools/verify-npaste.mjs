// verify-npaste.mjs — 봄딩 네이버 붙여넣기 위젯 v2(_design/bomding-npaste.js) 헤드리스 검증
//   node _tools/verify-npaste.mjs [--all | --unpub] [--limit N] [--shots K] [--out DIR] [file.html ...]
//   · 각 미리보기를 headless Chrome(CDP)으로 열고 로컬 스크립트를 주입해
//     예외 0 / 서랍 생성 / 자동 생존본 통계 / 원문 토큰 커버리지(자동본 vs 작성자 #copy) / 복사 HTML 형태를 잰다.
//   · --shots K : 앞 K개는 서랍을 열어 스크린샷(PNG)을 남긴다(이미지 로드 허용).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SCRIPT = readFileSync(join(ROOT, '_design', 'naver-npaste.js'), 'utf8');   /* 캐논(봄딩·영도 공용). bomding-npaste.js 는 1줄 로더 */
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(val('--limit', 0)) || 0;
const SHOTS = Number(val('--shots', 0)) || 0;
const OUT = val('--out', join(ROOT, '_tools', '_npaste-out'));
mkdirSync(OUT, { recursive: true });

let files = args.filter(a => a.endsWith('.html'));
if (flag('--all') || flag('--unpub') || !files.length) {
  const posts = JSON.parse(readFileSync(join(ROOT, 'posts.json'), 'utf8'));
  const AUTHOR = val('--author', '봄딩');   /* --author 영도 : 다른 작성자 글에 같은 스크립트를 실험 주입(검토용) */
  files = posts.filter(p => p.author === AUTHOR && (!flag('--unpub') || !p.published)).map(p => p.rel);
}
if (LIMIT) files = files.slice(0, LIMIT);
console.log(`files: ${files.length}`);

const port = 9400 + Math.floor(Math.random() * 400);
const prof = join(OUT, `_prof${port}`);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`,
  '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); throw new Error('chrome did not start'); }
console.log('chrome', ver.Browser);
const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); let logs = []; let loaded = null;
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('[console.error] ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Page.loadEventFired' && loaded) loaded();
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

const PROBE = `(()=>{const d=window.__np; if(!d) return {err:'no __np'};
  const s=d.stats(); const tok=(x)=>new Set(String(x).split(/\\s+/).map(w=>w.replace(/[\\s"'“”‘’()\\[\\]〔〕·—,.!?:;]/g,'')).filter(w=>w.length>=2));
  const A=tok(d.articleText()), U=tok(d.autoText()); const oldEl=document.getElementById('copy'); const O=tok(oldEl?d.htmlText(oldEl):'');
  let hit=0; for(const w of A) if(U.has(w)) hit++; let hitO=0; for(const w of A) if(O.has(w)) hitO++;
  const miss=[]; for(const w of A){ if(!U.has(w)){ miss.push(w); if(miss.length>=12) break; } }
  const h1=d.copyHTML('img','h3'), h2=d.copyHTML('text','quote');
  return Object.assign({}, s, {writer:d.writer, artTok:A.size, cov:A.size?+(hit/A.size).toFixed(3):1, covOld:O.size?+(hitO/A.size).toFixed(3):null,
    imgsInCopy:(h1.match(/<img /g)||[]).length, imgsInText:(h2.match(/<img /g)||[]).length, quotes:(h2.match(/<blockquote/g)||[]).length,
    h3InQuote:(h2.match(/<h3/g)||[]).length, phText:(h2.match(/사진 자리/g)||[]).length, cls:(h1.match(/class="(?!ph")/g)||[]).length,
    autoLen:d.autoText().length, oldLen:oldEl?oldEl.textContent.length:0, drawer:!!document.getElementById('npDrawer'), miss:miss.join(' ')});})()`;

const rows = []; let bad = 0;
for (let i = 0; i < files.length; i++) {
  const rel = files[i]; const abs = join(ROOT, rel);
  if (!existsSync(abs)) { rows.push({ rel, err: 'missing' }); continue; }
  const wantShot = i < SHOTS;
  const LIVE = flag('--live');   /* --live: 로컬 주입 없이 글에 박힌 include(라이브 URL)만으로 동작하는지 본다 */
  const blocked = wantShot ? [] : ['*.png', '*.jpg', '*.jpeg', '*.webp', '*.gif'];
  if (!LIVE) { blocked.push('*bomding-npaste.js*'); blocked.push('*naver-npaste.js*'); }
  await send('Network.setBlockedURLs', { urls: blocked });
  logs = [];
  const p = new Promise(r => loaded = r);
  await send('Page.navigate', { url: pathToFileURL(abs).href });
  await Promise.race([p, sleep(8000)]); loaded = null;
  await sleep(LIVE ? 1200 : 150);
  if (!LIVE) await send('Runtime.evaluate', { expression: SCRIPT, returnByValue: true });
  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  const v = r.result?.result?.value || { err: 'no value' };
  v.rel = rel; v.exc = logs.length; v.excMsg = logs.slice(0, 2).join(' | ');
  if (wantShot) {
    await send('Runtime.evaluate', { expression: 'window.__np&&window.__np.open()' });
    await sleep(900);
    const scroll = Number(val('--scroll', 0)) || 0;
    if (scroll) { await send('Runtime.evaluate', { expression: `document.querySelector('.np2-body').scrollTop=${scroll}` }); await sleep(250); }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = join(OUT, `shot-${String(i + 1).padStart(2, '0')}${scroll ? '-s' + scroll : ''}.png`);
    writeFileSync(name, Buffer.from(shot.result.data, 'base64')); v.shot = name;
  }
  if (val('--probe', '') && i === 0) {   /* --probe "<js>" : 첫 파일에서 임의 표현식 평가(디버그) */
    const pr = await send('Runtime.evaluate', { expression: val('--probe', ''), returnByValue: true });
    console.log('probe →', JSON.stringify(pr.result?.result?.value ?? pr.result?.exceptionDetails?.text).slice(0, 1500));
  }
  if (flag('--dump') && i === 0) {
    const d1 = await send('Runtime.evaluate', { expression: 'window.__np.copyHTML("img","h3")', returnByValue: true });
    const d2 = await send('Runtime.evaluate', { expression: 'window.__np.copyHTML("text","quote")', returnByValue: true });
    writeFileSync(join(OUT, 'copy-img-h3.html'), d1.result?.result?.value || '');
    writeFileSync(join(OUT, 'copy-text-quote.html'), d2.result?.result?.value || '');
    console.log('dumped copy HTML →', join(OUT, 'copy-img-h3.html'));
  }
  rows.push(v);
  const mark = v.err || v.exc || (v.cov != null && v.cov < 0.97) || !v.drawer ? ' <<' : '';
  if (mark) bad++;
  console.log(`${String(i + 1).padStart(3)} [${v.writer ?? '?'}] cov=${v.cov ?? '-'} old=${v.covOld ?? '-'} photo=${v.photos ?? '-'}(img${v.imgs ?? '-'}) tbl=${v.tables ?? '-'} cp=${v.coupang ?? '-'} h=${v.heads ?? '-'} blocks=${v.blocks ?? '-'} imgCopy=${v.imgsInCopy ?? '-'}/${v.imgsInText ?? '-'} q=${v.quotes ?? '-'}/${v.h3InQuote ?? '-'} exc=${v.exc}${mark} ${rel.slice(0, 70)}${v.err ? ' ERR ' + v.err : ''}${v.exc ? ' ' + v.excMsg : ''}${mark && v.miss ? '\n      miss: ' + v.miss : ''}`);
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
const covs = rows.filter(r => r.cov != null).map(r => r.cov);
const min = Math.min(...covs), avg = covs.reduce((a, b) => a + b, 0) / (covs.length || 1);
const olds = rows.filter(r => r.covOld != null).map(r => r.covOld);
const avgOld = olds.reduce((a, b) => a + b, 0) / (olds.length || 1);
console.log(`\nsummary: files=${rows.length} flagged=${bad} cov min=${min.toFixed(3)} avg=${avg.toFixed(3)} | 작성자#copy 평균 커버리지=${avgOld.toFixed(3)} (${olds.length}편) | exceptions=${rows.filter(r => r.exc).length}`);
ws.close(); chrome.kill();
process.exit(bad ? 1 : 0);
