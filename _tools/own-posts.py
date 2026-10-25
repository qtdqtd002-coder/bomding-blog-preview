#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
own-posts.py — 봄딩 «자작 글» 풀(문체 기준 표본 · 골든 세트)을 만든다 (2026-10-25 결정서 12-5 · LLM 0)

왜 있나: qa-style 라이브 대조와 bomding-blog-writer «최근 글 학습»이 «봄딩 실블로그 최근 글»을 기준 삼는데, 2026-05-31부터는
  그 다수가 우리 파이프라인 산출물이라 AI 말투가 기준으로 굳는다(에코체임버). 사용자 결정(10-24 인터뷰 12-5):
  기준 표본 = **2026-05-30 이전 글 전부 + 이후 글 중 우리 산출물이 아닌 것(자작)**.

«우리 산출물» 판정(이후 글만) — 두 단계:
  ① 제목 대조 = check-published.ps1 과 같은 글자 bigram 판정(Jaccard ≥ 0.70 또는 overlap ≥ 0.92 & Jaccard ≥ 0.40) ↔ BlogPreview 봄딩 초안 제목 전체.
  ② ①에서 안 걸린 글은 **본문 대조**: 라이브 본문(m.blog.naver.com)을 받아 글자 6-gram 집합을 만들고, 라이브 날짜 기준 −30일~+1일에
     만든 봄딩 초안(#copy 우선 · 없으면 .post)과 비교해 **초안 6-gram 의 35% 이상이 라이브에 있으면 우리 글**이다.
     (봄딩은 제목을 고쳐 올리는 일이 잦다 — 10-25 실측: 제목 대조만으로 «자작» 101편 중 상당수가 우리 글이었다. 본문 대조가 그걸 잡는다.)
     결과는 `_trend/_own-posts-cache.json` 에 logNo 별로 저장해 다음 실행부턴 새 글만 받는다(--recheck 로 전부 재판정).

입력  _trend/_live-posts.json (live-ledger.cjs · 봄딩 라이브 전체) · posts.json (봄딩 초안 제목·경로·작성일)
출력  _trend/_own-posts.json  {updated, rule, cutoff, counts:{live, before, after, afterOursTitle, afterOursBody, afterOwn, own}, posts:[{n, d, t, cat, g, era}]}
       era = 'before'(05-30 이전) | 'own'(이후 자작)
사용  python _tools/own-posts.py [--print] [--recheck] [--no-fetch] [--out <path>]
      데스크 [E](매일 06:00)가 live-ledger 뒤에 1회 굽는다. 검수·학습은 이 파일에서만 표본을 뽑는다(라이브 최신글 직접 fetch 금지).
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, time, html as H, datetime, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOFF = '2026-05-31'          # 이 날짜부터 우리 파이프라인 글이 라이브에 올라갔다(첫 글 05-31)
JAC, OVL_HI, JAC_LO = 0.70, 0.92, 0.40
BODY_MIN = 0.35                # 초안 6-gram 의 이 비율 이상이 라이브에 있으면 우리 글
WINDOW_BEFORE, WINDOW_AFTER = 30, 1
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
CACHE = os.path.join(BASE, '_trend', '_own-posts-cache.json')


def norm(s):
    return re.sub(r'[^0-9a-z가-힣]', '', (s or '').lower())


def bigrams(s):
    s = norm(s)
    return {s[i:i + 2] for i in range(len(s) - 1)} if len(s) > 1 else ({s} if s else set())


def title_match(A, B):
    if not A or not B:
        return False
    inter = len(A & B)
    if not inter:
        return False
    jac = inter / float(len(A | B)); ovl = inter / float(min(len(A), len(B)))
    return jac >= JAC or (ovl >= OVL_HI and jac >= JAC_LO)


def grams6(text):
    t = norm(text)
    return {t[i:i + 6] for i in range(len(t) - 5)} if len(t) >= 6 else set()


def html_text(h):
    h = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', h, flags=re.S | re.I)
    return H.unescape(re.sub(r'<[^>]+>', ' ', h))


def draft_text(path):
    try:
        h = io.open(path, encoding='utf-8', errors='replace').read()
    except Exception:
        return ''
    m = re.search(r'<div[^>]*id\s*=\s*["\']copy["\']', h)
    seg = h[m.start():] if m else h
    m2 = re.search(r'<script\b|</body>', seg, re.I)
    seg = seg[:m2.start()] if (m and m2) else seg
    return html_text(seg)


def fetch_live(logno):
    req = urllib.request.Request('https://m.blog.naver.com/bomding/%s' % logno, headers={'User-Agent': UA, 'Referer': 'https://m.blog.naver.com/bomding'})
    h = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
    i = h.find('class="se-main-container"')
    return html_text(h[i:] if i > 0 else h)


def main():
    argv = sys.argv[1:]
    out_path = os.path.join(BASE, '_trend', '_own-posts.json')
    if '--out' in argv:
        out_path = argv[argv.index('--out') + 1]
    recheck = '--recheck' in argv; nofetch = '--no-fetch' in argv
    live = json.load(io.open(os.path.join(BASE, '_trend', '_live-posts.json'), encoding='utf-8'))
    bom = next((w for w in live.get('writers', []) if w.get('id') == 'bomding'), None)
    if not bom:
        print('⛔ _live-posts.json 에 bomding 없음'); sys.exit(1)
    posts = json.load(io.open(os.path.join(BASE, 'posts.json'), encoding='utf-8'))
    posts = posts if isinstance(posts, list) else posts.get('posts', [])
    drafts = [{'rel': p['rel'].replace(chr(92), '/'), 'title': p.get('title', ''), 'created': (p.get('created') or '')[:10]}
              for p in posts if p.get('author') == '봄딩' and p.get('title')]
    draft_bg = [(d, bigrams(d['title'])) for d in drafts]
    try:
        cache = json.load(io.open(CACHE, encoding='utf-8'))
    except Exception:
        cache = {}
    gram_cache = {}

    def draft_grams(rel):
        if rel not in gram_cache:
            gram_cache[rel] = grams6(draft_text(os.path.join(BASE, rel)))
        return gram_cache[rel]

    before, after_own, ours_title, ours_body = [], [], [], []
    fetched = 0
    for p in bom['posts']:
        rec = {'n': p['n'], 'd': p['d'], 't': p['t'], 'cat': p.get('cat', ''), 'g': p.get('g', '')}
        if p['d'] < CUTOFF:
            rec['era'] = 'before'; before.append(rec); continue
        B = bigrams(p['t'])
        hit = next((d for d, A in draft_bg if title_match(A, B)), None)
        if hit:
            ours_title.append(rec); continue
        c = cache.get(str(p['n']))
        if c is None or recheck:
            if nofetch:
                c = {'ours': False, 'score': None, 'draft': '', 'note': 'no-fetch'}
            else:
                try:
                    lg = grams6(fetch_live(p['n'])); fetched += 1; time.sleep(0.5)
                    d0 = datetime.date.fromisoformat(p['d'])
                    best = (0.0, '')
                    for d in drafts:
                        if not d['created']:
                            continue
                        dd = datetime.date.fromisoformat(d['created'])
                        if not (d0 - datetime.timedelta(days=WINDOW_BEFORE) <= dd <= d0 + datetime.timedelta(days=WINDOW_AFTER)):
                            continue
                        G = draft_grams(d['rel'])
                        if len(G) < 200:
                            continue
                        sc = len(G & lg) / float(len(G))
                        if sc > best[0]:
                            best = (sc, d['rel'])
                    c = {'ours': best[0] >= BODY_MIN, 'score': round(best[0], 3), 'draft': best[1], 'checkedAt': datetime.date.today().isoformat()}
                except Exception as e:
                    c = {'ours': False, 'score': None, 'draft': '', 'note': 'fetch-fail ' + str(e)[:60]}
            cache[str(p['n'])] = c
        if c.get('ours'):
            rec['draft'] = c.get('draft', ''); rec['score'] = c.get('score'); ours_body.append(rec)
        else:
            rec['era'] = 'own'; after_own.append(rec)
    io.open(CACHE, 'w', encoding='utf-8', newline='\n').write(json.dumps(cache, ensure_ascii=False, indent=0))
    own = sorted(before + after_own, key=lambda x: x['d'], reverse=True)
    res = {'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
           'rule': '2026-05-30 이전 전부 + 이후 글 중 우리 초안과 제목(bigram)·본문(6-gram ≥ %.2f) 둘 다 불일치' % BODY_MIN,
           'cutoff': CUTOFF, 'draftTitles': len(drafts),
           'counts': {'live': len(bom['posts']), 'before': len(before), 'after': len(after_own) + len(ours_title) + len(ours_body),
                      'afterOursTitle': len(ours_title), 'afterOursBody': len(ours_body), 'afterOwn': len(after_own), 'own': len(own)},
           'oursByBody': ours_body,
           'posts': own}
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    io.open(out_path, 'w', encoding='utf-8', newline='\n').write(json.dumps(res, ensure_ascii=False, indent=0))
    c = res['counts']
    print('own-posts: 라이브 %d · 05-30 이전 %d · 이후 %d(우리: 제목 %d + 본문 %d · 자작 %d · 새로 받은 본문 %d) → 표본 %d → %s' % (
        c['live'], c['before'], c['after'], c['afterOursTitle'], c['afterOursBody'], c['afterOwn'], fetched, c['own'], os.path.relpath(out_path, BASE)))
    if '--print' in argv:
        for x in ours_body:
            print('  본문대조=우리 %s %.2f «%s» ← %s' % (x['d'], x['score'] or 0, x['t'][:40], x['draft'][:60]))
        for x in after_own[:60]:
            print('  이후 자작', x['d'], x['t'][:60])


if __name__ == '__main__':
    main()
