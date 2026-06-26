# structure-sim.py — cookie-cutter(골격 균일) 정량 감지 (인프라, 2026-06-26)
# 목적: 같은 작성자(특히 같은 클러스터) 글들의 h2 시퀀스 유사도를 계산해 '골격 글자단위 동일/스파인 반복'을
#       수치로 경고한다. game-blog-qa qa-checklist M-1(애드센스 cookie-cutter)의 '눈대중'을 대체.
#       애드센스 거절 '유일 진짜 축'이 cookie-cutter라 게이트가 가장 약했던 곳(2026-06 월말 결산).
# 동작: BlogPreview/<작성자>/**/*.html 의 <h2> 텍스트 시퀀스를 정규화해, 작성자 내 쌍별 Jaccard 유사도 계산.
#       같은 클러스터(최상위 폴더) 쌍의 고유사도가 진짜 위험(POE2 빌드 연작·메이플 보스 연작).
# 읽기 전용(아무 파일도 수정하지 않음). 사용: python _tools/structure-sim.py [작성자] [--threshold 0.6] [--top 40]
import os, re, sys, itertools

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUTHORS = ["봄딩", "영도", "겜더쿠", "연봄"]

def h2words(html):
    # 글의 모든 <h2> 텍스트에서 '단어 집합'을 만든다(2글자+). 빌드/게임명이 박혀 있어도
    # 반복되는 템플릿 단어(어떻게·굴러가나·스킬·장비·장단점·신규·복귀 등)가 겹치면 골격 유사로 잡힌다.
    # 전체 h2 문자열 set은 주어가 박혀 다 달라져 못 잡으므로 단어 단위로 본다.
    words = set()
    n = 0
    for h in re.findall(r"(?is)<h2[^>]*>(.*?)</h2>", html):
        t = re.sub(r"<[^>]+>", " ", h)
        n += 1
        for w in re.findall(r"[0-9a-z가-힣]+", t.lower()):
            if len(w) >= 2:
                words.add(w)
    return words, n

def jaccard(a, b):
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)

def collect(author):
    root = os.path.join(BASE, author)
    posts = []
    if not os.path.isdir(root):
        return posts
    for dp, _, fs in os.walk(root):
        rel_dir = os.path.relpath(dp, root)
        segs = [] if rel_dir == "." else rel_dir.split(os.sep)
        if any(s.startswith(("_", ".")) for s in segs):   # _*/.* 폴더 제외
            continue
        for fn in fs:
            if not fn.endswith(".html") or "_티스토리_" in fn:
                continue
            p = os.path.join(dp, fn)
            try:
                html = open(p, encoding="utf-8").read()
            except Exception:
                continue
            words, n = h2words(html)
            if n < 2 or len(words) < 3:
                continue
            posts.append({
                "rel": os.path.relpath(p, BASE),
                "cluster": segs[0] if segs else "(root)",
                "words": words,
                "n": n,
            })
    return posts

def main():
    args = sys.argv[1:]
    threshold, top, targets = 0.6, 40, []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--threshold":
            threshold = float(args[i + 1]); i += 2; continue
        if a == "--top":
            top = int(args[i + 1]); i += 2; continue
        if a in AUTHORS:
            targets.append(a)
        i += 1
    if not targets:
        targets = AUTHORS

    grand = 0
    for author in targets:
        posts = collect(author)
        print(f"\n===== {author} : 분석대상 {len(posts)}편 (h2 2개 이상) =====")
        pairs = []
        for x, y in itertools.combinations(posts, 2):
            j = jaccard(x["words"], y["words"])
            if j >= threshold:
                pairs.append((j, x["cluster"] == y["cluster"], x, y))
        pairs.sort(key=lambda t: (-t[0], not t[1]))   # 유사도 desc, 같은클러스터 우선
        if not pairs:
            print(f"  ✓ h2 골격 유사도 ≥{threshold} 쌍 없음 — 다양성 양호")
            continue
        same = sum(1 for p in pairs if p[1])
        print(f"  ⚠ 골격 유사쌍 {len(pairs)}건(같은 클러스터 {same}건 — ★우선) · 상위 {min(top, len(pairs))} 표시:")
        grand += len(pairs)
        for j, samec, x, y in pairs[:top]:
            tag = "★같은클러스터" if samec else "  타클러스터"
            print(f"  {j:.2f} {tag}  {x['cluster']} ↔ {y['cluster']}")
            print(f"        - {x['rel']}")
            print(f"        - {y['rel']}")
    print(f"\n[structure-sim] 총 유사쌍 {grand}건 (threshold {threshold}). 같은 클러스터 고유사쌍 = cookie-cutter 우선 교정 대상.")

if __name__ == "__main__":
    main()
