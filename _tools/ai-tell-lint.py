# ai-tell-lint.py — 타이포/시각 레이어 AI티 카운터 (인프라, 2026-06-27)
# 목적: style-lint(시그니처·클래스)·structure-sim(h2 골격)이 못 보는 '타이포/시각 레이어'를 수치화.
#   독자·구글이 즉각 인지하는 AI 티 = em-dash 남발·볼드 과다·이모지 떡칠·전부 리스트·문단 길이 과균일·헤지 남발.
# ★대상 = 겜더쿠·연봄만(봄딩·영도는 사람이 직접 전사·검수 → 학습격리, 비대상).
# ★WARN 전용(push 차단 안 함). 임계는 라이브 정상글 분포로 캘리브레이션한 값(아래 TH). 좋은 글을 막지 않는 게 우선.
# 사용:
#   python _tools/ai-tell-lint.py 겜더쿠 연봄            # WARN 스캔
#   python _tools/ai-tell-lint.py --stats 겜더쿠 연봄     # 분포(캘리브레이션용 — min/median/p75/p90/max)
#   python _tools/ai-tell-lint.py <파일.html ...>         # 특정 파일만(작성 직전 셀프 게이트)
import os, re, sys, statistics

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_AUTHORS = ["겜더쿠", "연봄"]   # 격리: 봄딩·영도(사람 전사)는 비대상

# 작성자별 시그니처 이모지(이건 '과용'에서 제외 — 의도된 정체성). 연봄 듀얼보이스 💙🩷🌿.
SIGNATURE_EMOJI = {
    "연봄": set("💙🩷🌿"),
    "겜더쿠": set(),
}
# 헤지(추측·완충) 어구 — 한국어. 떼로 몰리면 LLM 톤.
HEDGE = [
    r"수\s*있습니다", r"수\s*있어요", r"수\s*있는", r"수\s*도\s*있", r"수도\s*있",
    r"것\s*같", r"듯\s*합니다", r"듯해요", r"듯한", r"아마(?:도)?", r"보입니다", r"보여요",
    r"편입니다", r"편이에요", r"정도(?:입니다|예요|이에요)", r"느낌(?:입니다|이에요|이네요)",
    r"라고\s*합니다", r"다고\s*합니다", r"라고\s*하는데", r"으로\s*보입니다",
]
EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF←-⇿⬀-⯿️]"
)

# ── 작성자별 캘리브레이션 WARN 임계(2026-06-27, 각 작성자 라이브 분포 ~p90) ──
# ★절대적 'AI티 기준'이 아니라 '그 작성자 자기 글들 중 가장 튀는 상위 ~10%'를 표시한다(페르소나 norm 존중·정상글 차단 방지).
#   겜더쿠(HUD 결)는 이모지·볼드가 본래 많고, 연봄은 불릿이 거의 없는 등 정상범위가 작성자마다 달라 글로벌 임계는 오작동.
#   분포가 바뀌면 `--stats`로 다시 보고 재튜닝. para_unif는 '이 값 미만'이면 과균일 경고(나머지는 초과 시 경고).
TH = {
    "겜더쿠": { "emdash_per1k": 4.5, "bold_ratio": 0.21, "emoji_per_h2": 24.0, "bullet_ratio": 0.30, "para_unif": 0.75, "hedge_ratio": 0.13 },
    "연봄":   { "emdash_per1k": 4.0, "bold_ratio": 0.20, "emoji_per_h2": 2.5,  "bullet_ratio": 0.10, "para_unif": 0.85, "hedge_ratio": 0.22 },
}

def clean(html):
    html = re.sub(r"(?is)<!--.*?-->", " ", html)
    html = re.sub(r"(?is)<(style|script)[^>]*>.*?</\1>", " ", html)
    return html

def visible_text(html):
    return re.sub(r"<[^>]+>", " ", html)

