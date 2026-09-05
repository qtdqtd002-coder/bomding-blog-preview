#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
glossary-lint.py — 용어집 «흔한 오표기» 열을 «코드가» 집행한다 (2026-09-05 신설)

왜 만들었나
-----------
용어집(`_glossary/<게임>.md`)의 명칭 표에는 `흔한 오표기` 열이 있다. 「신비한 숲 → 신비의 숲」,
「5티어 → 5단계」 같은 것들이다. 그런데 **`_tools/` 어디에도 `_glossary` 를 읽는 코드가 없었다**
(2026-09-05 진단 §2-2). 즉 정본에 적어 놔도 **LLM 이 그걸 읽고 기억해야만** 잡혔다.
검수자가 매번 기억하는 데 의존하는 규칙은 글이 쌓일수록 반드시 샌다.

이 린트는 발행 직전에 글 본문을 열어 **오표기 문자열이 실제로 있는지 결정론으로** 본다.
판단도 요약도 없다 — 있으면 있다고, 없으면 없다고만 한다.

무엇을 보나
-----------
  1. 그 글의 **게임 판정**: 경로(`<작성자>/<게임>/<주제>/` · 평면 저장도 커버)를
     `_glossary/_aliases.json` 별칭 색인으로 정규화한다. 게임을 못 정하면 «건너뜀»으로 정직히 보고한다.
  2. 그 게임 용어집의 `흔한 오표기` 열 → 본문에 있으면 🔴.
  3. 전 게임 공통 패턴(`_COMMON`) → 「N성」·「N티어」처럼 게임 불문 자주 틀리는 표기.
     ★단 **오탐이 나기 쉬운 자리는 코드로 뺀다** — 인용부호 안, 「흔한 오표기」를 설명하는 문장,
       HTML 속성값·URL·클래스명. 늑대 소년이 되면 아무도 안 본다.

무엇을 «못» 하나 — 정직하게
---------------------------
  · **한국어 맞춤법 검사가 아니다.** 외부 검사기(부산대·네이버)는 본문을 남의 서버로 보내야 해서
    쓰지 않는다. 이 린트는 «우리가 실제로 틀렸던 것»만 잡는 재발 방지 장치다.
  · 오표기 열에 없는 새 오타는 못 잡는다 → 검수에서 잡히면 **용어집 오표기 열에 한 줄 추가**하는 게
    이 도구를 강하게 만드는 유일한 방법이다(그래서 실패 메시지가 그 경로를 안내한다).

쓰는 법
-------
  python glossary-lint.py <글 HTML 경로> [...]     # 파일 지정
  python glossary-lint.py --all                     # BlogPreview 전 발행글(역전파 점검용)
  python glossary-lint.py --game 롤토체스 <경로>     # 게임 강제 지정
  python glossary-lint.py --json                    # 기계 출력
