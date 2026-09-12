#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
집필 프리플라이트 — 결정론으로 잡히는 결함을 QA 라운드 전에 없앤다  (2026-09-12 신설 · LLM 0)

왜 있나 (실측)
  QA 차원당 라운드가 편당 2.1~2.4 인데, R1 FAIL 사유의 다수가 **사람 판단이 필요 없는 것**들이다:
  분량 미달, `<img>` 치수 누락(CLS), 태그 메타↔본문 불일치, 제목 «N종» 과 실제 커버 수 불일치,
  날짜↔요일 오표기(09-07 실측 «수»→«목» 6곳 · 09-12 «8/13»↔실제 8/12).
  집필 프리플라이트 4종은 2026-07-11부터 «프롬프트 문장»으로만 존재했고, 문장은 집행되지 않았다.
  R2 한 바퀴 = 수정 5분 + 재QA 4분 + 4~5스폰(약 $2.5). 코드가 먼저 막으면 그만큼이 사라진다.

사용
  python preflight.py "<글 HTML 절대경로>" [--writer 봄딩|영도] [--min 2000] [--json]
    exit 0 = 통과 · exit 1 = 결함(고쳐서 다시 돌릴 것)
  집필·수정 서브가 **결과를 반환하기 전에** 스스로 돌린다. 드레이너 게이트에도 붙일 수 있다.

