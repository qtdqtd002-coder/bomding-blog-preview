#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
refresh-due.py — 갱신 약속이 기한에 닿은 글 목록 (2026-10-19 신설 · 봄딩·영도 · LLM 0 · 읽기 전용)

왜 있나: 네이버 공식 가이드 원칙 ⑤ «정보가 바뀌면 글을 수정»(각 작성자 ai-briefing.md §2-2 R10).
  글에 «다시 정리해서 올릴게요»·예정된 변경 날짜(초기화·시즌 종료·패치)가 있으면 작성 서브가
  글 폴더에 `_qa/refresh.json` 을 남긴다. 이 도구는 그 기록을 모아 «지금 갱신할 글»을 보여 준다.
  갱신 자체는 같은 주소 개선본 경로(-Kind improve)가 한다 — 이 도구는 아무 파일도 고치지 않는다.

  python _tools/refresh-due.py [--days N] [--all] [--json] [--out <path>]
    --days N : 오늘부터 N일 안에 기한이 오는 것까지 포함(기본 0 = 오늘까지 기한이 지난 것만)
    --all    : 기한과 무관하게 기록 전부
    --json   : 사람용 표 대신 JSON 배열
    --out P  : JSON 을 파일로 쓴다(updated 시각 포함) — ★사이트 홈 «갱신할 글» 타일의 스냅샷
               `--all --out _trend/_refresh.json` 을 데스크 [E](매일 06:00) 가 하루 1회 굽는다(2026-10-19 사용자 지시).
               항목의 rel = 글 폴더의 미리보기 HTML(사이트 링크용).

refresh.json 형식(하나 또는 배열):
  {"due": "YYYY-MM-DD", "why": "10-21 정기 점검 도술 강화·돌파 초기화", "fix": ["도술 문단", "하루 순서"]}
  · 갱신을 마치면 그 항목에 "done": "YYYY-MM-DD" 를 적는다(목록에서 빠진다). 파일을 지우지 않는다.

exit: 0 = 정상(목록 유무 무관) · 2 = 인자 오류. 형식이 깨진 refresh.json 은 «형식 오류» 줄로 알리고 계속한다.
"""
import io, os, re, sys, json, glob, argparse, datetime

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITERS = ('봄딩', '영도')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def title_of(folder):
    """(제목, 미리보기 HTML 의 ROOT 기준 경로) — 글 1편 = 글 폴더 HTML 1개(07_교훈)."""
    for f in sorted(glob.glob(os.path.join(folder, '*.html'))):
        try:
            raw = io.open(f, encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        rel = os.path.relpath(f, ROOT).replace('\\', '/')
        m = re.search(r'<h1\b[^>]*>(.*?)</h1>', raw, re.S) or re.search(r'<title>(.*?)</title>', raw, re.S)
        if m:
            return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m.group(1))).strip(), rel
        return os.path.basename(folder), rel
    return os.path.basename(folder), ''


def load(path):
    data = json.load(io.open(path, encoding='utf-8'))
    items = data if isinstance(data, list) else [data]
    for it in items:
        if not isinstance(it, dict) or not DATE_RE.match(str(it.get('due', ''))):
            raise ValueError('due 가 YYYY-MM-DD 가 아니다')
    return items


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument('--days', type=int, default=0)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    today = datetime.date.today()
    limit = today + datetime.timedelta(days=max(a.days, 0))

    rows, bad = [], []
    for w in WRITERS:
        for path in glob.glob(os.path.join(ROOT, w, '**', '_qa', 'refresh.json'), recursive=True):
            folder = os.path.dirname(os.path.dirname(path))
            rel = os.path.relpath(folder, ROOT).replace('\\', '/')
            try:
                items = load(path)
            except Exception as e:
                bad.append((rel, str(e)))
                continue
            for it in items:
                if it.get('done'):
                    continue
                due = datetime.date.fromisoformat(it['due'])
                if not a.all and due > limit:
                    continue
                title, html_rel = title_of(folder)
                rows.append({'writer': w, 'post': rel, 'rel': html_rel, 'title': title, 'due': it['due'],
                             'late': (today - due).days, 'why': it.get('why', ''), 'fix': it.get('fix', [])})
    rows.sort(key=lambda r: r['due'])

    doc = {'today': today.isoformat(), 'items': rows, 'bad': [{'post': p, 'error': e} for p, e in bad]}
    if a.out:
        doc = dict(doc, updated=datetime.datetime.now().astimezone().isoformat(timespec='seconds'))
        out = a.out if os.path.isabs(a.out) else os.path.join(ROOT, a.out)
        tmp = out + '.tmp'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
        os.replace(tmp, out)
        print('[refresh-due] %s · %d건%s' % (os.path.relpath(out, ROOT).replace('\\', '/'), len(rows),
                                            (' · 형식 오류 %d' % len(bad)) if bad else ''))
        return 0
    if a.json:
        print(json.dumps(doc, ensure_ascii=False, indent=1))
        return 0
    print('[refresh-due] 오늘 %s · %s · %d건%s' % (today.isoformat(), '전체' if a.all else ('%d일 안' % a.days if a.days else '기한 지난 것'),
                                               len(rows), (' · 형식 오류 %d' % len(bad)) if bad else ''))
    for r in rows:
        state = ('%d일 지남' % r['late']) if r['late'] > 0 else ('오늘' if r['late'] == 0 else '%d일 남음' % -r['late'])
        print('- [%s] %s %s(%s) — %s' % (r['writer'], r['due'], r['title'], state, r['why']))
        print('    고칠 곳: %s · 폴더: %s' % (' / '.join(r['fix']) if r['fix'] else '(미기재)', r['post']))
    for p, e in bad:
        print('- 형식 오류: %s/_qa/refresh.json — %s' % (p, e))
    return 0


if __name__ == '__main__':
    sys.exit(main())
