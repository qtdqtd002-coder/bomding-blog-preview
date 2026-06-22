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
 * 사용:
 *   node _tools/verify-copy.cjs            # 전체 검사, 실패 시 exit 1
 *   node _tools/verify-copy.cjs <경로...>  # 특정 _미리보기_ 파일만 검사 (발행 직전 대상글)
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

function checkPair(previewPath) {
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

  return { rel, fails, bodyLen: body ? body.length : 0, title };
}

function main() {
  const args = process.argv.slice(2);
  let targets;
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

  const results = targets.map(checkPair);
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