종료코드: 0 = 위반 없음 · 1 = 위반 있음(발행 게이트에서 막는 용도) · 2 = 실행 오류
"""
import sys, os, re, json, glob

ROOT      = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))     # BlogPreview
CLAUDE    = os.path.dirname(ROOT)                                              # Desktop\Claude
GLOSSARY  = os.path.join(CLAUDE, '_glossary')
ALIASES   = os.path.join(GLOSSARY, '_aliases.json')

# 게임 불문 공통 오표기. 용어집에 게임별로 또 적을 필요가 없는 것만 둔다.
# (근거: 08-28 「5성→5단계/코스트」 교훈, 롤토체스 용어집 「5티어」 행)
_COMMON = [
    (r'\b([1-5])\s*티어\s*(유닛|챔피언|카드)', '{0}단계 / {0}코스트', '롤토체스는 «단계»·«코스트»가 공식 표기다'),
]

def load_aliases():
    if not os.path.exists(ALIASES):
        return []
    with open(ALIASES, encoding='utf-8') as f:
        return json.load(f).get('games', [])

def norm(s):
    return re.sub(r'[\s()_\-:]', '', str(s)).lower()

def game_of(path, games, forced=None):
    """경로에서 게임을 정한다. 정규 `<작성자>/<게임>/<주제>` 도, 09-04 평면 저장도 커버한다."""
    if forced:
        for g in games:
            if norm(forced) == norm(g['canon']) or any(norm(forced) == norm(a) for a in g['aliases']):
                return g
        return None
    parts = [p for p in os.path.abspath(path).replace('\\', '/').split('/') if p]
    cand = set()
    for p in parts:
        cand.add(norm(p))
    joined = norm('/'.join(parts))
    for g in games:
        names = [g['canon']] + list(g.get('aliases', [])) + list(g.get('folders', []))
        for n in names:
            nn = norm(n)
            if not nn:
                continue
            if nn in cand:
                return g
            # 평면 저장: 폴더명이 `롤토체스 싸움꾼 마스터 이` 처럼 게임명으로 «시작» 한다
            if len(nn) >= 4 and any(c.startswith(nn) for c in cand):
                return g
            if len(nn) >= 6 and nn in joined:
                return g
    return None

def parse_glossary(fname):
    """
    «흔한 오표기» 쌍을 뽑는다.

    ★열 위치를 숫자로 박지 않는다(2026-09-05 첫 구현이 이걸로 13/13 전부 오탐을 냈다).
      용어집에는 표가 여럿이다 — `## 소스맵`(소스·URL·신뢰등급·무엇을) · `## 명칭`(분류·공식표기·
      영문·흔한오표기·근거·확인일) · `## 사실`. 4번째 열을 무조건 «오표기»로 읽으면 소스맵의
      «무엇을» 열(챔피언·특성·아이템…)을 오표기로 착각해 멀쩡한 글을 전부 빨갛게 만든다.
    그래서 ⑴`## 명칭` 절 안의 표만 보고 ⑵헤더 행에서 «흔한 오표기»·«공식 표기» 열의
      **위치를 직접 찾아** 쓴다. 표 구조가 바뀌어도 헤더만 맞으면 따라간다.
    """
    p = os.path.join(GLOSSARY, fname)
    if not os.path.exists(p):
        return []
    rows, in_terms, wi, oi = [], False, None, None
    with open(p, encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if s.startswith('#'):
                in_terms = ('명칭' in s)      # `## 명칭 (canonical terms)` 절에서만 켠다
                wi = oi = None
                continue
            if not in_terms or not s.startswith('|'):
                continue
            cols = [c.strip() for c in s.strip('|').split('|')]
            if wi is None:                     # 헤더 행에서 열 위치를 찾는다
                for i, c in enumerate(cols):
                    if '오표기' in c:
                        wi = i
                    if '공식' in c and '표기' in c:
                        oi = i
                if wi is None:
                    wi = oi = None             # 헤더가 아니면 계속 찾는다
                continue
            if len(cols) <= wi or set(''.join(cols)) <= set('-: |'):
                continue
            wrong = cols[wi]
            official = cols[oi] if (oi is not None and len(cols) > oi) else '(용어집 참조)'
            if not wrong or wrong in ('-', '—', '흔한 오표기'):
                continue
            # ★«오표기» 열은 순수한 오표기만 들어 있지 않다 — 산문 주석이 섞인다.
            #   `쿠키런 크럼블(약칭은 본문 허용)` 은 **허용**한다는 뜻이라 잡으면 오탐이고,
            #   `B 티어와 혼동 금지(...)` 는 검수자에게 주는 메모지 문자열 규칙이 아니다.
            #   → 허용·주의류가 섞인 칸은 통째로 건너뛰고, 괄호 주석은 떼고 본다.
            if re.search(r'(허용|가능|무방|금지|주의|혼동|참고|없음|뭉뚱|병기|—)', wrong):
                continue
            wrong = re.sub(r'\([^)]*\)', ' ', wrong)     # 괄호 주석 제거
            for w in re.split(r'[·,/]', wrong):
                w = w.strip()
                if len(w) >= 2 and w not in ('-', '—'):
                    rows.append((w, official))
    return rows

def nz(s):
    """공백·문장부호·대소문자를 지운 비교용 형태."""
    return re.sub(r'[\s\-_:·,.()\[\]/]', '', str(s)).lower()

def severity(wrong, official):
    """
    «오표기»를 두 종류로 자동 분류한다 (2026-09-05 신설).

    용어집 오표기 열에는 성격이 다른 둘이 섞여 있다 —
      🔴 **틀린 정보**: 독자를 오도한다. `타이란티어`(다른 포켓몬) · `신비한 숲`(없는 세트명) ·
         `스태프`(공식은 지팡이) · `해저 평정산`(없는 지명). 이건 발행을 막아야 한다.
      🟡 **표기 흔들림**: 띄어쓰기·약칭이라 뜻이 안 바뀐다. `AP초기화권`(공식 `AP 초기화권`) ·
         `제노니아1`(용어집 스스로 «SEO용 관용 표기»라고 적어 둔 것).
         **제목 붙여쓰기는 검색 유입 쪽 판단이라 코드가 막을 일이 아니다.**

    첫 구현이 둘을 똑같이 🔴로 막았고, 실제로 걸린 2건이 전부 후자였다(사용자 지적).
    ⇒ 판별은 **정규화 후 포함 관계**로 한다 — 공백·부호만 다르거나 정식명의 앞부분이면 흔들림.
       실측(2026-09-05, 규칙 34건): 🟡 2 · 🔴 32 로 정확히 갈렸다.
    ★용어집 25행을 손으로 고치지 않는 이유 = 앞으로 늘 규칙도 자동으로 분류돼야 하고,
      기록(「이건 오표기다」)은 남기되 **집행 강도만** 달라야 하기 때문이다.
    """
    w, o = nz(wrong), nz(official)
    if w == o:
        return 'soft'
    if len(w) >= 3 and o.startswith(w):
        return 'soft'
    if len(w) >= 4 and w in o:
        return 'soft'
    return 'hard'

def visible_text(html):
    """검사 대상 본문만 남긴다 — 태그·속성·URL·스크립트는 오탐의 원천이라 통째로 뺀다."""
    t = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', html)
    t = re.sub(r'(?s)<!--.*?-->', ' ', t)
    t = re.sub(r'(?s)<[^>]+>', ' ', t)          # 속성값(class·href·alt)까지 함께 사라진다
    t = re.sub(r'&[a-zA-Z#0-9]+;', ' ', t)
    return re.sub(r'\s+', ' ', t)

# «오표기» 자체를 설명하는 문장은 위반이 아니다 — 오히려 잘 쓴 글이다.
# ★실측으로 넓혔다(2026-09-05): 첫 규칙은 4건 중 2건을 오탐으로 냈다.
#   ⓐ 킹덤2 «정식 명칭은 '지팡이'고 흔히들 헷갈리는 '스태프'라는 표기는 공식 사이트 어디에도 없으니»
#   ⓑ 타임 테이커즈 «엔씨(NC, 구 엔씨소프트)» — 옛 이름임을 스스로 밝힌 정상 표기
#   둘 다 «틀린 표기를 틀렸다고 말하는» 문장이라 잡으면 안 된다.
_EXCUSE = re.compile(
    r'(오표기|잘못된 표기|틀린 표기|아님|아니라|가 아니라|→|⇒'
    r'|헷갈리|혼동|공식 명칭은|정식 명칭은|공식 표기는|어디에도 없|라는 표기|이라고도)')
# 바로 앞에 «구/옛/전» 이 붙으면 옛 이름을 명시한 것이다(`구 엔씨소프트`).
_FORMER = re.compile(r'(구|옛|이전|전)\s*[,(]?\s*$')

def check_file(path, games, forced=None):
    with open(path, encoding='utf-8', errors='replace') as f:
        html = f.read()
    text = visible_text(html)
    g = game_of(path, games, forced)
    out = {'file': os.path.relpath(path, ROOT), 'game': g['canon'] if g else None, 'hits': []}
    if not g:
        out['skipped'] = '게임 판정 실패 — _aliases.json 에 이 폴더명을 추가하면 검사된다'
        return out
    if not g.get('glossary'):
        out['skipped'] = '용어집 없음(%s)' % g['canon']
        return out

    for wrong, official in parse_glossary(g['glossary']):
        for m in re.finditer(re.escape(wrong), text):
            ctx = text[max(0, m.start() - 45):m.start() + len(wrong) + 45]
            if _EXCUSE.search(ctx) or _FORMER.search(text[max(0, m.start() - 12):m.start()]):
                continue        # "신비한 숲(오표기) → 신비의 숲" 같은 설명·옛이름 병기는 통과
            out['hits'].append({'kind': '용어집', 'sev': severity(wrong, official), 'wrong': wrong, 'official': official, 'ctx': ctx.strip()})
            break               # 같은 오표기는 한 번만 보고한다(한 줄이면 충분)
    for pat, fix, why in _COMMON:
        for m in re.finditer(pat, text):
            ctx = text[max(0, m.start() - 45):m.end() + 45]
            if _EXCUSE.search(ctx):
                continue
            out['hits'].append({'kind': '공통', 'sev': 'hard', 'wrong': m.group(0), 'official': fix.format(*m.groups()), 'ctx': ctx.strip(), 'why': why})
            break
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    as_json = '--json' in sys.argv
    forced = None
    if '--game' in sys.argv:
        i = sys.argv.index('--game')
        if i + 1 < len(sys.argv):
            forced = sys.argv[i + 1]
            if forced in args:
                args.remove(forced)

    games = load_aliases()
    if not games:
        print('[glossary-lint] ⚠ _aliases.json 이 없거나 비었다 — 검사를 못 한다: %s' % ALIASES)
        return 2

    if '--all' in sys.argv or not args:
        targets = [p for p in glob.glob(os.path.join(ROOT, '*', '**', '*.html'), recursive=True)
                   if '_qa' not in p.replace('\\', '/').split('/') and '/_' not in p.replace('\\', '/')]
    else:
        targets = args

    results = [check_file(p, games, forced) for p in targets if os.path.isfile(p)]
    # 🔴 틀린 정보만 발행을 막는다. 🟡 표기 흔들림(띄어쓰기·약칭)은 알리되 막지 않는다 — severity() 주석 참조.
    hard = [r for r in results if any(h.get('sev') != 'soft' for h in r['hits'])]
    soft = [r for r in results if r['hits'] and r not in hard]
    skipped = [r for r in results if r.get('skipped')]

    if as_json:
        print(json.dumps({'checked': len(results), 'blocking': len(hard), 'warnings': len(soft),
                          'results': results}, ensure_ascii=False, indent=2))
        return 1 if hard else 0

    print('[glossary-lint] 검사 %d개 · 🔴차단 %d개 · 🟡경고 %d개 · 대상 아님 %d개(용어집 없는 게임 또는 경로에서 게임 판정 불가 — --verbose 로 목록)'
          % (len(results), len(hard), len(soft), len(skipped)))
    for r in hard:
        print('\n🔴 %s  (게임: %s)' % (r['file'], r['game']))
        for h in r['hits']:
            if h.get('sev') == 'soft':
                continue
            print('   [%s] «%s» → «%s»' % (h['kind'], h['wrong'], h['official']))
            print('        …%s…' % h['ctx'][:150])
            if h.get('why'):
                print('        %s' % h['why'])
    for r in soft:
        print('\n🟡 %s  (게임: %s) — 표기 흔들림, 발행은 막지 않는다' % (r['file'], r['game']))
        for h in r['hits']:
            print('   «%s» → 공식은 «%s» (띄어쓰기·약칭 차이라 뜻은 같다 — 제목 표기는 검색 유입 판단)' % (h['wrong'], h['official']))
    if skipped and ('--verbose' in sys.argv):
        print('\n건너뜀:')
        for r in skipped:
            print('   - %s : %s' % (r['file'], r['skipped']))
    if hard:
        print('\n※ 새 오타를 여기서 잡고 싶으면 `_glossary/<게임>.md` 명칭 표의 «흔한 오표기» 열에 한 줄 추가한다.')
        print('  이 린트는 맞춤법 검사기가 아니라 «우리가 실제로 틀렸던 것»의 재발 방지 장치다.')
    return 1 if hard else 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        print('[glossary-lint] 실행 오류: %s' % e)
        sys.exit(2)
