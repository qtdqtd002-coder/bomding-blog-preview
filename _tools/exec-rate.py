#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
exec-rate.py — 데스크 규칙 집행률 2개 (2026-10-25 결정서 8번 · LLM 0 · 읽기 전용)

① how-to 유지율: «소식은 how-to 로 뒤집어서만 제안»(09-18) 규칙이 데스크 → 발주 → 초안 제목 → 라이브 제목 네 단계에서 각각 얼마나 지켜지는가.
   - 데스크: _trend/trend.json 최근 N일 에디션의 게임 칸(pinned·watch·guide·core·new·update·hot) 항목 angleType(데스크 stamp: howto·rank·news·info)
   - 발주:   백엔드 /requests (source=trend-desk · 작성자 봄딩 · 기간 내) topic 을 각도 사다리로 분류
   - 초안:   그 요청들의 최종 title(파이프라인이 적은 제목)을 분류
   - 라이브: _trend/_live-posts.json 봄딩 글(기간 내)의 a(live-ledger 분류)
   각도 사다리 = _tools/live-ledger.cjs LADDER 와 같은 순서(첫 일치 우선). how-to = 공략·방법형 + 쿠폰형 + 추천·티어·비교형.
② 분할 연재 집행률: 데스크 [A-0] «업데이트 주간 분할 연재» 제안 대비 실제 발주 수. ★제안에 표식 필드(split)가 없어 지금은 «제목에 1편·2편·(상)·(하)»
   로만 세어 근사치다 — 데스크 stamp 에 split 이 생기면 그걸 쓴다(결과에 basis 로 적는다).
출력 _health/exec-rate.json {updated, window, howto:{desk, order, draft, live}, split:{…}, basis}
사용 python _tools/exec-rate.py [--days 28] [--print]
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, datetime, urllib.request, collections
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
API = 'https://34.139.184.70.sslip.io'
GAME_SECS = ('pinned', 'watch', 'guide', 'core', 'new', 'update', 'hot')  # watch = 업데이트 챙길 게임(10-25)
LADDER = [
    ('공략·방법형', re.compile(r'하는 ?법|방법|공략|(?<!스)위치|얻는 ?법|만드는 ?법|세팅|스킬트리|조합|루트|파밍|재료|퀘스트|보는 ?법|설정|설치|사용법|치트|명령어|염색코드|코디|기댓값|확률|빌드|덱|특성|상성|카운터|강화|각성|승급|재련|우선순위|효율|드랍|주간|일일|보상|스펙|스탯|육성')),
    ('쿠폰형', re.compile(r'쿠폰|코드')),
    ('추천·티어·비교형', re.compile(r'티어|추천|순위|BEST|TOP|비교|뭐가 다를|차이', re.I)),
    ('후기·리뷰형', re.compile(r'후기|리뷰|사용기|써본|첫인상')),
    ('뉴스·소식형', re.compile(r'출시|사전예약|사전 예약|발표|공개|업데이트|패치|콜라보|이벤트|일정|중단|확정|출시일|정식|소식|근황|생중계|응모')),
    ('정리·모음형', re.compile(r'총정리|정리|가이드|모음|링크|사이트')),
]
HOWTO = ('공략·방법형', '쿠폰형', '추천·티어·비교형')
TYPE_HOWTO = ('howto', 'rank')


def arg(k, d):
    a = sys.argv[1:]
    return a[a.index(k) + 1] if k in a else d


def classify(t):
    for name, rx in LADDER:
        if rx.search(t or ''):
            return name
    return '기타'


def share(items, pred):
    n = len(items); k = sum(1 for x in items if pred(x))
    return {'n': n, 'howto': k, 'rate': round(k / n, 3) if n else None}


