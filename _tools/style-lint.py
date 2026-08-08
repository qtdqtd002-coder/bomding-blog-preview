# 작성자 간 문체 교차오염 + 발행본 금지요소 결정론적 린트 (블로그 컴퍼니)
# 사용: python _tools/style-lint.py   (발행 push 전 게이트 / git pre-push 훅에서 자동 실행)
# 목적: 정규식으로 "기계적 시그니처" 오염과 "AI 일반 템플릿/초안 잔재"를 100% 잡는다.
#       1) 한 작성자 글에 '다른 작성자 전용 시그니처'가 들어가면 실패(exit 2).  ← DENY/CLOSING_DENY
#       2) 전 작성자 공통: 발행본에 절대 없어야 하는 'AI 일반 템플릿 면책 박스/초안·QA 잔재'면 실패(exit 2). ← PUBLISH_DENY
#       3) 작성자 정본 스켈레톤을 안 쓴 '비표준 템플릿' 의심이면 경고(WARN, push는 막지 않음). ← PUBLISH_WARN
#       ※ 문장 리듬·어미 비율 같은 '산문 톤' 오염, 사실 오류, 문체 부재는 정규식으로 못 잡으므로 QA/검수2(LLM)가 담당.
#       ※ 🔍·.chk(미확정 마커)는 미리보기(작성자 확인용) 관례라 잡지 않는다 — 네이버/티스토리 붙여넣기 시 제외됨(feedback-log 2026-05-31).
# 배경: 2026-06-14, 봄딩 우마무스메 글이 파이프라인(작성 스킬·QA·린트)을 통째로 건너뛰고 'AI 일반 템플릿(.container/.disclaimer/🔍 본문노출)'
#       으로 발행된 사고. 이 린트가 push마다 자동(pre-push 훅) 실행되도록 강제 + 면책박스류를 전 작성자 공통 금지로 추가.
import os, re, sys

# Windows 기본 콘솔(cp949)에서 이모지(⚠ ✗)·한글 출력이 UnicodeEncodeError로 크래시 → pre-push 훅이 통째로 죽던 버그 수정(2026-06-14).
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

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
    # ★2026-08-08 신설 — 하루살이(네이버, 2026-07-22 합류)가 이 명단에 없어서
    #   author_of() 가 None 을 돌려주고 **모든 하루살이 글이 발행 게이트를 통째로 건너뛰고 있었다**
    #   (교차오염·발행본 금지요소 검사 0건 상태로 34편 발행). 명단 하드코딩이 만든 사각지대다.
    #   하루살이 = 가볍고 친근하되 **정중**, 한 문장 한 정보. 영도·겜더쿠 시그니처와 봄딩 마무리 금지.
    "하루살이": [
        ("영도식 가운뎃점 ㆍ(아래아)", re.escape(ARAEA)),
        ("영도 자기지칭 '주인장'", r"주인장"),
        ("영도/겜더 슬랭 (?) 너스레", r"\(\?\)"),
        ("영도 마무리 이모티콘 ' :)'", r"\s:\)"),
        ("영도 라벨 '오늘 내용 정리'/'한 줄 요약'", r"오늘 내용 정리|한 줄 요약"),
        ("겜더쿠 잔재 '이상 겜더쿠'", r"이상 겜더쿠"),
        ("봄딩 마무리 정형구 '포스팅 마치'", r"포스팅[을를]?\s*마치"),
        ("게이머 슬랭 ㄱㄱ/ㄹㅇ/ㅇㅇ", r"(?:^|\s)(?:ㄱㄱ|ㄹㅇ|ㅇㅇ)(?:\s|[.!?]|$)"),
        ("강한 슬랭 갓겜/띵작/창렬/현타", r"갓겜|띵작|창렬|현타"),
        # 하루살이 정본 §3 금지(aeo-geo) — 홍보성 과장어는 네이버가 인용 제외 대상으로 명시.
        # ★단정형만 잡는다: FAQ 질문·부정 맥락 오탐을 피하려고 '무조건/최저가' 는 뺐다
        #   (2026-08-08 발행본 10편 실측에서 4편이 부정·인용 맥락 오탐).
        ("홍보성 과장어 '역대급/모르면 손해'", r"역대급|모르면\s*손해"),
    ],
}

