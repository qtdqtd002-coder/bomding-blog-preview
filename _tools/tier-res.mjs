// tier-res.mjs — 도구함 「티어표 제작」 캐릭터 리소스 묶음 생성 (2026-09-07)
//   node _tools/tier-res.mjs --spec <spec.json> [--out _toolbox/tier/res] [--size 512] [--sheet]
//   · spec = { id, game, aliases?, source:{name,url,rights}, updated, zoom?, focus?, pad?, items:[{id,name,rarity,element,role,url, referer?, zoom?, focus?:{x,y}, pad?}] }
//     - aliases = 게임 다른 표기(«쿠키런 크럼블» 등) — manifest·index 에 실려 사이트 «티어표 추천» 칸이 묶음을 찾는다(2026-10-25).
//     - referer = 그 원본 호스트가 요구하는 Referer. 비우면 호스트 표(REFERER)로 — ★i.namu.wiki 는 Referer 없이 받으면 그림 대신 SVG 자리표시를 준다(10-25 실측).
//   · 원본(url)을 임시 폴더에 내려받고, 헤드리스 크롬(의존성 0)에서 알파 경계(그림이 있는 상자)를 잰 뒤
//     «얼굴이 보이는 정사각»으로 잘라 size² webp 로 저장한다.
//     - zoom = 상자의 짧은 변 대비 정사각 한 변의 비율(1 = 그림 전체 · .6 = 머리+상체 정도). 기본 1.
//     - focus = {x,y} 정사각의 «중심»을 상자 안 비율로(0~1). zoom<1 일 때 기본 {x:.5,y:.4}(얼굴은 대개 위쪽).
//       정사각이 상자 밖으로 나가면 안쪽으로 밀어 넣는다(zoom 1 이면 세로가 길 때 위 끝·가로가 길 때 가운데 정렬과 같다).
//     - pad = 바깥 여백 비율(기본 .06). 항목값 > spec 기본값 > 내장 기본값 순으로 적용.
//   · 결과 = <out>/<id>/<itemId>.webp + manifest.json + spec.json(재현용 사본) (+ <out>/index.json 갱신) + --sheet 면 대조용 contact-sheet.png
//   · 원본 파일은 저장소에 넣지 않는다(임시 폴더 캐시). 출처·권리 표기는 manifest.source 에 남긴다.
//   · ★받기 실패한 항목은 건너뛰고 manifest.missing 에 남긴 뒤 exit 3(나머지는 묶음에 들어간다) — 호출자는 그 항목의 출처를 바꿔(공식 홈 등) 다시 돌린다.
//     요청 사이 0.8초 · 실패 시 3초 뒤 한 번만 다시(★이 PC 는 수집 과다로 IP 차단된 적이 있다 — 10-20 도깨비 포럼. 반복 재시도 금지).
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, createReadStream, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SPEC = resolve(val('--spec', ''));
const OUT = resolve(ROOT, val('--out', '_toolbox/tier/res'));
const SIZE = parseInt(val('--size', '512'), 10);
const SHEET = args.includes('--sheet');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (!SPEC || !existsSync(SPEC)) { console.error('spec 파일이 필요합니다: --spec <json>'); process.exit(1); }
const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
if (!spec.id || !Array.isArray(spec.items) || !spec.items.length) { console.error('spec 형식 오류(id·items)'); process.exit(1); }

