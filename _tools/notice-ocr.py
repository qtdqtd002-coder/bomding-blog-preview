#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
notice-ocr.py — 공식 공지의 «그림 속 글자» 판독 (2026-10-26 · LLM 0 · Windows 내장 OCR)

왜 만들었나(2026-10-26 데스크 첫 «업데이트 챙길 게임» 회차): 애니모 10/29 업데이트(S1 «바람 따라 출발·하»)가 있었는데
공식 뉴스 100222 본문이 «긴 그림 7장»뿐이라 조사원이 «근거 불인정»으로 0건을 냈다. 공식 공지가 그림인 게임은 흔하다
(애니모·도깨비의세계 포럼 등) — 그림을 글자로 뽑아 근거로 쓸 수 있게 한다. 판독 엔진 = `img-ocr.ps1`(도깨비 forum_ocr.ps1 의 범용 사본).

사용
  python _tools/notice-ocr.py --page <공지 URL> [--out <txt>] [--json <json>] [--keep <폴더>] [--match <주소 조각>] [--max 20] [--min-w 400]
     --keep = 받은 그림을 그 폴더에 남긴다(001.jpg…) — 조사원·refute 가 Read 로 열어 날짜·수치를 눈으로 대조할 때
  python _tools/notice-ocr.py --img <그림 URL> [--img …] [--referer <URL>] …
  python _tools/notice-ocr.py --page <URL> --find 10/29 보상     # 판독 결과에서 낱말이 «한 그림 안에» 모두 든 곳(공백·구두점 무시)

동작
  ① --page: curl 로 HTML 을 받아 <img src|data-src> 와 본문 속 그림 주소를 모은다(로고·아이콘·푸터·og·스프라이트 이름은 뺀다 · --match 로 좁힐 수 있다).
  ② 그림을 curl 로 받는다(Referer = 그 페이지 · 요청 간격 0.6초 · ★이 PC 는 수집 과다로 IP 차단 이력이 있다 — 공지 1건 단위로만 쓴다).
  ③ img-ocr.ps1 로 배율 x2·x3 두 벌 판독(작은 글자 오독을 서로 메운다) → 폭이 --min-w 보다 좁은 그림(버튼·아이콘)은 결과에서 뺀다.
  ④ 출력 = 그림 순서대로 «[n] URL · 크기» + 판독 줄. --out 이면 파일로(머리에 경고 줄), --json 이면 {page, fetchedAt, images:[{url,size,x2,x3}]}.

★기계 판독이다 — 오독이 섞인다(숫자·고유명). 그래서
  ① 판독 글자는 «근거를 찾는 용도»다. 판에 싣는 값(날짜·보상·수치)은 그림 URL 을 Read 로 열어 눈으로 확인한 것만 쓴다.
  ② 데스크 항목의 sources 에는 공지 URL 을 그대로 쓰고 `"ocr": true` + `expect` = 판독 줄(눈으로 확인한 표기로 고친 것)을 단다 —
     url-verify 는 그림 속 글자를 못 보므로 이 출처의 MISS 는 정상이다(refute 가 그림을 열어 대조한다).
  ③ 여기서 안 나왔다고 «그림에도 없다»가 되지 않는다.
