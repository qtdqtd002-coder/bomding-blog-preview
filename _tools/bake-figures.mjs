// bake-figures.mjs — 봄딩·영도 미리보기의 «HTML로 그린 도해»를 PNG 사진으로 굽는다 (2026-11-01)
//   node _tools/bake-figures.mjs [--check] [--verbose] <글.html> ...
//   · 이유: 네이버 붙여넣기 위젯(naver-npaste.js)은 HTML 도해를 글자로 풀어 복사한다(11-01 판타지포유 «선점 일정» 도해 실측).
//     사진이어야 위젯의 «사진 포함» 복사·사진별 [복사]/[받기]·이미지함 [받기]에 그대로 들어간다.
//   · 대상(★소스 규칙 하나로 정한다): <!-- 이미지 이유: … --> 주석 바로 뒤에 오는 블록 중
//       ① <svg> ② <div> 인데 안에 <img> 가 없고, 인라인 style 이 있거나 class 에 svgwrap·ig·infographic 이 있거나 data-bake 가 있는 것
//     제외: data-bake="no" · class 가 imgwrap/imgrow/ss/shoot/imgslot/para-wrap/sidenote(사진 자리·본문 글은 굽지 않는다)
//   · 결과: 블록 → <div class="imgwrap"><img src="img/fig-<해시8>.png" width height alt data-fig></div> (주석은 그대로 둔다)
//     원본 블록은 <글폴더>/_qa/figures/fig-<해시8>.html 에 남긴다(고칠 땐 원본을 고쳐 본문에 되돌린 뒤 다시 굽는다 — PNG 직접 편집 금지).
//   · 폭: 글 자신의 CSS 로 미리보기와 같은 자리에서 렌더 → 보이는 크기 그대로 2배 해상도.
//   · 마지막 줄: BAKE n=<구운 수> files=<글 수>  (--check 는 고치지 않고 BAKE-CHECK n=<후보 수>)
//   · exit 0 = 정상(0개 포함) · exit 1 = 사고(크롬·렌더 실패 — 그 글은 손대지 않는다)
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const VERBOSE = args.includes('--verbose');
const files = args.filter(a => !a.startsWith('--')).map(f => resolve(f));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (m) => { if (VERBOSE) console.error('[bake] ' + m); };
if (!files.length) { console.error('사용법: node _tools/bake-figures.mjs [--check] <글.html> ...'); process.exit(1); }

const SKIP_CLASS = /\b(imgwrap|imgrow|ss|shoot|imgslot|para-wrap|sidenote)\b/;
const FIG_CLASS = /\b(svgwrap|ig|infographic|ig-[\w-]+)\b/;

/* 같은 이름 태그의 짝을 세어 블록 끝(닫는 태그 뒤 인덱스)을 찾는다 */
function blockEnd(src, start, tag) {
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*?(/?)>', 'gi');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(src))) {
    if (m[1]) { depth--; if (depth === 0) return re.lastIndex; }
    else if (!m[2]) depth++;
  }
  return -1;
}

const INLINE_PARENT = /^(p|span|li|a|b|strong|em|i|h[1-6]|td|th|button|label|summary|dt|dd)$/i;
/* 시작 태그가 굽을 대상인가 — 인포그래픽 정본(infographic-library §0-3)은 «클래스 없는 인라인 스타일 블록»이고,
   클래스 달린 상자(.gap·.box·.pick·.shoot 등)는 글 CSS 의 본문 부품이라 글자로 붙는 게 맞다 */
