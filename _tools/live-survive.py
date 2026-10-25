#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
live-survive.py — 봄딩 초안의 장치가 네이버 라이브에 «실제로 남았는지» 계수 (2026-10-25 결정서 6·14번 · LLM 0 · 읽기 전용)

왜 있나: R6(상황 분기)·R7(봄딩 한 줄 칸)은 10-19 승인했지만 봄딩이 붙여넣을 때 지우면 독자에겐 없는 것이다. 위젯 v2 피드백도
  봄딩에게 묻는 대신 «초안 대비 라이브에서 빠진 요소»를 재서 대신한다. 주간 헬스체크(월 09:38)가 결과 파일을 읽기만 한다.

측정 대상: 봄딩 초안 중 작성일 ≥ --since(기본 2026-10-19 = R6/R7 적용일)이고 라이브에 올라간 글.
  초안↔라이브 짝 = ① 제목 bigram 대조(check-published 판정) ② _trend/_own-posts-cache.json 의 본문 대조 결과(draft→logNo).
요소(초안에 있을 때만 분모에 넣는다):
  r7   «✍️ 봄딩 한 줄» 칸 — 초안 .gap.mine 문장에서 〔보기〕를 뺀 고정 조각(≥8자)이 라이브 본문에 있는가(= 봄딩이 하나 골라 남겼다)
  r6   «이럴 땐 A / 저럴 땐 B» 굵은 리드 — 초안 <p><b>…</b> 중 «이럴 땐|저럴 땐|이렇게» 리드 텍스트가 라이브에 있는가
  refs «참고한 곳» 줄 — 라이브에 '참고한 곳' 글자가 있는가
  faq  «자주 묻는 질문» — 라이브에 있는가
  tables 초안 .tbl 수 vs 라이브 se-table 수 · imgs 초안 img 수 vs 라이브 se-module-image 수 · quotes 라이브 인용구 수 vs 초안 h2 수
  stamp 라이브 통계 스탬프(«기준» + 표본|패치) 생존(초안에 있을 때만)
  publishedAt 라이브 발행 시각(blog_date) — 11번(적재 시각↔발행 시각) 상관의 원자료
출력 _health/live-survive.json {updated, since, pairs, rows:[…], rates:{r7, r6, refs, faq, stamp, tableKeep, imgKeep, quotesPerH2}, hours:{…}}
사용 python _tools/live-survive.py [--since YYYY-MM-DD] [--max N] [--print]
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, time, html as H, datetime, urllib.request, collections
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(BASE, '_trend')
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
JAC, OVL_HI, JAC_LO = 0.70, 0.92, 0.40


def arg(k, d):
    a = sys.argv[1:]
    return a[a.index(k) + 1] if k in a else d


def norm(s):
    return re.sub(r'[^0-9a-z가-힣]', '', (s or '').lower())


def bigrams(s):
    s = norm(s)
    return {s[i:i + 2] for i in range(len(s) - 1)} if len(s) > 1 else ({s} if s else set())


def tmatch(A, B):
    if not A or not B:
        return False
    inter = len(A & B)
    if not inter:
        return False
    jac = inter / float(len(A | B)); ovl = inter / float(min(len(A), len(B)))
    return jac >= JAC or (ovl >= OVL_HI and jac >= JAC_LO)


def untag(h):
    h = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', h, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', H.unescape(re.sub(r'<[^>]+>', ' ', h)))


def post_part(html):
    """미리보기 본문(.post)만 — 위젯 서랍(#npBtn)·#copy 앞까지. ★script·style·주석을 먼저 지운다(CSS 의 #npBtn 선택자에 잘리던 것 · preflight 와 같은 순서)."""
    t = re.sub(r'<!--.*?-->', ' ', html, flags=re.S)
    t = re.sub(r'<(script|style)\b[^>]*>.*?</\1\s*>', ' ', t, flags=re.S | re.I)
    m = re.search(r'id\s*=\s*["\']npBtn["\']|<div[^>]*id\s*=\s*["\']copy["\']|네이버 붙여넣기 위젯', t)
    return t[:m.start()] if m else t


def fetch_live(logno):
    req = urllib.request.Request('https://m.blog.naver.com/bomding/%s' % logno, headers={'User-Agent': UA, 'Referer': 'https://m.blog.naver.com/bomding'})
    return urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')


