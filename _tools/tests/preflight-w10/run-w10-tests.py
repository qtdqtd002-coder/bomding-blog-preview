#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
preflight.py W10(지정 우선 출처 미인용 · 경고만) 러너 (2026-10-08)

  python _tools/tests/preflight-w10/run-w10-tests.py        → 전부 PASS 면 exit 0

글은 임시 폴더 `<tmp>/봄딩/<게임>/<주제>/post.html` 에 만들어 돌린다(경로 폴더로 게임을 판정하는지까지 본다).
분량 등 다른 차단이 끼지 않게 --min 1. preflight.json 은 --out-dir 로 임시 폴더에만 쓴다.

| 케이스 | 게임 폴더 | 제목 | 본문 링크 | 기대 |
|---|---|---|---|---|
| k1 | 도깨비의세계 | 도술 조합 | 공식 포럼만 | W10 경고 · applied · cited False |
| k2 | 도깨비의세계 | 도술 조합 | 깨비지지(참고한 곳) | W10 없음 · cited · W3 화이트리스트 밖 없음 · B5 1차 링크 ≥1 |
| k3 | 도깨비의세계 | 쿠폰 입력 | 공식 포럼만 | W10 없음 · applied False |
| k4 | 애니모 | 포획 확률 | 공식 1 | priority_src 비어 있음 |
| k5 | (게임 폴더 없음) | «도깨비의 세계» 버프 | 없음 | 제목으로 게임 판정 → W10 경고 |
"""
import io, os, sys, json, shutil, subprocess, tempfile

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
PF = os.path.abspath(os.path.join(HERE, '..', '..', 'preflight.py'))

FORUM = '<a href="https://forum.kakaogames.com/dokkaebi/postView/?code=notice&id=1">공식 포럼 공지</a>'
KKAEBI = '<a href="https://kkaebigg.com/builder">깨비지지 도술 빌더</a>'


def page(title, refs):
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>%s</title></head><body>'
            '<div class="wrap"><div class="post"><h1 class="title">%s</h1>'
            '<p>W10 픽스처 본문입니다.</p><h2>1. 정리</h2><p>내용입니다.</p>'
            '<p><b>참고한 곳</b> %s</p><div class="tags">#테스트</div></div></div></body></html>') % (title, title, refs)


CASES = [
    # name, rel_dir, title, refs, extra, want(dict on priority_src), want_w10, more_checks
    ('k1', os.path.join('봄딩', '도깨비의세계', '도술 조합'), '도깨비의세계 도술 조합 정리', FORUM, ['--purpose', '게임 공략'],
     {'game': '도깨비의세계', 'applied': True, 'cited': False}, True),
    ('k2', os.path.join('봄딩', '도깨비의세계', '도술 조합'), '도깨비의세계 도술 조합 정리', KKAEBI + ' · ' + FORUM, ['--purpose', '게임 공략'],
     {'game': '도깨비의세계', 'applied': True, 'cited': True}, False),
    ('k3', os.path.join('봄딩', '도깨비의세계', '쿠폰'), '도깨비의세계 쿠폰 입력 방법', FORUM, ['--purpose', '쿠폰·이벤트'],
     {'game': '도깨비의세계', 'applied': False}, False),
    ('k4', os.path.join('봄딩', '애니모', '포획'), '애니모 포획 확률 정리', '<a href="https://www.aniimo.com/ko/news/1">공식</a>', [],
     None, False),
    ('k5', os.path.join('임시'), '도깨비의 세계 버프 사전 정리', '', [],
     {'game': '도깨비의세계', 'applied': True, 'cited': False}, True),
]


def run_case(tmp, name, rel, title, refs, extra, want_ps, want_w10):
    d = os.path.join(tmp, name, rel)
    os.makedirs(d, exist_ok=True)
    f = os.path.join(d, 'post.html')
    io.open(f, 'w', encoding='utf-8', newline='\n').write(page(title, refs))
    out_dir = os.path.join(tmp, name, '_out')
    cmd = [sys.executable, PF, f, '--min', '1', '--json', '--out-dir', out_dir] + extra
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace',
                       env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    line = [l for l in r.stdout.splitlines() if l.strip().startswith('{')]
    j = json.loads(line[-1]) if line else {}
    ps = j.get('priority_src', {})
    w10 = any(w.startswith('W10') for w in j.get('warns', []))
    probs = []
    if not line:
        probs.append('JSON 출력 없음: ' + (r.stdout[-300:] + r.stderr[-300:]))
    if want_ps is None:
        if ps:
            probs.append('priority_src 가 비어야 함: %r' % ps)
    else:
        for k, v in want_ps.items():
            if ps.get(k) != v:
                probs.append('priority_src.%s=%r ≠ 기대 %r' % (k, ps.get(k), v))
    if w10 != want_w10:
        probs.append('W10 경고 %s ≠ 기대 %s' % (w10, want_w10))
    if name == 'k2':
        bad = j.get('checks', {}).get('refs', {}).get('not_whitelisted', [])
        if any('kkaebigg' in h for h in bad):
            probs.append('W3 가 kkaebigg.com 을 화이트리스트 밖으로 봄')
        if 'kkaebigg.com' not in j.get('b5', {}).get('primaryHosts', []):
            probs.append('B5 1차 링크에 kkaebigg.com 없음: %r' % j.get('b5', {}).get('primaryHosts'))
    return r.returncode, ps, w10, probs


def main():
    if not os.path.isfile(PF):
        print('⛔ preflight.py 없음: %s' % PF)
        return 2
    tmp = tempfile.mkdtemp(prefix='pf-w10-')
    fails = 0
    print('=== preflight W10 (%s) ===' % tmp)
    try:
        for name, rel, title, refs, extra, want_ps, want_w10 in CASES:
            rc, ps, w10, probs = run_case(tmp, name, rel, title, refs, extra, want_ps, want_w10)
            fails += 1 if probs else 0
            print('%-3s exit %s · game %s · 주제 %s · cited %s · W10 %s → %s' % (
                name, rc, ps.get('game'), ps.get('topicHits'), ps.get('cited'), w10,
                'PASS' if not probs else 'FAIL: ' + ' · '.join(probs)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('→ %d/%d PASS' % (len(CASES) - fails, len(CASES)))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
