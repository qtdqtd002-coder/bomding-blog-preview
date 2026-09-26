# inject-npaste.py — 네이버 붙여넣기 위젯(v2 include · 봄딩 위젯 골격) 주입 도구. 멱등.
#
# (A) 소급 모드(2026-09-05 · ★09-27 부터 --all 필수 — 인자 없이 돌면 사용법만 찍고 exit 2):
#   python _tools/inject-npaste.py --all [--author 봄딩|영도] [--dry] [--skip-lint]
#   · 대상: posts.json 의 해당 작성자 미리보기 HTML 중 include(naver-npaste.js / bomding-npaste.js)가 없는 파일.
#   · 삽입 위치: 이미지함 include(bomding-imagebox.js) 바로 다음 줄, 없으면 </body> 직전.
#   · style-lint 인자 모드(DENY=exit 2)에 걸리는 파일은 건너뛴다 — pre-push 훅이 push 되는 HTML 을 같은 모드로
#     린트하므로, 기존 위반 글을 섞으면 push 전체가 막힌다(이미지함 소급 때와 같은 원칙, 2026-09-02).
#   · 2026-09-05: 봄딩 283편은 bomding-npaste.js(1줄 로더)로 이미 들어가 있고, 캐논은 naver-npaste.js(봄딩·영도 공용).
#
# (B) 단일 파일 모드(2026-09-23 · 전수조사 P1 «주입 구조» — 봄딩 output-format 골격 분리):
#   python _tools/inject-npaste.py --file <html> [--dry] [--author 봄딩|영도] [--no-chrome] [--no-imagebox] [--lint-gate]
#   · 파이프라인이 집필 서브의 초안(·수정본) 저장 직후 돌린다. 집필 서브는 위젯·이미지함 «코드»를 쓰지 않는다 —
#     쓰는 것은 `<div id="copy">…</div>` 생존본(output-format §4-2)뿐이며 </body> 앞에 단독으로 둔다.
#   · 주입하는 것(봄딩 글 · 각각 멱등 — 이미 있으면 그대로):
#       ⑴ §4-3 위젯 CSS  → 첫 </style> 앞            (판별 `#npBtn{`)         템플릿 templates/npaste-widget.css
#       ⑵ §4-3 위젯 HTML+JS → </body> 앞, 집필 서브의 #copy 요소를 서랍 안으로 옮겨 감싼다 (판별 id="npBtn"/"npDrawer")
#            guide 의 {{N}}·{{M}}·{{제목}}·쿠팡 조건문은 #copy 안 〔사진 자리〕·〔제품컷〕·〔쿠팡 링크 자리〕 수와 h1.title 로 채운다.
#            #copy 가 없으면 exit 3 — output-format §4-0 «생존본 생략 금지»의 코드 게이트(파일 무변경).
#       ⑶ v2 include naver-npaste.js → </body> 앞   (봄딩·영도 공용)        템플릿 templates/npaste-include.html
#       ⑷ 이미지함 include bomding-imagebox.js → </body> 앞 (★봄딩만 — §6 전파 금지) 템플릿 templates/imagebox-include.html
#       ⑸ §1-7 .imgslot CSS  → 첫 </style> 앞, 본문이 class="imgslot…" 을 쓸 때만 (판별 `.imgslot{`)   templates/imgslot.css
#       ⑹ §1-4b 사이드노트 CSS → 첫 </style> 앞, 본문이 rev-hl/para-wrap/sidenote/pvbar 를 쓸 때만 (판별 `.sidenote{`) templates/sidenote.css
#     영도 경로(/영도/)면 ⑶만 넣는다(영도 정본은 분리 전 — 위젯은 영도 output-format §4 그대로 작성자 몫).
#   · 템플릿 정본 = ~/.claude/skills/bomding-blog-writer/references/templates/ (output-format.md 에서 옮긴 원문 그대로).
#   · 이 모드는 posts.json 을 읽지 않고 _inject-npaste.list 도 건드리지 않는다(병렬 파이프라인 서브가 동시에 돌려도 충돌 0).
#   · exit: 0=정상(변경 유무 무관) · 2=파일/구조/템플릿 오류 · 3=#copy 없음 · 4=--lint-gate 실패.
import io, json, os, re, subprocess, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINE = '<script src="https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/naver-npaste.js" defer></script>'
IMAGEBOX = "bomding-imagebox.js"
IMAGEBOX_LINE = '<script src="https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/bomding-imagebox.js" defer></script>'
LINT = os.path.join(BASE, "_tools", "style-lint.py")
TPL_DIR = os.path.join(os.path.expanduser("~"), ".claude", "skills", "bomding-blog-writer", "references", "templates")
DRY = "--dry" in sys.argv
SKIP_LINT = "--skip-lint" in sys.argv
AUTHOR = sys.argv[sys.argv.index("--author") + 1] if "--author" in sys.argv else "봄딩"


