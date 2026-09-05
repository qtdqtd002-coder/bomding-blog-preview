#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
img-lint.py — 글에 박힌 이미지가 «실제로 존재하는가»를 코드가 집행한다 (2026-09-05 신설)

왜 만들었나
-----------
2026-09-04, 봄딩 「팰월드 온라인 사전예약」 글이 이미지 4장을 전부
`play-lh.googleusercontent.com/<해시>=w526-h296-rw` 로 박은 채 발행됐다.
**4개 모두 HTTP 400 — 그 경로는 존재한 적이 없었다.** 구글플레이 CDN URL의 «형태»만 흉내 낸
날조였고, `width=600 height=338` 도 근거 없는 값이었다(실물은 1280x720).

사용자가 "이미지가 하나도 안 나온다"고 신고할 때까지 아무도 몰랐다. 이유는 단순하다 —
  · qa-structure 는 「이미지 A형 4장」으로 **개수만** 셌다(URL 생사 축 없음).
  · style-lint·pre-push 는 문체·금지요소만 본다.
  · 사실검증(qa-fact)은 **텍스트**를 본다. 이미지 경로는 검증 대상이 아니었다.
즉 **이미지 URL 날조는 현행 전 게이트를 무증상 통과한다.** 그 구멍을 코드로 막는다.

설계 원칙 — 네트워크를 타지 않는다
----------------------------------
사용자 결정(2026-09-05): «코드 게이트(비용 0)» 안. 그래서 이 린트는 **HTTP 요청을 하지 않는다.**
디스크에 있는 사실만 본다 — 파일이 있나, 치수가 맞나, 금지 호스트인가.
「실재하지만 맥락이 틀린 외부 핫링크」는 이 도구가 못 잡는다(그건 QA/검수 몫). 정직히 적어 둔다.

무엇을 보나
-----------
  IMG-1 🔴 참조한 로컬 이미지가 디스크에 없다.
        상대경로(`img/foo.jpg`)든 자체호스트 절대 URL(GitHub Pages)이든, 파일이 없으면 라이브에서 깨진다.
        ★2026-08 「img/ 미추적」 사고(커밋에서 이미지가 빠져 라이브만 깨짐)도 이 축이 잡는다.
  IMG-2 🔴 개인 블로그 CDN 이미지(네이버 blogfiles/postfiles/mblogthumb · 티스토리 cfile).
        image-sourcing §12-2 «하드 금지» — 출처를 밝혀도 안 된다. 호스트만 보면 확정이라 오탐 0.
  IMG-3 🟡 외부 핫링크(우리가 self-host 하지 않은 이미지).
        정본 §6은 self-host 가 기본이고 핫링크는 «받기가 끝내 막힐 때»만 허용한다.
        ★**self-host 0장 + 핫링크만 N장** 이면 self-host 절차를 통째로 건너뛴 글이라는 뜻 —
          팰월드 사고의 지문이 정확히 이것이라 따로 표시한다.
  IMG-4 🟡 self-host 이미지의 width/height 가 실제 파일 치수와 다르거나 없다(CLS·정본 §4).
        추정치로 박은 자리를 잡는다(팰월드 글의 600x338 이 이 유형).

쓰는 법
-------
  python img-lint.py <글 HTML 경로> [...]   # 인자 모드 — 위반 있으면 exit 1 (발행 게이트)
  python img-lint.py --all                   # 전수 스윕(보고용, 항상 exit 0)
  python img-lint.py --all --deny            # 전수 스윕을 차단 모드로
  python img-lint.py --json <경로...>        # 기계 출력
