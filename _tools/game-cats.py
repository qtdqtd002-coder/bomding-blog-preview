#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
game-cats.py — 봄딩 «새 글을 어느 네이버 카테고리에 넣나» 안내표 (2026-10-25 결정서 9번 «안내만» · ★2026-11-01 운영 전략 §9 개정 · LLM 0)

무엇: 봄딩이 글을 올리는 순간(붙여넣기 서랍·사이트 카드)에 셋 중 하나를 알려 준다.
  exists  — 이 게임 전용 카테고리가 이미 있다 → 그 카테고리에 넣는다.
  new     — 전용 카테고리가 없는데 최근 90일 글(사이트 초안 + 라이브)이 임계(NEW_MIN) 이상 → «카테고리 신설 필요» 를 알린다. 신설·기존 글 이동은 봄딩 판단.
  generic — 전용 카테고리가 없고 글도 적다 → 범용 칸(공략·방법형=플레이·공략 / 소식형=신작·업데이트 / 오프라인·굿즈=게임 테마).
  기존 글은 다시 분류하지 않는다(사용자 11-01) — 이 표는 «앞으로 낼 글»만 본다.

어떻게 «있다» 를 아나: ① 봄딩 블로그 공개 카테고리 트리(m.blog.naver.com/api/blogs/bomding/category-list · 하루 1회 · 실패하면 직전 산출의 트리 재사용)
  ② 라이브 글의 게임별 최다 카테고리가 전용 칸이면 그것(포켓몬 GO→«포켓몬고», 메이플플래닛→«메이플랜드» 같은 봄딩의 실제 관행이 여기서 잡힌다)
  ③ 이름 정규화 일치(공백·기호 제거). 게임 이름은 사이트 폴더명(posts.json group)·라이브 원장(g)·카테고리명이 서로 조금씩 달라 전부 정규화해서 맞춘다.

출력 _trend/_game-cats.json
  games   {<라이브 게임명>: {cat, n, total, alt}}            — 옛 형식 그대로(사이트 카드 ncHtml 호환)
  groups  {<사이트 폴더명(정규화 전 원문)>: {cat, status, n90, why}}  — 봄딩 최근 180일 폴더 전부
  byPost  {<rel>: {cat, status, angle}}                      — 봄딩 최근 60일 초안(generic 은 제목 각도로 칸을 정한다 · 그 전 글은 groups 폴백)
  tree    {fetchedAt, ok, cats:[{name, no, parent, postCnt}]}
  fallback {howto, news}                                     — 옛 필드 유지
