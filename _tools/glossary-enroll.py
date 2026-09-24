#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
glossary-enroll.py — 글이 쌓인 게임을 «별칭 색인»에 자동 등재하고 «빈 용어집 헤더»를 만든다
(2026-09-23 신설 · 전수조사 C#1 «용어 검증의 근거 원천이 글의 55%에서 없다» · A#4 «용어집 커버리지 갭»)

왜 만들었나
-----------
`_glossary/_aliases.json` 에 없는 게임은 qa-fact 가 매 글 즉석 조사하고, `glossary-lint.py` 는
«게임 판정 실패»로 건너뛴다(최근 127편 중 48편 = 38%). 규칙(«새 게임을 쓰기 시작하면 여기 한 줄을 먼저
추가한다»)은 있었지만 **주체가 없어** 2주 76편에 5~6개만 생겼다. 이 도구는 posts.json 이라는 «이미 있는
사실»에서 조건을 기계로 판정한다 — LLM 0.

무엇을 하나
-----------
  ⑴ posts.json(작성자·경로)에서 글 폴더 규약 `<작성자>/<게임 폴더>/<주제>/<파일>.html` 로 게임 폴더별 글 수를 센다.
     현역 작성자(봄딩·영도)만 — 휴면 3인(겜더쿠·연봄·하루살이) 폴더는 세지 않는다(2026-09-02 휴면).
  ⑵ 글 ≥ N편(기본 2)인데 `_aliases.json` 의 canon·aliases·folders 어느 것으로도 해석되지 않는 게임 →
     별칭 항목 추가(canon=폴더명 · folders=[폴더명] · aliases=[] · glossary=`<폴더명>.md`) +
     `_glossary/<폴더명>.md` 가 없으면 **빈 용어집 헤더**만 생성(qa-fact 가 첫 검수 때 확정 명칭을 append).
  ⑶ 색인이 가리키는 파일이 없는 항목(예: 애프터러브EP.md)은 빈 헤더 파일을 만들어 해소한다.
     `glossary: null` 항목은 글 ≥ N편일 때만 파일을 만들고 색인을 갱신한다(아니면 보고만).
  ⑷ 오판 방지 — 기존 별칭을 **먼저** 적용하고, 같은 게임의 다른 폴더명(정규화가 같음: «솔인챈트»·«솔 인챈트»)은
     한 항목으로 병합한다. 새 canon 이 기존 canon·별칭의 «부분 문자열»이거나 그 반대(«마비노기» ↔
     «마비노기 이터니티»)면 별칭일 가능성이 있으므로 **«후보(사람 확인)»으로만 출력하고 만들지 않는다.**
  ⑸ 게임이 아닌 폴더(게이밍기어 레인·육아·취미·AI 도구)는 posts.json 의 `cat` 로 걸러 건너뛴다.

★정본을 쓰는 도구라 **기본은 dry-run**(계획표만) — `--apply` 로만 쓴다. 실행 전후 계수(별칭 수·용어집 파일 수·
  없는 파일 수)를 찍는다. 기존 파일은 절대 덮어쓰지 않는다(파일이 있으면 색인만 잇는다).

쓰는 법
-------
  python glossary-enroll.py                 # dry-run: 계획표
  python glossary-enroll.py --apply         # 적용
  python glossary-enroll.py --json          # 기계 출력(daily-refresh.cjs «용어집 갭» 절이 매일 부른다 — 생성은 안 함)
  옵션: --min-posts 2 · --authors 봄딩,영도 · --days 60(60일 계수 열 기준 · 판정엔 안 씀)
종료코드: 0 정상 · 2 실행 오류
"""
import sys, os, re, io, json, argparse, datetime, collections

for _s in ('stdout', 'stderr'):
    try:
        getattr(sys, _s).reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT     = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))     # BlogPreview
CLAUDE   = os.path.dirname(ROOT)                                              # Desktop\Claude
GLOSSARY = os.path.join(CLAUDE, '_glossary')
ALIASES  = os.path.join(GLOSSARY, '_aliases.json')
POSTS    = os.path.join(ROOT, 'posts.json')
TODAY    = datetime.date.today().isoformat()

ACTIVE_AUTHORS = ('봄딩', '영도')
# 게임 레인 판정 — posts.json `cat` 문자열. 비게임 레인 단어가 있으면 비게임, 게임 단어가 있으면 게임, 둘 다 없으면 미상.
NON_GAME_CAT = re.compile(r'(게이밍\s*기어|육아|취미|임신|출산|\bIT\b|내돈내산)')
GAME_CAT     = re.compile(r'(게임|공략|업데이트|패치|쿠폰)')


def norm(s):
    """glossary-lint.py 와 같은 정규화 — 공백·괄호·구분자를 지우고 소문자."""
    return re.sub(r'[\s()_\-:]', '', str(s)).lower()


def safe_name(canon):
    """파일명에 못 쓰는 문자만 `_`(glossary-format.md 규칙)."""
    return re.sub(r'[\\/:*?"<>|]', '_', canon).strip()


def load_json(p):
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def empty_glossary(canon, folders, n_posts):
    """빈 용어집 헤더 — glossary-format.md 템플릿 + 최근 실물(이환.md·카오스 제로 나이트메어.md)의 헤더 줄을 따른다.
    daily-refresh.cjs 신선도 검사는 `버전민감: 예` 만 세므로 «미정»은 신선도 🔴 대상이 아니다(qa-fact 가 확정)."""
    fl = ' · '.join('`%s/`' % f for f in folders)
    return (
        '# %s 용어집\n'
        '마지막 갱신: %s\n'
        '버전민감: 미정 (qa-fact 가 첫 검수 때 «예/아니오»와 사유를 확정한다)\n'
        '개발사: (미확인) / 퍼블리셔: (미확인)\n'
        '공식 사이트: (미확인)\n'
        '\n'
        '> (자동 생성 %s · qa-fact 가 확정 명칭을 append 한다) — glossary-enroll.py 가 글 %d편 실측으로 등재. 글 폴더 %s\n'
        '\n'
        '---\n'
        '\n'
        '## 소스맵\n'
        '\n'
        '| 소스 | URL | 접근법 | 신뢰등급 | 무엇을 | 최종확인일 |\n'
        '|------|-----|--------|---------|--------|-----------|\n'
        '\n'
        '## 명칭 (canonical terms)\n'
        '| 분류 | 공식 표기(정본) | 영문/원문 | 흔한 오표기 | 근거 URL | 확인일 |\n'
        '|------|----------------|-----------|-------------|----------|--------|\n'
        '\n'
        '## 사실 (verified facts)\n'
        '| 항목 | 값 | 근거 URL | 확인일 | 비고 |\n'
        '|------|----|----------|--------|------|\n'
        '\n'
        '## 미확정/확인 필요 (provisional)\n'
        '- (없음)\n'
    ) % (canon, TODAY, TODAY, n_posts, fl)


def count_posts(posts, authors, days):
    """폴더별 글 수. 반환: {folder: {'n':전체, 'n60':기간내, 'game':게임글수, 'nongame':비게임글수, 'authors':set}}.
    평면 저장(`<작성자>/<폴더>/<파일>` 3단)은 게임 폴더가 아니라 건너뛰고 따로 센다."""
    today = datetime.date.fromisoformat(TODAY)
    st = collections.defaultdict(lambda: {'n': 0, 'n60': 0, 'game': 0, 'nongame': 0, 'authors': set()})
    flat = []
    for p in posts:
        a = p.get('author')
        if a not in authors:
            continue
        parts = [x for x in str(p.get('rel', '')).split('/') if x]
        if len(parts) < 4:
            flat.append(p.get('rel'))
            continue
        folder = parts[1]
        s = st[folder]
        s['n'] += 1
        s['authors'].add(a)
        cat = str(p.get('cat') or '')
        if NON_GAME_CAT.search(cat):
            s['nongame'] += 1
        elif GAME_CAT.search(cat):
            s['game'] += 1
        try:
            d = datetime.date.fromisoformat(str(p.get('created', ''))[:10])
            if (today - d).days <= days:
                s['n60'] += 1
        except Exception:
            pass
    return st, flat


def name_table(games):
    """기존 색인의 모든 이름(정규화) → canon."""
    out = []
    for g in games:
        for n in [g.get('canon', '')] + list(g.get('aliases') or []) + list(g.get('folders') or []):
            nn = norm(n)
            if nn:
                out.append((nn, g['canon']))
    return out


def plan(args):
    al = load_json(ALIASES)
    games = al.get('games', [])
    posts = load_json(POSTS)
    stats, flat = count_posts(posts, tuple(args.authors), args.days)
    names = name_table(games)
    exact = {nn: c for nn, c in names}

    before = {
        'aliases': len(games),
        'files': len([f for f in os.listdir(GLOSSARY) if f.endswith('.md')]) if os.path.isdir(GLOSSARY) else 0,
        'missing': [g['canon'] for g in games if g.get('glossary') and not os.path.exists(os.path.join(GLOSSARY, g['glossary']))],
        'null': [g['canon'] for g in games if not g.get('glossary')],
    }

    # ⑴ 해석 안 되는 게임 폴더 → 정규화 키로 병합
    groups = collections.OrderedDict()          # norm -> [folder,...]
    skipped_nongame, skipped_few = [], []
    for folder, s in sorted(stats.items(), key=lambda kv: (-kv[1]['n'], kv[0])):
        if norm(folder) in exact:
            continue                             # 이미 색인이 안다
        if s['n'] < args.min_posts:
            skipped_few.append(folder)
            continue
        if not (s['game'] >= 1 and s['game'] >= s['nongame']):
            skipped_nongame.append((folder, s['n'], s['game'], s['nongame']))
            continue
        groups.setdefault(norm(folder), []).append(folder)

    # 글 수로 canon 선택(가장 많은 폴더명 · 동률이면 띄어쓰기 있는 쪽 = 검색·표기 관례)
    cands = []
    for key, folders in groups.items():
        folders = sorted(folders, key=lambda f: (-stats[f]['n'], -len(f)))
        canon = folders[0]
        n = sum(stats[f]['n'] for f in folders)
        n60 = sum(stats[f]['n60'] for f in folders)
        authors = sorted(set().union(*[stats[f]['authors'] for f in folders]))
        cands.append({'key': key, 'canon': canon, 'folders': folders, 'n': n, 'n60': n60, 'authors': authors})

    # ⑷ 별칭일 가능성 — 기존 이름 또는 다른 후보와 «부분 문자열» 관계면 사람 확인
    existing_norms = [nn for nn, _ in names]
    cand_norms = [c['key'] for c in cands]
    enroll, review = [], []
    for c in cands:
        k = c['key']
        why = []
        for nn in existing_norms:
            if nn != k and len(min(nn, k, key=len)) >= 2 and (k in nn or nn in k):
                why.append('기존 «%s» 와 부분 일치' % exact.get(nn, nn))
        for other in cand_norms:
            if other != k and k in other:        # 내가 다른 후보의 접두·부분이면 나만 보류(긴 쪽은 구체적이라 등재)
                why.append('다른 후보 «%s» 의 부분' % other)
        if why:
            c['why'] = sorted(set(why))
            review.append(c)
        else:
            enroll.append(c)

    # 파일 유무 → 조치
    for c in enroll:
        fn = safe_name(c['canon']) + '.md'
        c['glossary'] = fn
        c['file_exists'] = os.path.exists(os.path.join(GLOSSARY, fn))
        c['action'] = '별칭 추가' + ('' if c['file_exists'] else ' + 빈 용어집 생성')

    # ⑶ 없는 파일 / null
    fix_missing = []
    for g in games:
        fn = g.get('glossary')
        canon = g['canon']
        n_posts = sum(s['n'] for f, s in stats.items() if norm(f) == norm(canon) or norm(f) in [norm(x) for x in (g.get('folders') or []) + (g.get('aliases') or [])])
        if fn and not os.path.exists(os.path.join(GLOSSARY, fn)):
            fix_missing.append({'canon': canon, 'glossary': fn, 'n': n_posts, 'kind': '없는 파일'})
        elif not fn and n_posts >= args.min_posts:
            fix_missing.append({'canon': canon, 'glossary': safe_name(canon) + '.md', 'n': n_posts, 'kind': 'glossary null'})

    after = {
        'aliases': before['aliases'] + len(enroll),
        'files': before['files'] + len([c for c in enroll if not c['file_exists']]) + len(fix_missing),
        'missing': 0,
        'null': [c for c in before['null'] if c not in [m['canon'] for m in fix_missing]],
    }
    return {
        'today': TODAY, 'before': before, 'after': after,
        'enroll': enroll, 'review': review, 'fix_missing': fix_missing,
        'skipped_nongame': skipped_nongame, 'skipped_few': skipped_few, 'flat': flat,
        'null_untouched': [g['canon'] for g in games if not g.get('glossary') and g['canon'] not in [m['canon'] for m in fix_missing]],
    }


def apply(p):
    al = load_json(ALIASES)
    raw = io.open(ALIASES, encoding='utf-8').read()
    games = al['games']
    made = []
    # 새 항목
    for c in p['enroll']:
        entry = collections.OrderedDict()
        entry['canon'] = c['canon']
        entry['glossary'] = c['glossary']
        entry['aliases'] = [f for f in c['folders'] if f != c['canon']]
        entry['folders'] = list(c['folders'])
        entry['note'] = ('%s glossary-enroll.py 자동 등재(봄딩·영도 글 %d편 실측%s) — %s. qa-fact 가 첫 검수 때 명칭·사실을 채운다.'
                         % (TODAY, c['n'], '·작성자 ' + '/'.join(c['authors']) if c['authors'] else '',
                            '기존 용어집에 연결' if c['file_exists'] else '빈 용어집 헤더 생성'))
        games.append(entry)
        fp = os.path.join(GLOSSARY, c['glossary'])
        if not os.path.exists(fp):
            io.open(fp, 'w', encoding='utf-8', newline='').write(empty_glossary(c['canon'], c['folders'], c['n']))
            made.append(c['glossary'])
    # 없는 파일 · null
    for m in p['fix_missing']:
        fp = os.path.join(GLOSSARY, m['glossary'])
        if not os.path.exists(fp):
            g = next(x for x in games if x['canon'] == m['canon'])
            io.open(fp, 'w', encoding='utf-8', newline='').write(empty_glossary(m['canon'], g.get('folders') or [m['canon']], m['n']))
            made.append(m['glossary'])
        if m['kind'] == 'glossary null':
            g = next(x for x in games if x['canon'] == m['canon'])
            g['glossary'] = m['glossary']
    al['updated'] = TODAY
    out = json.dumps(al, ensure_ascii=False, indent=2)
    if raw.endswith('\n') and not out.endswith('\n'):
        out += '\n'
    io.open(ALIASES, 'w', encoding='utf-8', newline='').write(out)
    return made


def fmt_row(cols):
    return '| ' + ' | '.join(str(c) for c in cols) + ' |'


def report(p, applied=None):
    b, a = p['before'], p['after']
    L = []
    L.append('[glossary-enroll] %s — %s' % (p['today'], '적용 완료' if applied is not None else 'dry-run(계획만 · --apply 로 실행)'))
    L.append('전: 별칭 항목 %d · 용어집 파일 %d · 색인이 가리키는 없는 파일 %d(%s) · glossary null %d(%s)'
             % (b['aliases'], b['files'], len(b['missing']), ', '.join(b['missing']) or '-', len(b['null']), ', '.join(b['null']) or '-'))
    L.append('')
    L.append('== ⑴ 등재(별칭 추가 + 용어집) %d건' % len(p['enroll']))
    if p['enroll']:
        L.append(fmt_row(['canon', 'folders', '글(전체/최근)', '작성자', '용어집 파일', '조치']))
        L.append(fmt_row(['---'] * 6))
        for c in p['enroll']:
            L.append(fmt_row([c['canon'], ' · '.join(c['folders']), '%d/%d' % (c['n'], c['n60']), '/'.join(c['authors']),
                              c['glossary'] + ('(있음)' if c['file_exists'] else '(신규)'), c['action']]))
    L.append('')
    L.append('== ⑶ 없는 파일·null 해소 %d건' % len(p['fix_missing']))
    for m in p['fix_missing']:
        L.append('   - %s → %s 생성 (%s · 글 %d편)' % (m['canon'], m['glossary'], m['kind'], m['n']))
    if p['null_untouched']:
        L.append('   - glossary null 유지(글 부족): %s' % ', '.join(p['null_untouched']))
    L.append('')
    L.append('== ⑷ 후보(사람 확인) %d건 — 만들지 않음' % len(p['review']))
    for c in p['review']:
        L.append('   - «%s» folders=%s 글 %d/%d — %s' % (c['canon'], ' · '.join(c['folders']), c['n'], c['n60'], ' / '.join(c['why'])))
    L.append('')
    L.append('== 건너뜀: 비게임 폴더 %d(%s) · 글 <%d편 %d · 평면 저장 %d'
             % (len(p['skipped_nongame']), ', '.join('%s(%d)' % (f, n) for f, n, _, _ in p['skipped_nongame']) or '-',
                2, len(p['skipped_few']), len(p['flat'])))
    L.append('')
    if applied is not None:
        files = len([f for f in os.listdir(GLOSSARY) if f.endswith('.md')])
        al = load_json(ALIASES)['games']
        missing = [g['canon'] for g in al if g.get('glossary') and not os.path.exists(os.path.join(GLOSSARY, g['glossary']))]
        nulls = [g['canon'] for g in al if not g.get('glossary')]
        L.append('후(실측): 별칭 항목 %d · 용어집 파일 %d · 없는 파일 %d · glossary null %d(%s) · 새 파일 %d개: %s'
                 % (len(al), files, len(missing), len(nulls), ', '.join(nulls) or '-', len(applied), ', '.join(applied) or '-'))
    else:
        L.append('후(예상): 별칭 항목 %d · 용어집 파일 %d · 없는 파일 %d · glossary null %d' % (a['aliases'], a['files'], a['missing'], len(a['null'])))
    return '\n'.join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='실제로 색인·파일을 쓴다(기본은 dry-run)')
    ap.add_argument('--json', action='store_true', help='계획을 JSON 으로(daily-refresh.cjs 용)')
    ap.add_argument('--min-posts', type=int, default=2)
    ap.add_argument('--days', type=int, default=60, help='«최근» 계수 열의 기간(판정엔 쓰지 않는다)')
    ap.add_argument('--authors', default=','.join(ACTIVE_AUTHORS))
    a = ap.parse_args()
    a.authors = [x.strip() for x in a.authors.split(',') if x.strip()]
    if not os.path.exists(ALIASES) or not os.path.exists(POSTS):
        print('[glossary-enroll] 입력이 없다: %s / %s' % (ALIASES, POSTS))
        return 2
    p = plan(a)
    if a.json:
        q = {k: v for k, v in p.items() if k != 'flat'}
        q['flat'] = len(p['flat'])
        print(json.dumps(q, ensure_ascii=False, indent=1, default=list))
        return 0
    if a.apply:
        made = apply(p)
        print(report(p, applied=made))
    else:
        print(report(p))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        print('[glossary-enroll] 실행 오류: %s' % e)
        sys.exit(2)
