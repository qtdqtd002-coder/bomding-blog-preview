#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
hero-aib.py — 봄딩 «효자 글» 월간 배치 (2026-10-25 결정서 13번 · LLM 0 · 네이버 실검색 · 월 1회)

무엇: 봄딩 라이브 글(최근 180일)의 제목에서 검색 질의를 하나씩 만들어 네이버 통합검색 AI 브리핑을 실제로 열어 보고(aib-check.py),
  **봄딩 글이 브리핑 출처로 잡힌 글**을 센다. 상위 3편이 다음 달 「갱신할 글」 칸의 «효자 글»이 된다(발주는 사용자).
  지금까지 «효자»는 발행 번도 점수(core-games)였다 — 독자 가치가 아니다. 이 배치는 실제 노출만 센다.
질의 = 제목의 첫 쉼표 앞 조각(앞머리)에서 괄호·특수문자를 지운 것(최대 28자). 같은 질의는 한 번만.
비용 = LLM 0 · HTTP 만(8초 간격 — aib-check.py 기본). 300편이면 ≈40분. 캐시(aib-check 24h)가 있으면 그만큼 빠르다.
출력 _trend/_hero.json {updated, month, window, checked, shown, hits:[…], top:[{n,d,t,g,query,rank,hits,rel}]}
     rel = 그 라이브 글이 우리 초안이면 그 폴더(own-posts 캐시) · 자작이면 ''.
사용 python _tools/hero-aib.py [--days 180] [--max N] [--gap 8] [--dry]
     ★예약: Windows 작업 sseudam-hero-aib (매월 1일 03:00 · 숨김 런처) — 06:00 데스크가 _hero.json 을 읽는다.
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, datetime, subprocess
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
AIB = os.path.join(os.path.expanduser('~'), '.claude', 'shared', 'blog-writing', 'tools', 'aib-check.py')


def arg(k, d):
    a = sys.argv[1:]
    return a[a.index(k) + 1] if k in a else d


def query_of(title):
    head = re.split(r'[,，!?]', title)[0]
    head = re.sub(r'\([^)]*\)|\[[^\]]*\]|[«»「」『』"\'·…]', ' ', head)
    head = re.sub(r'\s+', ' ', head).strip()
    return head[:28].strip()


def main():
    days = int(arg('--days', 180)); mx = int(arg('--max', 0)); gap = arg('--gap', '8'); dry = '--dry' in sys.argv
    live = json.load(io.open(os.path.join(T, '_live-posts.json'), encoding='utf-8'))
    bom = next((w for w in live.get('writers', []) if w.get('id') == 'bomding'), None)
    if not bom:
        print('⛔ bomding 없음'); sys.exit(1)
    since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    posts = [p for p in bom['posts'] if p['d'] >= since]
    try:
        cache = json.load(io.open(os.path.join(T, '_own-posts-cache.json'), encoding='utf-8'))
    except Exception:
        cache = {}
    seen, items = set(), []
    for p in posts:
        q = query_of(p['t'])
        if len(q) < 6 or q in seen:
            continue
        seen.add(q); items.append({'n': p['n'], 'd': p['d'], 't': p['t'], 'g': p.get('g', ''), 'query': q,
                                   'rel': (cache.get(str(p['n'])) or {}).get('draft', '')})
    if mx:
        items = items[:mx]
    print('hero-aib: 대상 %d편(%s 이후) · 질의 %d · gap %ss%s' % (len(posts), since, len(items), gap, ' · dry' if dry else ''))
    if dry:
        for it in items[:20]:
            print('  ', it['d'], it['query'])
        return
    qfile = os.path.join(T, '_hero-queries.json')          # aib-check --file = JSON 배열(문자열 또는 {q})
    io.open(qfile, 'w', encoding='utf-8').write(json.dumps([it['query'] for it in items], ensure_ascii=False))
    out_json = os.path.join(T, '_hero-raw.json')
    if os.path.exists(out_json):
        os.remove(out_json)
    cmd = [sys.executable, '-X', 'utf8', AIB, '--file', qfile, '--blog', 'bomding', '--gap', str(gap), '--max', str(len(items)), '--json', out_json]
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    if not os.path.exists(out_json):
        print('⛔ aib-check 결과 없음 rc=%s %s' % (r.returncode, (r.stderr or r.stdout)[-400:])); sys.exit(1)
    try:
        raw = json.load(io.open(out_json, encoding='utf-8'))
    except Exception as e:
        print('⛔ 결과 JSON 파싱 실패 — %s' % e); sys.exit(1)
    rows = raw if isinstance(raw, list) else (raw.get('results') or raw.get('items') or [])
    byq = {}
    for x in rows:
        if isinstance(x, dict) and x.get('q'):
            byq[x['q']] = x
    hits, shown = [], 0
    for it in items:
        x = byq.get(it['query']) or {}
        st = x.get('status'); tg = x.get('target') or {}
        if st == 'shown':
            shown += 1
        rank = tg.get('rank') if tg.get('cited') else None
        if rank is None:
            for s in x.get('sources') or []:
                if str(s.get('blog') or '') == 'bomding':
                    rank = s.get('rank'); break
        if rank:
            hits.append(dict(it, rank=rank, hits=1, status=st))
    hits.sort(key=lambda h: (h['rank'] or 99, h['d']))
    month = datetime.date.today().strftime('%Y-%m')
    out = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'month': month, 'window': '%s~' % since,
           'checked': len(items), 'shown': shown, 'hits': hits, 'top': hits[:3],
           'rule': '봄딩 라이브 제목 앞머리 질의로 AI 브리핑 실검색 · 봄딩 출처 순위에 든 글 상위 3 = 효자(발주는 사용자)'}
    io.open(os.path.join(T, '_hero.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
    for tmp in (qfile, out_json):   # 중간 산출물은 남기지 않는다(저장소 미추적 파일 방지)
        try:
            os.remove(tmp)
        except Exception:
            pass
    print('hero-aib: 질의 %d · 브리핑 뜸 %d · 봄딩 출처 %d · top %s' % (len(items), shown, len(hits), [(h['t'][:24], h['rank']) for h in hits[:3]]))


if __name__ == '__main__':
    main()