# 맺음말(마지막 본문 단락) 한정 금지 패턴 (2026-06-13 신설).
# 봄딩·겜더쿠·연봄은 본문 중 '댓글' 언급은 정당("필요한 분은 댓글 남겨주세요" 등)하나,
# 글을 '댓글 유도'로 닫는 사인오프는 영도 마무리 축(교차오염). 영도는 댓글 마무리가 시그니처라 제외.
# 봄딩 마무리 정본(opening-closing-bank B-1~B-4)엔 댓글로 닫는 유형이 없다.
CLOSING_DENY = {
    "봄딩":   [("영도식 댓글 유도 마무리(맺음말이 댓글로 닫힘)", r"댓글")],
    "겜더쿠": [("영도식 댓글 유도 마무리(맺음말이 댓글로 닫힘)", r"댓글")],
    "연봄":   [("영도식 댓글 유도 마무리(맺음말이 댓글로 닫힘)", r"댓글")],
}

# 양식 변형 차단 — 작성자 정본 스켈레톤(output-format §1-3) 위반. 봄딩·영도(네이버)에 금지된 티스토리/겜더쿠식 장식.
# 배경: 2026-06-14 봄딩 '레테' 글이 정본 스켈레톤을 안 타고 자유 생성돼, §1-3가 봄딩에 금지한 '내부링크 박스(같이 보면 좋은 글)'가 섞여 들어온 사고.
# 겜더쿠·연봄(티스토리)은 클러스터 내부링크 박스를 정당하게 쓰므로 여기서 제외(봄딩·영도만 적용).
FORMAT_DENY = {
    "봄딩": [
        ("티스토리/겜더쿠식 내부링크 박스 '같이 보면 좋은 글'(§1-3 봄딩 금지)", r"같이\s*보면\s*좋은\s*글"),
    ],
    "영도": [
        # ★2026-06-26: 영도는 텍스트형 '▶ 같이 보면 좋은 글'(h2.sec + 평문 링크)이 주인장 실제 시그니처라 허용.
        #   금지 = 겜더쿠식 '박스'만 — 🔗 라벨 또는 인라인 style= 로 감싼 박스/pill 형태(▶ 텍스트형은 통과).
        ("겜더쿠식 내부링크 박스(🔗 라벨/인라인 박스 style) — 영도는 ▶ 텍스트형만 허용", r'🔗\s*같이\s*보면\s*좋은\s*글|style="[^"]*(?:background|border|padding)[^"]*"[^>]*>[^<]*같이\s*보면\s*좋은\s*글'),
    ],
}

# 양식 변형 경고 — push는 막지 않으나 정본 스켈레톤 미사용(자유 생성) 의심. 봄딩·영도만.
# 봄딩 정본 소제목=h2.sub 클래스 / 영도=h2.sec 클래스. 인라인 style= 남용과 빈 앵커(href="#")는 정본 미준수 신호.
FORMAT_WARN = {
    "봄딩": [
        ("본문 <h2> 인라인 style= 사용(정본은 h2.sub 클래스)", r"<h2[^>]*\bstyle="),
        ('죽은/빈 링크 href="#" (실제 내부링크 URL 아님)', r'href="#"'),
    ],
    "영도": [
        ("본문 <h2> 인라인 style= 사용(정본은 h2.sec 클래스)", r"<h2[^>]*\bstyle="),
        ('죽은/빈 링크 href="#" (실제 내부링크 URL 아님)', r'href="#"'),
    ],
}

# 발행본 절대금지 — 전 작성자 공통(범인 글이 어느 폴더에 있든 적용). 정상 발행글엔 0건이어야 한다.
# 'AI 일반 템플릿 면책 박스 / 초안·QA 내부 잔재'로, 봄딩 우마무스메 사고(2026-06-14)의 핵심 시그니처.
PUBLISH_DENY = [
    ("AI 일반 템플릿 면책 박스(.disclaimer) — 정본 스켈레톤엔 없음", r'class="disclaimer"'),
    ("초안/QA 잔재 면책 문구 '게임 내 확인 필요'(발행본 노출 금지)", r"게임 내 확인 필요"),
    # ↓ 2026-06-14 WARN→DENY 승격(해당 잔존 글 전부 정리 완료: 포켓몬카드 아마존 재작성·유산균비교·레이드공략 메타푸터 제거)
    ("작성자 스켈레톤 대신 일반 .container 래퍼 사용(정본은 .wrap/.post)", r'class="container"'),
    ("초안 이미지 자리 'img-placeholder'(정본은 .ss/.shoot/.imgwrap)", r"img-placeholder"),
    ("발행본 금지 메타 푸터 '작성 참고…사실 확인'(검증 방법론은 내부 기록일 뿐 발행본 요소 아님)", r"작성\s*참고[\s\S]{0,40}사실\s*확인"),
]

