#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
QA 리포트 실측 게이트 — «전 차원 PASS» 를 파일로 증명한다  (2026-09-12 신설 · LLM 0)

왜 있나 (실측 사고)
  A1 경로(요청큐 러너)에는 `qa-panel` 워크플로가 없어 코드 가드가 하나도 안 걸린다.
  그래서 «검수 완주 5/5» 는 파이프라인 서브의 **자가보고**였고, 반복적으로 사실과 달랐다:
    · 2026-08-27  두 요청 다 5/5 보고 → 실제 _qa 에 3개·1개. «전 차원 PASS» 가 파일 없이 적재됨.
    · 2026-09-12  STAGED 자가보고 4편 중 3편 불일치(image 전무 · R2 뒤 수정 미검 · structure FAIL 뒤 적재).
  그때마다 메인이 «전 차원을 재스폰» 해 같은 글을 두 번 검수했다 —
  발행편당 QA 스폰 13.0(설계 6~8)의 절반이 이 이중화다.

  판정을 산문에서 **코드**로 옮긴다. 서브의 말이 아니라 파일이 진실이다.

사용
  python qa-files-check.py "<글 HTML 또는 글 폴더>" [--sensitive] [--json]
    exit 0 = 적재 가능(필수 차원 전부 존재 · FAIL 뒤 재검 존재 · 최종 🔴 0)
    exit 1 = 차원 누락 또는 FAIL 뒤 재검 없음 → **그 차원만** 재스폰할 것(전 차원 재검 금지)
    exit 2 = 최종 라운드에 🔴 잔존 → 수정 루프 미완(적재 금지)

읽는 규칙
  · 리포트 위치 = 글 폴더의 `_qa/`  (구 관례로 상위 `_qa/<주제>/` 에 있으면 그것도 본다)
  · 파일명 = `round<N>-<차원>.md` 또는 `round<N>_qa-<차원>.md` (두 관례가 섞여 있다 — 둘 다 받는다)
  · 차원 별칭  fact|qa-fact → fact / style|qa-style → style / structure|qa-structure → structure
                image|qa-image → image / refute → refute
  · round2 는 **round1 에서 FAIL 난 차원만** 있으면 정상이다(전 차원 재검은 낭비).
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, glob, json, argparse, collections

sys.stdout.reconfigure(encoding='utf-8')

REQUIRED = ['fact', 'style', 'structure', 'image']
ALIAS = {'fact': 'fact', 'qa-fact': 'fact', 'style': 'style', 'qa-style': 'style',
         'structure': 'structure', 'qa-structure': 'structure', 'image': 'image',
         'qa-image': 'image', 'refute': 'refute', 'qa-refute': 'refute', 'lead': 'lead',
         'qa-lead': 'lead'}
# ★파일명 관례가 **세 가지**다(실측 — 표준이 없어 각 회차가 제 방식으로 썼다):
#     ⑴ round1-fact.md · round2-style.md
#     ⑵ round1_qa-fact.md · round2_refute.md
#     ⑶ qa-fact.md(=round1) · qa-fact-round2.md
#   셋 다 받는다. 하나만 받으면 «리포트 없음» 오탐이 나고, 게이트가 늑대소년이 되면 꺼진다.
#   (`editorial*.md` 는 사후검수라 QA 라운드가 아니다 — 아래 패턴에 안 걸린다.)
FNAME = re.compile(r'^round(\d+)[-_](.+?)\.md$', re.I)
FNAME_ALT = re.compile(r'^(?:qa-)?(fact|style|structure|image|refute|lead)(?:[-_]round(\d+))?\.md$', re.I)
# ★판정은 «본문 🔴 개수»로 세지 않는다(2026-09-12 실측 — 리포트가 «R1 🟡-2 해소»처럼 과거 지적을
#   서술하고 «🔴/🟡 기준»을 설명하기도 해서 오탐이 났다. 실제로 PASS 해 발행된 글이 «🔴 잔존 5»로 잡혔다).
#   검수자가 쓴 **명시 판정 문자열**만 신뢰한다. 그게 리포트의 계약이다.
VERDICT = re.compile(r'\*\*(PASS|FAIL)\*\*|판정[^\n]{0,24}?\b(PASS|FAIL)\b')
# «전회차: round1-style.md (FAIL …)» 처럼 앞 라운드를 인용한 줄은 이 라운드 판정이 아니다.
BACKREF = re.compile(r'전회차|직전\s*라운드|이전\s*라운드|앞\s*라운드|참고\s*[:：]')