사용 python _tools/game-cats.py [--print] [--offline]   (데스크 [E] 가 하루 1회)
★Windows: stdout UTF-8 고정. 네트워크는 카테고리 트리 1회(8초 타임아웃)뿐.
"""
import io, os, sys, re, json, datetime, collections, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
OUT = os.path.join(T, '_game-cats.json')
MIN_N = 2          # 옛 games 표: 게임별 최다 카테고리를 적는 최소 편수
NEW_MIN = 5        # 90일 글(초안+라이브)이 이 수 이상인데 전용 카테고리가 없으면 «신설 필요»
GENERIC = {'신작·업데이트', '플레이·공략', '게임 테마', '게임공략', '게임정보', '*공지', '*이벤트', '육아일상', 'IT 일상 정보', '애니', '노래', '게임', '게임일지'}
HOWTO = {'공략·방법형', '쿠폰형', '추천·티어·비교형', '정리·모음형'}
TREE_URL = 'https://m.blog.naver.com/api/blogs/bomding/category-list'
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
# 제목 각도 — _tools/live-ledger.cjs LADDER 와 같은 순서·같은 정규식(첫 일치가 각도)
LADDER = [
    ('공략·방법형', re.compile(r'하는 ?법|방법|공략|(?<!스)위치|얻는 ?법|만드는 ?법|세팅|스킬트리|조합|루트|파밍|재료|퀘스트|보는 ?법|설정|설치|사용법|치트|명령어|염색코드|코디|기댓값|확률|빌드|덱|특성|상성|카운터|강화|각성|승급|재련|우선순위|효율|드랍|주간|일일|보상|스펙|스탯|육성')),
    ('쿠폰형', re.compile(r'쿠폰|코드')),
    ('추천·티어·비교형', re.compile(r'티어|추천|순위|BEST|TOP|비교|뭐가 다를|차이', re.I)),
    ('후기·리뷰형', re.compile(r'후기|리뷰|사용기|써본|첫인상')),
    ('뉴스·소식형', re.compile(r'출시|사전예약|사전 예약|발표|공개|업데이트|패치|콜라보|이벤트|일정|중단|확정|출시일|정식|소식|근황|생중계|응모')),
    ('정리·모음형', re.compile(r'총정리|정리|가이드|모음|링크|사이트')),
]
THEME_RE = re.compile(r'방탈출|팝업|굿즈|카페|전시|블리즈컨|행사|오프라인|페스티벌|지스타|콘서트')


def norm(s):
    return re.sub(r'[\s·\-_:：!！.,/()\[\]「」«»]+', '', (s or '')).lower()


def angle(title):
    for name, rx in LADDER:
        if rx.search(title or ''):
            return name
    return '기타'


def fetch_tree(prev):
    if '--offline' not in sys.argv:
        try:
            req = urllib.request.Request(TREE_URL, headers={'User-Agent': UA, 'Referer': 'https://m.blog.naver.com/bomding', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=8) as r:
                j = json.loads(r.read().decode('utf-8'))
            lst = j.get('result', {}).get('mylogCategoryList') or []
            cats = [{'name': c['categoryName'], 'no': c['categoryNo'], 'parent': c.get('parentCategoryNo'), 'postCnt': c.get('postCnt', 0)}
                    for c in lst if not c.get('divisionLine')]
            if cats:
                return {'fetchedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'ok': True, 'cats': cats}
        except Exception as e:  # 네트워크·형식 실패 → 직전 트리
            sys.stderr.write('game-cats: 트리 수집 실패 %s → 직전 트리 재사용\n' % e)
    old = (prev or {}).get('tree') or {}
    return {'fetchedAt': old.get('fetchedAt'), 'ok': False, 'cats': old.get('cats') or []}


def main():
    live = json.load(io.open(os.path.join(T, '_live-posts.json'), encoding='utf-8'))
    bom = next((w for w in live.get('writers', []) if w.get('id') == 'bomding'), None)
    if not bom:
        print('⛔ bomding 없음'); sys.exit(1)
    prev = None
    if os.path.exists(OUT):
        try: prev = json.load(io.open(OUT, encoding='utf-8'))
        except Exception: prev = None
    tree = fetch_tree(prev)
    today = datetime.date.today()
    d60, d90, d180 = [(today - datetime.timedelta(days=n)).isoformat() for n in (60, 90, 180)]

    # ① 라이브 원장: 게임별 카테고리 분포(옛 games 표) + 정규화 이름 → 전용 카테고리(관행)
    by = collections.defaultdict(collections.Counter)
    live90 = collections.Counter()
    angle_cat = {'howto': collections.Counter(), 'news': collections.Counter()}
    for p in bom['posts']:
        g, cat, a = p.get('g') or '', p.get('cat') or '', p.get('a') or ''
        if cat:
            if g:
                by[g][cat] += 1
                if (p.get('d') or '') >= d90:
                    live90[norm(g)] += 1
            if a in HOWTO:
                angle_cat['howto'][cat] += 1
            elif a == '뉴스·소식형':
                angle_cat['news'][cat] += 1
    games, own_by_norm = {}, {}
    for g, c in by.items():
        total = sum(c.values()); cat, n = c.most_common(1)[0]
        if n >= MIN_N:
            games[g] = {'cat': cat, 'n': n, 'total': total, 'alt': c.most_common(3)}
            if cat not in GENERIC and n * 2 >= total:   # 과반이 전용 칸이면 봄딩의 관행으로 본다
                own_by_norm[norm(g)] = cat
    # ② 카테고리 트리의 전용 칸(범용·상위 묶음 제외) — 이름 정규화 색인
    tree_by_norm = {}
    for c in tree['cats']:
        if c['name'] not in GENERIC and c.get('parent') is not None:
            tree_by_norm[norm(c['name'])] = c['name']

    def resolve(name):
        k = norm(name)
        if k in own_by_norm: return own_by_norm[k], '라이브 관행'
        if k in tree_by_norm: return tree_by_norm[k], '카테고리 이름 일치'
        return None, None

    # ③ 사이트 초안(posts.json) — 봄딩 폴더별 90일 수 · 180일 폴더 목록 · 120일 글별 각도
    posts = []
    pp = os.path.join(BASE, 'posts.json')
    if os.path.exists(pp):
        posts = [p for p in json.load(io.open(pp, encoding='utf-8')) if p.get('author') == '봄딩']
    draft90 = collections.Counter(norm(p.get('group')) for p in posts if (p.get('created') or '')[:10] >= d90)
    groups = {}
    for p in posts:
        grp = p.get('group') or ''
        if not grp or (p.get('created') or '')[:10] < d180 or grp in groups:
            continue
        cat, why = resolve(grp)
        n90 = max(draft90.get(norm(grp), 0), live90.get(norm(grp), 0))   # 초안의 85%가 라이브가 되므로 합치면 같은 글을 두 번 센다 → 큰 쪽
        site_cat = p.get('cat') or ''
        if '육아' in site_cat:
            groups[grp] = {'cat': '육아일상', 'status': 'exists', 'n90': n90, 'why': '육아 글'}
        elif site_cat.startswith('IT'):
            groups[grp] = {'cat': 'IT 일상 정보', 'status': 'exists', 'n90': n90, 'why': 'IT 글'}
        elif cat:
            groups[grp] = {'cat': cat, 'status': 'exists', 'n90': n90, 'why': why}
        elif n90 >= NEW_MIN:
            groups[grp] = {'cat': grp, 'status': 'new', 'n90': n90, 'why': '전용 카테고리 없음 · 90일 %d편 ≥ %d' % (n90, NEW_MIN)}
        else:
            groups[grp] = {'cat': None, 'status': 'generic', 'n90': n90, 'why': '전용 카테고리 없음 · 90일 %d편 < %d → 각도별 범용 칸' % (n90, NEW_MIN)}
    by_post = {}
    for p in posts:
        if (p.get('created') or '')[:10] < d60: continue   # 서랍이 매번 받는 파일이라 60일로 자른다(그 전 글은 groups·games 로 폴백)
        grp = p.get('group') or ''; gi = groups.get(grp)
        if not gi: continue
        a = angle(p.get('title'))
        if gi['status'] == 'generic':
            if THEME_RE.search(p.get('title') or ''): cat = '게임 테마'
            elif a in HOWTO: cat = '플레이·공략'
            else: cat = '신작·업데이트'
        else:
            cat = gi['cat']
        by_post[p['rel']] = {'cat': cat, 'status': gi['status'], 'angle': a}

    out = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
           'rule': '새 글만 본다(기존 글 재분류 없음). exists=전용 카테고리 있음(라이브 관행·이름 일치) / new=없는데 90일 글 ≥%d → 신설 필요(신설·이동은 봄딩) / generic=각도별 범용(공략·방법형→플레이·공략 · 소식형→신작·업데이트 · 오프라인·굿즈→게임 테마)' % NEW_MIN,
           'newMin': NEW_MIN,
           'games': games, 'groups': groups, 'byPost': by_post, 'tree': tree,
           'fallback': {k: (v.most_common(1)[0][0] if v else '') for k, v in angle_cat.items()}}
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))   # 서랍이 매번 받는 파일 — 들여쓰기 없이(≈70KB)
    st = collections.Counter(v['status'] for v in groups.values())
    print('game-cats: 게임 %d · 폴더 %d(exists %d · new %d · generic %d) · 글 %d · 트리 %s(%d칸) · fallback %s' % (
        len(games), len(groups), st['exists'], st['new'], st['generic'], len(by_post), '수집' if tree['ok'] else '직전본', len(tree['cats']), out['fallback']))
    if '--print' in sys.argv:
        print('  [신설 필요]')
        for g, v in sorted(groups.items(), key=lambda kv: -kv[1]['n90']):
            if v['status'] == 'new': print('   %-18s 90일 %d편' % (g[:18], v['n90']))
        print('  [전용 있음 · 90일 ≥2]')
        for g, v in sorted(groups.items(), key=lambda kv: -kv[1]['n90']):
            if v['status'] == 'exists' and v['n90'] >= 2: print('   %-18s → %s (%s · 90일 %d편)' % (g[:18], v['cat'], v['why'], v['n90']))


if __name__ == '__main__':
    main()