측정 정의 = game-blog-publish §2 «분량 측정 정의 — 정본 확정(2026-08-02)» 를 코드로 옮긴 것:
  포함 = 산문(p·li) + 소제목(h2·h3) + **표(td·th)**    ← 표는 독자가 읽는 본문이다
  제외 = 네이버 붙여넣기 위젯(#copy) · h1 · 캡션(.cap) · 출처줄(.src) · 각주(.tnote) · 태그줄(.tags)
          · 자리표시자 · HTML 주석
  단위 = **한글(가-힣) 글자수**
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, argparse, datetime

sys.stdout.reconfigure(encoding='utf-8')

WD = ['월', '화', '수', '목', '금', '토', '일']
BAND = {'봄딩': 2000, '영도': 2000, '겜더쿠': 2000, '연봄': 2500, '하루살이': 2000}


def strip_excluded(html):
    """분량 계수에서 빼야 하는 영역을 지운다."""
    t = re.sub(r'<!--.*?-->', ' ', html, flags=re.S)                      # 주석
    t = re.sub(r'<script\b.*?</script>', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<style\b.*?</style>', ' ', t, flags=re.S | re.I)
    # 네이버 붙여넣기 위젯 — id="copy" 블록 통째로(중복 계수 방지)
    t = re.sub(r'<div[^>]*id\s*=\s*["\']copy["\'].*?</div>\s*(?=<)', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<h1\b.*?</h1>', ' ', t, flags=re.S | re.I)
    for cls in ('cap', 'src', 'tnote', 'tags', 'pvbar', 'imgslot', 'shoot'):
        t = re.sub(r'<(\w+)[^>]*class\s*=\s*["\'][^"\']*\b%s\b[^"\']*["\'].*?</\1>' % cls,
                   ' ', t, flags=re.S | re.I)
    return t


def body_korean_chars(html):
    t = strip_excluded(html)
    chunks = re.findall(r'<(?:p|li|h2|h3|td|th)\b[^>]*>(.*?)</(?:p|li|h2|h3|td|th)>', t, flags=re.S | re.I)
    text = ' '.join(chunks)
    text = re.sub(r'<[^>]+>', ' ', text)
    return sum(1 for c in text if '가' <= c <= '힣'), text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path')
    ap.add_argument('--writer', default='')
    ap.add_argument('--min', type=int, default=0)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    p = os.path.abspath(a.path)
    if not os.path.isfile(p):
        print('⛔ 파일 없음: %s' % p)
        sys.exit(1)
    html = io.open(p, encoding='utf-8', errors='replace').read()

    writer = a.writer or next((w for w in BAND if w in p), '')
    floor = a.min or BAND.get(writer, 2000)
    issues, warns = [], []

    # ① 분량 — «작성자 자가보고를 신뢰하지 마라»(정본)를 코드로 강제
    n, _txt = body_korean_chars(html)
    if n < floor:
        issues.append('분량 %d자 < 하한 %d자(%s) — fluff 말고 **검증된 소재**로 채운다(기획팀 환류 경로)'
                      % (n, floor, writer or '기본'))

    # ② 이미지 치수(CLS) — 모든 <img> 에 width/height
    imgs = re.findall(r'<img\b[^>]*>', html, flags=re.I)
    nodim = [t for t in imgs
             if not (re.search(r'\bwidth\s*=', t, re.I) and re.search(r'\bheight\s*=', t, re.I))]
    if nodim:
        issues.append('img 치수 누락 %d/%d — width·height 속성 필수(CLS). 예: %s'
                      % (len(nodim), len(imgs), nodim[0][:90]))

    # ③ 날짜↔요일 — 실측 사고 2건(요일 6곳 오표기 · 날짜 하루 밀림)
    bad = []
    for m in re.finditer(r'(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?\s*\(\s*([월화수목금토일])\s*\)', html):
        y, mo, d, w = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4)
        try:
            real = WD[datetime.date(y, mo, d).weekday()]
        except ValueError:
            bad.append('%s-%s-%s(존재하지 않는 날짜)' % (y, mo, d))
            continue
        if real != w:
            bad.append('%d.%02d.%02d(%s) → 실제 %s' % (y, mo, d, w, real))
    if bad:
        issues.append('날짜↔요일 불일치 %d건: %s' % (len(bad), ' · '.join(bad[:5])))

    # ④ 제목 약속 수 ↔ 본문 커버리지
    head = ' '.join(re.findall(r'<title\b[^>]*>(.*?)</title>', html, flags=re.S | re.I)
                    + re.findall(r'<h1\b[^>]*>(.*?)</h1>', html, flags=re.S | re.I))
    head = re.sub(r'<[^>]+>', ' ', head)
    h2n = len(re.findall(r'<h2\b', html, flags=re.I))
    promise = re.search(r'(\d+)\s*(종|선|가지|개)\b', head)
    if promise:
        k = int(promise.group(1))
        # 표 행·리스트 항목도 커버 수단이라 h2 만으로 단정하지 않는다 — 모자랄 때만 경고.
        rows = len(re.findall(r'<tr\b', html, flags=re.I))
        lis = len(re.findall(r'<li\b', html, flags=re.I))
        if k > max(h2n, rows - 1, lis):
            warns.append('제목이 «%d%s»을 약속했는데 h2 %d·표행 %d·li %d — 커버 수를 세어 제목 숫자를 맞출 것'
                         % (k, promise.group(2), h2n, max(0, rows - 1), lis))

    # ⑤ 태그 줄 존재(네이버·티스토리 SEO) — 없으면 QA structure 가 반드시 잡는다
    if not re.search(r'class\s*=\s*["\'][^"\']*\btags\b', html, re.I) and '#' not in html[-3000:]:
        warns.append('태그 줄을 못 찾았다 — output-format 의 `.tags` 규격 확인')

    # ⑥ 초안·QA 잔재(발행본 금지요소) — style-lint 가 push 를 막지만 여기서 먼저 알린다
    for pat, why in ((r'class\s*=\s*["\'][^"\']*\bdisclaimer\b', '면책 박스(.disclaimer)'),
                     (r'게임 내 확인 필요', 'AI 템플릿 잔재 문구'),
                     (r'img-placeholder', '비표준 플레이스홀더')):
        if re.search(pat, html, re.I):
            issues.append('발행본 금지요소: %s — style-lint 가 push 를 차단한다' % why)

    ok = not issues
    if a.json:
        print(json.dumps({'ok': ok, 'chars': n, 'floor': floor, 'writer': writer,
                          'imgs': len(imgs), 'img_nodim': len(nodim),
                          'issues': issues, 'warns': warns}, ensure_ascii=False))
    else:
        print('=== 집필 프리플라이트: %s ===' % os.path.basename(p))
        print('  작성자 %s · 본문 한글 %d자(하한 %d) · img %d장(치수누락 %d) · h2 %d개'
              % (writer or '?', n, floor, len(imgs), len(nodim), h2n))
        for s in issues:
            print('  ⛔ %s' % s)
        for s in warns:
            print('  ⚠ %s' % s)
        if ok and not warns:
            print('  ✅ 통과 — 결정론 게이트에서 걸릴 것이 없다')
        elif ok:
            print('  ✅ 차단 사유 없음(경고만) — 경고는 고치는 쪽이 R2 를 아낀다')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