def qa_dirs(target):
    """글 폴더의 _qa/ 를 찾는다(파일을 주면 그 폴더 기준)."""
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
    return out


def read(p):
    try:
        with io.open(p, encoding='utf-8', errors='replace') as fh:
            return fh.read()
    except IOError:
        return ''


def verdict_of(text):
    """리포트 한 장의 판정 — 'PASS' | 'FAIL' | 'UNKNOWN'.

    같은 파일에 판정 문자열이 여러 번 나오면 **마지막**을 취한다(리포트는 머리에 요약,
    끝에 종합 판정을 쓰는 관례다). 앞 라운드를 인용한 줄은 건너뛴다.
    """
    found = []
    for ln in text.split('\n'):
        if BACKREF.search(ln):
            continue
        m = VERDICT.search(ln)
        if m:
            found.append(m.group(1) or m.group(2))
    return found[-1] if found else 'UNKNOWN'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--sensitive', action='store_true', help='refute 도 필수 차원으로 본다')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    dirs = qa_dirs(a.target)
    reports = {}                      # (dim, round) -> path
    for d in dirs:
        for p in sorted(glob.glob(os.path.join(d, '*.md'))):
            fn = os.path.basename(p)
            m = FNAME.match(fn)
            if m:
                dim, rnd = ALIAS.get(m.group(2).lower()), int(m.group(1))
            else:
                m = FNAME_ALT.match(fn)
                if not m:
                    continue
                dim, rnd = ALIAS.get(m.group(1).lower()), int(m.group(2) or 1)
            if not dim:
                continue
            reports[(dim, rnd)] = p

    need = list(REQUIRED) + (['refute'] if a.sensitive else [])
    missing, stuck, unknown = [], [], []
    per_dim = {}
    for dim in ['fact', 'style', 'structure', 'image', 'refute', 'lead']:
        rounds = sorted(r for (d, r) in reports if d == dim)
        if not rounds:
            if dim in need:
                missing.append(dim)
            continue
        last = rounds[-1]
        v = verdict_of(read(reports[(dim, last)]))
        per_dim[dim] = {'rounds': rounds, 'last': last, 'verdict': v}
        if v == 'FAIL':
            # 마지막 라운드가 FAIL = 그 뒤 재검이 없다는 뜻(있으면 그게 last 였을 것) = 수정 루프 미완.
            stuck.append('%s(round%d FAIL · 재검 없음)' % (dim, last))
        elif v == 'UNKNOWN':
            unknown.append('%s(round%d)' % (dim, last))

    ok = not missing and not stuck
    if a.json:
        print(json.dumps({'ok': ok, 'dirs': dirs, 'missing': missing,
                          'stuck': stuck, 'unknown': unknown, 'dims': per_dim},
                         ensure_ascii=False))
    else:
        print('=== QA 리포트 실측: %s ===' % os.path.basename(os.path.abspath(a.target)))
        if not dirs:
            print('  _qa 폴더 없음 — 검수 리포트가 하나도 저장되지 않았다.')
        for dim in ['fact', 'style', 'structure', 'image', 'refute', 'lead']:
            if dim in per_dim:
                v = per_dim[dim]
                print('  %-10s round %-10s 최종 %s' % (dim, ','.join(str(r) for r in v['rounds']), v['verdict']))
            elif dim in need:
                print('  %-10s (리포트 없음)' % dim)
        if missing:
            print('\n⛔ 차원 누락 %d: %s' % (len(missing), ', '.join(missing)))
            print('   → **누락 차원만** 재스폰해 저장할 것(전 차원 재검 금지 — 그게 편당 QA 13스폰의 원인이다).')
        if stuck:
            print('\n⛔ 수정 루프 미완 %d: %s — 적재 금지(FAIL 차원의 재검 리포트가 없다).'
                  % (len(stuck), ', '.join(stuck)))
        if unknown:
            print('\n⚠ 판정 문자열 없음 %d: %s — 리포트에 «판정: PASS/FAIL» 을 적을 것(차단은 안 한다).'
                  % (len(unknown), ', '.join(unknown)))
        if ok:
            print('\n✅ 적재 가능 — 필수 차원 전부 존재 · 최종 라운드 FAIL 0')

    if stuck:
        sys.exit(2)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
