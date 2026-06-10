# 작성자 간 문체 교차오염 결정론적 린트 (블로그 컴퍼니)
# 사용: python _tools/style-lint.py   (발행 push 전 게이트)
# 목적: 정규식으로 "기계적 시그니처" 오염을 100% 잡는다.
#       - 한 작성자 글에 '다른 작성자 전용 시그니처'가 들어가면 실패(exit 2).
#       ※ 문장 리듬·어미 비율 같은 '산문 톤' 오염은 정규식으로 못 잡으므로 검수2(LLM)가 담당.
import os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARAEA = "ㆍ"  # ㆍ 아래아(영도 전용 나열 구분자)

# 작성자별 '금지 패턴' = 그 작성자 글에 있으면 오염. (label, regex)
# 본문 텍스트만 검사하기 위해 태그/주석/스타일은 사전 제거.
DENY = {
    "봄딩": [
        ("영도식 가운뎃점 ㆍ(아래아)", re.escape(ARAEA)),
        ("영도 자기지칭 '주인장'", r"주인장"),
        ("영도/겜더 슬랭 (?) 너스레", r"\(\?\)"),
        ("영도 마무리 이모티콘 ' :)'", r"\s:\)"),
        ("영도 마무리 라벨 '오늘 내용 정리'", r"오늘 내용 정리"),
        ("영도 벤치 라벨 '한 줄 요약'", r"한 줄 요약"),
        ("겜더쿠 잔재 '이상 겜더쿠'", r"이상 겜더쿠"),
        ("게이머 슬랭 ㄱㄱ/ㄹㅇ/ㅇㅇ", r"(?:^|\s)(?:ㄱㄱ|ㄹㅇ|ㅇㅇ)(?:\s|[.!?]|$)"),
        ("강한 슬랭 갓겜/창렬/현타/지갑안녕", r"갓겜|창렬|현타|지갑\s*안녕"),
    ],
    "겜더쿠": [  # v3 = 봄딩 베이스(남성 어조). 영도 시그니처·옛 덕후 슬랭 금지.
        ("영도식 가운뎃점 ㆍ(아래아)", re.escape(ARAEA)),
        ("영도 자기지칭 '주인장'", r"주인장"),
        ("(?) 너스레(폐기)", r"\(\?\)"),
        ("영도 마무리 ' :)'", r"\s:\)"),
        ("영도 라벨 '오늘 내용 정리'/'한 줄 요약'", r"오늘 내용 정리|한 줄 요약"),
        ("옛 페르소나 '이상 겜더쿠였습니다'/'다음 덕질'", r"이상 겜더쿠|다음 덕질"),
        ("폐기 슬랭 갓겜/띵작/창렬/현타/지갑안녕/덕질", r"갓겜|띵작|창렬|현타|지갑\s*안녕|덕질"),
        ("게이머 슬랭 ㄱㄱ/ㄹㅇ/ㅇㅇ", r"(?:^|\s)(?:ㄱㄱ|ㄹㅇ|ㅇㅇ)(?:\s|[.!?]|$)"),
    ],
    "영도": [  # 영도는 ㆍ·(?)· :)·주인장이 정당(시그니처). 봄딩 마무리·ㅎㅎ만 금지.
        ("봄딩 마무리 '마치도록 할게요/마칠게요'", r"마치도록 할게요|마칠게요"),
        ("봄딩 웃음 'ㅎㅎ'", r"ㅎㅎ"),
        ("겜더쿠 잔재 '이상 겜더쿠'", r"이상 겜더쿠"),
    ],
    "연봄": [  # 연봄 = 부드럽고 담백(봄딩+겜더쿠 블렌드). 영도 시그니처·슬랭 금지. 시그니처 이모지(💙🩷🌿)는 허용.
        ("영도식 가운뎃점 ㆍ(아래아)", re.escape(ARAEA)),
        ("영도 자기지칭 '주인장'", r"주인장"),
        ("영도/겜더 슬랭 (?) 너스레", r"\(\?\)"),
        ("영도 마무리 이모티콘 ' :)'", r"\s:\)"),
        ("영도 라벨 '오늘 내용 정리'/'한 줄 요약'", r"오늘 내용 정리|한 줄 요약"),
        ("겜더쿠 잔재 '이상 겜더쿠'", r"이상 겜더쿠"),
        ("게이머 슬랭 ㄱㄱ/ㄹㅇ/ㅇㅇ", r"(?:^|\s)(?:ㄱㄱ|ㄹㅇ|ㅇㅇ)(?:\s|[.!?]|$)"),
        ("강한 슬랭 갓겜/띵작/창렬/현타/지갑안녕", r"갓겜|띵작|창렬|현타|지갑\s*안녕"),
    ],
}

def strip_html(s):
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S)
    # 미리보기 래퍼 라벨(topbar)은 본문이 아님 — "겜더쿠 · 게임 덕질" 같은 고정 라벨이 슬랭 규칙에 오탐되는 것 방지(2026-06-11)
    s = re.sub(r'<div class="topbar">.*?</div>', " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return s

def main():
    problems = []
    for author, rules in DENY.items():
        root = os.path.join(BASE, author)
        if not os.path.isdir(root):
            continue
        for dp, _, fs in os.walk(root):
            for fn in fs:
                if not fn.endswith(".html"):
                    continue
                p = os.path.join(dp, fn)
                text = strip_html(open(p, encoding="utf-8").read())
                for label, pat in rules:
                    hits = re.findall(pat, text)
                    if hits:
                        rel = os.path.relpath(p, BASE)
                        problems.append((author, rel, label, len(hits)))
    if problems:
        print("[STYLE-LINT] 교차오염 의심 발견:", len(problems), "건")
        for a, rel, label, n in problems:
            print(f"  - [{a}] {rel}\n      -> {label} ({n}회)")
        print("\n해당 작성자 순정 문체로 교정 후 다시 실행하세요. (산문 톤은 검수2가 별도 확인)")
        sys.exit(2)
    print("[STYLE-LINT] 통과: 작성자 간 기계적 시그니처 오염 없음.")
    sys.exit(0)

if __name__ == "__main__":
    main()