def metrics(html, author):
    h = clean(html)
    text = visible_text(h)
    text_nospace = re.sub(r"\s+", "", text)
    n_chars = max(1, len(text_nospace))
    # em-dash
    emdash = text.count("—")
    emdash_per1k = emdash / n_chars * 1000
    # bold ratio
    bold_text = "".join(re.findall(r"(?is)<(?:strong|b)\b[^>]*>(.*?)</(?:strong|b)>", h))
    bold_len = len(re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", bold_text)))
    bold_ratio = bold_len / n_chars
    # emoji (시그니처 제외)
    sig = SIGNATURE_EMOJI.get(author, set())
    emojis = [e for e in EMOJI_RE.findall(text) if e not in sig]
    n_h2 = max(1, len(re.findall(r"(?is)<h2\b", h)))
    emoji_per_h2 = len(emojis) / n_h2
    # bullet ratio
    n_li = len(re.findall(r"(?is)<li\b", h))
    n_p = len(re.findall(r"(?is)<p\b", h))
    total_blocks = max(1, n_li + n_p)
    bullet_ratio = n_li / total_blocks
    # paragraph uniformity (문단별 문장수 표준편차)
    paras = re.findall(r"(?is)<p\b[^>]*>(.*?)</p>", h)
    sent_counts = []
    for p in paras:
        pt = re.sub(r"<[^>]+>", "", p).strip()
        if len(pt) < 10:
            continue
        sents = [s for s in re.split(r"[.!?。…]+|다\.|요\.", pt) if len(s.strip()) > 4]
        sent_counts.append(max(1, len(sents)))
    para_unif = statistics.pstdev(sent_counts) if len(sent_counts) >= 3 else 99.0
    # hedge ratio
    n_sent = max(1, len(re.split(r"[.!?。…]\s|다\.\s|요\.\s", text)))
    hedge_hits = sum(len(re.findall(p, text)) for p in HEDGE)
    hedge_ratio = hedge_hits / n_sent
    return {
        "emdash_per1k": round(emdash_per1k, 2),
        "bold_ratio": round(bold_ratio, 3),
        "emoji_per_h2": round(emoji_per_h2, 2),
        "bullet_ratio": round(bullet_ratio, 2),
        "para_unif": round(para_unif, 2),
        "hedge_ratio": round(hedge_ratio, 2),
    }

def flags(m, author):
    t = TH.get(author, TH["겜더쿠"])
    out = []
    if m["emdash_per1k"] > t["emdash_per1k"]: out.append(f"em-dash 남발({m['emdash_per1k']}/1k>{t['emdash_per1k']})")
    if m["bold_ratio"]   > t["bold_ratio"]:   out.append(f"볼드 과다({m['bold_ratio']}>{t['bold_ratio']})")
    if m["emoji_per_h2"] > t["emoji_per_h2"]: out.append(f"이모지 과다({m['emoji_per_h2']}/h2>{t['emoji_per_h2']})")
    if m["bullet_ratio"] > t["bullet_ratio"]: out.append(f"리스트 과다({m['bullet_ratio']}>{t['bullet_ratio']})")
    if m["para_unif"]    < t["para_unif"]:    out.append(f"문단 과균일({m['para_unif']}<{t['para_unif']})")
    if m["hedge_ratio"]  > t["hedge_ratio"]:  out.append(f"헤지 남발({m['hedge_ratio']}>{t['hedge_ratio']})")
    return out

def collect(author):
    root = os.path.join(BASE, author)
    posts = []
    if not os.path.isdir(root):
        return posts
    for dp, _, fs in os.walk(root):
        segs = os.path.relpath(dp, root).split(os.sep)
        if any(s.startswith(("_", ".")) for s in segs if s not in (".", "")):
            continue
        for fn in fs:
            if not fn.endswith(".html") or "_티스토리_" in fn:
                continue
            p = os.path.join(dp, fn)
            try:
                html = open(p, encoding="utf-8").read()
            except Exception:
                continue
            posts.append((os.path.relpath(p, BASE), metrics(html, author)))
    return posts

def main():
    args = sys.argv[1:]
    stats_mode = "--stats" in args
    args = [a for a in args if a != "--stats"]
    file_args = [a for a in args if a.endswith(".html")]
    authors = [a for a in args if a in TARGET_AUTHORS]

    if file_args:
        for f in file_args:
            p = os.path.abspath(f)
            author = next((a for a in TARGET_AUTHORS if f"{os.sep}{a}{os.sep}" in p or p.split(os.sep)[-3:].count(a)), None)
            author = author or "겜더쿠"
            try:
                m = metrics(open(p, encoding="utf-8").read(), author)
            except Exception as e:
                print(f"  ! {f}: {e}"); continue
            fl = flags(m, author)
            print(f"[{author}] {os.path.relpath(p, BASE)}  {m}")
            print("  ⚠ " + " · ".join(fl) if fl else "  ✓ 타이포 AI티 임계 이내")
        return

    if not authors:
        authors = TARGET_AUTHORS
    metric_keys = list(TH.keys())
    grand_warn = 0
    for author in authors:
        posts = collect(author)
        print(f"\n===== {author} : {len(posts)}편 =====")
        if not posts:
            continue
        if stats_mode:
            for k in metric_keys:
                vals = sorted(m[k] for _, m in posts)
                n = len(vals)
                def pct(q): return vals[min(n-1, int(q*n))]
                print(f"  {k:14} min={vals[0]:<6} median={statistics.median(vals):<6} p75={pct(0.75):<6} p90={pct(0.90):<6} max={vals[-1]:<6} (TH={TH.get(author,{}).get(k,'-')})")
            continue
        warned = [(rel, m, flags(m, author)) for rel, m in posts]
        warned = [(rel, m, fl) for rel, m, fl in warned if fl]
        grand_warn += len(warned)
        if not warned:
            print("  ✓ 전 글 타이포 AI티 임계 이내")
            continue
        print(f"  ⚠ {len(warned)}편 경고(WARN — push 차단 아님):")
        for rel, m, fl in sorted(warned, key=lambda t: -len(t[2])):
            print(f"  · {rel}\n      {' · '.join(fl)}")
    if not stats_mode:
        print(f"\n[ai-tell-lint] WARN {grand_warn}편 (겜더쿠·연봄 대상 / 봄딩·영도 비대상=격리). WARN은 작성단계 점검용이며 발행을 막지 않는다.")

if __name__ == "__main__":
    main()