def lint_ok(path):
    if SKIP_LINT:
        return True, ""
    r = subprocess.run([sys.executable, LINT, path], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode == 0, (r.stdout or "")[-300:]


# ---------------------------------------------------------------------------
# (A) 소급 모드 — 2026-09-05 로직 그대로(무변경)
# ---------------------------------------------------------------------------
def run_author_mode():
    posts = json.load(io.open(os.path.join(BASE, "posts.json"), encoding="utf-8"))
    targets = [p["rel"] for p in posts if p.get("author") == AUTHOR]

    done = skipped_have = skipped_lint = missing = 0
    lint_fail = []
    changed = []
    for rel in targets:
        path = os.path.join(BASE, rel)
        if not os.path.exists(path):
            missing += 1
            continue
        raw = io.open(path, encoding="utf-8", errors="strict").read()
        if "naver-npaste.js" in raw or "bomding-npaste.js" in raw:
            skipped_have += 1
            continue
        ok, out = lint_ok(path)
        if not ok:
            skipped_lint += 1
            lint_fail.append(rel)
            continue
        nl = "\r\n" if "\r\n" in raw else "\n"
        if IMAGEBOX in raw:
            m = re.search(r'<script[^>]*' + re.escape(IMAGEBOX) + r'[^>]*>\s*</script>[ \t]*\r?\n?', raw)
            new = raw[:m.end()] + (LINE + nl if raw[m.end() - 1] in "\r\n" else nl + LINE + nl) + raw[m.end():]
        else:
            i = raw.rfind("</body>")
            if i < 0:
                skipped_lint += 1
                lint_fail.append(rel + " (no </body>)")
                continue
            new = raw[:i] + LINE + nl + raw[i:]
        if not DRY:
            io.open(path, "w", encoding="utf-8", newline="").write(new)
        done += 1
        changed.append(rel)

    # 커밋용 경로 목록(git add --pathspec-from-file) — 다른 세션이 건드린 파일이 섞이지 않게 바꾼 파일만 적는다
    list_path = os.path.join(BASE, "_tools", "_inject-npaste.list")
    io.open(list_path, "w", encoding="utf-8", newline="\n").write("\n".join(changed) + ("\n" if changed else ""))
    print(f"[{AUTHOR}] 대상 {len(targets)} | 삽입 {done}{' (dry)' if DRY else ''} | 이미 있음 {skipped_have} | 린트 제외 {skipped_lint} | 파일 없음 {missing} | 목록 {list_path}")
    for r in lint_fail:
        print("  lint-skip:", r)


# ---------------------------------------------------------------------------
# (B) 단일 파일 모드 — 2026-09-23
# ---------------------------------------------------------------------------
def die(code, msg):
    print("[file] ERROR:", msg)
    sys.exit(code)


def read_tpl(name):
    p = os.path.join(TPL_DIR, name)
    if not os.path.exists(p):
        die(2, f"템플릿 없음: {p}")
    return io.open(p, encoding="utf-8", newline="").read()


def find_div_by_id(raw, id_value, start=0):
    """<div … id="<id_value>" …> 요소의 (시작, 끝) — 중첩 div 를 깊이로 센다. 없으면 None."""
    m = re.compile(r'<div\b[^>]*\bid\s*=\s*["\']' + re.escape(id_value) + r'["\'][^>]*>', re.I).search(raw, start)
    if not m:
        return None
    tag = re.compile(r'<div\b|</div\s*>', re.I)
    depth, pos = 1, m.end()
    while depth:
        t = tag.search(raw, pos)
        if not t:
            return None
        depth += 1 if t.group(0).lower().startswith("<div") else -1
        pos = t.end()
    return (m.start(), pos)


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def article_part(raw):
    """#copy 앞까지 = 본문(style-lint 와 같은 판별)."""
    m = re.search(r'id\s*=\s*["\']copy["\']', raw)
    return raw[:m.start()] if m else raw


def fill_chrome(tpl, copy_el, photos, coupang, title):
    total = photos + coupang
    minutes = total + 1 if total <= 3 else total          # 최근 8편 관례(1→2·3→4·4→4·5→5·6→6) 에 맞춘 어림
    out = tpl
    out = out.replace("{{ · 👉 쿠팡 링크 {{N}}곳 본인 파트너스 URL}}",
                      (" · 👉 쿠팡 링크 %d곳 본인 파트너스 URL" % coupang) if coupang else "")
    out = out.replace("{{, 👉 쿠팡 링크는 본인 파트너스 URL 연결}}",
                      ", 👉 쿠팡 링크는 본인 파트너스 URL 연결" if coupang else "")
    out = out.replace("직접 채울 건 {{N}}가지(약 {{M}}분)", "직접 채울 건 %d가지(약 %d분)" % (total, minutes))
    out = out.replace("사진 {{N}}곳", "사진 %d곳" % photos)
    out = out.replace("{{제목}}", title)
    slot = find_div_by_id(out, "copy")
    if not slot:
        die(2, "템플릿 npaste-widget.html 에 #copy 슬롯이 없다")
    out = out[:slot[0]] + copy_el + out[slot[1]:]
    if "{{" in out:
        die(2, "템플릿 자리표시자가 남았다: " + out[out.find("{{"):out.find("{{") + 60])
    return out


def insert_before_first(raw, marker, block, nl):
    i = raw.find(marker)
    if i < 0:
        return None
    pre = raw[:i]
    if pre and not pre.endswith("\n"):
        block = nl + block
    return pre + block + raw[i:]


def run_file_mode(path):
    if not os.path.exists(path):
        die(2, f"파일 없음: {path}")
    raw = io.open(path, encoding="utf-8", errors="strict", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    norm = os.path.abspath(path).replace("\\", "/")
    if "--author" in sys.argv:
        author = AUTHOR
    else:
        author = "영도" if "/영도/" in norm else "봄딩"
    bomding = author == "봄딩"
    want_chrome = bomding and "--no-chrome" not in sys.argv
    want_imagebox = bomding and "--no-imagebox" not in sys.argv

    def tpl(name):
        t = read_tpl(name)
        return t.replace("\n", nl) if nl != "\n" else t

    # 템플릿 include 줄과 도구 상수의 드리프트 감시(치명 아님)
    if tpl("npaste-include.html").strip() != LINE:
        print("[file] WARN: templates/npaste-include.html 이 도구 상수 LINE 과 다르다 — 정본을 맞출 것")
    if want_imagebox and tpl("imagebox-include.html").strip() != IMAGEBOX_LINE:
        print("[file] WARN: templates/imagebox-include.html 이 도구 상수 IMAGEBOX_LINE 과 다르다 — 정본을 맞출 것")

    # 존재 판별은 전부 원본 기준으로 먼저 잰다
    has_chrome = re.search(r'id\s*=\s*["\']np(?:Btn|Drawer)["\']', raw) is not None
    has_css = re.search(r'#npBtn\s*\{', raw) is not None
    has_np = "naver-npaste.js" in raw or "bomding-npaste.js" in raw
    has_ib = IMAGEBOX in raw
    art = article_part(raw)
    uses_imgslot = re.search(r'class\s*=\s*["\'][^"\']*\bimgslot\b', art) is not None
    has_imgslot_css = re.search(r'\.imgslot\s*\{', raw) is not None
    uses_sidenote = re.search(r'class\s*=\s*["\'][^"\']*\b(?:rev-hl|para-wrap|sidenote|pvbar)\b', art) is not None
    has_sidenote_css = re.search(r'\.sidenote\s*\{', raw) is not None

    status = {}
    new = raw

    # ⑵ 위젯 HTML+JS — 집필 서브의 #copy 를 잘라 서랍 안에 넣는다
    if want_chrome:
        if has_chrome:
            status["chrome"] = "="
        else:
            span = find_div_by_id(new, "copy")
            if not span:
                die(3, "#copy 생존본이 없다 — 집필 서브가 output-format §4-2 생존본 <div id=\"copy\">…</div> 을 </body> 앞에 써야 한다(§4-0 생략 금지). 파일 무변경")
            a, b = span
            copy_el = new[a:b]
            # 잘라낼 때 그 줄의 앞 공백과 뒤 줄바꿈 하나를 같이 걷는다(빈 줄을 남기지 않게)
            ls = new.rfind("\n", 0, a) + 1
            if new[ls:a].strip() == "":
                a = ls
            if new.startswith(nl, b):
                b += len(nl)
            elif new.startswith("\n", b):
                b += 1
            new = new[:a] + new[b:]
            photos = copy_el.count("〔사진 자리") + copy_el.count("〔제품컷")
            coupang = copy_el.count("〔쿠팡 링크 자리")
            if photos == 0:
                photos = len(re.findall(r'class\s*=\s*["\'](?:ss|imgslot(?:\s+mini)?|imgwrap)["\']', art))
            if coupang == 0:
                coupang = len(re.findall(r'class\s*=\s*["\']coupang["\']', art))
            h1 = re.search(r'<h1\b[^>]*class\s*=\s*["\']title["\'][^>]*>(.*?)</h1>', art, re.S)
            title = strip_tags(h1.group(1)) if h1 else strip_tags((re.search(r"<title>(.*?)</title>", raw, re.S) or [None, ""])[1])
            chrome = fill_chrome(tpl("npaste-widget.html"), copy_el, photos, coupang, title)
            out = insert_before_first(new, "</body>", chrome, nl)
            if out is None:
                die(2, "</body> 가 없다")
            new = out
            status["chrome"] = "+(사진 %d·쿠팡 %d)" % (photos, coupang)
    else:
        status["chrome"] = "-"

    # ⑴ 위젯 CSS
    if want_chrome:
        if has_css:
            status["css"] = "="
        else:
            out = insert_before_first(new, "</style>", tpl("npaste-widget.css"), nl)
            if out is None:
                die(2, "</style> 가 없다")
            new = out
            status["css"] = "+"
    else:
        status["css"] = "-"

    # ⑶ v2 include
    if has_np:
        status["npaste"] = "="
    else:
        out = insert_before_first(new, "</body>", LINE + nl, nl)
        if out is None:
            die(2, "</body> 가 없다")
        new = out
        status["npaste"] = "+"

    # ⑷ 이미지함 include(봄딩만)
    if not want_imagebox:
        status["imagebox"] = "-"
    elif has_ib:
        status["imagebox"] = "="
    else:
        new = insert_before_first(new, "</body>", IMAGEBOX_LINE + nl, nl)
        status["imagebox"] = "+"

    # ⑸ .imgslot CSS · ⑹ 사이드노트 CSS — 쓰는 글에만, 위젯 CSS 보다 앞(첫 </style> 직전 순서: sidenote → imgslot → 위젯)
    for key, uses, has, name in (("imgslot", uses_imgslot, has_imgslot_css, "imgslot.css"),
                                 ("sidenote", uses_sidenote, has_sidenote_css, "sidenote.css")):
        if not bomding or not uses:
            status[key] = "-"
        elif has:
            status[key] = "="
        else:
            marker = "/* ===== 네이버 붙여넣기 위젯" if "/* ===== 네이버 붙여넣기 위젯" in new else "</style>"
            out = insert_before_first(new, marker, tpl(name), nl)
            if out is None:
                die(2, "</style> 가 없다")
            new = out
            status[key] = "+"

    if "--lint-gate" in sys.argv:
        ok, out = lint_ok(path)
        if not ok:
            die(4, "style-lint 실패 — 주입 보류(파일 무변경)\n" + out)

    changed = new != raw
    if changed and not DRY:
        io.open(path, "w", encoding="utf-8", newline="").write(new)
    print("[file] %s | 작성자 %s | 위젯HTML %s | 위젯CSS %s | npaste %s | imagebox %s | imgslot-css %s | sidenote-css %s | %dB→%dB%s%s" % (
        path, author, status["chrome"], status["css"], status["npaste"], status["imagebox"], status["imgslot"], status["sidenote"],
        len(raw.encode("utf-8")), len(new.encode("utf-8")), " (dry)" if DRY else "", "" if changed else " · 변경 0"))
    sys.exit(0)


if "-h" in sys.argv or "--help" in sys.argv:
    # ★2026-09-27: --help 가 없어 «인자 없음 = (A) 소급 모드» 로 떨어졌다 — 사용법을 보려던 집필 서브가
    #   봄딩 글 3편에 include 를 실제로 넣었다(즉시 git checkout 으로 복구). 도움말은 이 파일 머리 주석이다.
    print(open(__file__, encoding="utf-8").read().split("import io,", 1)[0].rstrip())
    sys.exit(0)
if "--file" in sys.argv:
    run_file_mode(sys.argv[sys.argv.index("--file") + 1])
elif "--all" in sys.argv:
    run_author_mode()
else:
    print("[inject-npaste] 인자가 없다 — 글 1편은 --file <html>, 작성자 전체 소급은 --all [--author 봄딩|영도] [--dry] (도움말 --help).")
    print("  ★2026-09-27: 소급 모드는 --all 을 적어야만 돈다(인자 없이 실행해 봄딩 글 3편이 바뀐 사고 뒤).")
    sys.exit(2)