# 비표준 템플릿 경고(WARN) — push를 막지는 않으나 정본 스켈레톤 미사용 의심. 전 작성자 공통분은 모두 DENY로 승격돼 현재 비어 있음.
# (봄딩·영도 양식 변형 경고는 위 FORMAT_WARN에서 처리: 인라인 h2·href="#")
PUBLISH_WARN = []

def strip_meta(s):
    # 클래스/태그는 남기되(class="disclaimer" 등 탐지 위해) 주석·스타일·스크립트만 제거.
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S)
    return s

def strip_html(s):
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S)
    # 미리보기 래퍼 라벨(topbar)은 본문이 아님 — "겜더쿠 · 게임 덕질" 같은 고정 라벨이 슬랭 규칙에 오탐되는 것 방지(2026-06-11)
    s = re.sub(r'<div class="topbar">.*?</div>', " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return s

def closing_paragraph(raw):
    # 캡션(class="cap" 등)을 뺀 마지막 본문 <p> = 맺음말. 없으면 빈 문자열.
    blocks = re.findall(r"<p\b([^>]*)>(.*?)</p>", raw, flags=re.S)
    body = [re.sub(r"<[^>]+>", " ", t) for attrs, t in blocks if "cap" not in attrs]
    return body[-1] if body else ""

# ===== 사실성(출처) 게이트 — 2026-08-08 신설 =====
# 배경: 2026-08-08 전반 감사에서 발행본 표본 결함이 나왔다.
#   ⒜ 연봄 레지트리오/루나아라/그라우돈 = 팬 DB(pokemondb)를 링크 텍스트 「포켓몬 공식」으로 표기
#   ⒝ 연봄·겜더쿠 = 출시일·배율·전투력 같은 확정형 수치를 쓰면서 외부 출처 링크 0
# 규칙은 산문에만 있었고(qa-checklist D장·verification-playbook) 코드 게이트가 없었다.
#
# ★캘리브레이션(발행본 639편 실측)으로 심각도를 갈랐다 — 오탐이 나면 사람이 게이트를 끄기 때문이다:
#   · SRC-1(공식 오표기) = **3편, 전부 진짜 결함, 오탐 0** → 두 모드 모두 DENY.
#   · SRC-0(출처 링크 0)  = 122편(19.1%)인데 **8월 이후 신규는 3편뿐**. 전체 스캔에서 DENY 로 걸면
#     과거 122편 때문에 **push 가 영구 차단**된다(= 게이트가 꺼지는 결말) → 신규 글이 오는
#     **인자 모드에서만 DENY**, pre-push 전체 스캔은 **WARN**.
# ★만들지 않은 것: '스토어 이미지 캡션의 1인칭 체험 표현' 검사. 639편에 1건 걸렸는데
#   그마저 오탐이었다(「네이버 본문엔 직접 업로드」= 발행 절차 서술). 규칙은 정본 산문으로만 둔다.
FAN_DB = ("pokemondb.net", "serebii.net", "bulbapedia", "namu.wiki", "fandom.com",
          "leekduck.com", "buffhub", "gamewith", "game8.co", "wikipedia.org")

def _body_html(raw):
    """#copy(붙여넣기 생존본) 앞까지 = 본문. 같은 내용을 두 번 세지 않는다."""
    m = re.search(r'id\s*=\s*["\']copy["\']', raw)
    seg = raw[:m.start()] if m else raw
    return re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", " ", seg, flags=re.S)

def check_sources(author, p, raw, problems, warnings, strict):
    rel = os.path.relpath(p, BASE)
    seg = _body_html(raw)

    # SRC-1 — 링크 텍스트가 '공식'이라 주장하는데 실제 도메인이 팬 DB·위키.
    bad = []
    for m in re.finditer(r'<a[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>', seg, re.S | re.I):
        href, txt = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
        if "공식" in txt and any(d in href.lower() for d in FAN_DB):
            bad.append(href)
    if bad:
        problems.append((author, rel, "SRC-1 출처 오표기 — 팬 DB·위키를 '공식'으로 표기 (%s)" % bad[0][:60], len(bad)))

    # SRC-0 — 확정형 수치·날짜가 있는데 외부 출처 링크가 0개.
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", seg))
    has_date = bool(re.search(r"20\d\d\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}|(?<!\d)\d{1,2}월\s*\d{1,2}일", text))
    has_num = bool(re.search(r"(?<![\d.])\d{3,}(?![\d.])", text))
    ext = [u for u in re.findall(r'<a[^>]*href\s*=\s*["\'](https?://[^"\']+)', seg, re.I)
           if "qtdqtd002-coder.github.io" not in u]
    if (has_date or has_num) and not ext:
        item = (author, rel, "SRC-0 수치·날짜가 있는데 외부 출처 링크 0 — 근거 없이 단정한 값이 없는지 확인", 1)
        (problems if strict else warnings).append(item)

def check_file(author, p, problems, warnings, strict=False):
    raw = open(p, encoding="utf-8").read()
    text = strip_html(raw)
    meta = strip_meta(raw)
    rel = os.path.relpath(p, BASE)
    check_sources(author, p, raw, problems, warnings, strict)
    # 1) 작성자 간 교차오염(본문 텍스트)
    for label, pat in DENY[author]:
        hits = re.findall(pat, text)
        if hits:
            problems.append((author, rel, label, len(hits)))
    # 맺음말 한정 검사(본문 중 정당 사용은 통과, 글을 그 표현으로 '닫는' 경우만 적발)
    close = closing_paragraph(raw)
    for label, pat in CLOSING_DENY.get(author, []):
        hits = re.findall(pat, close)
        if hits:
            problems.append((author, rel, label, len(hits)))
    # 2) 전 작성자 공통 발행본 금지요소(클래스/문구 — 주석·스타일 제거 후)
    for label, pat in PUBLISH_DENY:
        hits = re.findall(pat, meta)
        if hits:
            problems.append((author, rel, label, len(hits)))
    # 2-1) 양식 변형 차단(봄딩·영도 정본 스켈레톤 위반 — §1-3)
    for label, pat in FORMAT_DENY.get(author, []):
        hits = re.findall(pat, meta)
        if hits:
            problems.append((author, rel, label, len(hits)))
    # 3) 비표준 템플릿 경고(WARN)
    for label, pat in PUBLISH_WARN:
        hits = re.findall(pat, meta)
        if hits:
            warnings.append((author, rel, label, len(hits)))
    # 3-1) 양식 변형 경고(인라인 h2·빈 앵커 — 봄딩·영도)
    for label, pat in FORMAT_WARN.get(author, []):
        hits = re.findall(pat, meta)
        if hits:
            warnings.append((author, rel, label, len(hits)))


def author_of(p):
    # 경로 첫 세그먼트가 작성자명이면 그 작성자, 아니면 None(검사 대상 아님).
    rel = os.path.relpath(os.path.abspath(p), BASE)
    seg = rel.replace("\\", "/").split("/")[0]
    return seg if seg in DENY else None


def main():
    problems = []   # exit 2 — push 차단
    warnings = []   # WARN — push 막지 않음
    # ★인자로 파일을 주면 그 파일만 검사(드레이너의 job별 게이트). 인자 없으면 전체 스캔(pre-push 훅 — 종전 동작).
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if args:
        for a in args:
            p = os.path.abspath(a)
            if not (p.endswith(".html") and os.path.isfile(p)):
                continue
            author = author_of(p)
            if not author:
                continue  # 작성자 폴더 밖(아이콘·트렌드 등)은 작성자 린트 대상 아님
            # ★인자 모드 = 드레이너가 **이번에 발행할 글**만 검사하는 경로 → strict.
            #   SRC-0 을 여기서 차단해야 새 글이 무출처로 나가지 않는다(과거분은 아래 전체 스캔에서 WARN).
            check_file(author, p, problems, warnings, strict=True)
    else:
        for author in DENY.keys():
            root = os.path.join(BASE, author)
            if not os.path.isdir(root):
                continue
            for dp, _, fs in os.walk(root):
                for fn in fs:
                    if not fn.endswith(".html"):
                        continue
                    check_file(author, os.path.join(dp, fn), problems, warnings)

    if warnings:
        print("[STYLE-LINT] ⚠ 비표준 템플릿 경고(push는 막지 않음 — 작성자 정본 스켈레톤 사용 권장):", len(warnings), "건")
        for a, rel, label, n in warnings:
            print(f"  · [{a}] {rel}\n      ~> {label} ({n}회)")
        print()

    if problems:
        print("[STYLE-LINT] ✗ 발행 차단 — 교차오염/발행본 금지요소 발견:", len(problems), "건")
        for a, rel, label, n in problems:
            print(f"  - [{a}] {rel}\n      -> {label} ({n}회)")
        print("\n해당 작성자 순정 문체·정본 스켈레톤으로 교정 후 다시 실행하세요. (산문 톤·사실은 QA/검수2가 별도 확인)")
        sys.exit(2)
    print("[STYLE-LINT] 통과: 교차오염·발행본 금지요소 없음." + (" (경고는 위 참조)" if warnings else ""))
    sys.exit(0)

if __name__ == "__main__":
    main()
