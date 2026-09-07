// tier-res.mjs — 도구함 「티어표 제작」 캐릭터 리소스 묶음 생성 (2026-09-07)
//   node _tools/tier-res.mjs --spec <spec.json> [--out _toolbox/tier/res] [--size 512] [--sheet]
//   · spec = { id, game, source:{name,url,rights}, updated, zoom?, focus?, pad?, items:[{id,name,rarity,element,role,url, zoom?, focus?:{x,y}, pad?}] }
//   · 원본(url)을 임시 폴더에 내려받고, 헤드리스 크롬(의존성 0)에서 알파 경계(그림이 있는 상자)를 잰 뒤
//     «얼굴이 보이는 정사각»으로 잘라 size² webp 로 저장한다.
//     - zoom = 상자의 짧은 변 대비 정사각 한 변의 비율(1 = 그림 전체 · .6 = 머리+상체 정도). 기본 1.
//     - focus = {x,y} 정사각의 «중심»을 상자 안 비율로(0~1). zoom<1 일 때 기본 {x:.5,y:.4}(얼굴은 대개 위쪽).
//       정사각이 상자 밖으로 나가면 안쪽으로 밀어 넣는다(zoom 1 이면 세로가 길 때 위 끝·가로가 길 때 가운데 정렬과 같다).
//     - pad = 바깥 여백 비율(기본 .06). 항목값 > spec 기본값 > 내장 기본값 순으로 적용.
//   · 결과 = <out>/<id>/<itemId>.webp + manifest.json + spec.json(재현용 사본) (+ <out>/index.json 갱신) + --sheet 면 대조용 contact-sheet.png
//   · 원본 파일은 저장소에 넣지 않는다(임시 폴더 캐시). 출처·권리 표기는 manifest.source 에 남긴다.
import { spawn } from 'node:child_process';
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

/* 1) 원본 내려받기(캐시) */
const cache = join(tmpdir(), '_tier-res', spec.id); mkdirSync(cache, { recursive: true });
let dl = 0;
for (const it of spec.items) {
  const ext = (extname(new URL(it.url).pathname) || '.png').toLowerCase();
  it._src = join(cache, it.id + ext);
  if (existsSync(it._src) && statSync(it._src).size > 0) continue;
  const r = await fetch(it.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) { console.error('받기 실패', it.id, it.url, r.status); process.exit(1); }
  writeFileSync(it._src, Buffer.from(await r.arrayBuffer())); dl++;
}
console.log(`원본 ${spec.items.length}개 (새로 받음 ${dl}) → ${cache}`);

/* 2) 로컬 서버(캐시 폴더) + 헤드리스 크롬 */
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
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
  return { url: o.toDataURL('image/webp', .9), w, h, box: [l, t, bw, bh], side, sx, sy };
}; true`);

/* 3) 항목마다 크롭 → 파일 */
const outDir = join(OUT, spec.id); mkdirSync(outDir, { recursive: true });
const manifest = { id: spec.id, game: spec.game, source: spec.source || null, updated: spec.updated || new Date().toISOString().slice(0, 10), size: SIZE, characters: [] };
const sheetTiles = [];
for (const it of spec.items) {
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
  sheetTiles.push({ name: it.name, rarity: it.rarity || '', url: r.url });
  console.log(`  ${it.rarity || ''}\t${it.id}\t${it.name}\t${r.w}×${r.h} → box ${r.box.join(',')} side ${r.side}`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(join(outDir, 'spec.json'), JSON.stringify(spec, (k, v) => (k === '_src' ? undefined : v), 1));   /* 재현용 — 다음 갱신 때 이 파일을 --spec 으로 */
/* index.json — 도구가 «게임 목록»으로 읽는다 */
const idxPath = join(OUT, 'index.json');
let index = { bundles: [] };
try { index = JSON.parse(readFileSync(idxPath, 'utf8')); } catch {}
index.bundles = (index.bundles || []).filter(b => b.id !== spec.id);
index.bundles.push({ id: spec.id, game: spec.game, count: manifest.characters.length, updated: manifest.updated, dir: spec.id + '/' });
index.bundles.sort((a, b) => a.game.localeCompare(b.game, 'ko'));
writeFileSync(idxPath, JSON.stringify(index, null, 1));
console.log(`manifest ${manifest.characters.length}개 → ${join(outDir, 'manifest.json')} · index ${index.bundles.length}묶음`);

/* 4) 대조용 contact sheet(선택) — 이름·희귀도 라벨과 함께 8열 */
if (SHEET) {
  const r = await ev(`(async()=>{const tiles=${JSON.stringify(sheetTiles)};const cols=8,cell=150,pad=10,lab=34;const rows=Math.ceil(tiles.length/cols);const c=document.createElement('canvas');c.width=cols*cell+pad*2;c.height=rows*(cell+lab)+pad*2;const x=c.getContext('2d');x.fillStyle='#EFF0F2';x.fillRect(0,0,c.width,c.height);for(let i=0;i<tiles.length;i++){const im=new Image();im.src=tiles[i].url;await im.decode();const cx=pad+(i%cols)*cell,cy=pad+Math.floor(i/cols)*(cell+lab);x.fillStyle='#fff';x.fillRect(cx+4,cy+4,cell-8,cell-8);x.drawImage(im,cx+4,cy+4,cell-8,cell-8);x.fillStyle='#0E1114';x.font='600 13px "Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif';x.textAlign='center';x.fillText((tiles[i].rarity?tiles[i].rarity+' · ':'')+tiles[i].name,cx+cell/2,cy+cell+14,cell-6);}return c.toDataURL('image/png')})()`);
  writeFileSync(join(outDir, 'contact-sheet.png'), Buffer.from(r.split(',')[1], 'base64'));
  console.log('contact-sheet.png 저장');
}
try { ws.close(); } catch {}
chrome.kill(); srv.close();
