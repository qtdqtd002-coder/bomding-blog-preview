#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
preflight.py B6(봄딩·영도 공략형 시각 앵커 ≥2 = 차단) 픽스처 러너 (2026-09-26 · 사용자 결정 «공략형 글은 사진 자리 최소 N곳»)

  python _tools/tests/preflight-b6/run-b6-tests.py        → 전부 PASS 면 exit 0, 하나라도 어긋나면 exit 1

픽스처는 임시 폴더로 복사해 돌리고 preflight.json 도 임시 폴더(--out-dir)에만 쓴다. 분량 등 다른 차단이 끼어들지 않게 --min 1.
B5(공략형 1차 출처 링크)가 같이 걸리지 않도록 모든 픽스처 본문에 공식 링크(aniimo.com) 1개를 둔다.

| 케이스 | 인자 | 앵커 | 기대 |
|---|---|---|---|
| g1 | --writer 봄딩 --purpose "게임 공략" | 0 | exit 1 · b6.blocked |
| g2 | --writer 봄딩 --purpose "게임 공략" | img 1 + B형 1 | exit 0 · anchors 2 |
| g3 | --writer 봄딩 --purpose "출시·첫인상" | 0 | exit 0 · 경고 «W9» |
| g4 | (작성자 없음 · 임시 경로) --purpose "게임 공략" | 0 | exit 0 · b6 미적용({}) |
| g5 | --writer 영도 --purpose "게임 공략" | B형 2 | exit 0 · anchors 2 |
| g6 | --writer 봄딩 --purpose "게임 공략" | _design 자산 img(앵커 아님) + B형 1 | exit 1 · img 0 · ss 1 |

