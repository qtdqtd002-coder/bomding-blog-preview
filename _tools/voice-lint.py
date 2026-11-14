# voice-lint.py — 문체 수치(어미 비율·출처 귀속) 를 «작성자 실블로그 기준»과 견준다 (2026-11-14 신설 · LLM 0)
# 배경: 봄딩·영도 실블로그는 «~습니다·~는데요» 뼈대(«~어요» 거의 0)인데 우리 초안은 «~어요»체였다(쓰담/docs/2026-11-14_쓰담_구조진단_개선기획안.html).
#   ai-tell-lint 의 어미표는 «세기만» 했다 — 이 도구는 같은 식으로 센 값을 기준선과 비교해 판정을 낸다.
# 기준 = Desktop\Claude\_voice\fingerprint.json (실블로그 2026-05-30 이전 글 표본 · _voice/tools/build_fingerprint.py 가 만든다)
#   mode: "observe" = 기록만(집필·게이트에 안 보임) · "warn" = preflight 경고 · "block" = preflight 차단
#   ★차단 승격은 사용자 보고 뒤에만(2026-11-14 결정 2 — 2주 관찰 뒤).
# 사용:
#   python _tools/voice-lint.py <글.html> --writer 봄딩 [--purpose "<발주 목적>"] [--type 공략|소식] [--no-log]
#   python _tools/voice-lint.py --scan 봄딩 30        # 최근 30편 일괄(기록 안 함 · 분포 확인용)
#   python _tools/voice-lint.py --log-summary 7      # 관찰 기록 요약(주간 헬스체크 3c · 글마다 마지막 기록만)
# 출력: 표 + `<글폴더>/_qa/voice.json` + Desktop\Claude\_health\voice-log.jsonl 1줄(관찰 기록). exit 는 항상 0(판정은 preflight 가 mode 로).
import os, re, sys, io, json, glob, time, importlib.util

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))           # BlogPreview
ROOT = os.path.dirname(BASE)                                                 # Desktop\Claude
VOICE = os.path.join(ROOT, "_voice")
FP_PATH = os.path.join(VOICE, "fingerprint.json")
LOG_PATH = os.path.join(ROOT, "_health", "voice-log.jsonl")
GUIDE_KEYS = ("공략", "쿠폰", "티어", "추천", "순위", "가이드")
GUIDE_TITLE = re.compile(r"공략|방법|하는\s?법|얻는|티어|쿠폰|가이드|조합|위치|레시피|스킬|세팅|팁|육성")
MIN_CHARS = 600
_LIB = {"m": None}


def _lib():
    if _LIB["m"] is None:
        spec = importlib.util.spec_from_file_location("voicelib", os.path.join(VOICE, "tools", "voicelib.py"))
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        _LIB["m"] = m
    return _LIB["m"]


def _mode(v):
    """mode 낱말 정리 — 대소문자·공백을 봐주고, 모르는 값은 observe(조용히 차단으로 가지 않는다)."""
    v = str(v or "").strip().lower()
    return v if v in ("observe", "warn", "block") else "observe"


def load_fp():
    return json.load(io.open(FP_PATH, encoding="utf-8"))


def post_kind(purpose, title, writer=""):
    """('공략'|'소식'|'기어', 근거) — ★제목 낱말로만 가른다(voicelib.kind_of_title). 기준 표본(실블로그)에는 발주 목적이 없어서,
    초안만 purpose 로 가르면 기준과 초안의 유형 규칙이 달라진다(11-14 검수: 191편 중 85편이 엇갈렸다). purpose 는 쓰지 않는다."""
    return _lib().kind_of_title(title or "", writer), "title"


