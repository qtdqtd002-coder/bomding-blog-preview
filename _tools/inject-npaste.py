# inject-npaste.py — 봄딩 미리보기 전편에 네이버 붙여넣기 위젯 v2 include 한 줄을 넣는다(멱등).
#   python _tools/inject-npaste.py [--dry] [--skip-lint]
#   · 대상: posts.json 의 author=봄딩 미리보기 HTML 중 include 가 없는 파일.
#   · 삽입 위치: 이미지함 include(bomding-imagebox.js) 바로 다음 줄, 없으면 </body> 직전.
#   · style-lint 인자 모드(DENY=exit 2)에 걸리는 파일은 건너뛴다 — pre-push 훅이 push 되는 HTML 을 같은 모드로
#     린트하므로, 기존 위반 글을 섞으면 push 전체가 막힌다(이미지함 소급 때와 같은 원칙, 2026-09-02).
import io, json, os, re, subprocess, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINE = '<script src="https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/bomding-npaste.js" defer></script>'
IMAGEBOX = "bomding-imagebox.js"
LINT = os.path.join(BASE, "_tools", "style-lint.py")
DRY = "--dry" in sys.argv
SKIP_LINT = "--skip-lint" in sys.argv

posts = json.load(io.open(os.path.join(BASE, "posts.json"), encoding="utf-8"))
targets = [p["rel"] for p in posts if p.get("author") == "봄딩"]

def lint_ok(path):
    if SKIP_LINT:
        return True, ""
    r = subprocess.run([sys.executable, LINT, path], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode == 0, (r.stdout or "")[-300:]

done = skipped_have = skipped_lint = missing = 0
lint_fail = []
changed = []
for rel in targets:
    path = os.path.join(BASE, rel)
    if not os.path.exists(path):
        missing += 1
        continue
    raw = io.open(path, encoding="utf-8", errors="strict").read()
    if "bomding-npaste.js" in raw:
        skipped_have += 1
        continue
    ok, out = lint_ok(path)
    if not ok:
        skipped_lint += 1
        lint_fail.append(rel)
        continue
    nl = "\r\n" if "\r\n" in raw else "\n"
    if IMAGEBOX in raw:
        # 이미지함 include 줄 뒤에
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
print(f"대상 {len(targets)} | 삽입 {done}{' (dry)' if DRY else ''} | 이미 있음 {skipped_have} | 린트 제외 {skipped_lint} | 파일 없음 {missing} | 목록 {list_path}")
for r in lint_fail:
    print("  lint-skip:", r)
