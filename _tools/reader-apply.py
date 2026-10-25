#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
reader-apply.py — «독자 첫 읽기» 패스(Q2 · 2026-10-25 승인)의 코드 쪽 절반 (LLM 0)

흐름(game-blog-publish §4 ⓪-2 · agents/sseudam-pipeline.md §5):
  1) --extract : 붙여넣기본(#copy · 없으면 .post)을 블록 번호와 함께 텍스트로 뽑는다 → qa-reader 서브(Sonnet)에게 이것만 준다.
  2) qa-reader 가 <글폴더>/_qa/reader.json 에 치환안(quote·fix·sev)을 쓴다 — 글은 안 고친다.
  3) --apply   : reader.json 의 🔴·🟡 치환안을 **원문 정확 일치(공백 정규화)**로 .post 와 #copy 둘 다에 적용한다.
                 «(삭제)» 는 문장 삭제(블록이 비면 블록째). 못 찾는 quote 는 건너뛴다(새 문장 생성 0 · W0 w0_apply.py 와 같은 텍스트 맵 방식).
                 적용 전 원본을 _qa/reader-backup.html 에 남기고, 결과를 _qa/reader-apply.json 에 쓴다.
                 치환이 1건 이상이면 호출부가 ①~④ 게이트(style-lint·glossary-lint·preflight·qa-files-check)를 다시 돈다.
  exit  --apply: 0 = 1건 이상 적용 · 2 = 적용할 것 없음(reader.json 없음·빈 findings·전부 불일치) · 1 = 오류
사용
  python reader-apply.py "<글 HTML>" --extract
  python reader-apply.py "<글 HTML>" --apply [--json <reader.json>] [--sev 🔴🟡] [--dry]
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, html as H, shutil, datetime
sys.stdout.reconfigure(encoding='utf-8')
BLOCK_TAGS = ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'tr', 'div', 'blockquote', 'figcaption', 'caption', 'ul', 'ol', 'table', 'section', 'article', 'dt', 'dd')
TOK = re.compile(r'<!--.*?-->|<(script|style)\b[^>]*>.*?</\1\s*>|<[^>]+>|&[#A-Za-z0-9]+;|\s+|[^<&\s]+', re.S)
EMPTY_BLOCK = re.compile(r'<(p|li|h2|h3|h4)(\s[^>]*)?>\s*(?:<br\s*/?>|&nbsp;|\s)*</\1>', re.I)


def build_map(html):
    """body 텍스트(공백 정규화)와 각 문자의 (html 시작, 끝) 오프셋. <br> = ' / ', td 경계 = ' | ', 블록 경계 = 폭 0 공백."""
    text, starts, ends = [], [], []
    b0 = html.find('<body'); b0 = html.find('>', b0) + 1 if b0 >= 0 else 0
    b1 = html.rfind('</body>'); b1 = b1 if b1 > 0 else len(html)
    pend = [None]

    def emit(ch, s, e):
        text.append(ch); starts.append(s); ends.append(e)

    def space(s, e):
        if text and text[-1] != ' ':
            pend[0] = (s, e) if pend[0] is None else (pend[0][0], e)

    def flush():
        if pend[0]:
            emit(' ', *pend[0]); pend[0] = None
    for m in TOK.finditer(html, b0, b1):
        t = m.group(0); s, e = m.start(), m.end()
        if t.startswith('<!--') or (t.startswith('<') and re.match(r'<(script|style)\b', t, re.I)):
            continue
        if t.startswith('<'):
            tag = re.match(r'</?\s*([A-Za-z0-9]+)', t); name = tag.group(1).lower() if tag else ''
            if name == 'br':
                flush(); emit(' ', s, s); emit('/', s, e); emit(' ', e, e)
            elif name in ('td', 'th') and not t.startswith('</'):
                flush(); emit(' ', s, s); emit('|', s, e); emit(' ', e, e)
            elif name in BLOCK_TAGS or name == 'img':
                space(s, s)
            continue
        if t.startswith('&'):
            ch = H.unescape(t)
            if ch.isspace():
                space(s, e); continue
            flush(); emit(ch[0], s, e); continue
        if t.isspace():
            space(s, e); continue
        flush()
        for i, ch in enumerate(t):
            emit(ch, s + i, s + i + 1)
    return ''.join(text), starts, ends


def nz(s):
    return re.sub(r'\s+', ' ', s or '').strip()


def extract(html):
    """붙여넣기본 블록 목록 — (번호, 태그, 텍스트)."""
    m = re.search(r'<div[^>]*id\s*=\s*["\']copy["\']', html)
    if m:
        seg = html[m.start():]
        e = re.search(r'<script\b|</body>', seg, re.I)
        seg = seg[:e.start()] if e else seg
        src = '#copy'
    else:
        i = html.find('class="post"'); seg = html[i:] if i > 0 else html; src = '.post'
    seg = re.sub(r'<(script|style)\b[^>]*>.*?</\1\s*>', ' ', seg, flags=re.S | re.I)
    out = []
    for bm in re.finditer(r'<(p|li|h1|h2|h3|h4|td|th|figcaption)\b[^>]*>(.*?)</\1>', seg, flags=re.S | re.I):
        inner = re.sub(r'<br\s*/?>', ' / ', bm.group(2), flags=re.I)
        t = nz(H.unescape(re.sub(r'<[^>]+>', ' ', inner)))
        if t:
            out.append((bm.group(1).upper(), t))
    return src, out