function isFigStart(tag, attrs, src, s) {
  if (/data-bake\s*=\s*["']?no/i.test(attrs)) return false;
  if (/data-bake/i.test(attrs)) return true;
  const cls = (attrs.match(/class\s*=\s*"([^"]*)"/i) || [])[1] || '';
  if (tag === 'svg') {
    /* 글줄 안 아이콘 svg(14~24px)는 제외 — 블록 자리에 놓인 큰 svg 만 */
    const vb = attrs.match(/viewBox\s*=\s*"\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)/i);
    const wd = attrs.match(/\bwidth\s*=\s*"?([\d.]+)/i);
    const w = Math.max(vb ? +vb[1] : 0, wd ? +wd[1] : 0);
    const prev = src.slice(Math.max(0, s - 400), s).match(/<(\/?)([a-z][\w-]*)\b[^>]*>\s*$/i);
    if (prev && !prev[1] && INLINE_PARENT.test(prev[2])) return false;
    return w >= 120;
  }
  if (FIG_CLASS.test(cls)) return true;
  if (cls.trim()) return false;
  const st = (attrs.match(/style\s*=\s*"([^"]*)"/i) || [])[1] || '';
  return /border|background/i.test(st);
}

/* 본문(위젯 서랍·#copy 앞)에서 굽을 블록을 찾는다 — 바깥쪽 블록만(안쪽 메모지·카드는 바깥 블록과 같이 구워진다) */
function findBlocks(src) {
  const cut = ['id="npBtn"', 'id="npDrawer"', 'id="copy"'].map(k => src.indexOf(k)).filter(i => i >= 0);
  const limit = cut.length ? Math.min(...cut) : src.length;
  const bodyAt = Math.max(0, src.search(/<body\b/i));
  /* 주석·script·style 안의 태그는 세지 않는다(같은 길이 공백으로 지운 사본에서 위치만 찾는다) */
  const scan = src.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, (t) => ' '.repeat(t.length));
  const re = /<(div|svg)\b([^>]*?)(\/?)>/gi;
  re.lastIndex = bodyAt;
  const out = [];
  let m;
  while ((m = re.exec(scan)) && m.index < limit) {
    const tag = m[1].toLowerCase(), attrs = m[2];
    if (m[3] || !isFigStart(tag, attrs, scan, m.index)) continue;
    const s = m.index, e = blockEnd(scan, s, tag);
    if (e < 0 || e > limit) continue;
    const block = src.slice(s, e);
    if (/<img\b/i.test(block)) { re.lastIndex = e; continue; }   // 사진이 든 묶음은 이미 사진이다
    /* 설명: 바로 앞 «이미지 이유» 주석이 있으면 그 문장, 없으면 블록 첫 글자들 */
    const pre = src.slice(Math.max(0, s - 1200), s).match(/<!--\s*이미지 이유:([\s\S]*?)-->\s*$/);
    let why = pre ? pre[1].split(/\s\/\s*출처/)[0] : block.replace(/<[^>]+>/g, ' ');
    why = why.replace(/\s+/g, ' ').trim();
    const hash = createHash('sha1').update(block).digest('hex').slice(0, 8);
    out.push({ s, e, tag, block, why, id: 'fig-' + hash, hasMeta: !!pre });
    re.lastIndex = e;
  }
  return out;
}

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const escAttr = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── 크롬(CDP) 한 번 띄워 모든 글을 렌더 ── */
let chrome = null, ws = null;
const killAll = () => { try { ws && ws.close(); } catch {} try { chrome && chrome.kill(); } catch {} };
setTimeout(() => { console.error('시간 초과(150초)'); killAll(); process.exit(1); }, 150000).unref();

let id = 0; const pending = new Map(); let loaded = null;
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };

async function startChrome() {
  const port = 9400 + Math.floor(Math.random() * 90);
  const prof = join(tmpdir(), `_figbake${port}`); mkdirSync(prof, { recursive: true });
  chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  if (!ver) throw new Error('chrome did not start');
  const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = (m0) => {
    const m = JSON.parse(m0.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Page.loadEventFired' && loaded) loaded();
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  /* 위젯·이미지함·스플래시 스크립트는 렌더에 불필요 — 막는다(본문 레이아웃만 본다) */
  await send('Network.setBlockedURLs', { urls: ['*/_design/*.js', '*sslip.io*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 2, mobile: false });
  log('chrome ' + ver.Browser);
}

async function bakeFile(file) {
  const src = readFileSync(file, 'utf8');
  const blocks = findBlocks(src);
  const postDir = dirname(file);
  if (!blocks.length || CHECK) return blocks;
  if (!chrome) await startChrome();
  const figDir = join(postDir, '_qa', 'figures');
  mkdirSync(figDir, { recursive: true });
  /* 렌더용 사본: 후보 블록 시작 태그에 표식 · <base> 로 상대경로를 글 폴더 기준으로 */
  let html = src;
  for (let k = blocks.length - 1; k >= 0; k--) {
    const b = blocks[k];
    html = html.slice(0, b.s) + b.block.replace(/^<(div|svg)\b/i, (t) => `${t} data-figbake="${k}"`) + html.slice(b.e);
  }
  const base = pathToFileURL(postDir + '/').href;
  html = html.replace(/<head([^>]*)>/i, (t) => `${t}<base href="${base}">`);
  const tmp = join(figDir, '_render.html');
  writeFileSync(tmp, html, 'utf8');
  try {
    const p0 = new Promise(r => loaded = r);
    await send('Page.navigate', { url: pathToFileURL(tmp).href });
    await Promise.race([p0, sleep(15000)]); loaded = null;
    await ev(`(async()=>{ try{ await document.fonts.ready; }catch(e){} await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,5000);}))); await new Promise(r=>setTimeout(r,300)); return true; })()`);
    let out = src;
    for (let k = blocks.length - 1; k >= 0; k--) {
      const b = blocks[k];
      /* 요소와 자손(기울인 메모지·테이프) 사각형의 합 — 요소 밖으로 16px 넘게는 안 넓힌다 */
      const r = await ev(`(()=>{const el=document.querySelector('[data-figbake="${k}"]'); if(!el) return null;
        const o=el.getBoundingClientRect(); let x0=o.left,y0=o.top,x1=o.right,y1=o.bottom;
        for (const d of el.querySelectorAll('*')) { const q=d.getBoundingClientRect(); if(!q.width||!q.height) continue;
          x0=Math.min(x0,Math.max(q.left,o.left-16)); y0=Math.min(y0,Math.max(q.top,o.top-16));
          x1=Math.max(x1,Math.min(q.right,o.right+16)); y1=Math.max(y1,Math.min(q.bottom,o.bottom+16)); }
        const sx=window.scrollX, sy=window.scrollY;
        return {x:Math.floor(x0+sx), y:Math.floor(y0+sy), w:Math.ceil(x1-x0), h:Math.ceil(y1-y0)}; })()`);
      if (!r || r.w < 20 || r.h < 20) throw new Error(`블록 ${k} 렌더 크기 이상: ${JSON.stringify(r)}`);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
      if (!shot.result?.data) throw new Error(`블록 ${k} 캡처 실패`);
      const buf = Buffer.from(shot.result.data, 'base64');
      const { w, h } = pngSize(buf);
      mkdirSync(join(postDir, 'img'), { recursive: true });
      writeFileSync(join(postDir, 'img', b.id + '.png'), buf);
      writeFileSync(join(figDir, b.id + '.html'), b.block, 'utf8');
      const alt = escAttr((b.why || '도해').slice(0, 120));
      /* 3종 메타 주석이 없던 도해엔 붙여 준다(img-lint IMG-6 · 이미지함 설명) — 주석 안에 -- 가 들어가지 않게 */
      const meta = b.hasMeta ? '' : `<!-- 이미지 이유: ${(b.why || '도해').slice(0, 80).replace(/--+/g, '-')} / 출처: 직접 제작 도해(bake-figures 자동 구움) / 분류: 인포그래픽 -->\n    `;
      const tagOut = `${meta}<div class="imgwrap"><img src="img/${b.id}.png" width="${w}" height="${h}" alt="${alt}" data-fig="${b.id}"></div>`;
      out = out.slice(0, b.s) + tagOut + out.slice(b.e);
      log(`${b.id} ${w}x${h} ← ${b.why.slice(0, 40)}`);
    }
    writeFileSync(file, out, 'utf8');
  } finally {
    try { rmSync(tmp, { force: true }); } catch {}
  }
  return blocks;
}

let total = 0, rc = 0;
for (const f of files) {
  if (!existsSync(f)) { console.error('없음: ' + f); rc = 1; continue; }
  try {
    const b = await bakeFile(f);
    total += b.length;
    if (b.length) console.log(`${CHECK ? '후보' : '구움'} ${b.length}  ${f}` + (VERBOSE || CHECK ? '\n' + b.map(x => `   - ${x.id} <${x.tag}> ${x.why.slice(0, 60)}`).join('\n') : ''));
  } catch (e) { console.error(`실패: ${f} — ${e.message}`); rc = 1; }
}
killAll();
console.log(`${CHECK ? 'BAKE-CHECK' : 'BAKE'} n=${total} files=${files.length}`);
process.exit(rc);
