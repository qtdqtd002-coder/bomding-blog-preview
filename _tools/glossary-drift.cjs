#!/usr/bin/env node
/* =============================================================================
   glossary-drift.cjs — 역전파: 용어집이 고쳐지면 «이미 나간 글»을 다시 훑는다 (2026-09-05 신설)

   왜 만들었나
   -----------
   지금 구조는 **한 방향으로만** 돈다. 새 글은 `glossary-lint` 가 발행 직전에 막지만,
   **정본이 고쳐져도 기발행 글은 아무도 다시 안 본다.** 이번 주에만 그 사고가 두 번 났다:
     ⓐ 연승 하한 `3~4` → `2~4` 정정(09-04) — **발행글은 고쳤는데 정본이 안 따라왔다**(반대 방향).
     ⓑ 「전쟁기계」가 세트18에 **있는데** 없는 걸로 DROP(09-04) → 09-05 정정 —
        그 판단으로 빠진 주제는 되돌아보지 않았다.
   장기 클러스터에서는 «같은 게임 글끼리 표기가 갈리는» 드리프트가 조용히 쌓인다.

   무엇을 하나 — 새 판정기를 만들지 않는다
   ---------------------------------------
   판정은 이미 `glossary-lint.py` 가 한다(1,100편 0.9초). 이 도구가 하는 일은 셋뿐:
     ⑴ **최근 용어집 변경을 git 로그에서 뽑는다** — 어떤 게임의 정본이 바뀌었나.
     ⑵ 그 게임의 **기발행 글만** 골라 `glossary-lint` 를 돌린다(전수가 아니라 바뀐 게임만).
     ⑶ 결과를 리포트로 낸다. **고치지 않는다** — 정정은 사람 판단이다(발행된 글을 건드리는 일이라).
   ★`--all-games` 로 전 게임을 볼 수도 있지만 기본은 «최근 바뀐 것»이다. 매일 전수를 훑는 건
     주간 헬스체크가 이미 하고 있고, 역전파의 값은 **«방금 바뀐 정본»에 반응하는 것**에 있다.

   왜 «리포트»까지만 하나
   ----------------------
   이미 발행된 글을 코드가 고치면 ⑴네이버 라이브와 어긋나고 ⑵문체 정본을 안 보고 손대게 되고
   ⑶재발행 게이트를 우회한다. 그래서 **찾아 주기까지가 이 도구의 일**이다.

   쓰는 법
   -------
     node glossary-drift.cjs                 # 최근 7일 용어집 변경 → 그 게임 기발행 글 재검
     node glossary-drift.cjs --days 30
     node glossary-drift.cjs --game 롤토체스   # 게임 지정
     node glossary-drift.cjs --all-games      # 전 게임(주간 감사용)
     node glossary-drift.cjs --json
   종료코드: 0 = 드리프트 없음 · 1 = 발견(리포트 출력) · 2 = 실행 오류
   ※ **1 이어도 발행을 막지 않는다** — pre-push 에 물리지 않는다. 보고 전용이다.
============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT      = path.resolve(__dirname, '..');            // BlogPreview
const CLAUDE    = path.dirname(ROOT);                        // Desktop\Claude
const GLOSSARY  = path.join(CLAUDE, '_glossary');
const ALIASES   = path.join(GLOSSARY, '_aliases.json');
const LINT      = path.join(__dirname, 'glossary-lint.py');

const argv = process.argv.slice(2);
const opt  = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const num  = (n, d) => { const v = Number(opt(n, d)); return Number.isFinite(v) ? v : d; };
const has  = (n) => argv.includes('--' + n);
const DAYS = num('days', 7);

function die(m, c = 2) { process.stderr.write('[glossary-drift] ' + m + '\n'); process.exit(c); }

function games() {
  try { return JSON.parse(fs.readFileSync(ALIASES, 'utf8')).games || []; }
  catch (e) { die('_aliases.json 을 읽지 못했다: ' + e.message); }
}

/* 최근 N일 안에 «내용이 바뀐» 용어집 파일. `_glossary` 는 09-04 부터 자체 git repo 다. */
function recentlyChanged() {
  try {
    // ★`-c core.quotepath=false` 가 없으면 git 이 한글 파일명을 8진 이스케이프(`"ë¡¤…"`)로
    //   내보내 파일명 매칭이 통째로 실패한다(2026-09-05 첫 실행이 이걸로 «바뀐 용어집 없음»을 냈다).
    const G = ['-c', 'core.quotepath=false', '-C', GLOSSARY];
    const out = execFileSync('git', [...G, 'log', `--since=${DAYS} days ago`,
                                     '--name-only', '--pretty=format:'], { encoding: 'utf8', timeout: 20000 });
    const names = out.split('\n').map((s) => s.trim()).filter((s) => s.endsWith('.md'));
    // ★커밋 «전» 변경도 본다 — 용어집을 고친 직후가 역전파를 돌릴 가장 자연스러운 시점인데
    //   git log 만 보면 그때는 아직 아무것도 안 잡힌다(2026-09-05 첫 실행에서 실제로 0종이 나왔다).
    const wt = execFileSync('git', [...G, 'status', '--porcelain'], { encoding: 'utf8', timeout: 20000 });
    for (const line of wt.split('\n')) {
      const f = line.slice(3).trim().replace(/^"|"$/g, '');
      if (f.endsWith('.md')) names.push(path.basename(f));
    }
    return [...new Set(names.map((n) => path.basename(n)))];
  } catch {
    // git 이 없거나 repo 가 아니면 mtime 으로 대신 본다(정확도는 떨어져도 조용히 죽지 않는다).
    const cut = Date.now() - DAYS * 86400000;
    try {
      return fs.readdirSync(GLOSSARY).filter((f) => f.endsWith('.md') &&
        fs.statSync(path.join(GLOSSARY, f)).mtimeMs >= cut);
    } catch { return []; }
  }
}

