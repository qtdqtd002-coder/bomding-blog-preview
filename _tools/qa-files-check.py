#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
QA 리포트 실측 게이트 — «전 차원 PASS» 를 파일로 증명한다  (2026-09-12 신설 · 2026-09-23 강화 · LLM 0)

왜 있나 (실측 사고)
  A1 경로(요청큐 러너)에는 `qa-panel` 워크플로가 없어 코드 가드가 하나도 안 걸린다.
  그래서 «검수 완주 5/5» 는 파이프라인 서브의 **자가보고**였고, 반복적으로 사실과 달랐다:
    · 2026-08-27  두 요청 다 5/5 보고 → 실제 _qa 에 3개·1개. «전 차원 PASS» 가 파일 없이 적재됨.
    · 2026-09-12  STAGED 자가보고 4편 중 3편 불일치(image 전무 · R2 뒤 수정 미검 · structure FAIL 뒤 적재).
  그때마다 메인이 «전 차원을 재스폰» 해 같은 글을 두 번 검수했다 —
  발행편당 QA 스폰 13.0(설계 6~8)의 절반이 이 이중화다.

  판정을 산문에서 **코드**로 옮긴다. 서브의 말이 아니라 파일이 진실이다.

★2026-09-23 강화 (전수조사 감사 C#2·#3·#4·#7·#14 · F#3 · 사용자 결정 «🟡=경고, 확인 불가=차단»)
  실측: 🟡가 남은 채 `판정: PASS` 139파일 · «확인 불가» 무등급 92줄 · mainfix 무재검 발행 8/9 ·
  판정줄 없는 리포트 92 — 이 게이트는 PASS/FAIL 문자열만 읽어서 전부 통과시켰다.
  이제 🔴/🟡 를 센다. 판정 계약:
    exit 0 = PASS  적재 가능
    exit 2 = WARN  경고(적재 허용) — 🟡 잔존 · 판정줄 없음 · research-brief/용어집/editorial 부재 · 검수 대상 표기 없음
    exit 1 = BLOCK 적재 거부 — ⒜필수 차원 부재 ⒝최종 라운드 FAIL 또는 🔴≥1 ⒞FAIL 뒤 재검 없음
                                ⒟fact 최종 리포트에 «확인 불가|확인 필요|미확인|검증 불가» 지적 잔존
                                ⒠«검수 대상:» 경로가 글 폴더와 다름 ⒡mainfix 뒤 차원 재검 없음
  ⚠ exit 계약이 바뀌었다: 예전 «2 = FAIL 재검 없음(차단)» 은 이제 **1(BLOCK)** 이고, 2 는 **경고(적재 허용)** 다.
    호출부는 «exit 0 또는 2 = 진행 · 1 = 재검(--fail-dims 로 차원 확인)» 으로 읽는다.
  ★qa-image 는 2026-09-23 부로 은퇴 — image 리포트는 있으면 참고(경고)만, 없어도 통과.
  ★refute 는 `<글폴더>/_qa/sensitive.json` 이 {"sensitive": true} 이거나(또는 preflight 확장이 쓰는 `_qa/preflight.json` 의
    "sensitive": true) --sensitive 일 때만 필수.

사용
  python qa-files-check.py "<글 HTML 또는 글 폴더>" [--sensitive] [--json] [--quiet]
                            [--fail-dims [--touched fact,style]] [--post-publish]
    --json         아래 스키마를 stdout 에 한 줄(통합자·runner-record.py 가 소비 — 키 이름 고정)
    --fail-dims    (재)검수가 필요한 차원만 쉼표 한 줄 출력(예: fact,structure) = 최종 FAIL/🔴 차원 + «확인 불가» 잔존 fact
                   + 결측 필수 차원(리포트 없음 = 스폰 필요). --touched 는 «수정이 닿은 차원» 합집합.
    --post-publish 발행 후 모드 — `_qa/editorial*.md` 부재를 경고에 추가
    --quiet        사람용 출력 생략(--json 이면 JSON 만 · 아니면 마지막 한 줄만)
    --sensitive    refute 를 필수 차원으로(민감글) — sensitive.json 과 동치

--json 스키마
  {"post": "<글폴더 상대경로>", "writer": "봄딩|영도|?", "game": "<canon 또는 null>",
   "dims": {"fact": {"rounds": 2, "final": "PASS|FAIL|WARN|NONE", "red": 0, "yellow": 3, "unverified": 0,
                     "lastFile": "round2-fact.md"}, "style": {...}, "structure": {...}, "refute": {...}, "image": {...}},
   "rounds": 2, "overall": "PASS|WARN|BLOCK", "exit": 0, "failDims": [], "blocks": ["..."], "warnings": ["..."],
   "files": {"research": true, "sensitive": false, "editorial": false, "glossary": true|false|null}}
  files.glossary = null 이면 «게임 판정 불가 = 대상 아님»(경고 아님).

읽는 규칙
  · 리포트 위치 = 글 폴더의 `_qa/`  (구 관례로 상위 `_qa/<주제>/` 에 있으면 그것도 본다)
  · 파일명 관례 **네 가지** 전부(실측): ⑴ round1-fact.md ⑵ round1_qa-fact.md ⑶ qa-fact.md·qa-fact-round2.md ⑷ qa-fact-r1.md
    + improve<N>-<차원>.md(개선본 재검 = 정규 라운드 뒤 라운드) + round<N>-mainfix.md(메인 치환 기록 = 검수 아님)
    (`editorial*.md`·`main-verify-*`·`*-fix-verify`·`yd-bundle`·`fb-*` 는 QA 라운드가 아니다 — 패턴에 안 걸린다.)
  · 차원 별칭  fact|qa-fact → fact / style|qa-style → style / structure|qa-structure → structure
                image|qa-image → image / refute → refute / lead|qa-lead → lead(판정자 · 참고)
  · round2 는 **round1 에서 FAIL 난 차원만** 있으면 정상이다(전 차원 재검은 낭비).
  · 🔴/🟡 계수 = 리포트의 «🔴 N건 · 🟡 M건» 요약줄 우선(마지막 것) · 없으면 줄머리 마커 계수(fallback).
    «🔴0»·«🔴 0» 은 0 이다(마커가 아니다). 하위 라운드 인용줄(R1 … 🔴1)·규칙 설명줄(PASS 조건: 🔴0 AND 🟡0)은 뺀다.
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, glob, json, argparse, unicodedata

sys.stdout.reconfigure(encoding='utf-8')

WRITERS = ['봄딩', '영도', '겜더쿠', '연봄', '하루살이']
REQUIRED = ['fact', 'style', 'structure']            # ★image 은퇴(2026-09-23) · refute 는 민감글만
DIMS = ['fact', 'style', 'structure', 'refute', 'image']   # --json dims 키(고정)
BLOCKING_DIMS = ['fact', 'style', 'structure', 'refute']   # 최종 FAIL/🔴 이 차단인 차원(image 는 참고)
ALIAS = {'fact': 'fact', 'qa-fact': 'fact', 'style': 'style', 'qa-style': 'style',
         'structure': 'structure', 'qa-structure': 'structure', 'image': 'image',
         'qa-image': 'image', 'refute': 'refute', 'qa-refute': 'refute', 'lead': 'lead',
         'qa-lead': 'lead'}
CLAUDE_ROOT = r'C:\Users\qtdqt\Desktop\Claude'
GLOSSARY_DIR = os.path.join(CLAUDE_ROOT, '_glossary')
ALIASES_JSON = os.path.join(GLOSSARY_DIR, '_aliases.json')
IMPROVE_BASE = 100          # improve<N>-<dim>.md 는 라운드 100+N 으로 본다(정규 라운드 뒤)

# ── 파일명 ──
FNAME = re.compile(r'^round(\d+)[-_](.+?)\.md$', re.I)
FNAME_ALT = re.compile(r'^(?:qa-)?(fact|style|structure|image|refute|lead)(?:[-_](?:round|r)(\d+))?\.md$', re.I)
FNAME_IMPROVE = re.compile(r'^improve(\d+)[-_](?:qa-)?(fact|style|structure|image|refute|lead)\.md$', re.I)
MAINFIX_NAME = re.compile(r'^(?:main-?fix)(?:[-_].*)?$', re.I)      # round2-mainfix.md · round3-main-fix.md
# ── 판정 ──
# ★판정은 검수자가 쓴 **명시 판정 문자열**을 신뢰한다(2026-09-12 실측 — 본문 🔴 개수로 세면 «R1 🟡-2 해소»
#   같은 서술 때문에 오탐이 났다). 같은 파일에 여러 번 나오면 **마지막**(머리 요약·끝 종합 관례).
VERDICT = re.compile(r'\*\*(PASS|FAIL)\*\*|(?:판정|최종|결론|종합)[^\n]{0,24}?\b(PASS|FAIL)\b')
BACKREF = re.compile(r'전회차|직전\s*라운드|이전\s*라운드|앞\s*라운드|참고\s*[:：]')
ROUNDREF = re.compile(r'(?:\bR|\bround\s*|라운드\s*)(\d+)', re.I)
# ── 🔴/🟡 요약줄: «🔴 1건 · 🟡 2건» «🔴0 🟡2» «🔴 치명: 1건  🟡 주의: 2건» «🔴 없음. 🟡 1건» ──
#   «🔴 잔여 오류 0건 / 🟡 잔여 주의 1건» «🔴 건수: 0» «| 🔴 | 0건 |» «🔴 치명 항목 없음» — 마커 뒤 짧은 라벨(≤10자)+콜론 또는 «N건».
#   라벨 없이 «🔴 2025년…» 은 계수가 아니다(숫자 뒤에 건·줄끝·괄호·구분자가 와야 한다). 50 초과는 계수로 보지 않는다.
COUNT_TAIL = (r'(?:(?:치명|주의)?\s*[:：]?\s*(\d+|없음)\s*건'                        # 🔴 1건 · 🔴 치명: 1건 · 🔴 없음건?
              r'|[^\d🟡🔴\n|]{0,10}?[:：]\s*(\d+|없음)\s*(?:건|(?=\s*$)|(?=\s*[)|,·/]))'   # 🔴 건수: 0 · 🔴 항목: 없음 · 🔴 심각 오류: 0건
              r'|[^\d🟡🔴\n:：|]{0,10}?(\d+)\s*건'                                  # 🔴 잔여 오류 0건
              r'|[^\d🟡🔴\n:：|]{0,10}?(없음)'                                        # 🔴 치명 항목 없음
              r'|\s*\|\s*(\d+|없음)\s*건?)')                                          # | 🔴 | 0건 |
COUNT_RED = re.compile('🔴\\s*' + COUNT_TAIL)
COUNT_YEL = re.compile('🟡\\s*' + COUNT_TAIL)
COUNT_RESOLVED_AFTER = re.compile(r'해소|CLOSED|정정|수정|반영|해결')   # 계수 직후 8자 안에 있으면 «지난 지적» 서술이지 이 라운드 계수가 아니다
SCOPE_LINE = re.compile(r'검수\s*범위|범위\s*[:：]|직전|이전\s*지적|지난\s*지적')   # 재검 범위 서술줄(«직전 🔴 2건 해소 여부»)
RULE_LINE = re.compile(r'\bAND\b|PASS\s*조건|조건\s*[:：]|판정\s*기준|규정|규칙|정의\s*[:：]')
# ── 마커 계수(fallback) — 줄머리 🔴/🟡(뒤에 숫자·없음·=·(·: 이 오면 마커가 아니라 계수/범례) ──
MARKER = re.compile(r'^(?:[-*+>|]|\d+[.)]|\*\*|\s)*\s*(🔴|🟡)(?!\s*\d|\s*없음|\s*[=:：]|\s*\()')
MARKER_NOISE = re.compile(r'없음|(?<!\d)0\s*건|[:：]\s*0\s*$|목록\s*[:：]\s*$|\b0\s*/')   # «🔴/🟡 지적사항 없음»·«🔴 목록:» 은 지적이 아니다
SEVERITY = re.compile(r'심각도\s*[:：]\s*\**\s*(🔴|🟡)')
RESOLVED_LINE = re.compile(r'해소|정정\s*완료|수정\s*완료|수정됨|→\s*(?:🟢|PASS|해소)|CLOSED|반영됨|기각|재발\s*없음')
# ── «확인 불가» 잔존(fact 최종 리포트의 지적 줄) ──
UNVERIFIED = re.compile(r'확인\s*불가|(?<!재)확인\s*필요|미확인|검증\s*불가')
# 해소 어휘 — 규약 8종(해소|해결|정정|삭제|헤지|고지|반영|제외) + 실측 오탐 7/13 에서 나온 «이미 처리됨» 서술
#   (배지 부착 = 헤지 · 정합/일관/정상/PASS · 결함 아님/문제 없음/근거 없음 · «…없음, 확인.» = 확인됨). «미확인.» 은 확인이 아니다.
UNV_RESOLVED = re.compile(r'해소|해결|정정|삭제|헤지|고지|반영|제외|배지|정합|일관|정상|\bPASS\b|결함\s*아님|문제\s*없음|이상\s*없음|근거\s*없음'
                          r'|(?<!미)확인(?:됨|\s*완료|\.)')
UNV_SKIP = re.compile(r'_glossary|\(참고\)')     # 용어집 행 서술·참고 메모는 글의 지적이 아니다
UNV_NEGATED = re.compile(r'(?:확인\s*불가|확인\s*필요|미확인|검증\s*불가)\s*(?:항목|사항|건|표시|처리)?\s*(?:은|는|이|가|도|을|를)?\s*'
                         r'(?:없음|없다|없었|0\s*건|아님|아니)')
ISSUE_LINE = re.compile(r'^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:\*\*)?\s*(?:🔴|🟡|⚠)')
LIST_LINE = re.compile(r'^\s*-\s+')
# ── 검수 대상 머리표기 ──
TARGET_HDR = re.compile(r'(?:검수\s*)?대상[^:：\n]{0,12}[:：]\s*(.+)$')
POST_HTML = re.compile(r'\.html?$', re.I)


# ───────────────────────────── 공통 ─────────────────────────────
def nfc(s):
    return unicodedata.normalize('NFC', s or '')


def read(p):
    try:
        with io.open(p, encoding='utf-8', errors='replace') as fh:
            return fh.read()
    except IOError:
        return ''


def qa_dirs(target):
    """글 폴더의 _qa/ 를 찾는다(파일을 주면 그 폴더 기준). 반환: (글폴더 절대경로, [_qa 경로...])"""
    p = os.path.abspath(target)
    base = os.path.dirname(p) if os.path.isfile(p) else p
    out = []
    d = os.path.join(base, '_qa')
    if os.path.isdir(d):
        out.append(d)
    # 구 관례: BlogPreview/_qa/<주제>/ 또는 <작성자>/_qa/
    topic = os.path.basename(base)
    for up in (os.path.dirname(base), os.path.dirname(os.path.dirname(base))):
        for cand in (os.path.join(up, '_qa', topic), os.path.join(up, '_qa')):
            if os.path.isdir(cand) and cand not in out:
                # 상위 공용 _qa 는 이 글 이름 하위만 인정(다른 글 리포트를 끌어오면 오판)
                if cand.endswith(os.sep + topic) or os.path.basename(os.path.dirname(cand)) == topic:
                    out.append(cand)
    return base, out


def post_rel_of(base):
    """BlogPreview 이후의 상대경로('/' 구분). BlogPreview 가 경로에 없으면 마지막 3단."""
    parts = [nfc(x) for x in os.path.abspath(base).replace('\\', '/').split('/') if x]
    low = [x.lower() for x in parts]
    if 'blogpreview' in low:
        i = len(low) - 1 - low[::-1].index('blogpreview')
        return '/'.join(parts[i + 1:])
    return '/'.join(parts[-3:])


def round_ref_before(line, pos, rnd):
    """줄의 pos 앞에 «R1/round1/라운드1» 처럼 이 리포트보다 낮은 라운드 언급이 있으면 True(하위 라운드 인용줄)."""
    for m in ROUNDREF.finditer(line):
        if m.start() >= pos:
            break
        try:
            if int(m.group(1)) < rnd:
                return True
        except ValueError:
            pass
    return False


# ───────────────────────────── 리포트 파싱 ─────────────────────────────
def verdict_of(text, rnd):
    """리포트 한 장의 판정 — 'PASS' | 'FAIL' | 'UNKNOWN'."""
    found = []
    for ln in text.split('\n'):
        if BACKREF.search(ln) or RULE_LINE.search(ln):
            continue
        m = VERDICT.search(ln)
        if not m:
            continue
        if round_ref_before(ln, m.start(), rnd):
            continue
        found.append(m.group(1) or m.group(2))
    return found[-1] if found else 'UNKNOWN'


def _num(s):
    return 0 if s == '없음' else int(s)


def _count_matches(rx, ln):
    out = []
    for m in rx.finditer(ln):
        val = next((g for g in m.groups() if g is not None), None)
        if val is None:
            continue
        n = _num(val)
        if n > 50:
            continue
        out.append((m.start(), m.end(), n))
    return out


def line_counts(ln, rnd):
    """한 줄의 (red|None, yellow|None). 하위 라운드 인용 뒤·해소 서술 앞의 계수는 뺀다. 표 행이면 마지막 열, 산문이면 첫 것."""
    if BACKREF.search(ln) or RULE_LINE.search(ln) or SCOPE_LINE.search(ln):
        return None, None
    res = []
    for rx in (COUNT_RED, COUNT_YEL):
        keep = []
        for st, en, n in _count_matches(rx, ln):
            if round_ref_before(ln, st, rnd):
                continue
            if COUNT_RESOLVED_AFTER.search(ln[en:en + 8]):
                continue
            keep.append(n)
        if not keep:
            res.append(None)
        else:
            res.append(keep[-1] if '|' in ln else keep[0])
    return res[0], res[1]


def summary_counts(text, rnd):
    """(red, yellow, source) — 두 색이 한 줄에 있는 마지막 요약줄('summary') 우선, 없으면 색별 마지막 단색 계수줄('single'), 둘 다 없으면 None."""
    joint = None
    red = yellow = None
    for ln in text.split('\n'):
        r, y = line_counts(ln, rnd)
        if r is not None and y is not None:
            joint = (r, y)
        if r is not None:
            red = r
        if y is not None:
            yellow = y
    if joint is not None:
        return joint[0], joint[1], 'summary'
    if red is not None or yellow is not None:
        return red, yellow, 'single'
    return None


def marker_counts(text, rnd):
    """fallback — 줄머리 🔴/🟡 마커·«심각도: 🔴» 를 센다(해소·기각·하위 라운드 인용줄·계수줄·«없음/0건» 줄 제외)."""
    red = yellow = 0
    for ln in text.split('\n'):
        if BACKREF.search(ln) or RULE_LINE.search(ln) or RESOLVED_LINE.search(ln) or MARKER_NOISE.search(ln):
            continue
        if _count_matches(COUNT_RED, ln) or _count_matches(COUNT_YEL, ln):
            continue
        m = MARKER.match(ln)
        if not m:
            m = SEVERITY.search(ln)
        if not m:
            continue
        if round_ref_before(ln, m.start(1), rnd):
            continue
        if m.group(1) == '🔴':
            red += 1
        else:
            yellow += 1
    return red, yellow


def counts_of(text, rnd):
    """(red, yellow, source) — source = 'summary' | 'single' | 'marker'. 계수줄이 한 색만 주면 나머지 색은 마커 계수로 보충."""
    r, y = marker_counts(text, rnd)
    s = summary_counts(text, rnd)
    if s is None:
        return r, y, 'marker'
    sr, sy, src = s
    return (sr if sr is not None else r), (sy if sy is not None else y), src


def unverified_of(text, rnd):
    """fact 리포트의 지적 줄(🔴·🟡·⚠·`- ` 시작) 중 «확인 불가|확인 필요|미확인|검증 불가» 가 있고
    같은 줄에 해소 표기(해소|해결|정정|삭제|헤지|고지|반영|제외)도, 부정(«… 없음»)도 없는 줄."""
    hits = []
    for ln in text.split('\n'):
        if not (ISSUE_LINE.match(ln) or LIST_LINE.match(ln)):
            continue
        m = UNVERIFIED.search(ln)
        if not m:
            continue
        if BACKREF.search(ln) or RULE_LINE.search(ln) or UNV_SKIP.search(ln):
            continue
        if round_ref_before(ln, m.start(), rnd):
            continue
        if UNV_RESOLVED.search(ln) or UNV_NEGATED.search(ln):
            continue
        hits.append(re.sub(r'\s+', ' ', ln.strip())[:110])
    return hits


def target_of(text):
    """리포트 머리(15줄)의 «검수 대상:» 값 → (kind, value). kind = 'path' | 'basename' | None."""
    for ln in text.split('\n')[:15]:
        m = TARGET_HDR.search(ln)
        if not m:
            continue
        v = m.group(1).strip()
        q = re.search(r'`([^`]+)`', v)
        if q:
            v = q.group(1)
        else:
            h = re.search(r'(.+?\.html?)(?:\s|$|[)\]»」』"\'*,])', v + ' ')
            if h:
                v = h.group(1)
        v = nfc(v.strip(' `"\'*<>「」«»'))
        v = re.sub(r'^file:///', '', v).replace('\\', '/')
        if not v:
            continue
        if '/' in v:
            return 'path', v
        if POST_HTML.search(v):
            return 'basename', v
        return None, v          # 제목만 적은 경우 = 경로 표기 없음
    return None, None


def target_matches(kind, value, base, post_rel):
    """'ok' | 'mismatch' | 'unknown'"""
    if kind == 'basename':
        return 'ok' if os.path.isfile(os.path.join(base, value)) else 'unknown'
    if kind != 'path':
        return 'unknown'
    v = value.strip('/')
    i = v.lower().find('blogpreview/')
    if i >= 0:
        v = v[i + len('blogpreview/'):]
    v = v.strip('/')
    if POST_HTML.search(v):
        d = v.rsplit('/', 1)[0] if '/' in v else ''
    else:
        d = v
    if not d:
        return 'ok' if os.path.isfile(os.path.join(base, v.rsplit('/', 1)[-1])) else 'unknown'
    a = [x.casefold() for x in nfc(post_rel).split('/') if x]
    b = [x.casefold() for x in d.split('/') if x and x not in ('…', '...', '..', '.', '~')]   # «…/주제/파일» 생략 표기 허용(실측 3건)
    if not b:
        return 'unknown'
    if len(a) >= 2 and len(b) >= 2:
        return 'ok' if b[-2:] == a[-2:] else 'mismatch'
    return 'ok' if (a and b and b[-1] == a[-1]) else 'mismatch'


# ───────────────────────────── 게임·용어집 ─────────────────────────────
def _norm_game(s):
    return re.sub(r'[\s()_\-:]', '', nfc(str(s))).lower()


def game_of(post_rel, games):
    """glossary-lint.py 의 game_of 와 같은 규칙(정확 일치 → 시작 일치 → 부분 일치)."""
    parts = [p for p in post_rel.split('/') if p]
    if parts and parts[0] in WRITERS:
        parts = parts[1:]
    cand = set(_norm_game(p) for p in parts)
    joined = _norm_game('/'.join(parts))
    for g in games:
        names = [g.get('canon', '')] + list(g.get('aliases', [])) + list(g.get('folders', []))
        for n in names:
            nn = _norm_game(n)
            if not nn:
                continue
            if nn in cand:
                return g
            if len(nn) >= 4 and any(c.startswith(nn) for c in cand):
                return g
            if len(nn) >= 6 and nn in joined:
                return g
    return None


def load_games():
    try:
        with io.open(ALIASES_JSON, encoding='utf-8') as fh:
            return json.load(fh).get('games', [])
    except (IOError, ValueError):
        return []


# ───────────────────────────── 수집 ─────────────────────────────
def collect(dirs):
    """(dim, round) -> path · mainfix 라운드 목록 · 그 외 존재 파일 플래그."""
    reports, mainfix = {}, []
    for d in dirs:
        for p in sorted(glob.glob(os.path.join(d, '*.md'))):
            fn = os.path.basename(p)
            m = FNAME.match(fn)
            if m:
                rnd, name = int(m.group(1)), m.group(2).lower()
                if MAINFIX_NAME.match(name):
                    mainfix.append(rnd)
                    continue
                dim = ALIAS.get(name)
            else:
                m = FNAME_IMPROVE.match(fn)
                if m:
                    dim, rnd = ALIAS.get(m.group(2).lower()), IMPROVE_BASE + int(m.group(1))
                else:
                    m = FNAME_ALT.match(fn)
                    if not m:
                        continue
                    dim, rnd = ALIAS.get(m.group(1).lower()), int(m.group(2) or 1)
            if not dim:
                continue
            reports[(dim, rnd)] = p
    return reports, sorted(set(mainfix))


def analyze(target, sensitive=False, post_publish=False, touched=None):
    base, dirs = qa_dirs(target)
    post_rel = post_rel_of(base)
    parts = [p for p in post_rel.split('/') if p]
    writer = parts[0] if parts and parts[0] in WRITERS else '?'
    reports, mainfix = collect(dirs)

    # 보조 파일
    own_qa = os.path.join(base, '_qa')
    # 민감글 플래그 원천 2종(2026-09-23): 규약 `_qa/sensitive.json` {"sensitive": true} + preflight 확장(다른 패키지)이 쓰는
    # `_qa/preflight.json` 의 "sensitive" 키(실측 09-23 23:06 소드X스태프). 둘 중 하나라도 true 면 refute 필수.
    sens_flag = False
    for fn in ('sensitive.json', 'preflight.json'):
        sp = os.path.join(own_qa, fn)
        if os.path.isfile(sp):
            try:
                if bool(json.loads(read(sp) or '{}').get('sensitive')):
                    sens_flag = True
            except ValueError:
                pass
    research = any(os.path.isfile(os.path.join(d, 'research-brief.md')) for d in dirs)
    editorial = any(glob.glob(os.path.join(d, 'editorial*.md')) for d in dirs)
    games = load_games()
    g = game_of(post_rel, games) if games else None
    game = g.get('canon') if g else None
    if g:
        gl = g.get('glossary')
        glossary = bool(gl) and os.path.isfile(os.path.join(GLOSSARY_DIR, gl))
    else:
        glossary = None

    need = list(REQUIRED) + (['refute'] if (sensitive or sens_flag) else [])
    blocks, warnings = [], []
    dims_out = {}
    per = {}
    for dim in DIMS + ['lead']:
        rounds = sorted(r for (d, r) in reports if d == dim)
        if not rounds:
            per[dim] = None
            continue
        last = rounds[-1]
        path = reports[(dim, last)]
        text = read(path)
        v = verdict_of(text, last)
        red, yellow, src = counts_of(text, last)
        unv = unverified_of(text, last) if dim == 'fact' else []
        tkind, tval = target_of(text)
        tmatch = target_matches(tkind, tval, base, post_rel) if tkind else 'none'
        if v == 'FAIL' or red > 0:
            final = 'FAIL'
        elif v == 'UNKNOWN' or yellow > 0:
            final = 'WARN'
        else:
            final = 'PASS'
        per[dim] = {'rounds': rounds, 'last': last, 'verdict': v, 'red': red, 'yellow': yellow, 'src': src,
                    'unverified': unv, 'file': os.path.basename(path), 'final': final,
                    'tkind': tkind, 'tval': tval, 'tmatch': tmatch}

    # ── 판정 ──
    missing = [d for d in need if per.get(d) is None]
    if missing:
        blocks.append('필수 차원 리포트 부재: %s%s' % (', '.join(missing), '(refute=민감글)' if 'refute' in missing else ''))
    # failDims = «(재)검수가 필요한 차원». 결측 필수 차원도 넣는다 — 리포트가 없으면 그 차원을 스폰해야 하니까.
    #   드레이너 reason.txt 의 «재검 차원:» 과 러너의 «그 차원만 재스폰» 이 이 목록을 읽는다(결측이 빠지면 빈 목록 = 무엇을 돌릴지 모른다).
    fail_dims = list(missing)
    unknown = []
    yellow_parts = []
    no_hdr = []
    for dim in DIMS:
        info = per.get(dim)
        if not info:
            continue
        label = '%s(%s)' % (dim, info['file'])
        if info['final'] == 'FAIL':
            why = 'FAIL' if info['verdict'] == 'FAIL' else '판정 %s' % info['verdict']
            if dim in BLOCKING_DIMS:
                # 마지막 라운드가 FAIL = 그 뒤 재검이 없다는 뜻(있으면 그게 last 였을 것) = 수정 루프 미완.
                blocks.append('%s 최종 %s · 🔴%d 🟡%d · 재검 없음 — 그 차원만 재검 리포트를 저장할 것'
                              % (label, why, info['red'], info['yellow']))
                fail_dims.append(dim)
            else:
                warnings.append('%s 최종 %s · 🔴%d — 은퇴 차원(참고만, 차단 안 함)' % (label, why, info['red']))
        if info['verdict'] == 'UNKNOWN':
            unknown.append(label)
        if info['yellow'] > 0:
            yellow_parts.append('%s %d' % (dim, info['yellow']))
        if dim == 'fact' and info['unverified']:
            blocks.append('확인 불가 항목이 남아 있음 — 본문에서 삭제·헤지·미확인 고지 후 fact 재검(리포트에 \'해소\' 표기) · %d줄: %s'
                          % (len(info['unverified']), ' ‖ '.join(info['unverified'][:3])))
            if 'fact' not in fail_dims:
                fail_dims.append('fact')
        if info['tmatch'] == 'mismatch':
            blocks.append('검수 대상 경로 불일치: %s «%s» ≠ 글 폴더 «%s»' % (label, info['tval'], post_rel))
        elif info['tmatch'] in ('none', 'unknown'):
            no_hdr.append(label if info['tmatch'] == 'none' else '%s(파일명 «%s» 글 폴더에 없음)' % (label, info['tval']))
    if unknown:
        warnings.append('판정줄 없음: %s — 리포트에 «판정: PASS/FAIL» 을 적을 것' % ', '.join(unknown))
    total_yellow = sum(per[d]['yellow'] for d in DIMS if per.get(d))
    if total_yellow > 0:
        warnings.append('🟡 %d건 잔존(최종 라운드 합계: %s)' % (total_yellow, ' · '.join(yellow_parts)))
    if no_hdr:
        warnings.append('검수 대상 경로 표기 없음/불명: %s' % ', '.join(no_hdr))
    lead = per.get('lead')
    if lead and lead['final'] == 'FAIL':
        warnings.append('lead(%s) 최종 FAIL · 🔴%d 🟡%d — 판정자 참고(차원 리포트가 정본)' % (lead['file'], lead['red'], lead['yellow']))
    # ⒡ mainfix 무재검 — 메인 치환 뒤 어떤 차원도 더 높은 라운드 리포트가 없다.
    if mainfix:
        mf = max(mainfix)
        max_dim_round = max([per[d]['last'] for d in DIMS if per.get(d)] or [0])
        if max_dim_round <= mf:
            blocks.append('mainfix 무재검: round%d-mainfix 뒤 차원 재검 리포트 없음(최고 차원 라운드 %d) — 치환이 닿은 차원을 round%d 로 재검할 것'
                          % (mf, max_dim_round, mf + 1))
    if not research:
        warnings.append('_qa/research-brief.md 부재')
    if g and glossary is False:
        warnings.append('게임 용어집 부재: %s(_aliases.json glossary=%s) — qa-fact 종료 시 용어집 생성·append 규약'
                        % (game, g.get('glossary')))
    if post_publish and not editorial:
        warnings.append('_qa/editorial.md 부재(--post-publish)')

    if touched:
        for t in touched:
            t = ALIAS.get(t.strip().lower(), t.strip().lower())
            if t in DIMS and t not in fail_dims:
                fail_dims.append(t)

    overall = 'BLOCK' if blocks else ('WARN' if warnings else 'PASS')
    code = {'PASS': 0, 'WARN': 2, 'BLOCK': 1}[overall]
    rounds_max = max([r for (d, r) in reports if d in DIMS and r < IMPROVE_BASE] or [0])
    for dim in DIMS:
        info = per.get(dim)
        if info:
            dims_out[dim] = {'rounds': len(info['rounds']), 'final': info['final'], 'red': info['red'],
                             'yellow': info['yellow'], 'unverified': len(info['unverified']), 'lastFile': info['file']}
        else:
            dims_out[dim] = {'rounds': 0, 'final': 'NONE', 'red': 0, 'yellow': 0, 'unverified': 0, 'lastFile': None}
    out = {'post': post_rel, 'writer': writer, 'game': game, 'dims': dims_out, 'rounds': rounds_max,
           'overall': overall, 'exit': code, 'failDims': fail_dims, 'blocks': blocks, 'warnings': warnings,
           'files': {'research': research, 'sensitive': bool(sens_flag or sensitive), 'editorial': editorial,
                     'glossary': glossary}}
    return out, per, dirs, base


def print_human(out, per, dirs, base):
    print('=== QA 리포트 실측: %s ===  (작성자 %s · 게임 %s · 라운드 %d)'
          % (out['post'], out['writer'], out['game'] or '대상 아님', out['rounds']))
    if not dirs:
        print('  _qa 폴더 없음 — 검수 리포트가 하나도 저장되지 않았다.')
    for dim in DIMS + ['lead']:
        info = per.get(dim)
        if info:
            print('  %-10s round %-10s 최종 %-4s 🔴%d 🟡%d%s  [%s]'
                  % (dim, ','.join(str(r) for r in info['rounds']), info['final'], info['red'], info['yellow'],
                     {'marker': '(마커)', 'single': '(단색)'}.get(info['src'], ''), info['file']))
        elif dim in REQUIRED or (dim == 'refute' and out['files']['sensitive']):
            print('  %-10s (리포트 없음)' % dim)
    for b in out['blocks']:
        print('\n⛔ BLOCK: %s' % b)
    for w in out['warnings']:
        print('\n⚠ WARN: %s' % w)
    if out['overall'] == 'BLOCK':
        print('\n⛔ 적재 거부(exit 1) — 재검 차원: %s' % (','.join(out['failDims']) or '(메시지 참조)'))
        print('   → **해당 차원만** 재스폰해 저장할 것(전 차원 재검 금지 — 그게 편당 QA 13스폰의 원인이다).')
    elif out['overall'] == 'WARN':
        print('\n✅ 적재 가능(exit 2 · 경고 %d) — 경고는 고치는 쪽이 사후 🔴 를 줄인다.' % len(out['warnings']))
    else:
        print('\n✅ 적재 가능(exit 0) — 필수 차원 전부 존재 · 최종 라운드 FAIL 0 · 🔴 0 · 🟡 0')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--sensitive', action='store_true', help='refute 도 필수 차원으로 본다(민감글)')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--quiet', action='store_true')
    ap.add_argument('--fail-dims', action='store_true', help='재검이 필요한 차원만 쉼표 한 줄')
    ap.add_argument('--touched', default='', help='--fail-dims 에 합칠 «수정이 닿은 차원» (예: fact,style)')
    ap.add_argument('--post-publish', action='store_true', help='발행 후 모드 — editorial 부재를 경고')
    a = ap.parse_args()

    touched = [t for t in a.touched.split(',') if t.strip()] if a.touched else None
    out, per, dirs, base = analyze(a.target, sensitive=a.sensitive, post_publish=a.post_publish, touched=touched)

    if a.json:
        print(json.dumps(out, ensure_ascii=False))
    elif a.fail_dims:
        print(','.join(out['failDims']))
    elif a.quiet:
        print('[qa-files-check] %s exit=%d %s' % (out['overall'], out['exit'],
                                               (out['blocks'] or out['warnings'] or ['clean'])[0]))
    else:
        print_human(out, per, dirs, base)
    sys.exit(out['exit'])


if __name__ == '__main__':
    main()