종료코드: 0 = 위반 없음 · 1 = 🔴 있음 · 2 = 실행 오류
"""
import sys, os, re, json, glob, struct
from urllib.parse import unquote, urlsplit

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))   # BlogPreview

# 자체호스트(GitHub Pages) 절대 URL 접두사. git remote 에서 유도하고, 실패하면 상수로 떨어진다.
FALLBACK_PAGES = "https://qtdqtd002-coder.github.io/bomding-blog-preview/"

# image-sourcing §12-2 하드 금지 — 개인 블로그에 실린 이미지(출처를 밝혀도 금지).
BANNED_HOSTS = [
    ("네이버 블로그", re.compile(r'(?:^|\.)(?:blogfiles|postfiles|mblogthumb-phinf|blogthumb\d*|blogpfthumb)\.pstatic\.net$')),
    ("티스토리 블로그", re.compile(r'^(?:t1|img1|blog)\.daumcdn\.net$')),
    ("티스토리 blog.kakaocdn", re.compile(r'^blog\.kakaocdn\.net$')),
]
# t1.daumcdn.net 은 /cfile 경로만 개인 블로그 첨부다. 그 외(스킨 리소스 등)는 제외한다.
DAUM_BLOG_PATH = re.compile(r'^/cfile', re.I)

IMG_TAG = re.compile(r'<img\b[^>]*>', re.I)
ATTR    = re.compile(r'(\w[\w:-]*)\s*=\s*"([^"]*)"|(\w[\w:-]*)\s*=\s*\'([^\']*)\'')


def pages_prefix():
    """git remote 에서 `https://<user>.github.io/<repo>/` 를 유도한다."""
    try:
        import subprocess
        url = subprocess.check_output(
            ["git", "-C", ROOT, "remote", "get-url", "origin"],
            stderr=subprocess.DEVNULL).decode("utf-8", "replace").strip()
        m = re.search(r'github\.com[:/]+([^/]+)/([^/.]+)', url)
        if m:
            return "https://%s.github.io/%s/" % (m.group(1).lower(), m.group(2))
    except Exception:
        pass
    return FALLBACK_PAGES


# ---------------------------------------------------------------- 이미지 치수(외부 의존 없음)
def image_size(path):
    """JPEG/PNG/GIF/WebP 헤더에서 (w,h). 못 읽으면 None — Pillow 를 요구하지 않는다."""
    try:
        with open(path, 'rb') as f:
            head = f.read(32)
            if len(head) < 16:
                return None
            # PNG
            if head[:8] == b'\x89PNG\r\n\x1a\n':
                return struct.unpack('>II', head[16:24])
            # GIF
            if head[:6] in (b'GIF87a', b'GIF89a'):
                return struct.unpack('<HH', head[6:10])
            # WebP (VP8 / VP8L / VP8X)
            if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
                fmt = head[12:16]
                f.seek(20)
                b = f.read(14)
                if fmt == b'VP8 ':
                    return (struct.unpack('<H', b[6:8])[0] & 0x3FFF,
                            struct.unpack('<H', b[8:10])[0] & 0x3FFF)
                if fmt == b'VP8L':
                    n = struct.unpack('<I', b[1:5])[0]
                    return ((n & 0x3FFF) + 1, ((n >> 14) & 0x3FFF) + 1)
                if fmt == b'VP8X':
                    w = b[4] | (b[5] << 8) | (b[6] << 16)
                    h = b[7] | (b[8] << 8) | (b[9] << 16)
                    return (w + 1, h + 1)
                return None
            # JPEG — SOFn 세그먼트까지 훑는다
            if head[:2] == b'\xff\xd8':
                f.seek(2)
                while True:
                    b = f.read(1)
                    while b and b != b'\xff':
                        b = f.read(1)
                    while b == b'\xff':
                        b = f.read(1)
                    if not b:
                        return None
                    marker = b[0]
                    if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                        continue
                    ln = f.read(2)
                    if len(ln) < 2:
                        return None
                    seglen = struct.unpack('>H', ln)[0]
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                                  0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                        d = f.read(5)
                        if len(d) < 5:
                            return None
                        h, w = struct.unpack('>HH', d[1:5])
                        return (w, h)
                    f.seek(seglen - 2, 1)
    except Exception:
        return None
    return None


# ---------------------------------------------------------------- 파싱
def parse_imgs(html):
    out = []
    for m in IMG_TAG.finditer(html):
        tag = m.group(0)
        attrs = {}
        for a in ATTR.finditer(tag):
            k = (a.group(1) or a.group(3) or '').lower()
            v = a.group(2) if a.group(2) is not None else a.group(4)
            attrs[k] = v
        if attrs.get('src'):
            out.append((attrs, tag, html.count('\n', 0, m.start()) + 1))
    return out


def classify(src, html_dir, prefix):
    """(kind, local_path or None). kind = local | selfhost | external | data"""
    s = (src or '').strip()
    if not s:
        return ('empty', None)
    if s.startswith('data:'):
        return ('data', None)
    low = s.lower()
    if low.startswith(prefix.lower()):
        rel = unquote(s[len(prefix):]).split('?')[0].split('#')[0]
        return ('selfhost', os.path.normpath(os.path.join(ROOT, rel.replace('/', os.sep))))
    if low.startswith('http://') or low.startswith('https://') or s.startswith('//'):
        return ('external', None)
    rel = unquote(s).split('?')[0].split('#')[0]
    if rel.startswith('/'):
        return ('selfhost', os.path.normpath(os.path.join(ROOT, rel.lstrip('/').replace('/', os.sep))))
    return ('local', os.path.normpath(os.path.join(html_dir, rel.replace('/', os.sep))))


def banned_host(src):
    try:
        u = urlsplit(src if '//' in src else '//' + src)
    except Exception:
        return None
    host = (u.hostname or '').lower()
    if not host:
        return None
    for label, rx in BANNED_HOSTS:
        if rx.search(host):
            if host.endswith('daumcdn.net') and not DAUM_BLOG_PATH.match(u.path or ''):
                continue
            return label
    return None


# ---------------------------------------------------------------- 검사
def check(path, prefix):
    res = {"file": os.path.relpath(path, ROOT).replace(os.sep, '/'),
           "red": [], "yellow": [], "counts": {}}
    try:
        with open(path, encoding='utf-8', errors='replace') as f:
            html = f.read()
    except Exception as e:
        res["red"].append(["IMG-0", "파일을 열 수 없음: %s" % e, ""])
        return res

    imgs = parse_imgs(html)
    html_dir = os.path.dirname(os.path.abspath(path))
    n_self = n_ext = 0

    for attrs, tag, line in imgs:
        src = attrs['src']
        short = src if len(src) <= 96 else src[:93] + '...'

        b = banned_host(src)
        if b:
            res["red"].append(["IMG-2", "개인 블로그 이미지(하드 금지 · image-sourcing §12-2): %s" % b,
                               "%d행 %s" % (line, short)])
            continue

        kind, local = classify(src, html_dir, prefix)
        if kind in ('local', 'selfhost'):
            n_self += 1
            if not os.path.isfile(local):
                res["red"].append(["IMG-1", "참조한 이미지 파일이 없음(라이브에서 깨짐)",
                                   "%d행 %s" % (line, short)])
                continue
            real = image_size(local)
            w, h = attrs.get('width'), attrs.get('height')
            if not w or not h:
                res["yellow"].append(["IMG-4", "width/height 없음(CLS · 정본 §4)",
                                      "%d행 %s" % (line, short)])
            elif real:
                try:
                    if (int(w), int(h)) != real:
                        res["yellow"].append(
                            ["IMG-4", "치수 불일치 — 태그 %sx%s ↔ 실제 %dx%d(추정치 금지 · 정본 §4)"
                             % (w, h, real[0], real[1]), "%d행 %s" % (line, short)])
                except ValueError:
                    res["yellow"].append(["IMG-4", "width/height 가 숫자가 아님: %s / %s" % (w, h),
                                          "%d행 %s" % (line, short)])
        elif kind == 'external':
            n_ext += 1
            res["yellow"].append(["IMG-3", "외부 핫링크(정본 §6은 self-host 가 기본)",
                                  "%d행 %s" % (line, short)])
        elif kind == 'empty':
            res["red"].append(["IMG-1", "src 가 비어 있음", "%d행" % line])

    res["counts"] = {"total": len(imgs), "selfhost": n_self, "external": n_ext}
    # 팰월드 사고의 지문: self-host 0 + 핫링크만 N장 = self-host 절차를 통째로 건너뛴 글
    if n_ext and not n_self:
        res["yellow"].append(["IMG-3!", "이 글은 self-host 이미지가 0장이고 외부 핫링크만 %d장입니다 — "
                              "정본 §6 self-host 절차를 건너뛴 신호(2026-09-04 팰월드 사고 유형)" % n_ext, ""])
    return res


def targets(argv):
    if '--all' in argv:
        out = []
        for w in ('봄딩', '영도', '겜더쿠', '연봄', '하루살이'):
            out += glob.glob(os.path.join(ROOT, w, '**', '*.html'), recursive=True)
        return [p for p in out if os.sep + '_qa' + os.sep not in p]
    return [a for a in argv[1:] if not a.startswith('-')]


def main():
    argv = sys.argv
    as_json = '--json' in argv
    deny = ('--all' not in argv) or ('--deny' in argv)
    files = targets(argv)
    if not files:
        print("img-lint: 검사할 글이 없습니다. (사용: python img-lint.py <글.html> ... | --all)")
        return 0

    prefix = pages_prefix()
    results = [check(p, prefix) for p in files]
    red = [r for r in results if r["red"]]
    yellow = [r for r in results if r["yellow"]]

    if as_json:
        print(json.dumps({"prefix": prefix, "results": results}, ensure_ascii=False, indent=2))
        return 1 if (red and deny) else 0

    for r in results:
        if not r["red"] and not r["yellow"]:
            continue
        print("\n■ %s" % r["file"])
        c = r.get("counts") or {}
        if c:
            print("   이미지 %d장(자체호스트 %d · 외부 %d)" % (c.get("total", 0), c.get("selfhost", 0), c.get("external", 0)))
        for code, msg, where in r["red"]:
            print("   🔴 [%s] %s" % (code, msg))
            if where:
                print("        %s" % where)
        for code, msg, where in r["yellow"]:
            print("   🟡 [%s] %s" % (code, msg))
            if where:
                print("        %s" % where)

    print("")
    print("── img-lint 결과 ── 검사 %d편 · 🔴 %d편 · 🟡 %d편" % (len(results), len(red), len(yellow)))
    if red:
        print("🔴 는 «디스크에 파일이 없다/금지 호스트다» 라 판단이 아니라 사실입니다 — 고치기 전엔 라이브가 깨집니다.")
        print("   고치는 법: 이미지를 글 폴더 img/ 에 받아(image-sourcing §6) 경로를 맞추고, 커밋에 img/ 를 함께 담으세요.")
    if not red and not yellow:
        print("✓ 통과: 깨진 참조·금지 호스트·치수 불일치 없음.")
    if red and deny:
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(2)