purpose 이어받기(2026-09-26 — 아웃박스 게이트는 --purpose 없이 돌며 `_qa/preflight.json` 을 덮어쓴다). `_qa/preflight.json` 을 미리 깔고 --purpose 없이 돈다.
| c1 | 직전 b5 «게임 공략»(arg) · 앵커 0 | exit 1 · purposeSource «_qa/preflight.json←arg» |
| c2 | 직전 출처가 이미 «_qa/preflight.json←arg» | 출처를 겹쳐 쓰지 않는다(그대로) |
| c3 | 직전 purpose 빈 값 | 미판정 · exit 0 · W9 |
| c4 | 직전 «순위 결과 정리»(arg) · 앵커 2 | exit 0 · sensitive ①(파이프라인과 같은 입력) |
| c5 | 직전 «순위 결과 정리»(research-brief 추론) · 앵커 2 | sensitive ① 없음(추론값은 sensitive 에 안 쓴다) |
| c6 | 실제 순서 — ①--purpose 로 실행(--out-dir 없이) ②없이 ③또 없이 | ②③ 모두 exit 1 · «←arg» |
"""
import io, os, sys, json, shutil, subprocess, tempfile

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
PF = os.path.abspath(os.path.join(HERE, '..', '..', 'preflight.py'))

G = ['--purpose', '게임 공략']
CASES = [
    ('g1', 'g1-guide-zero.html', ['--writer', '봄딩'] + G, 1, {'blocked': True, 'anchors': 0, 'guide': True}, None),
    ('g2', 'g2-guide-two.html', ['--writer', '봄딩'] + G, 0, {'blocked': False, 'anchors': 2, 'img': 1, 'ss': 1}, None),
    ('g3', 'g3-news-zero.html', ['--writer', '봄딩', '--purpose', '출시·첫인상'], 0, {'blocked': False, 'anchors': 0, 'guide': False}, 'W9'),
    ('g4', 'g4-guide-zero-nowriter.html', G, 0, None, None),
    ('g5', 'g5-yd-guide-ss2.html', ['--writer', '영도'] + G, 0, {'blocked': False, 'anchors': 2, 'ss': 2}, None),
    ('g6', 'g6-guide-design-only.html', ['--writer', '봄딩'] + G, 1, {'blocked': True, 'img': 0, 'ss': 1}, None),
]


def run_case(tmp, name, fname, extra, want_exit, want_b6, want_warn):
    d = os.path.join(tmp, name)
    os.makedirs(d, exist_ok=True)
    dst = os.path.join(d, fname)
    shutil.copyfile(os.path.join(HERE, fname), dst)
    out_dir = os.path.join(d, '_out')
    cmd = [sys.executable, PF, dst, '--min', '1', '--json', '--out-dir', out_dir] + extra
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    line = [l for l in r.stdout.splitlines() if l.strip().startswith('{')]
    j = json.loads(line[-1]) if line else {}
    b6 = j.get('b6', {})
    probs = []
    if r.returncode != want_exit:
        probs.append('exit %d ≠ 기대 %d · issues %s' % (r.returncode, want_exit, j.get('issues')))
    if want_b6 is None:
        if b6:
            probs.append('b6 가 적용됐다(작성자 미상이면 미적용이어야 함): %s' % b6)
    else:
        for k, v in want_b6.items():
            if b6.get(k) != v:
                probs.append('b6.%s=%r ≠ 기대 %r' % (k, b6.get(k), v))
    if want_warn and not any(w.startswith(want_warn) for w in j.get('warns', [])):
        probs.append('경고 «%s» 없음 · warns %s' % (want_warn, j.get('warns')))
    if not line:
        probs.append('JSON 출력 없음: ' + (r.stdout[-300:] + r.stderr[-300:]))
    return r.returncode, b6, probs


B = ['--writer', '봄딩']
CARRY = [
    # (이름, 픽스처, 직전 b5, 기대 exit, 기대 b6, 기대 경고, 기대 sensitive ①)
    ('c1', 'g1-guide-zero.html', {'purpose': '게임 공략', 'purposeSource': 'arg'}, 1,
     {'blocked': True, 'guide': True, 'purposeSource': '_qa/preflight.json←arg'}, None, None),
    ('c2', 'g1-guide-zero.html', {'purpose': '게임 공략', 'purposeSource': '_qa/preflight.json←arg'}, 1,
     {'blocked': True, 'purposeSource': '_qa/preflight.json←arg'}, None, None),
    ('c3', 'g1-guide-zero.html', {'purpose': '', 'purposeSource': ''}, 0,
     {'blocked': False, 'guide': None, 'purposeSource': ''}, 'W9', None),
    ('c4', 'g2-guide-two.html', {'purpose': '순위 결과 정리', 'purposeSource': 'arg'}, 0,
     {'blocked': False, 'guide': True}, None, True),
    ('c5', 'g2-guide-two.html', {'purpose': '순위 결과 정리', 'purposeSource': '_qa/research-brief.md'}, 0,
     {'blocked': False, 'purposeSource': '_qa/preflight.json←_qa/research-brief.md'}, None, False),
]


def pf_run(dst, extra, out_dir=None):
    cmd = [sys.executable, PF, dst, '--min', '1', '--json'] + (['--out-dir', out_dir] if out_dir else []) + extra
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    line = [l for l in r.stdout.splitlines() if l.strip().startswith('{')]
    return r.returncode, (json.loads(line[-1]) if line else {}), r


def check(rc, j, want_exit, want_b6, want_warn, want_s1):
    b6 = j.get('b6', {})
    probs = []
    if not j:
        return ['JSON 출력 없음']
    if rc != want_exit:
        probs.append('exit %d ≠ 기대 %d · issues %s' % (rc, want_exit, j.get('issues')))
    for k, v in (want_b6 or {}).items():
        if b6.get(k) != v:
            probs.append('b6.%s=%r ≠ 기대 %r' % (k, b6.get(k), v))
    if want_warn and not any(w.startswith(want_warn) for w in j.get('warns', [])):
        probs.append('경고 «%s» 없음 · warns %s' % (want_warn, j.get('warns')))
    if want_s1 is not None:
        s1 = any(x.startswith('①') for x in (j.get('sensitive_detail') or {}).get('reasons', []))
        if s1 != want_s1:
            probs.append('sensitive ① %s ≠ 기대 %s · %s' % (s1, want_s1, (j.get('sensitive_detail') or {}).get('reasons')))
    return probs


def run_carry(tmp, name, fname, prev_b5, we, wb, ww, ws):
    d = os.path.join(tmp, name)
    os.makedirs(os.path.join(d, '_qa'), exist_ok=True)
    dst = os.path.join(d, fname)
    shutil.copyfile(os.path.join(HERE, fname), dst)
    io.open(os.path.join(d, '_qa', 'preflight.json'), 'w', encoding='utf-8').write(json.dumps({'b5': prev_b5}, ensure_ascii=False))
    rc, j, _ = pf_run(dst, B, out_dir=os.path.join(d, '_out'))
    return rc, j.get('b6', {}), check(rc, j, we, wb, ww, ws)


def run_sequence(tmp):
    """c6 — 파이프라인(--purpose) → 아웃박스(없이) → 재적재(없이). --out-dir 없이 실제 _qa/preflight.json 을 덮어쓰며 돈다(임시 폴더)."""
    d = os.path.join(tmp, 'c6')
    os.makedirs(d, exist_ok=True)
    dst = os.path.join(d, 'g1-guide-zero.html')
    shutil.copyfile(os.path.join(HERE, 'g1-guide-zero.html'), dst)
    probs, seen = [], []
    for i, extra in enumerate((B + G, B, B)):
        rc, j, _ = pf_run(dst, extra)
        b6 = j.get('b6', {})
        seen.append('%d:%s«%s»' % (rc, b6.get('purposeSource'), b6.get('purpose')))
        want_src = 'arg' if i == 0 else '_qa/preflight.json←arg'
        probs += ['%d회차 %s' % (i + 1, p) for p in check(rc, j, 1, {'blocked': True, 'purposeSource': want_src}, None, None)]
    return seen, probs


def main():
    if not os.path.isfile(PF):
        print('⛔ preflight.py 없음: %s' % PF)
        return 2
    tmp = tempfile.mkdtemp(prefix='pf-b6-')
    fails = 0
    total = len(CASES) + len(CARRY) + 1
    print('=== preflight B6 픽스처 (%s) ===' % tmp)
    try:
        for name, fname, extra, we, wb, ww in CASES:
            rc, b6, probs = run_case(tmp, name, fname, extra, we, wb, ww)
            fails += 1 if probs else 0
            print('%-3s exit %s · 앵커 %s(img %s · imgslot %s · ss %s) · 공략형 %s · 차단 %s → %s' % (
                name, rc, b6.get('anchors', '-'), b6.get('img', '-'), b6.get('imgslot', '-'), b6.get('ss', '-'),
                b6.get('guide', '-'), b6.get('blocked', '-'), 'PASS' if not probs else 'FAIL: ' + ' · '.join(probs)))
        print('── purpose 이어받기(직전 _qa/preflight.json) ──')
        for name, fname, prev, we, wb, ww, ws in CARRY:
            rc, b6, probs = run_carry(tmp, name, fname, prev, we, wb, ww, ws)
            fails += 1 if probs else 0
            print('%-3s exit %s · purpose «%s» ← %s · 공략형 %s · 차단 %s → %s' % (
                name, rc, b6.get('purpose', '-'), b6.get('purposeSource', '-'), b6.get('guide', '-'), b6.get('blocked', '-'),
                'PASS' if not probs else 'FAIL: ' + ' · '.join(probs)))
        seen, probs = run_sequence(tmp)
        fails += 1 if probs else 0
        print('c6  파이프라인→아웃박스→재적재 %s → %s' % (' / '.join(seen), 'PASS' if not probs else 'FAIL: ' + ' · '.join(probs)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('→ %d/%d PASS' % (total - fails, total))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