def apply(html_path, reader_json, sevs, dry):
    html = io.open(html_path, encoding='utf-8', newline='').read()
    data = json.load(io.open(reader_json, encoding='utf-8'))
    text, starts, ends = build_map(html)
    plan, log = [], []
    for k, f in enumerate(data.get('findings', [])):
        sev = f.get('sev', ''); q = nz(f.get('quote', '')); fx = (f.get('fix') or '').strip()
        if sev not in sevs or not q:
            log.append({'k': k, 'sev': sev, 'status': 'SKIP-SEV', 'quote': q[:60]}); continue
        if not fx:
            log.append({'k': k, 'sev': sev, 'status': 'SKIP-NOFIX', 'quote': q[:60]}); continue
        kind = 'delete' if fx == '(삭제)' else 'replace'
        if kind == 'replace' and (fx.startswith('(') or len(fx) > max(220, len(q) * 2)):
            log.append({'k': k, 'sev': sev, 'status': 'SKIP-FIX-FORM', 'quote': q[:60], 'fix': fx[:60]}); continue
        hits = []; i = 0
        while True:
            j = text.find(q, i)
            if j < 0:
                break
            hits.append((j, j + len(q))); i = j + 1
        if not hits:
            log.append({'k': k, 'sev': sev, 'status': 'NOTFOUND', 'quote': q[:80]}); continue
        for a, b in hits:
            plan.append((starts[a], ends[b - 1], kind, fx, k, q))
        log.append({'k': k, 'sev': sev, 'status': 'OK', 'kind': kind, 'hits': len(hits), 'quote': q[:60], 'fix': fx[:80]})
    plan.sort(key=lambda x: (x[0], -x[1]))
    kept, last = [], -1
    for p in plan:
        if p[0] < last:
            log.append({'k': p[4], 'status': 'OVERLAP-SKIP', 'quote': p[5][:60]}); continue
        kept.append(p); last = p[1]
    new = html
    for s, e, kind, fx, k, q in sorted(kept, key=lambda x: -x[0]):
        if kind == 'replace':
            new = new[:s] + H.escape(fx, quote=False) + new[e:]
        else:
            left, right = new[:s], new[e:]
            if right.startswith(' '):
                right = right[1:]
            elif left.endswith(' '):
                left = left[:-1]
            new = left + right
    if kept:
        new = EMPTY_BLOCK.sub('', new)
    # 치환이 <b>…</b> 짝을 깨면 복구(블록 단위)
    new = repair_bold(new)
    applied = len(kept); changed = new != html
    qa = os.path.join(os.path.dirname(html_path), '_qa'); os.makedirs(qa, exist_ok=True)
    if changed and not dry:
        shutil.copy2(html_path, os.path.join(qa, 'reader-backup.html'))
        io.open(html_path, 'w', encoding='utf-8', newline='').write(new)
    res = {'post': html_path, 'readerJson': reader_json, 'appliedRanges': applied, 'changed': bool(changed and not dry), 'dry': dry,
           'bytes': [len(html), len(new)], 'log': log, 'at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}
    io.open(os.path.join(qa, 'reader-apply.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(res, ensure_ascii=False, indent=1))
    st = {}
    for l in log:
        st[l['status']] = st.get(l['status'], 0) + 1
    print('reader-apply: 치환 %d곳 · %s · %s' % (applied, st, '변경 저장' if (changed and not dry) else ('dry' if dry else '변경 없음')))
    return 0 if applied else 2


BTOK = re.compile(r'<b>|</b>|</(?:p|li|h2|h3|h4|td|th|div|figcaption|caption|span)>', re.I)


def repair_bold(h):
    out, pos, stack = [], 0, []
    for m in BTOK.finditer(h):
        t = m.group(0).lower()
        if t == '<b>':
            stack.append((m.start(), m.end())); continue
        if t == '</b>':
            if stack:
                stack.pop()
            else:
                out.append(h[pos:m.start()]); pos = m.end()
            continue
        if stack:
            for s, e in stack:
                out.append(h[pos:s]); pos = e
            stack = []
    out.append(h[pos:])
    return ''.join(out)


def main():
    argv = sys.argv[1:]
    files = [a for a in argv if not a.startswith('--') and os.path.isfile(a)]
    if not files:
        print('사용: reader-apply.py "<글 HTML>" --extract | --apply [--json <reader.json>] [--sev 🔴🟡] [--dry]'); sys.exit(1)
    html_path = os.path.abspath(files[0])
    if '--extract' in argv:
        html = io.open(html_path, encoding='utf-8', errors='replace').read()
        src, blocks = extract(html)
        print('# 독자 첫 읽기 — %s · 본문 출처 %s · 블록 %d개' % (os.path.basename(html_path), src, len(blocks)))
        for i, (tag, t) in enumerate(blocks, 1):
            print('C%03d [%s] %s' % (i, tag, t))
        sys.exit(0)
    if '--apply' in argv:
        rj = argv[argv.index('--json') + 1] if '--json' in argv else os.path.join(os.path.dirname(html_path), '_qa', 'reader.json')
        if not os.path.isfile(rj):
            print('reader-apply: reader.json 없음 — 적용할 것 없음 (%s)' % rj); sys.exit(2)
        sevs = argv[argv.index('--sev') + 1] if '--sev' in argv else '🔴🟡'
        try:
            sys.exit(apply(html_path, rj, sevs, '--dry' in argv))
        except Exception as e:
            print('reader-apply: 오류 — %s' % e); sys.exit(1)
    print('--extract 또는 --apply 를 지정하라'); sys.exit(1)


if __name__ == '__main__':
    main()