/* 1) 원본 내려받기(캐시) — 그림이 아닌 응답(SVG 자리표시·HTML 차단 페이지)은 실패로 본다 */
const REFERER = { 'i.namu.wiki': 'https://namu.wiki/' };
const cache = join(tmpdir(), '_tier-res', spec.id); mkdirSync(cache, { recursive: true });
let dl = 0; const missing = [];
for (const it of spec.items) {
  const ext = (extname(new URL(it.url).pathname).replace(/^\.svg$/i, '') || '.img').toLowerCase();   /* 나무위키 주소는 .svg 로 끝나도 실제 응답은 webp — 확장자는 응답 형식으로 다시 정한다 */
  it._src = join(cache, it.id + ext);
  if (existsSync(it._src) && statSync(it._src).size > 0) continue;
  const ref = it.referer || spec.referer || REFERER[new URL(it.url).hostname];
  /* ★받기는 curl(Windows 기본 curl.exe) — Node 의 fetch·https 는 같은 헤더여도 i.namu.wiki 가 403 을 준다(TLS 지문 · 10-25 실측). curl 은 Referer 만 있으면 200 */
  const tmp = join(cache, it.id + '.part');
  const cr = spawnSync('curl', ['-s', '-L', '--max-time', '40', '-A', 'Mozilla/5.0', '-H', 'Accept: image/avif,image/webp,image/png,image/*;q=0.8'].concat(ref ? ['-e', ref] : []).concat(['-o', tmp, '-w', '%{http_code} %{content_type}', it.url]), { encoding: 'utf8' });
  const [code, ...ctp] = String(cr.stdout || '').trim().split(' ');
  const ct = ctp.join(' ');
  const bad = cr.status !== 0 || code !== '200' ? (code || ('curl ' + cr.status)) : !/^image\/(png|jpe?g|webp|gif|avif)/.test(ct) ? '그림이 아님(' + (ct || '형식 없음') + ')' : '';
  if (bad) {
    if (!it._retried) { it._retried = true; await sleep(3000); spec.items.splice(spec.items.indexOf(it) + 1, 0, it); continue; }
    console.error('받기 실패(건너뜀)', it.id, it.name, bad, it.url); missing.push({ id: it.id, name: it.name, url: it.url, why: bad }); it._skip = true; continue;
  }
  const real = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' })[ct.split(';')[0].trim()] || ext;
  if (real !== extname(it._src)) it._src = it._src.slice(0, -extname(it._src).length) + real;
  writeFileSync(it._src, readFileSync(tmp)); dl++;
  await sleep(800);
}
spec.items = spec.items.filter((it, i, a) => a.indexOf(it) === i);
const items = spec.items.filter((it) => !it._skip);
console.log(`원본 ${items.length}/${spec.items.length}개 (새로 받음 ${dl}${missing.length ? ' · 실패 ' + missing.length : ''}) → ${cache}`);
if (!items.length) { console.error('받은 그림이 없다 — 묶음을 만들지 않는다'); process.exit(1); }