exit: 0 판독 1장 이상 · 2 인자 오류 · 3 그림 0장(주소 없음·받기 실패·전부 작은 그림)
"""
import io, os, re, sys, json, time, shutil, hashlib, argparse, tempfile, subprocess, datetime
from urllib.parse import urljoin, urlparse

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OCR = os.path.join(HERE, 'img-ocr.ps1')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
IMG_RE = re.compile(r'''(?:src|data-src|data-original)\s*=\s*["']([^"']+)["']|(https?://[^"'\s<>()]+?\.(?:png|jpe?g|webp|gif)(?:\?[^"'\s<>()]*)?)''', re.I)
EXT_RE = re.compile(r'\.(png|jpe?g|webp|gif|bmp)(?:$|\?)', re.I)
SKIP_RE = re.compile(r'logo|icon|favicon|footer|ogimage|og-image|sprite|avatar|emoji|qrcode|qr_|btn|button|badge|loading|blank\.', re.I)
NOTE = '★기계 판독(Windows OCR) — 오독이 섞여 있다. 근거를 찾는 용도로만 쓰고, 판·글에 옮길 값은 그림 URL 을 열어 눈으로 확인한다. 여기 없다 ≠ 그림에 없다.'


def curl(url, out=None, referer=None, timeout=40):
    a = ['curl', '-s', '-L', '--max-time', str(timeout), '-A', UA]
    if referer:
        a += ['-e', referer]
    a += (['-o', out] if out else []) + ['-w', '\n%{http_code} %{content_type}' if not out else '%{http_code} %{content_type}', url]
    r = subprocess.run(a, capture_output=True)
    raw = r.stdout.decode('utf-8', 'replace')
    if out:
        code, _, ct = raw.strip().partition(' ')
        return code, ct, None
    body, _, tail = raw.rpartition('\n')
    code, _, ct = tail.strip().partition(' ')
    return code, ct, body


def page_images(page, match):
    code, ct, html = curl(page)
    if code != '200' or not html:
        print('페이지 받기 실패', code, page, file=sys.stderr)
        return []
    seen, out = set(), []
    for m in IMG_RE.finditer(html):
        u = (m.group(1) or m.group(2) or '').strip().replace('&amp;', '&')
        if not u or u.startswith('data:'):
            continue
        u = urljoin(page, u)
        if not EXT_RE.search(urlparse(u).path + ('?' if '?' in u else '')) and not EXT_RE.search(u):
            continue
        if SKIP_RE.search(urlparse(u).path) or (match and match not in u) or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def ocr(urls, referer, min_w, keep=None):
    tmp = tempfile.mkdtemp(prefix='nocr_')
    rows = []
    try:
        names = []
        for i, u in enumerate(urls):
            m = EXT_RE.search(u)
            fn = '%03d_%s.%s' % (i, hashlib.sha1(u.encode('utf-8')).hexdigest()[:10], (m.group(1).lower() if m else 'png'))
            code, ct, _ = curl(u, os.path.join(tmp, fn), referer=referer)
            if code == '200' and ct.startswith('image/'):
                names.append((fn, u))
            else:
                rows.append({'url': u, 'err': '받기 실패 ' + code + ' ' + ct})
            time.sleep(0.6)
        if names:
            subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR, '-ImgDir', tmp], capture_output=True, timeout=1800)
        if keep:
            os.makedirs(keep, exist_ok=True)
            for fn, u in names:
                shutil.copyfile(os.path.join(tmp, fn), os.path.join(keep, fn.split('_')[0] + os.path.splitext(fn)[1]))
        for fn, u in names:
            op = os.path.join(tmp, fn + '.ocr.txt')
            if not os.path.isfile(op):
                rows.append({'url': u, 'err': '판독 결과 없음'})
                continue
            lines = io.open(op, encoding='utf-8').read().split('\n')
            if lines and lines[0].startswith('ERR'):
                rows.append({'url': u, 'err': lines[0][4:200]})
                continue
            row, cur = {'url': u, 'size': lines[0][5:] if lines[0].startswith('SIZE ') else ''}, None
            for l in lines[1:]:
                if l.startswith('--- x'):
                    cur = l[4:].strip()
                    row[cur] = []
                elif cur and l.strip():
                    row[cur].append(l.strip())
            w = int((row['size'].split('x') + ['0'])[0] or 0)
            if w and w < min_w:
                continue
            rows.append(row)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    order = {u: i for i, u in enumerate(urls)}
    return sorted(rows, key=lambda r: order.get(r['url'], 1e9))


def norm(s):
    return re.sub(r'[\s\.,:;·\-_/()\[\]「」『』<>~!?"\']', '', str(s)).lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page')
    ap.add_argument('--img', action='append', default=[])
    ap.add_argument('--referer')
    ap.add_argument('--match')
    ap.add_argument('--max', type=int, default=20)
    ap.add_argument('--min-w', type=int, default=400)
    ap.add_argument('--out')
    ap.add_argument('--json')
    ap.add_argument('--find', nargs='+')
    ap.add_argument('--keep')
    a = ap.parse_args()
    if not a.page and not a.img:
        print('사용: --page <URL> 또는 --img <URL> (머리 주석 참조)', file=sys.stderr)
        return 2
    urls = (page_images(a.page, a.match) if a.page else []) + a.img
    urls = urls[:a.max]
    if not urls:
        print('그림 주소 0개 — 페이지가 스크립트로 그림을 넣는 구조면 --img 로 직접 준다', file=sys.stderr)
        return 3
    rows = ocr(urls, a.referer or a.page, a.min_w, a.keep)
    good = [r for r in rows if 'err' not in r]
    if a.find:
        keys = [norm(k) for k in a.find]
        for i, r in enumerate(good, 1):
            for sc in ('x2', 'x3'):
                txt = norm(' '.join(r.get(sc, [])))
                if all(k in txt for k in keys):
                    hit = [l for l in r.get(sc, []) if any(k in norm(l) for k in keys)]
                    print('[%d] %s (%s)\n  %s' % (i, r['url'], sc, '\n  '.join(hit[:8])))
                    break
        return 0 if good else 3
    fetched = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    buf = ['# notice-ocr · %s · %s' % (a.page or '(그림 직접)', fetched), NOTE, '']
    for i, r in enumerate(rows, 1):
        if 'err' in r:
            buf.append('[%d] ✗ %s — %s' % (i, r['url'], r['err']))
            continue
        buf.append('[%d] %s · %s' % (i, r['url'], r['size']) + (' · 사본 %s' % os.path.join(a.keep, '%03d' % (urls.index(r['url'])) ) if a.keep else ''))
        buf += ['  ' + l for l in r.get('x2', [])]
        if r.get('x3') and r.get('x3') != r.get('x2'):
            buf.append('  --- x3')
            buf += ['  ' + l for l in r.get('x3', [])]
        buf.append('')
    text = '\n'.join(buf)
    if a.out:
        io.open(a.out, 'w', encoding='utf-8', newline='\n').write(text)
        print('→ %s · 그림 %d장 판독 · 실패 %d' % (a.out, len(good), len(rows) - len(good)))
    else:
        print(text)
    if a.json:
        io.open(a.json, 'w', encoding='utf-8', newline='\n').write(json.dumps({'page': a.page, 'fetchedAt': fetched, 'note': NOTE, 'images': rows}, ensure_ascii=False, indent=1))
    return 0 if good else 3


if __name__ == '__main__':
    sys.exit(main())