def check(html, writer, purpose="", title="", kind=""):
    """dict 를 돌려준다. 기준·표본이 없거나 글이 너무 짧으면 {'skipped': 사유}."""
    if not os.path.exists(FP_PATH):
        return {"skipped": "fingerprint.json 없음"}
    fp = load_fp()
    w = fp.get("writers", {}).get(writer)
    if not w:
        return {"skipped": "기준 없는 작성자 %s" % writer}
    lib = _lib()
    text = lib.prose_of_html(html, is_path=False)
    m = lib.metrics(text)
    if m["한글자수"] < MIN_CHARS:
        return {"skipped": "산문 %d자 < %d" % (m["한글자수"], MIN_CHARS)}
    src = "arg"
    if not kind:
        kind, src = post_kind(purpose, title, writer)
    ent = w["types"].get(kind) or w["types"]["all"]
    used = kind if kind in w["types"] else "all"
    checks = []
    for g in ent["gates"]:
        v = m[g["metric"]]
        ok = v <= g["value"] if g["op"] == "<=" else v >= g["value"]
        hard = g.get("hard", g["value"])                       # v1 기준 파일(hard 없음)이면 soft 와 같은 선
        far = not (v <= hard if g["op"] == "<=" else v >= hard)
        checks.append({"metric": g["metric"], "value": v, "op": g["op"], "limit": g["value"], "hard": hard,
                       "realMed": ent["dist"][g["metric"]]["med"], "ok": bool(ok), "far": bool(far)})
    n_out = sum(1 for c in checks if not c["ok"])
    n_far = sum(1 for c in checks if c["far"])
    # level — warn: 실제 글에 없는 값(hard) 1개 이상 또는 벗어난 항목 2개 이상 · block: 둘 다(_voice/tools/build_fingerprint.level 과 같은 규칙)
    lv = "block" if (n_far >= 1 and n_out >= 2) else ("warn" if (n_far >= 1 or n_out >= 2) else "ok")
    return {"writer": writer, "type": kind, "typeSrc": src, "basis": used, "basisN": ent["n"], "mode": _mode(os.environ.get("SSEUDAM_VOICE_MODE") or fp.get("mode", "observe")),   # 환경 변수는 사본 시험용(운영은 fingerprint.json)
            "chars": m["한글자수"], "metrics": m, "checks": checks, "out": n_out, "far": n_far, "level": lv,
            "fpBuilt": fp.get("built"), "checkedAt": time.strftime("%Y-%m-%d %H:%M")}


def summary(res):
    """한 줄 요약(preflight 경고·기록용)."""
    if res.get("skipped"):
        return "문체 수치 미판정(%s)" % res["skipped"]
    bad = ["«%s» %s(기준 %s %s · 실제 중앙 %s%s)" % (c["metric"], c["value"], c["op"], c["limit"], c["realMed"], " · 실제 글에 없는 값" if c.get("far") else "")
           for c in res["checks"] if not c["ok"]]
    if not bad:
        return "문체 수치 기준 안(%s · %s형 · 비광고 실제 글 %d편 기준)" % (res["writer"], res["type"], res["basisN"])
    tag = {"ok": "참고(실제 글도 서너 편 중 한 편은 한 항목쯤 벗어난다)", "warn": "주의", "block": "실제 글과 다름"}[res.get("level", "ok")]
    return "문체 수치 %s — 벗어난 항목 %d/%d(그중 실제 글에 없는 값 %d): %s [%s 비광고 실제 글 %s형 %d편 기준]" % (
        tag, res["out"], len(res["checks"]), res.get("far", 0), " · ".join(bad), res["writer"], res["basis"], res["basisN"])


def log(res, path):
    if res.get("skipped"):
        return
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        row = {"at": res["checkedAt"], "file": os.path.relpath(path, BASE).replace("\\", "/"), "writer": res["writer"], "type": res["type"],
               "mode": res["mode"], "out": res["out"], "far": res.get("far", 0), "level": res.get("level", ""), "chars": res["chars"]}
        for c in res["checks"]:
            row[c["metric"]] = c["value"]
        io.open(LOG_PATH, "a", encoding="utf-8", newline="\n").write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:
        pass


def save(res, path):
    try:
        d = os.path.join(os.path.dirname(path), "_qa")
        os.makedirs(d, exist_ok=True)
        io.open(os.path.join(d, "voice.json"), "w", encoding="utf-8", newline="\n").write(json.dumps(res, ensure_ascii=False, indent=1))
    except Exception:
        pass


def title_of(html):
    m = re.search(r"(?is)<h1\b[^>]*>(.*?)</h1>", html)
    return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""


def run_file(path, writer, purpose="", kind="", do_log=True, quiet=False):
    html = io.open(path, encoding="utf-8", errors="replace").read()
    res = check(html, writer, purpose, title_of(html), kind)
    if not res.get("skipped"):
        save(res, path)
        if do_log:
            log(res, path)
    if not quiet:
        print("[%s] %s" % (writer, os.path.relpath(path, BASE)))
        print("  " + summary(res))
        if not res.get("skipped"):
            for c in res["checks"]:
                print("   %s %-8s 초안 %6.2f · 기준 %s %5.2f · 실제 중앙 %5.2f%s" % ("✓" if c["ok"] else "✗", c["metric"], c["value"], c["op"], c["limit"], c["realMed"],
                      (" · 실제 글에 없는 값(한계 %s)" % c["hard"]) if c.get("far") else ""))
            m = res["metrics"]
            print("   참고: 네요 %.2f · 일인칭 %.2f · 문장평균 %.1f자 · 긴문장비 %.2f · 산문 %d자 · mode=%s" % (m["네요"], m["일인칭"], m["문장평균"], m["긴문장비"], m["한글자수"], res["mode"]))
    return res