def main():
    days = int(arg('--days', 28)); pr = '--print' in sys.argv
    today = datetime.date.today(); since = (today - datetime.timedelta(days=days)).isoformat()
    since_ms = int(datetime.datetime.combine(today - datetime.timedelta(days=days), datetime.time()).timestamp() * 1000)
    # ① 데스크
    tr = json.load(io.open(os.path.join(T, 'trend.json'), encoding='utf-8'))
    desk = []
    for ed in tr.get('editions') or []:
        if str(ed.get('date', '')) < since:
            continue
        for sec in ed.get('sections') or []:
            if sec.get('key') not in GAME_SECS:
                continue
            for it in sec.get('items') or []:
                desk.append({'angleType': it.get('angleType') or '', 'title': it.get('title') or '', 'split': bool(it.get('split'))})
    desk_typed = [d for d in desk if d['angleType']]
    desk_sh = share(desk_typed, lambda d: d['angleType'] in TYPE_HOWTO)
    desk_sh['untyped'] = len(desk) - len(desk_typed)
    # ② 발주·초안(백엔드)
    reqs = []
    try:
        r = urllib.request.urlopen(urllib.request.Request(API + '/requests?ts=1', headers={'User-Agent': 'exec-rate'}), timeout=25).read().decode('utf-8')
        d = json.loads(r); reqs = d if isinstance(d, list) else (d.get('items') or d.get('requests') or [])
    except Exception as e:
        reqs = []; api_err = str(e)[:80]
    else:
        api_err = ''
    win = [q for q in reqs if q.get('source') == 'trend-desk' and q.get('writer') == '봄딩' and str(q.get('createdAt', '0')).isdigit() and int(q['createdAt']) >= since_ms]
    order_sh = share(win, lambda q: classify(q.get('topic', '')) in HOWTO)
    drafted = [q for q in win if q.get('title')]
    draft_sh = share(drafted, lambda q: classify(q.get('title', '')) in HOWTO)
    lost = [q for q in drafted if classify(q.get('topic', '')) in HOWTO and classify(q.get('title', '')) == '뉴스·소식형']
    # ③ 라이브
    live = json.load(io.open(os.path.join(T, '_live-posts.json'), encoding='utf-8'))
    lp = [p for p in next((w for w in live.get('writers', []) if w.get('id') == 'bomding'), {}).get('posts', []) if p['d'] >= since]
    live_sh = share(lp, lambda p: (p.get('a') or classify(p.get('t', ''))) in HOWTO)
    # ④ 분할 연재(근사)
    split_desk = sum(1 for d in desk if d['split'])
    split_rx = re.compile(r'\b[12]편\b|\(상\)|\(하\)|1부|2부|전편|후편')
    split_desk_title = sum(1 for d in desk if split_rx.search(d['title']))
    split_orders = sum(1 for q in win if split_rx.search(q.get('topic', '')))
    out = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'window': '%s~%s(%d일)' % (since, today.isoformat(), days),
           'howto': {'desk': desk_sh, 'order': order_sh, 'draft': draft_sh, 'live': live_sh, 'lostAtTitle': [{'topic': q.get('topic', '')[:50], 'title': q.get('title', '')[:60]} for q in lost][:10]},
           'split': {'deskFlagged': split_desk, 'deskByTitle': split_desk_title, 'orders': split_orders,
                     'basis': 'stamp split 필드 ' + ('있음' if split_desk else '없음(제목의 1편·2편·상·하 로 근사)')},
           'apiError': api_err,
           'rule': 'how-to = 공략·방법형+쿠폰형+추천·티어·비교형 · 데스크=stamp angleType(howto·rank) · 발주=topic 분류 · 초안=요청 title 분류 · 라이브=live-ledger a'}
    os.makedirs(os.path.join(BASE, '_health'), exist_ok=True)
    io.open(os.path.join(BASE, '_health', 'exec-rate.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
    f = lambda s: ('%s%%(%d/%d)' % (int(s['rate'] * 100), s['howto'], s['n'])) if s['rate'] is not None else '-'
    print('exec-rate %s: how-to 데스크 %s → 발주 %s → 초안 %s → 라이브 %s · 각도 유실(발주 공략→제목 소식) %d · 분할: 데스크 표식 %d(제목 근사 %d) → 발주 %d%s' % (
        out['window'], f(desk_sh), f(order_sh), f(draft_sh), f(live_sh), len(lost), split_desk, split_desk_title, split_orders, (' · API 오류 ' + api_err) if api_err else ''))
    if pr:
        for q in lost:
            print('  유실:', q.get('topic', '')[:40], '→', q.get('title', '')[:50])


if __name__ == '__main__':
    main()
