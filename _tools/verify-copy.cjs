#!/usr/bin/env node
/*
 * verify-copy.cjs — 티스토리 'HTML 복사' 버튼 발행 전 정합성 검증 게이트
 *
 * 대상: 겜더쿠 / 연봄 (티스토리 붙여넣기본을 쓰는 작성자)의 _미리보기_ + _티스토리_ 쌍.
 * 봄딩 / 영도(네이버, 복사버튼 없음)는 검사 대상에서 제외한다.
 *
 * 검사 항목 (하나라도 실패하면 해당 글 FAIL, 전체 exit code 1):
 *   1. 미리보기/티스토리 파일 쌍이 모두 존재
 *   2. 미리보기에 복사 버튼 + 복사 스크립트 존재
 *   3. [URL 디코딩 가드] 미리보기 스크립트가 한글 파일명을 디코딩한 뒤 _미리보기_→_티스토리_
 *      치환을 하는가. (location.href 를 디코딩 없이 replace 하면 GitHub Pages에서 깨짐 — 연봄 버그)
 *   4. 티스토리에 복사 마커 쌍(↓↓↓ 여기부터 / ↑↑↑ 여기까지)이 각각 정확히 1개, 시작<끝
 *   5. 실제 추출 로직 재현 → 본문이 비어있지 않음
 *   6. 추출 본문에 주석/마커/작성자 메타 누출 0 (<!-- , ↓↓↓ , ↑↑↑ , 미리보기 배지 등)
 *   7. 제목/태그 메타 주석이 존재하고 추출값이 비어있지 않음
 *
 * ★콘텐츠 게이트 (2026-07-02 애드센스 2차 거절 "가치가 별로 없는 콘텐츠" 대응 — 파일 인자 모드에서만):
 *   8. 골격 메타 주석 필수: <!-- 골격: 프로파일=G / 결=2 데이터·표 중심형 / 밴드=2500-4500 -->
 *   9. 분량 밴드: 본문 순수 텍스트(공백 제외)가 선언한 밴드의 [min×0.85, max×1.2] 안
 *  10. 실사 이미지 ≥2 (<img> 카운트, SVG 안 셈 — G-7 게이트①. 면제 주석 '게임이미지 면제:' 있으면 스킵)
 *  11. 상단 공식이미지: 첫 <img>가 첫 <h2>보다 앞 (G-7 게이트② — 면제 없음)
 *  12. 팔레트 상한: 겜더쿠 본문 #7048E8 ≤18회 (시그니처=관련글카드·태그칩 몫, h2바·콜아웃·표헤더는 보조 팔레트)
 *  13. 컴포넌트 쿼터: 최근 10편(이번 글 포함) 중 한눈에박스 ≤6 · FAQ ≤5 · 한줄정리 ≤5(겜더쿠)
 *      — 이번 글이 그 컴포넌트를 써서 쿼터를 초과하게 되면 FAIL(빼거나 다른 골격으로)
 *
 * 사용:
 *   node _tools/verify-copy.cjs            # 전체 검사(1~7만), 실패 시 exit 1
 *   node _tools/verify-copy.cjs <경로...>  # 특정 글 검사 (1~7 + 콘텐츠 게이트 8~13, 발행 직전 필수)
 *   node _tools/verify-copy.cjs --report 겜더쿠 [N]  # 최근 N편(기본 15) 구조 지문 리포트(기획팀 발주용)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTHORS = ['겜더쿠', '연봄']; // 티스토리 붙여넣기본을 쓰는 작성자만

const START = '↓↓↓ 여기부터';
const END = '↑↑↑ 여기까지';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.includes('_미리보기_') && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// 수정된 복사 스크립트와 동일하게 추출을 재현한다(주석 제거 포함).
// 사용자가 복사 버튼을 눌렀을 때 실제로 얻게 되는 결과를 그대로 검사한다.
function extractBody(html) {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  let a = 0;
  if (s >= 0) { const m = html.indexOf('-->', s); a = m >= 0 ? m + 3 : 0; }
  let end = e >= 0 ? html.lastIndexOf('<!--', e) : html.length;
  if (end < 0) end = html.length;
  return html.slice(a, end).replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function countOcc(hay, needle) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
  return n;
}

function pickMeta(html, label) {
  const m = html.match(new RegExp('<!--\\s*' + label + ':([\\s\\S]*?)-->'));
  return m ? m[1].trim() : '';
}

function isTargetAuthor(file) {
  const rel = path.relative(ROOT, file).split(path.sep);
  return AUTHORS.includes(rel[0]);
}

// ===== 콘텐츠 균일성·이미지 게이트 (2026-07-02 애드센스 2차 거절 대응) =====
// 근거: 2차 거절 실측 — 최신 32편 전부 동일 컴포넌트 스택(한줄정리 32/32·FAQ 30/32·
// 한눈에 31/32) + #7048E8 글당 11~52회 + 분량 2.4~5k 단일 밴드 = cookie-cutter 지문.
const CONTENT_GATES = {
  '겜더쿠': {
    palette: { hex: '7048E8', max: 18, note: '관련글카드·태그칩 시그니처 몫 ≈13~17. h2바·콜아웃·표헤더·한눈에박스는 보조 팔레트(output-format §3-1)' },
    quotas: [
      { name: '한눈에 박스(②)', re: /이 글 한눈에/, max: 6 },
      { name: 'FAQ(⑭)', re: /자주 묻는 질문/, max: 5 },
      { name: '한 줄 정리(⑩)', re: /한 줄 정리/, max: 5 },
    ],
  },
  '연봄': {
    palette: null, // 듀얼컬러=부부 정체성(미거절·예방 단계라 상한 없음)
    quotas: [
      { name: '팩트카드 한눈에 보기(②)', re: /한눈에 보기/, max: 6 },
      { name: 'FAQ(⑭)', re: /자주 묻는 질문/, max: 5 },
    ],
  },
};
const QUOTA_WINDOW = 10; // 이번 글 포함 최근 10편

function authorOf(file) {
  return path.relative(ROOT, file).split(path.sep)[0];
}

function textLen(body) {
  return body
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, '')
    .replace(/\s/g, '').length;
}

function recentTistoryFiles(author, excludePath, n) {
  const dir = path.join(ROOT, author);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  (function walk2(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk2(p);
      else if (e.name.includes('_티스토리_') && e.name.endsWith('.html')) out.push(p);
    }
  })(dir);
  return out
    .filter(p => path.resolve(p) !== path.resolve(excludePath || ''))
    .map(p => ({ p, mtime: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, n)
    .map(x => x.p);
}

function pickSkeletonMeta(tistory) {
  // <!-- 골격: 프로파일=G / 결=2 데이터·표 중심형 / 밴드=2500-4500 -->
  const raw = pickMeta(tistory, '골격');
  if (!raw) return null;
  const band = raw.match(/밴드\s*=\s*(\d[\d,]*)\s*[-~]\s*(\d[\d,]*)/);
  const profile = raw.match(/프로파일\s*=\s*([GNRHD])/i);
  const gyeol = raw.match(/결\s*=\s*([^/]+)/);
  return {
    raw,
    profile: profile ? profile[1].toUpperCase() : null,
    gyeol: gyeol ? gyeol[1].trim() : null,
    bandMin: band ? parseInt(band[1].replace(/,/g, ''), 10) : null,
    bandMax: band ? parseInt(band[2].replace(/,/g, ''), 10) : null,
  };
}

function contentGateChecks(previewPath, preview, tistory, body) {
  const fails = [];
  const author = authorOf(previewPath);
  const cfg = CONTENT_GATES[author];
  if (!cfg || !body) return fails;

  // 8. 골격 메타
  const meta = pickSkeletonMeta(tistory);
  if (!meta || !meta.bandMin || !meta.bandMax || !meta.profile) {
    fails.push('골격 메타 주석 없음/불완전 — <!-- 골격: 프로파일=G|N|R|H|D / 결=<번호·이름> / 밴드=<min>-<max> --> 를 _티스토리_ 파일 상단(제목 주석 옆)에 선언해야 발행 가능 (tistory-seo §4-1 유형별 분량 밴드)');
  } else {
    // 9. 분량 밴드
    const len = textLen(body);
    const lo = Math.floor(meta.bandMin * 0.85), hi = Math.ceil(meta.bandMax * 1.2);
    if (len < lo || len > hi) {
      fails.push(`분량 밴드 위반: 본문 ${len}자 — 선언 밴드 ${meta.bandMin}~${meta.bandMax}자(허용 ${lo}~${hi}) 밖. 유형에 맞는 밴드를 다시 선언하거나(발주서 대조) 분량을 조정`);
    }
  }

  // 10/11. 실사 이미지 (SVG는 안 셈)
  const imgCount = (body.match(/<img\b/gi) || []).length;
  const exempt = /게임이미지 면제\s*:/.test(preview) || /게임이미지 면제\s*:/.test(tistory);
  if (imgCount < 2 && !exempt) {
    fails.push(`실사 이미지 ${imgCount}장(<2) — G-7 게이트①: 실사 게임 비주얼 최소 2장(SVG 인포그래픽은 안 셈). 공식·위키·커뮤니티까지 다 찾아도 없을 때만 <!-- 게임이미지 면제: 어디까지 확인 --> 주석으로 면제`);
  }
  const firstImg = body.search(/<img\b/i);
  const firstH2 = body.search(/<h2\b/i);
  if (firstH2 >= 0 && (firstImg < 0 || firstImg > firstH2)) {
    fails.push('상단 공식이미지 누락 — G-7 게이트②: 리드 문단 직후(첫 h2 이전)에 공식 이미지 1장 필수(키비주얼·로고는 항상 존재하므로 면제 없음)');
  }

  // 12. 팔레트 상한
  if (cfg.palette) {
    const n = countOcc(body.toUpperCase(), cfg.palette.hex.toUpperCase());
    if (n > cfg.palette.max) {
      fails.push(`팔레트 과다: #${cfg.palette.hex} ${n}회(>${cfg.palette.max}) — ${cfg.palette.note}`);
    }
  }

  // 13. 컴포넌트 쿼터 (최근 QUOTA_WINDOW편 중 사용 글 수, 이번 글 포함)
  const tistoryPath = previewPath.replace('_미리보기_', '_티스토리_');
  const recents = recentTistoryFiles(author, tistoryPath, QUOTA_WINDOW - 1)
    .map(p => { try { return extractBody(fs.readFileSync(p, 'utf8')); } catch { return ''; } });
  for (const q of cfg.quotas) {
    if (!q.re.test(body)) continue; // 이번 글이 안 쓰면 쿼터 무관
    const used = 1 + recents.filter(b => q.re.test(b)).length;
    if (used > q.max) {
      fails.push(`컴포넌트 쿼터 초과: ${q.name} — 최근 ${QUOTA_WINDOW}편 중 ${used}편 사용(상한 ${q.max}). 이번 글에서 빼고 다른 골격(결 로테이션·마무리 변주)으로 (tistory-seo §4-1/§4-2)`);
    }
  }

  return fails;
}

function fingerprintReport(author, n) {
  const files = recentTistoryFiles(author, '', n);
  const cfg = CONTENT_GATES[author] || { quotas: [], palette: null };
  console.log(`[verify-copy --report] ${author} 최근 ${files.length}편 구조 지문 (파일 mtime 역순)`);
  const rows = [];
  for (const p of files) {
    let t = '';
    try { t = fs.readFileSync(p, 'utf8'); } catch { continue; }
    const body = extractBody(t);
    const meta = pickSkeletonMeta(t);
    const row = {
      file: path.basename(p).replace('_티스토리_', '').replace('.html', '').slice(0, 30),
      자수: textLen(body),
      img: (body.match(/<img\b/gi) || []).length,
      svg: (body.match(/<svg\b/gi) || []).length,
      프로파일: meta ? (meta.profile || '-') : '-',
    };
    for (const q of cfg.quotas) row[q.name.replace(/\(.*\)/, '')] = q.re.test(body) ? 'O' : '·';
    if (cfg.palette) row['#' + cfg.palette.hex] = countOcc(body.toUpperCase(), cfg.palette.hex.toUpperCase());
    rows.push(row);
  }
  console.table(rows);
  // 쿼터 현황 요약
  for (const q of cfg.quotas) {
    const used = rows.slice(0, QUOTA_WINDOW).filter(r => r[q.name.replace(/\(.*\)/, '')] === 'O').length;
    const over = used >= q.max;
    console.log(`${over ? '⚠' : '·'} ${q.name}: 최근 ${Math.min(QUOTA_WINDOW, rows.length)}편 중 ${used}편 사용 / 상한 ${q.max}${over ? ' → 다음 글에서 이 컴포넌트 사용 시 차단됨' : ''}`);
  }
  const lens = rows.map(r => r.자수).filter(Boolean);
  if (lens.length) {
    console.log(`· 분량 분포: min ${Math.min(...lens)} / max ${Math.max(...lens)}자 — 좁은 밴드 몰림이면 다음 발주에서 유형·밴드로 분산 (1,500~7,000)`);
  }
}

function checkPair(previewPath, contentGates) {
  const fails = [];
  const rel = path.relative(ROOT, previewPath);
  const tistoryPath = previewPath.replace('_미리보기_', '_티스토리_');

  let preview = '';
  try { preview = fs.readFileSync(previewPath, 'utf8'); }
  catch { return { rel, fails: ['미리보기 파일 읽기 실패'] }; }

  // 2. 복사 버튼/스크립트 존재
  const hasButton = /티스토리용 HTML 복사|tcopyBtn|tcopyRun/.test(preview);
  const hasScript = preview.includes('_티스토리_') && preview.includes('여기부터');
  if (!hasButton || !hasScript) {
    fails.push('복사 버튼/스크립트 누락');
    return { rel, fails };
  }

  // 2b. [정본 복사 UI 패널] 제목·태그·본문(textarea)을 사용자에게 함께 노출하는 정본 스니펫인가.
  //     버튼만 있고 제목/태그/본문 패널이 빠진 약식 스니펫을 손으로 작성하면 여기서 걸린다.
  //     정본 = 이미 발행된 겜더쿠/연봄 미리보기 </body> 직전 id="tcopy" 블록(tcopyTitle/tcopyTags/tcopyArea).
  const hasTitleEl = /id=["']tcopyTitle["']/.test(preview);
  const hasTagsEl = /id=["']tcopyTags["']/.test(preview);
  const hasAreaEl = /id=["']tcopyArea["']/.test(preview);
  if (!hasTitleEl || !hasTagsEl || !hasAreaEl) {
    const miss = [
      !hasTitleEl && 'tcopyTitle(제목)',
      !hasTagsEl && 'tcopyTags(태그)',
      !hasAreaEl && 'tcopyArea(본문 textarea)',
    ].filter(Boolean).join(', ');
    fails.push('정본 복사 패널 요소 누락: ' + miss + ' — 제목·태그·본문 HTML을 함께 보여주는 정본 스니펫(이미 발행된 겜더쿠/연봄 미리보기의 id="tcopy" 블록)을 그대로 사용할 것. 약식 직접 작성 금지.');
  }

  // 3. URL 디코딩 가드 — href 를 디코딩 없이 replace 하면 한글 파일명에서 깨진다.
  const usesRawHref = /location\.href\.replace\(\s*['"]_미리보기_['"]/.test(preview);
  const decodesUrl = /decodeURIComponent\(\s*location\.(pathname|href)\s*\)/.test(preview);
  if (usesRawHref && !decodesUrl) {
    fails.push("URL 미디코딩: location.href 를 그대로 replace → GitHub Pages 한글 경로에서 치환 실패(복사 깨짐). decodeURIComponent(location.pathname) 사용 필요");
  } else if (!decodesUrl) {
    fails.push('URL 디코딩 코드(decodeURIComponent) 부재 — 한글 경로 복사 안정성 미확보');
  }

  // 3b. 주석 제거 가드 — 복사 스크립트가 추출 본문에서 <!-- ... --> 주석을 제거하는가.
  //     (제거하지 않으면 내부 편집 주석/메타가 티스토리에 누출된다.)
  const stripsComments = /\.replace\(\s*\/<!--/.test(preview);
  if (!stripsComments) {
    fails.push('복사 스크립트에 주석 제거(.replace(/<!--.../g,...)) 단계 없음 — 내부 주석/메타 누출 위험');
  }

  // 1. 티스토리 파일 존재
  if (!fs.existsSync(tistoryPath)) {
    fails.push('짝이 되는 _티스토리_ 파일 없음: ' + path.relative(ROOT, tistoryPath));
    return { rel, fails };
  }
  const tistory = fs.readFileSync(tistoryPath, 'utf8');

  // 4. 마커 쌍 정합
  const nStart = countOcc(tistory, START);
  const nEnd = countOcc(tistory, END);
  if (nStart !== 1) fails.push(`시작 마커(${START}) 개수=${nStart} (정확히 1이어야 함)`);
  if (nEnd !== 1) fails.push(`끝 마커(${END}) 개수=${nEnd} (정확히 1이어야 함)`);
  const sPos = tistory.indexOf(START), ePos = tistory.indexOf(END);
  if (sPos >= 0 && ePos >= 0 && ePos < sPos) fails.push('마커 순서 역전(끝<시작)');

  // 5/6. 본문 추출 + 누출 검사
  const body = extractBody(tistory);
  if (!body) fails.push('추출 본문이 비어있음');
  else {
    if (body.includes('<!--')) fails.push('본문에 주석(<!--) 누출 — 제목/태그/마커 주석이 복사 영역에 포함됨');
    if (body.includes('↓↓↓') || body.includes('↑↑↑')) fails.push('본문에 복사 마커(↑↑↑/↓↓↓) 누출');
    if (body.includes('미리보기') && /badge|topbar/.test(body)) fails.push('본문에 작성자 미리보기 메타 누출');
    if (body.length < 200) fails.push(`추출 본문이 비정상적으로 짧음(${body.length}자)`);
  }

  // 7. 제목/태그 메타
  const title = pickMeta(tistory, '제목');
  const tags = pickMeta(tistory, '태그');
  if (!title) fails.push('제목 메타 주석(<!-- 제목: ... -->) 없음/빈값');
  if (!tags) fails.push('태그 메타 주석(<!-- 태그: ... -->) 없음/빈값');

  // 8~13. 콘텐츠 게이트 (파일 인자 모드 = 발행 직전 검사에서만)
  if (contentGates) {
    fails.push(...contentGateChecks(previewPath, preview, tistory, body));
  }

  return { rel, fails, bodyLen: body ? body.length : 0, title };
}

function main() {
  const args = process.argv.slice(2);

  // --report <작성자> [N] : 최근 N편 구조 지문 리포트 (기획팀 발주·QA용, 게이트 아님)
  if (args[0] === '--report') {
    const author = args[1];
    if (!AUTHORS.includes(author)) {
      console.error(`[verify-copy] --report 대상은 ${AUTHORS.join('/')} 중 하나여야 합니다.`);
      process.exit(2);
    }
    fingerprintReport(author, parseInt(args[2], 10) || 15);
    process.exit(0);
  }

  let targets;
  const contentGates = args.length > 0; // 발행 직전 대상글 검사 = 콘텐츠 게이트 활성
  if (args.length) {
    // _티스토리_ 경로를 줘도 _미리보기_ 로 매핑해 검사한다(오탐 방지).
    targets = args.map(a => path.resolve(a).replace('_티스토리_', '_미리보기_'))
      .filter(p => p.includes('_미리보기_'));
    if (!targets.length) {
      console.error('[verify-copy] 검사 대상 없음: 인자에 _미리보기_/_티스토리_ HTML 경로를 주세요.');
      process.exit(2);
    }
  } else {
    targets = [];
    for (const a of AUTHORS) {
      const dir = path.join(ROOT, a);
      if (fs.existsSync(dir)) walk(dir, targets);
    }
  }

  const results = targets.map(p => checkPair(p, contentGates));
  const failed = results.filter(r => r.fails.length);

  console.log(`[verify-copy] 검사 대상 ${results.length}개 (겜더쿠/연봄 미리보기)`);
  if (!failed.length) {
    console.log(`✅ 통과: 전부 복사 버튼 정상 (마커 정합 + 본문 누출 0 + 제목/태그 OK)`);
    process.exit(0);
  }
  console.log(`❌ 실패 ${failed.length}개:\n`);
  for (const r of failed) {
    console.log(`  ✗ ${r.rel}`);
    for (const f of r.fails) console.log(`      - ${f}`);
  }
  process.exit(1);
}

main();
