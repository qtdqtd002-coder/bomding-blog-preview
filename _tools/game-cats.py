#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
game-cats.py — 게임별 «봄딩 네이버 카테고리» 추천표 (2026-10-25 결정서 9번 «안내만» · LLM 0 · 읽기 전용)

무엇: 봄딩 라이브 글(_trend/_live-posts.json · live-ledger.cjs)을 게임별로 모아 **가장 많이 쓴 네이버 카테고리**를 적는다.
  사이트 글 목록과 붙여넣기 서랍이 «네이버 카테고리 추천: X» 한 줄로 보여 준다. 양식 필드는 없다(사용자 결정) · 카테고리 신설은 봄딩 몫.
출력 _trend/_game-cats.json {updated, games:{<게임>: {cat, n, total, alt:[[cat,n],…]}}, fallback:{howto, news}}
  fallback = 게임 기록이 없을 때 각도별 기본값(라이브 전체에서 공략형 글·소식형 글이 가장 많이 쓴 카테고리).
사용 python _tools/game-cats.py [--print]   (데스크 [E] 가 하루 1회)
★Windows: stdout UTF-8 고정.
"""
import io, os, sys, json, datetime, collections
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
MIN_N = 2


def main():
    live = json.load(io.open(os.path.join(T, '_live-posts.json'), encoding='utf-8'))
    bom = next((w for w in live.get('writers', []) if w.get('id') == 'bomding'), None)
    if not bom:
        print('⛔ bomding 없음'); sys.exit(1)
    by = collections.defaultdict(collections.Counter)
    angle_cat = {'howto': collections.Counter(), 'news': collections.Counter()}
    for p in bom['posts']:
        g, cat, a = p.get('g') or '', p.get('cat') or '', p.get('a') or ''
        if cat:
            if g:
                by[g][cat] += 1
            if a in ('공략·방법형', '쿠폰형', '추천·티어·비교형'):
                angle_cat['howto'][cat] += 1
            elif a == '뉴스·소식형':
                angle_cat['news'][cat] += 1
    games = {}
    for g, c in by.items():
        total = sum(c.values())
        cat, n = c.most_common(1)[0]
        if n >= MIN_N:
            games[g] = {'cat': cat, 'n': n, 'total': total, 'alt': c.most_common(3)}
    out = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
           'rule': '게임별 봄딩 라이브 글의 최다 네이버 카테고리(%d편 이상) · 안내용 · 신설은 봄딩' % MIN_N,
           'games': games,
           'fallback': {k: (v.most_common(1)[0][0] if v else '') for k, v in angle_cat.items()}}
    io.open(os.path.join(T, '_game-cats.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
    print('game-cats: 게임 %d · fallback %s' % (len(games), out['fallback']))
    if '--print' in sys.argv:
        for g, v in sorted(games.items(), key=lambda kv: -kv[1]['total'])[:25]:
            print('  %-14s %s (%d/%d)' % (g[:14], v['cat'], v['n'], v['total']))


if __name__ == '__main__':
    main()
