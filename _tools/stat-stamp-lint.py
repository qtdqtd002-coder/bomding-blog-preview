#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
stat-stamp-lint.py — 라이브 통계를 실었으면 «언제 뽑은 값인지» 반드시 밝히게 한다 (2026-09-05 신설)

왜 만들었나
-----------
롤체지지 같은 **라이브 트래커** 수치는 패치가 없어도 매일 움직인다. 점유율 16.27% 는
«2026-09-04 밤 10시에 그랬다»는 뜻이지 «원래 그렇다»가 아니다. 시점·패치·표본을 안 밝히면
며칠 뒤 그 글은 **독자에게 그냥 틀린 글**이 된다.

이 규칙은 2026-09-04 부터 정본 세 곳(research-playbook §3-7 · 용어집 소스맵 · game-blog-qa
sources.md)에 «반드시 병기»로 적혀 있었고, 실측하니 **실제로 5편 전부 지켜지고 있었다.**
그런데 지키게 하는 건 «작성자가 정본을 읽고 기억하는 것» 뿐이었다 —
`_tools`·`.bc-locks` 어디에도 강제하는 코드가 0이었다(2026-09-05 실측).
**규율이 지켜지고 있다와 코드가 막고 있다는 다르다.** 이 린트가 그 차이를 메운다.

무엇을 보나
-----------
  1. 글의 게임을 `_glossary/_aliases.json` 별칭 색인으로 판정한다.
  2. 그 게임에 `liveStats` 플래그가 있을 때만 검사한다(다른 게임엔 해당 없음).
  3. **라이브 통계를 실제로 인용했는가** — 「점유율/순방률/등장률/승률 + 숫자」 형태.
     인용이 없으면 통과다(공략·시스템 설명 글은 스탬프가 필요 없다 — 실측 13편 중 8편이 이쪽).
  4. 인용했다면 `cite` 3요소가 본문에 있는가 — **패치 · 표본 · 조회(갱신) 시각.**

★스탬프 표현을 하나로 강요하지 않는다. 실제 발행글이 쓰는 형태가 다양하고 전부 정당하다:
   「패치 18.1d」 「표본 9만 8천 판」 「2026.09.04 21:00 KST 갱신 기준」
   「데이터 갱신은 9월 4일 오후 9시, 제가 뽑아본 시점은 같은 날 밤 10시 16분」
   ⇒ 문구가 아니라 **정보가 있는지**만 본다. (첫 측정 때 좁은 정규식으로 「누락 6편」이라
      잘못 보고했다가 원문을 열어 0편으로 정정한 적이 있다 — 그 교훈이 이 설계다.)

쓰는 법
-------
  python stat-stamp-lint.py <글 HTML 경로> [...]   # 발행 게이트(인자 모드 = 차단)
  python stat-stamp-lint.py --all                   # 전체 감사
  python stat-stamp-lint.py --json
종료코드: 0 = 통과 · 1 = 스탬프 누락 · 2 = 실행 오류
"""
import sys, os, re, json, glob

ROOT     = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CLAUDE   = os.path.dirname(ROOT)
ALIASES  = os.path.join(CLAUDE, '_glossary', '_aliases.json')

# 라이브 통계를 «인용했다»고 볼 신호. 숫자가 붙어야 한다 — 「점유율이 중요해요」는 인용이 아니다.
CITED = re.compile(r'(점유율|순방률|등장률|승률|평균\s*등수)\D{0,12}\d|\d+(\.\d+)?\s*%[^%]{0,25}(점유율|순방률|등장률)')

# 3요소 — 표현이 아니라 정보의 존재만 본다(주석 참조).
HAVE = {
    '패치':     re.compile(r'패치\s*\d+\.\d+[a-z]?|\b\d{2}\.\d[a-z]\b'),
    '표본':     re.compile(r'표본|[\d,]{4,}\s*판|만\s*[\d,]+\s*판'),
    '조회시각': (re.compile(r'\d{4}\s*[년.]\s*\d{1,2}\s*[월.]\s*\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일'),
                 re.compile(r'조회|갱신|기준')),
}

def norm(s):
    return re.sub(r'[\s()_\-:]', '', str(s)).lower()

def load_games():
    with open(ALIASES, encoding='utf-8') as f:
        return json.load(f).get('games', [])

def game_of(path, games):
    parts = [p for p in os.path.abspath(path).replace('\\', '/').split('/') if p]
    cand = {norm(p) for p in parts}
    for g in games:
        for n in [g['canon']] + list(g.get('aliases', [])) + list(g.get('folders', [])):
            nn = norm(n)
            if not nn:
                continue
            if nn in cand:
                return g
            if len(nn) >= 4 and any(c.startswith(nn) for c in cand):
                return g
    return None

def visible_text(html):
    t = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', html)
    t = re.sub(r'(?s)<!--.*?-->', ' ', t)
    t = re.sub(r'(?s)<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', t)

def check(path, games):
    g = game_of(path, games)
    out = {'file': os.path.relpath(path, ROOT), 'game': g['canon'] if g else None,
           'applies': bool(g and g.get('liveStats')), 'cited': False, 'missing': []}
    if not out['applies']:
        return out
    with open(path, encoding='utf-8', errors='replace') as f:
        text = visible_text(f.read())
    if not CITED.search(text):
        return out                      # 통계를 안 실은 글 — 스탬프 의무 없음
    out['cited'] = True
    for key in g['liveStats'].get('cite', ['패치', '표본', '조회시각']):
        rule = HAVE.get(key)
        if rule is None:
            continue
        ok = all(r.search(text) for r in rule) if isinstance(rule, tuple) else bool(rule.search(text))
        if not ok:
            out['missing'].append(key)
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    games = load_games()
    if not games:
        print('[stat-stamp-lint] ⚠ _aliases.json 을 읽지 못했다: %s' % ALIASES); return 2

    if '--all' in sys.argv or not args:
        targets = [p for p in glob.glob(os.path.join(ROOT, '*', '**', '*.html'), recursive=True)
                   if '_qa' not in p.replace('\\', '/').split('/')]
    else:
        targets = [p for p in args if os.path.isfile(p)]

    res = [check(p, games) for p in targets]
    scope = [r for r in res if r['applies']]
    cited = [r for r in scope if r['cited']]
    bad = [r for r in cited if r['missing']]

    if '--json' in sys.argv:
        print(json.dumps({'checked': len(res), 'inScope': len(scope), 'cited': len(cited),
                          'violations': len(bad), 'results': scope}, ensure_ascii=False, indent=2))
        return 1 if bad else 0

    print('[stat-stamp-lint] 검사 %d개 · 대상 게임 %d개 · 통계 인용 %d개 · 스탬프 누락 %d개'
          % (len(res), len(scope), len(cited), len(bad)))
    for r in bad:
        print('\n🔴 %s  (게임: %s)' % (r['file'], r['game']))
        print('   라이브 통계를 실었는데 빠진 것: %s' % ', '.join(r['missing']))
        print('   ※ 이 수치는 매일 바뀐다 — 「패치 18.1d · 표본 32만 판 · 9월 4일 22:16 조회 기준」처럼')
        print('      **언제 뽑은 값인지** 본문에 남겨야 며칠 뒤에도 틀린 글이 되지 않는다.')
        print('      숫자는 `node _tools/lolchess.cjs decks` 출력에서 그대로 복사할 것.')
    return 1 if bad else 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        print('[stat-stamp-lint] 실행 오류: %s' % e); sys.exit(2)