def draft_features(html):
    post = post_part(html)
    f = {}
    # R7 — .gap.mine 문장: 〔…〕 밖 고정 조각
    r7 = []
    for m in re.finditer(r'<div class="gap mine">(.*?)</div>', post, flags=re.S):
        t = untag(re.sub(r'<b>.*?</b>', ' ', m.group(1), flags=re.S))
        t = re.sub(r'^.*?(?:지우기)\s*', '', t).strip()
        parts = [p.strip() for p in re.split(r'〔[^〕]*〕', t) if len(norm(p)) >= 8]
        if parts:
            r7.append(max(parts, key=len))
    f['r7'] = r7
    # R6 — 굵은 리드
    f['r6'] = [untag(m.group(1)).strip() for m in re.finditer(r'<p>\s*<b>([^<]{4,80})</b>', post) if re.search(r'이럴 땐|저럴 땐|이렇게', m.group(1))]
    f['refs'] = bool(re.search(r'참고한\s*곳', post))
    f['faq'] = bool(re.search(r'자주\s*묻는\s*질문', post))
    f['tables'] = len(re.findall(r'<table\b', post, flags=re.I))
    f['imgs'] = len([t for t in re.findall(r'<img\b[^>]*>', post, flags=re.I) if '_design/' not in t])
    f['h2'] = len(re.findall(r'<h2\b', post, flags=re.I))
    f['stamp'] = bool(re.search(r'(표본|패치)[^.]{0,40}(기준|조회)', untag(post)))
    return f


def live_features(h):
    i = h.find('class="se-main-container"'); body = h[i:] if i > 0 else h
    txt = untag(body); n = norm(txt)
    m = re.search(r'(\d{4})\. ?(\d{1,2})\. ?(\d{1,2})\. ?(\d{1,2}):(\d{2})', h)
    pub = '%s-%02d-%02d %02d:%s' % (m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)), m.group(5)) if m else ''
    return {'text': txt, 'norm': n, 'tables': len(re.findall(r'class="se-component se-table', body)), 'imgs': len(re.findall(r'class="se-module se-module-image', body)),
            'quotes': len(re.findall(r'class="se-component se-quotation', body)), 'hr': len(re.findall(r'class="se-component se-horizontalLine', body)),
            'refs': '참고한곳' in n, 'faq': '자주묻는질문' in n, 'stamp': bool(re.search(r'(표본|패치)[^.]{0,40}(기준|조회)', txt)), 'publishedAt': pub,
            'chars': len(re.findall(r'[가-힣]', txt))}