/* 그 게임의 발행글 경로. `_aliases.json` 의 canon·aliases·folders 를 전부 본다(폴더 표기가 갈려 있어서). */
function postsOf(g) {
  const names = new Set([g.canon, ...(g.aliases || []), ...(g.folders || [])].filter(Boolean));
  const out = [];
  for (const writer of fs.readdirSync(ROOT)) {
    const wdir = path.join(ROOT, writer);
    if (writer.startsWith('_') || writer.startsWith('.') || !fs.existsSync(wdir) || !fs.statSync(wdir).isDirectory()) continue;
    let subs = [];
    try { subs = fs.readdirSync(wdir); } catch { continue; }
    for (const s of subs) {
      if (s.startsWith('_')) continue;
      const hit = [...names].some((n) => s === n || s.startsWith(n + ' '));
      if (!hit) continue;
      walk(path.join(wdir, s), out);
    }
  }
  return out;
}
function walk(dir, acc) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) { if (it.name !== '_qa' && it.name !== 'img') walk(p, acc); }
    else if (it.name.endsWith('.html')) acc.push(p);
  }
}

function runLint(files) {
  if (!files.length) return { blocking: 0, warnings: 0, results: [] };
  const py = process.env.PYTHON || 'python';
  try {
    const out = execFileSync(py, [LINT, '--json', ...files],
      { encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    return JSON.parse(out);
  } catch (e) {
    // 린트는 위반이 있으면 exit 1 이다 — 그건 실패가 아니라 결과다. stdout 을 그대로 읽는다.
    const so = (e.stdout || '').toString();
    try { return JSON.parse(so); } catch { die('glossary-lint 실행/파싱 실패: ' + (e.message || '').slice(0, 160)); }
  }
}

/* ── 정본 밖 용어집 감시 (2026-09-05 추가) ────────────────────────────────
   07-11 에 「용어집은 `_glossary` 하나」로 단일화했는데 08-02 에 shared 두 곳에 다시 생겼고,
   **README 에 «만들지 말 것»이라고 적혀 있었는데도** 생겼다. 문서로는 안 막힌다는 게 증명됐으니
   찾아서 보고한다. ★`쓰담v2/personas/<작성자>/glossary/` 는 **작성자 격리상 정당**하므로 제외한다. */
function strayGlossaries() {
  const roots = [path.join(process.env.USERPROFILE || '', '.claude', 'shared')];
  const found = [];
  const scan = (d) => {
    let items = [];
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      const p = path.join(d, it.name);
      if (it.isDirectory()) { if (it.name !== 'node_modules' && it.name !== 'archive') scan(p); }
      else if (it.name.endsWith('.md') && it.name !== 'README.md' &&
               /[\\/]_glossary[\\/]/.test(p)) found.push(p);
    }
  };
  for (const r of roots) scan(r);
  return found;
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
(function main() {
  const GS = games();
  let targets;
  const forced = opt('game', null);
  if (forced) {
    const g = GS.find((x) => x.canon === forced || (x.aliases || []).includes(forced));
    if (!g) die(`_aliases.json 에 «${forced}» 가 없다.`);
    targets = [g];
  } else if (has('all-games')) {
    targets = GS.filter((g) => g.glossary);
  } else {
    const changed = recentlyChanged();
    targets = GS.filter((g) => g.glossary && changed.includes(g.glossary));
  }

  const report = [];
  for (const g of targets) {
    const files = postsOf(g);
    const r = runLint(files);
    const hits = (r.results || []).filter((x) => x.hits && x.hits.length);
    report.push({ game: g.canon, glossary: g.glossary, posts: files.length,
                  blocking: r.blocking || 0, warnings: r.warnings || 0, hits });
  }
  const stray = strayGlossaries();
  const anyHard = report.some((r) => r.blocking > 0);

  if (has('json')) {
    console.log(JSON.stringify({ days: DAYS, targets: targets.map((t) => t.canon), report, stray }, null, 2));
    process.exit(anyHard ? 1 : 0);
  }

  console.log(`[glossary-drift] 최근 ${DAYS}일 용어집 변경 → 대상 게임 ${targets.length}종` +
              (targets.length ? ` (${targets.map((t) => t.canon).join(', ')})` : ' — 바뀐 용어집 없음'));
  for (const r of report) {
    console.log(`\n■ ${r.game} (${r.glossary}) — 기발행 ${r.posts}편 재검 · 🔴${r.blocking} 🟡${r.warnings}`);
    for (const h of r.hits) {
      const hard = h.hits.filter((x) => x.sev !== 'soft');
      const soft = h.hits.filter((x) => x.sev === 'soft');
      console.log(`   ${hard.length ? '🔴' : '🟡'} ${h.file}`);
      for (const x of [...hard, ...soft]) {
        console.log(`      ${x.sev === 'soft' ? '🟡' : '🔴'} «${x.wrong}» → «${String(x.official).slice(0, 40)}»`);
      }
    }
    if (!r.hits.length) console.log('   드리프트 없음.');
  }
  if (stray.length) {
    console.log(`\n⚠ 정본 밖 용어집 ${stray.length}건 — 「용어집은 _glossary 하나」 규칙 위반`);
    for (const s of stray) console.log('   · ' + s);
    console.log('   ★2026-09-05 실사고: 이렇게 갈린 두 벌이 서로 «충돌»했다(한쪽은 가상의 이름, 한쪽은 실재 확정).');
    console.log('     정본으로 병합한 뒤 삭제할 것 — 지우기 전에 반드시 diff(스텁이 정본보다 클 수 있다).');
  }
  console.log('\n※ 이 도구는 **고치지 않는다.** 발행된 글 수정은 사람 판단이다(라이브 대조·문체 정본·재발행 게이트).');
  process.exit(anyHard ? 1 : 0);
})();
