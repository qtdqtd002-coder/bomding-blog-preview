#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
pin-suggest.py — 「꼭 다룰 게임」 상자 옆 «추천» 후보 (2026-10-25 결정서 5번 · LLM 0 · 읽기 전용)

무엇: 봄딩 글이 **네이버 AI 브리핑 출처로 실제로 잡힌** 게임을 세어, 핀 상자 옆에 «추천»으로 보여 줄 후보를 만든다.
  핀 지정은 지금처럼 사용자가 한다 — 이 파일은 후보일 뿐이다(데스크는 /pins 만 읽는다).
근거(실측만):
  ① _trend/_aib-followup.json — 발행 후 D+7·D+14 재검에서 봄딩(bd)·영도(yd)가 출처 순위에 든 질의 (글 → 게임 = rel 두 번째 조각)
  ② _trend/trend.json — 데스크 스탬프 aib.bd / aib.yd (발주 전 실검색 때 이미 인용 중이던 게임)
  ③ _trend/_hero.json(있으면 · hero-aib.py 월 1회) — 라이브 글 제목 질의로 잡힌 출처 횟수
출력 _trend/_pin-suggest.json {updated, games:[{game, hits, src:{followup,desk,hero}, last}], note}
사용 python _tools/pin-suggest.py [--print]   (데스크 [E] 가 하루 1회)
★Windows: stdout UTF-8 고정.
"""
import io, os, sys, json, datetime, collections
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
NOT_GAMES = {'육아', '임신출산', '아기띠 힙시트', '아기 홈캠', '유아 영양제', '놀이방 매트', '아기 모기장', '아기 휴대용 선풍기', '아기 우비', '아기 콧물흡입기', '엘샤론염색방 등촌점', 'PixAI', '원스토어', '바다거북스프'}


def load(p):
    try:
        return json.load(io.open(p, encoding='utf-8'))
    except Exception:
        return None


def main():
    hits = collections.defaultdict(lambda: {'followup': 0, 'desk': 0, 'hero': 0, 'last': ''})
    fu = load(os.path.join(T, '_aib-followup.json')) or {}
    for rel, rec in (fu.get('posts') or {}).items():
        if rec.get('writer') not in ('봄딩', None):
            continue
        parts = rel.replace(chr(92), '/').split('/')
        game = parts[1] if len(parts) > 1 else ''
        if not game or game in NOT_GAMES:
            continue
        for stage in ('d14', 'd7', 'pre'):
            res = (rec.get(stage) or {}).get('res') if isinstance(rec.get(stage), dict) else rec.get(stage)
            if not res:
                continue
            got = [r for r in res if r.get('bd')]
            if got:
                hits[game]['followup'] += len(got)
                at = max((r.get('at') or '')[:10] for r in got)
                hits[game]['last'] = max(hits[game]['last'], at)
            break   # 가장 최근 단계 하나만 센다
    tr = load(os.path.join(T, 'trend.json')) or {}
    for ed in (tr.get('editions') or [])[:14]:
        for sec in ed.get('sections') or []:
            for it in sec.get('items') or []:
                a = it.get('aib') or {}
                g = it.get('game') or ''
                if g and g not in NOT_GAMES and a.get('bd'):
                    hits[g]['desk'] += 1
                    hits[g]['last'] = max(hits[g]['last'], str(ed.get('date') or ''))
    hero = load(os.path.join(T, '_hero.json')) or {}
    for x in hero.get('top') or []:
        g = x.get('g') or ''
        if g and g not in NOT_GAMES:
            hits[g]['hero'] += int(x.get('hits') or 1)
            hits[g]['last'] = max(hits[g]['last'], str(hero.get('updated') or '')[:10])
    games = []
    for g, v in hits.items():
        n = v['followup'] + v['desk'] + v['hero']
        if n:
            games.append({'game': g, 'hits': n, 'src': {'followup': v['followup'], 'desk': v['desk'], 'hero': v['hero']}, 'last': v['last']})
    games.sort(key=lambda x: (-x['hits'], x['last']), reverse=False)
    games.sort(key=lambda x: -x['hits'])
    out = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
           'rule': '봄딩 글이 AI 브리핑 출처로 잡힌 횟수(D+7/14 재검 + 데스크 스탬프 + 월간 효자 배치) 상위 — 핀 지정은 사용자',
           'games': games[:8]}
    io.open(os.path.join(T, '_pin-suggest.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
    print('pin-suggest: 게임 %d · 상위 %s' % (len(games), ', '.join('%s %d' % (x['game'], x['hits']) for x in games[:6])))
    if '--print' in sys.argv:
        for x in games:
            print(' ', x)


if __name__ == '__main__':
    main()
