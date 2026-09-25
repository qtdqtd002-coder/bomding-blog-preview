#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
preflight.py B5(1차 출처 링크 0 = 차단) 픽스처 러너 (2026-09-25 · 전수조사 후속 항목 12)

  python _tools/tests/preflight-b5/run-b5-tests.py        → 전부 PASS 면 exit 0, 하나라도 어긋나면 exit 1

픽스처는 임시 폴더로 복사해 돌린다 — ① `_qa/` 가 .gitignore 라 f4 의 발주 양식(_qa/order-form.md)은 커밋될 수 없어 러너가 만든다
② preflight.json·sensitive.json 도 임시 폴더(--out-dir)에만 쓴다. 분량·img 같은 다른 차단 항목이 끼어들지 않게 --min 1 로 돌린다.

| 케이스 | purpose 입력 | 본문 링크 | 기대 |
|---|---|---|---|
| f1 | --purpose "게임 공략" | 개인블로그·나무위키·카페·인벤게시판·유튜브 + href 없는 «참고한 곳» | exit 1 · blocked · primaryLinks 0 |
| f2 | --purpose "게임 공략" | aniimo.com 공식 1 (+#copy 안 링크는 무시) | exit 0 · primaryLinks 1 |
| f3 | (없음 · _qa 없음) | 0 | exit 0 · 경고 «B5 미판정» · applied false |
| f4 | _qa/order-form.md `[목적]` 다음 줄 «1. 쿠폰·이벤트» | 0 | exit 1 · purposeSource _qa/order-form.md |
| f5 | --purpose "제품 비교·추천" | 쿠팡 제휴 1 | exit 0 · applied false(B5_PURPOSE_SKIP) |
"""
import io, os, sys, json, shutil, subprocess, tempfile

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
PF = os.path.abspath(os.path.join(HERE, '..', '..', 'preflight.py'))

CASES = [
    ('f1', 'f1-guide-nolink.html', ['--purpose', '게임 공략'], 1,
     {'applied': True, 'blocked': True, 'primaryLinks': 0, 'purposeSource': 'arg'}, None),
    ('f2', 'f2-guide-official.html', ['--purpose', '게임 공략'], 0,
     {'applied': True, 'blocked': False, 'primaryLinks': 1, 'purposeSource': 'arg'}, None),
    ('f3', 'f3-unknown.html', [], 0,
     {'applied': False, 'blocked': False}, 'B5 미판정'),
    ('f4', 'f4-coupon-nolink.html', [], 1,
     {'applied': True, 'blocked': True, 'primaryLinks': 0, 'purposeSource': '_qa/order-form.md'}, None),
    ('f5', 'f5-product-compare.html', ['--purpose', '제품 비교·추천'], 0,
     {'applied': False, 'blocked': False}, None),
]


def run_case(tmp, name, fname, extra, want_exit, want_b5, want_warn):
    d = os.path.join(tmp, name)
    os.makedirs(d, exist_ok=True)
    src = os.path.join(HERE, fname)
    dst = os.path.join(d, fname)
    shutil.copyfile(src, dst)
    if name == 'f4':
        os.makedirs(os.path.join(d, '_qa'), exist_ok=True)
        io.open(os.path.join(d, '_qa', 'order-form.md'), 'w', encoding='utf-8', newline='\n').write(
            '# 발주서 — 테스트 · 쿠폰 (러너 생성 픽스처)\n\n[목적]\n1. 쿠폰·이벤트\n\n[게임/제품]\n1. 테스트 게임\n')
    out_dir = os.path.join(d, '_out')
    cmd = [sys.executable, PF, dst, '--min', '1', '--json', '--out-dir', out_dir] + extra
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    line = [l for l in r.stdout.splitlines() if l.strip().startswith('{')]
    j = json.loads(line[-1]) if line else {}
    b5 = j.get('b5', {})
    probs = []
    if r.returncode != want_exit:
        probs.append('exit %d ≠ 기대 %d' % (r.returncode, want_exit))
    for k, v in want_b5.items():
        if b5.get(k) != v:
            probs.append('b5.%s=%r ≠ 기대 %r' % (k, b5.get(k), v))
    if want_warn and not any(want_warn in w for w in j.get('warns', [])):
        probs.append('경고 «%s» 없음' % want_warn)
    # 파일 계약: preflight.json 최상위 b5 키
    pj = os.path.join(out_dir, 'preflight.json')
    try:
        fj = json.load(io.open(pj, encoding='utf-8'))
        if 'b5' not in fj:
            probs.append('preflight.json 에 b5 키 없음')
    except Exception as e:
        probs.append('preflight.json 못 읽음: %s' % e)
    if not line:
        probs.append('JSON 출력 없음: ' + (r.stdout[-300:] + r.stderr[-300:]))
    return r.returncode, b5, probs


def main():
    if not os.path.isfile(PF):
        print('⛔ preflight.py 없음: %s' % PF)
        return 2
    tmp = tempfile.mkdtemp(prefix='pf-b5-')
    fails = 0
    print('=== preflight B5 픽스처 (%s) ===' % tmp)
    print('%-3s %-5s %-6s %-8s %-4s %-24s %s' % ('케이스', 'exit', '적용', '차단', '링크', 'purpose←src', '판정'))
    try:
        for name, fname, extra, we, wb, ww in CASES:
            rc, b5, probs = run_case(tmp, name, fname, extra, we, wb, ww)
            ok = not probs
            fails += 0 if ok else 1
            print('%-4s %-5s %-6s %-8s %-4s %-24s %s' % (
                name, rc, b5.get('applied'), b5.get('blocked'), b5.get('primaryLinks'),
                ('%s←%s' % (b5.get('purpose') or '미상', b5.get('purposeSource') or '-'))[:24],
                'PASS' if ok else 'FAIL: ' + ' · '.join(probs)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('→ %d/%d PASS' % (len(CASES) - fails, len(CASES)))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