/* 2) 로컬 서버(캐시 폴더) + 헤드리스 크롬 */
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };
const srv = createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = req.url; }
  if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end('<!doctype html><meta charset="utf-8"><title>tier-res</title>'); return; }
  const abs = normalize(join(cache, p));
  if (!abs.startsWith(cache) || !existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
  createReadStream(abs).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const HP = srv.address().port;
const port = 9600 + Math.floor(Math.random() * 300);
const prof = join(tmpdir(), `_tierresprof${port}`); mkdirSync(prof, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, '--window-size=1200,900', 'about:blank'], { stdio: 'ignore' });
let ver = null; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); srv.close(); throw new Error('chrome did not start'); }
const tgt = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); let loaded = null;
ws.onmessage = (m0) => { const m = JSON.parse(m0.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Page.loadEventFired' && loaded) loaded(); };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
const p0 = new Promise(r => loaded = r); await send('Page.navigate', { url: `http://127.0.0.1:${HP}/` }); await Promise.race([p0, sleep(8000)]); loaded = null;

/* 브라우저 쪽 크롭 함수 — 알파 경계 → 정사각(zoom·focus) → size² webp */
await ev(`window.__crop = async function(src, size, zoom, fx, fy, pad){
  const im = new Image(); im.decoding = 'async'; im.src = src; await im.decode();
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let l = w, t = h, r = -1, b = -1;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { if (d[(yy * w + xx) * 4 + 3] > 24) { if (xx < l) l = xx; if (xx > r) r = xx; if (yy < t) t = yy; if (yy > b) b = yy; } }
  if (r < 0) { l = 0; t = 0; r = w - 1; b = h - 1; }
  const bw = r - l + 1, bh = b - t + 1;
  zoom = (zoom == null) ? 1 : Math.max(.2, Math.min(1, zoom));
  const side = Math.max(8, Math.round(Math.min(bw, bh) * zoom));
  if (fx == null) fx = .5;
  if (fy == null) fy = (zoom < 1) ? .4 : (bh >= bw ? (side / 2) / bh : .5);
  const clampN = (v, a, bb) => Math.max(a, Math.min(bb, v));
  const sx = Math.round(clampN(l + bw * fx - side / 2, l, l + bw - side));
  const sy = Math.round(clampN(t + bh * fy - side / 2, t, t + bh - side));
  const padPx = Math.round(side * (pad == null ? .06 : pad));
  const o = document.createElement('canvas'); o.width = size; o.height = size; const ox = o.getContext('2d');
  ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  const inner = size - padPx * 2;
  ox.drawImage(c, sx, sy, side, side, padPx, padPx, inner, inner);
  /* 디버그 — 원본 전체(200px 축소) 위에 상자(회색)·크롭 정사각(빨강)·중심 십자 */
  const D = 200, k = D / Math.max(w, h), dc = document.createElement('canvas'); dc.width = D; dc.height = D; const dx = dc.getContext('2d');
  dx.fillStyle = '#fff'; dx.fillRect(0, 0, D, D); dx.drawImage(c, (D - w * k) / 2, (D - h * k) / 2, w * k, h * k);
  const ox0 = (D - w * k) / 2, oy0 = (D - h * k) / 2;
  dx.strokeStyle = 'rgba(0,0,0,.35)'; dx.lineWidth = 1; dx.strokeRect(ox0 + l * k, oy0 + t * k, bw * k, bh * k);
  dx.strokeStyle = '#E11D48'; dx.lineWidth = 2; dx.strokeRect(ox0 + sx * k, oy0 + sy * k, side * k, side * k);
  dx.beginPath(); dx.moveTo(ox0 + (sx + side / 2) * k - 6, oy0 + (sy + side / 2) * k); dx.lineTo(ox0 + (sx + side / 2) * k + 6, oy0 + (sy + side / 2) * k); dx.moveTo(ox0 + (sx + side / 2) * k, oy0 + (sy + side / 2) * k - 6); dx.lineTo(ox0 + (sx + side / 2) * k, oy0 + (sy + side / 2) * k + 6); dx.stroke();
  return { url: o.toDataURL('image/webp', .9), w, h, box: [l, t, bw, bh], side, sx, sy, debug: dc.toDataURL('image/png') };
}; true`);

/* 3) 항목마다 크롭 → 파일 */
const outDir = join(OUT, spec.id); mkdirSync(outDir, { recursive: true });
const manifest = { id: spec.id, game: spec.game, aliases: Array.isArray(spec.aliases) ? spec.aliases : [], source: spec.source || null, updated: spec.updated || new Date().toISOString().slice(0, 10), size: SIZE, characters: [], missing };
const sheetTiles = [];
for (const it of items) {
  const src = `http://127.0.0.1:${HP}/${encodeURIComponent(it.id + extname(it._src))}`;
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? String(v) : 'null';
  const zoom = typeof it.zoom === 'number' ? it.zoom : spec.zoom;
  const fx = it.focus && typeof it.focus.x === 'number' ? it.focus.x : (spec.focus && typeof spec.focus.x === 'number' ? spec.focus.x : undefined);
  const fy = it.focus && typeof it.focus.y === 'number' ? it.focus.y : (spec.focus && typeof spec.focus.y === 'number' ? spec.focus.y : undefined);
  const pad = typeof it.pad === 'number' ? it.pad : spec.pad;
  const r = await ev(`window.__crop(${JSON.stringify(src)}, ${SIZE}, ${num(zoom)}, ${num(fx)}, ${num(fy)}, ${num(pad)})`);
  const file = it.id + '.webp';
  writeFileSync(join(outDir, file), Buffer.from(r.url.split(',')[1], 'base64'));
  manifest.characters.push({ id: it.id, name: it.name, rarity: it.rarity || null, element: it.element || null, role: it.role || null, file, src: { w: r.w, h: r.h, box: r.box, side: r.side, sx: r.sx, sy: r.sy, zoom: zoom == null ? 1 : zoom } });
  sheetTiles.push({ name: it.name, rarity: it.rarity || '', url: r.url, debug: r.debug });
  console.log(`  ${it.rarity || ''}\t${it.id}\t${it.name}\t${r.w}×${r.h} → box ${r.box.join(',')} side ${r.side}`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(join(outDir, 'spec.json'), JSON.stringify(spec, (k, v) => (k === '_src' || k === '_skip' || k === '_retried' ? undefined : v), 1));   /* 재현용 — 다음 갱신 때 이 파일을 --spec 으로 */
/* index.json — 도구·사이트가 «게임 목록»으로 읽는다. ★병합이 아니라 <out>/<묶음>/manifest.json 전부에서 «다시 짓는다»(10-25) —
   여러 글 파이프라인이 각자 묶음을 만들어도 마지막 실행이 전체를 맞춘다(옛 병합 방식은 동시 적재 때 남의 묶음 줄을 지울 수 있었다). */
const idxPath = join(OUT, 'index.json');
const index = { bundles: [] };
for (const d of readdirSync(OUT, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  let m; try { m = JSON.parse(readFileSync(join(OUT, d.name, 'manifest.json'), 'utf8')); } catch { continue; }
  if (!m || !m.id || !Array.isArray(m.characters)) continue;
  index.bundles.push(Object.assign({ id: m.id, game: m.game }, Array.isArray(m.aliases) && m.aliases.length ? { aliases: m.aliases } : {}, { count: m.characters.length, updated: m.updated, dir: d.name + '/' }));
}
index.bundles.sort((a, b) => String(a.game).localeCompare(String(b.game), 'ko'));
writeFileSync(idxPath, JSON.stringify(index, null, 1));
console.log(`manifest ${manifest.characters.length}개 → ${join(outDir, 'manifest.json')} · index ${index.bundles.length}묶음`);

/* 4) 대조용 contact sheet(선택) — 이름·희귀도 라벨과 함께(기본 8열 150px, --cols·--cell 로 조절) */
if (SHEET) {
  const COLS = parseInt(val('--cols', '8'), 10), CELL = parseInt(val('--cell', '150'), 10);
  const r = await ev(`(async()=>{const tiles=${JSON.stringify(sheetTiles)};const cols=${COLS},cell=${CELL},pad=10,lab=34;const rows=Math.ceil(tiles.length/cols);const c=document.createElement('canvas');c.width=cols*cell+pad*2;c.height=rows*(cell+lab)+pad*2;const x=c.getContext('2d');x.fillStyle='#EFF0F2';x.fillRect(0,0,c.width,c.height);for(let i=0;i<tiles.length;i++){const im=new Image();im.src=tiles[i].url;await im.decode();const cx=pad+(i%cols)*cell,cy=pad+Math.floor(i/cols)*(cell+lab);x.fillStyle='#fff';x.fillRect(cx+4,cy+4,cell-8,cell-8);x.drawImage(im,cx+4,cy+4,cell-8,cell-8);x.fillStyle='#0E1114';x.font='600 13px "Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif';x.textAlign='center';x.fillText((tiles[i].rarity?tiles[i].rarity+' · ':'')+tiles[i].name,cx+cell/2,cy+cell+14,cell-6);}return c.toDataURL('image/png')})()`);
  writeFileSync(join(outDir, 'contact-sheet.png'), Buffer.from(r.split(',')[1], 'base64'));
  console.log('contact-sheet.png 저장');
  if (args.includes('--debug')) {   /* 원본+크롭 상자 대조판 — 초점 보정용(커밋 안 함) */
    const r2 = await ev(`(async()=>{const tiles=${JSON.stringify(sheetTiles.map(t => ({ name: t.name, url: t.debug })))};const cols=${COLS},cell=${CELL},pad=10,lab=30;const rows=Math.ceil(tiles.length/cols);const c=document.createElement('canvas');c.width=cols*cell+pad*2;c.height=rows*(cell+lab)+pad*2;const x=c.getContext('2d');x.fillStyle='#EFF0F2';x.fillRect(0,0,c.width,c.height);for(let i=0;i<tiles.length;i++){const im=new Image();im.src=tiles[i].url;await im.decode();const cx=pad+(i%cols)*cell,cy=pad+Math.floor(i/cols)*(cell+lab);x.drawImage(im,cx+4,cy+4,cell-8,cell-8);x.fillStyle='#0E1114';x.font='600 13px "Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif';x.textAlign='center';x.fillText(tiles[i].name,cx+cell/2,cy+cell+12,cell-6);}return c.toDataURL('image/png')})()`);
    writeFileSync(join(outDir, 'debug-sheet.png'), Buffer.from(r2.split(',')[1], 'base64'));
    console.log('debug-sheet.png 저장');
  }
}
try { ws.close(); } catch {}
chrome.kill(); srv.close();
if (missing.length) { console.error('★받기 실패 ' + missing.length + '건(manifest.missing) — 그 항목의 출처를 바꿔(공식 홈 등) spec 을 고친 뒤 다시 돌린다: ' + missing.map((m) => m.name || m.id).join(', ')); process.exitCode = 3; }
