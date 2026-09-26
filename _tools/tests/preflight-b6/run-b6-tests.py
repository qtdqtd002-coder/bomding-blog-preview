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


def main():
    if not os.path.isfile(PF):
        print('⛔ preflight.py 없음: %s' % PF)
        return 2
    tmp = tempfile.mkdtemp(prefix='pf-b6-')
    fails = 0
    print('=== preflight B6 픽스처 (%s) ===' % tmp)
    try:
        for name, fname, extra, we, wb, ww in CASES:
            rc, b6, probs = run_case(tmp, name, fname, extra, we, wb, ww)
            fails += 1 if probs else 0
            print('%-3s exit %s · 앵커 %s(img %s · imgslot %s · ss %s) · 공략형 %s · 차단 %s → %s' % (
                name, rc, b6.get('anchors', '-'), b6.get('img', '-'), b6.get('imgslot', '-'), b6.get('ss', '-'),
                b6.get('guide', '-'), b6.get('blocked', '-'), 'PASS' if not probs else 'FAIL: ' + ' · '.join(probs)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('→ %d/%d PASS' % (len(CASES) - fails, len(CASES)))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