def scan(writer, n):
    files = [f for f in glob.glob(os.path.join(BASE, writer, "**", "%s_미리보기_*.html" % writer), recursive=True) if "\\_qa\\" not in f and "/_qa/" not in f]
    files.sort(key=os.path.getmtime, reverse=True)
    rows = []
    for f in files[:n]:      # 일괄 확인은 아무것도 쓰지 않는다(_qa/voice.json·기록은 preflight·단건 실행만)
        html = io.open(f, encoding="utf-8", errors="replace").read()
        rows.append(check(html, writer, "", title_of(html)))
    rows = [r for r in rows if not r.get("skipped")]
    if not rows:
        print("대상 없음"); return
    print("%s 최근 %d편 — 판정 ok %d · 주의 %d · 실제 글과 다름 %d | 벗어난 항목 0개 %d편 · 1개 %d · 2개 %d · 3개+ %d" % (
        writer, len(rows), *(sum(1 for r in rows if r.get("level") == k) for k in ("ok", "warn", "block")),
        *(sum(1 for r in rows if r["out"] == k) for k in (0, 1, 2)), sum(1 for r in rows if r["out"] >= 3)))
    for metric in [c["metric"] for c in rows[0]["checks"]]:
        bad = sum(1 for r in rows for c in r["checks"] if c["metric"] == metric and not c["ok"])
        vals = sorted(c["value"] for r in rows for c in r["checks"] if c["metric"] == metric)
        print("   %-8s 이탈 %d/%d · 초안 중앙 %.2f" % (metric, bad, len(rows), vals[len(vals) // 2]))


def log_summary(days):
    """관찰 기록(_health/voice-log.jsonl) 요약 한 줄씩 — 글(file)마다 마지막 기록만 센다."""
    import datetime
    if not os.path.exists(LOG_PATH):
        print("voice-log: 기록 없음(%s)" % LOG_PATH); return
    since = (datetime.datetime.now() - datetime.timedelta(days=days)).strftime("%Y-%m-%d %H:%M")
    last = {}
    for ln in io.open(LOG_PATH, encoding="utf-8"):
        try:
            r = json.loads(ln)
        except Exception:
            continue
        if r.get("at", "") >= since:
            last[r.get("file")] = r
    if not last:
        print("voice-log: 최근 %d일 기록 0편" % days); return
    mode = load_fp().get("mode", "?") if os.path.exists(FP_PATH) else "?"
    for w in ("봄딩", "영도"):
        rows = [r for r in last.values() if r.get("writer") == w]
        if not rows:
            continue
        med = lambda k: sorted(r.get(k, 0) for r in rows)[len(rows) // 2]
        print("voice-log %s 최근 %d일 %d편(mode=%s) — 판정 ok %d편 · 주의 %d · 실제 글과 다름 %d | 중앙: 해요체합 %.2f · ~습니다 %.2f · ~는데요 %.2f · 출처귀속 %.2f" % (
            w, days, len(rows), mode, sum(1 for r in rows if r.get("level") == "ok"), sum(1 for r in rows if r.get("level") == "warn"), sum(1 for r in rows if r.get("level") == "block"),
            med("해요체합"), med("습니다"), med("는데요"), med("출처귀속")))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__ or "usage: voice-lint.py <html> --writer 봄딩"); sys.exit(0)
    if a[0] == "--log-summary":
        log_summary(int(a[1]) if len(a) > 1 else 7); sys.exit(0)
    if a[0] == "--scan":
        scan(a[1], int(a[2]) if len(a) > 2 else 30); sys.exit(0)

    def opt(name, default=""):
        return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default
    path = os.path.abspath(a[0])
    writer = opt("--writer") or next((w for w in ("봄딩", "영도") if ("\\%s\\" % w) in path or ("/%s/" % w) in path), "")
    run_file(path, writer, opt("--purpose"), opt("--type"), do_log="--no-log" not in a)
    sys.exit(0)