def main():
    since = arg('--since', '2026-10-19'); mx = int(arg('--max', 0)); pr = '--print' in sys.argv
    posts = json.load(io.open(os.path.join(BASE, 'posts.json'), encoding='utf-8'))
    posts = posts if isinstance(posts, list) else posts.get('posts', [])
    drafts = [p for p in posts if p.get('author') == '봄딩' and (p.get('created') or '')[:10] >= since]
    live = json.load(io.open(os.path.join(T, '_live-posts.json'), encoding='utf-8'))
    lp = next((w for w in live.get('writers', []) if w.get('id') == 'bomding'), {}).get('posts', [])
    lp = [p for p in lp if p['d'] >= (datetime.date.fromisoformat(since) - datetime.timedelta(days=1)).isoformat()]
    try:
        cache = json.load(io.open(os.path.join(T, '_own-posts-cache.json'), encoding='utf-8'))
    except Exception:
        cache = {}
    by_draft = {}
    for logno, c in cache.items():
        if c.get('ours') and c.get('draft'):
            by_draft['/'.join(c['draft'].replace(chr(92), '/').split('/')[:3])] = logno
    pairs = []
    for d in drafts:
        rel = d['rel'].replace(chr(92), '/'); folder = '/'.join(rel.split('/')[:3])
        logno = None
        B = bigrams(d.get('title', ''))
        for p in lp:
            if tmatch(B, bigrams(p['t'])):
                logno = p['n']; break
        if not logno:
            logno = by_draft.get(folder)
        if logno:
            pairs.append((d, rel, logno))
    if mx:
        pairs = pairs[:mx]
    rows = []
    for d, rel, logno in pairs:
        try:
            dh = io.open(os.path.join(BASE, rel), encoding='utf-8', errors='replace').read()
            df = draft_features(dh)
            lf = live_features(fetch_live(logno)); time.sleep(0.6)
        except Exception as e:
            rows.append({'rel': rel, 'logNo': logno, 'error': str(e)[:80]}); continue
        row = {'rel': rel, 'logNo': logno, 'created': (d.get('created') or '')[:16], 'publishedAt': lf['publishedAt'], 'title': d.get('title', '')[:60],
               'r7': {'n': len(df['r7']), 'kept': sum(1 for s in df['r7'] if norm(s) in lf['norm'])},
               'r6': {'n': len(df['r6']), 'kept': sum(1 for s in df['r6'] if norm(s) in lf['norm'])},
               'refs': {'draft': df['refs'], 'live': lf['refs']}, 'faq': {'draft': df['faq'], 'live': lf['faq']},
               'stamp': {'draft': df['stamp'], 'live': lf['stamp']},
               'tables': {'draft': df['tables'], 'live': lf['tables']}, 'imgs': {'draft': df['imgs'], 'live': lf['imgs']},
               'h2': df['h2'], 'quotes': lf['quotes'], 'hr': lf['hr'], 'liveChars': lf['chars']}
        rows.append(row)
    ok = [r for r in rows if 'error' not in r]

    def rate(key, sub=None):
        if sub:
            num = sum(r[key]['kept'] for r in ok); den = sum(r[key]['n'] for r in ok)
        else:
            den = sum(1 for r in ok if r[key]['draft']); num = sum(1 for r in ok if r[key]['draft'] and r[key]['live'])
        return {'kept': num, 'of': den, 'rate': round(num / den, 2) if den else None}
    hours = collections.Counter()
    for r in ok:
        if r['publishedAt']:
            hr = int(r['publishedAt'][11:13]); hours['22-05' if (hr >= 22 or hr < 6) else '06-13' if hr < 14 else '14-21'] += 1
    rates = {'r7': rate('r7', True), 'r6': rate('r6', True), 'refs': rate('refs'), 'faq': rate('faq'), 'stamp': rate('stamp'),
             'tableKeep': {'draft': sum(r['tables']['draft'] for r in ok), 'live': sum(r['tables']['live'] for r in ok)},
             'imgKeep': {'draft': sum(r['imgs']['draft'] for r in ok), 'live': sum(r['imgs']['live'] for r in ok)},
             'quotesPerH2': {'h2': sum(r['h2'] for r in ok), 'quotes': sum(r['quotes'] for r in ok)},
             'hrLive': sum(r['hr'] for r in ok)}
    out = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'since': since, 'drafts': len(drafts), 'pairs': len(pairs), 'measured': len(ok),
           'rates': rates, 'hours': dict(hours), 'rows': rows,
           'rule': '초안(작성일 ≥ since)↔라이브 짝 = 제목 bigram 또는 own-posts 본문 대조 · 요소는 초안에 있을 때만 분모'}
    os.makedirs(os.path.join(BASE, '_health'), exist_ok=True)
    io.open(os.path.join(BASE, '_health', 'live-survive.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
    r7, r6 = rates['r7'], rates['r6']
    print('live-survive: 초안 %d · 라이브 짝 %d · 측정 %d | R7 %s/%s · R6 %s/%s · 참고한 곳 %s/%s · FAQ %s/%s · 스탬프 %s/%s · 표 %s→%s · 이미지 %s→%s · h2 %s→인용구 %s · 구분선 %s · 발행시각 %s' % (
        len(drafts), len(pairs), len(ok), r7['kept'], r7['of'], r6['kept'], r6['of'], rates['refs']['kept'], rates['refs']['of'], rates['faq']['kept'], rates['faq']['of'],
        rates['stamp']['kept'], rates['stamp']['of'], rates['tableKeep']['draft'], rates['tableKeep']['live'], rates['imgKeep']['draft'], rates['imgKeep']['live'],
        rates['quotesPerH2']['h2'], rates['quotesPerH2']['quotes'], rates['hrLive'], dict(hours)))
    if pr:
        for r in ok:
            print('  %s %s R7 %s/%s R6 %s/%s refs %s faq %s 표 %s→%s img %s→%s h2 %s q %s | %s' % (r['created'][:10], r['publishedAt'], r['r7']['kept'], r['r7']['n'], r['r6']['kept'], r['r6']['n'],
                  r['refs']['live'], r['faq']['live'], r['tables']['draft'], r['tables']['live'], r['imgs']['draft'], r['imgs']['live'], r['h2'], r['quotes'], r['title'][:34]))


if __name__ == '__main__':
    main()
