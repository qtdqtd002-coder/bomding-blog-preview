#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
bomding-kpi.py — 작성자별 운영 지표 3종 «14일 글당 공감 · 30일 최다 카테 비중 · 갱신 지연» (2026-11-01 운영 전략 §7 · LLM 0 · 읽기 전용)
  ★파일명은 처음 만든 봄딩 전용 때의 이름 그대로다(SKILL 두 곳이 이 이름으로 부른다 — 바꾸지 말 것). 지금은 라이브 원장의 작성자 전원(봄딩·영도)을 같은 자로 잰다.

무엇: 라이브 글(_trend/_live-posts.json · live-ledger.cjs)과 갱신 기한 글(_trend/_refresh.json · refresh-due.py)에서
  전략 보고서 §7 의 «되돌림 기준» 숫자(글당 공감 · 최다 카테고리 비중)를 매일 같은 자로 잰다.
  홈 「블로그 활동」 작성자 칸마다 3칸과 주간 헬스체크 3c 의 작성자별 3줄(--print)이 이 파일 하나를 공용한다.
  refresh 는 _refresh.json 의 writer 이름(봄딩·영도)으로 가른다.
창: KST «어제»까지(오늘 글은 공감이 안 익었고 아직 집계 전). win14 = 어제 포함 14일 · win30 = 어제 포함 30일.
규칙: 글당 공감은 소수 첫째 자리 «버림»(사이트 fmtKo 와 같다 · 반올림 금지) · 비중은 정수 % «버림».
  글이 0편인 창은 0 으로 위장하지 않고 null · _refresh.json 이 없으면 refresh 도 null.
  sy(공감)는 «수집 시점 값» — 그 뒤에 늘어난 공감은 반영되지 않는다.
출력 _trend/_kpi.json {updated, rule, asOf, srcAt, writers:{'봄딩':{win14, win30, refresh}, '영도':{…}}, bomding:<writers.봄딩 과 같은 값 · 옛 읽는 쪽 호환>}
  각 작성자 값:
  win14 {posts, sy, syPer} · win30 {posts, cats:[[cat,n],…], topCat, topN, topPct} · refresh {due, late, maxLate}
사용 python _tools/bomding-kpi.py [--print]   (데스크 [E] 가 하루 1회 · --print = 헬스체크용 작성자별 3줄씩(봄딩 3 + 영도 3)만 출력)
★Windows: stdout UTF-8 고정.
"""
import io, os, sys, json, datetime, collections
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
KST = datetime.timezone(datetime.timedelta(hours=9))
PEND = '집계 전'


def win(posts, ymd, n):
    """ymd(어제)를 포함해 n일 — 발행일 d 가 [ymd-(n-1), ymd] 인 글"""
    y = datetime.date.fromisoformat(ymd)
    lo = (y - datetime.timedelta(days=n - 1)).isoformat()
    return [p for p in posts if lo <= (p.get('d') or '') <= ymd]


def calc14(ps):
    if not ps:
        return None
    sy = sum(int(p.get('sy') or 0) for p in ps)
    # 정수 연산으로 소수 첫째 자리 버림(부동소수 오차로 9.4 가 9.3 이 되는 일 방지)
    return {'posts': len(ps), 'sy': sy, 'syPer': (sy * 10 // len(ps)) / 10}


def calc30(ps):
    if not ps:
        return None
    c = collections.Counter(p.get('cat') for p in ps if p.get('cat'))
    cats = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))   # 내림차순 · 동률은 이름순(실행마다 같은 결과)
    if not cats:
        return {'posts': len(ps), 'cats': [], 'topCat': None, 'topN': None, 'topPct': None}
    top, n = cats[0]
    return {'posts': len(ps), 'cats': [[k, v] for k, v in cats], 'topCat': top, 'topN': n, 'topPct': n * 100 // len(ps)}


def load_refresh():
    """_refresh.json 전체(없거나 깨졌으면 None)"""
    f = os.path.join(T, '_refresh.json')
    if not os.path.exists(f):
        return None
    try:
        return json.load(io.open(f, encoding='utf-8'))
    except Exception:
        return None


def calc_refresh(r, name):
    if r is None:
        return None
    its = [i for i in (r.get('items') or []) if i.get('writer') == name]
    lates = [i['late'] for i in its if isinstance(i.get('late'), (int, float)) and i['late'] > 0]
    return {'due': len(its), 'late': len(lates), 'maxLate': (max(lates) if lates else None)}


def lines(name, k):
    """헬스체크용 3줄 — 값이 없으면 «집계 전»"""
    w14, w30, rf = k['win14'], k['win30'], k['refresh']
    a = name + ' 14일 글당 공감 ' + (PEND if not w14 else '%s(%d편 · 공감 %d)' % (w14['syPer'], w14['posts'], w14['sy']))
    if not w30 or w30.get('topCat') is None:
        b = name + ' 30일 최다 카테고리 ' + PEND
    else:
        b = name + ' 30일 최다 카테고리 «%s» %d%%(%d/%d편)' % (w30['topCat'], w30['topPct'], w30['topN'], w30['posts'])
        if len(w30['cats']) > 1:
            b += ' · 2위 «%s» %d' % (w30['cats'][1][0], w30['cats'][1][1])
    if not rf:
        c = name + ' 갱신 기한 글 ' + PEND
    else:
        c = name + ' 갱신 기한 글 %d편 · 지연 %d편' % (rf['due'], rf['late'])
        if rf['maxLate'] is not None:
            c += '(최대 %d일)' % rf['maxLate']
    return [a, b, c]


def main():
    live = json.load(io.open(os.path.join(T, '_live-posts.json'), encoding='utf-8'))
    ws = [w for w in live.get('writers', []) if w.get('name')]
    if not any(w.get('id') == 'bomding' for w in ws):
        print('⛔ bomding 없음'); sys.exit(1)
    now = datetime.datetime.now(KST)
    asof = (now.date() - datetime.timedelta(days=1)).isoformat()
    rf = load_refresh()
    writers = {}
    for w in ws:
        posts = w.get('posts') or []
        writers[w['name']] = {'win14': calc14(win(posts, asof, 14)), 'win30': calc30(win(posts, asof, 30)), 'refresh': calc_refresh(rf, w['name'])}
    out = {'updated': now.strftime('%Y-%m-%d %H:%M'),
           'rule': '작성자별 어제까지 14일 글당 공감(소수 첫째 버림) · 30일 최다 카테고리 비중(정수 버림) · 갱신 기한 글 — 11-01 운영 전략 §7 · 공감은 수집 시점 값',
           'asOf': asof,
           'srcAt': live.get('updated'),
           'writers': writers,
           'bomding': writers['봄딩']}   # 옛 읽는 쪽 호환 — writers.봄딩 과 같은 값
    io.open(os.path.join(T, '_kpi.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
    if '--print' in sys.argv:
        for name in ('봄딩', '영도'):   # 헬스체크 3c 에 싣는 순서 — 봄딩 3줄 + 영도 3줄
            if name in writers:
                for ln in lines(name, writers[name]):
                    print(ln)
    else:
        for name, k in writers.items():
            w14, w30 = k['win14'], k['win30']
            print('bomding-kpi: %s asOf %s · 14일 글당 공감 %s · 30일 최다 %s' % (
                name, asof, (w14['syPer'] if w14 else None), ('%s %s%%' % (w30['topCat'], w30['topPct']) if w30 and w30.get('topCat') else None)))


if __name__ == '__main__':
    main()
