#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
bd-mapcard.py — 봄딩 양식 «지도 카드» 이미지를 헤드리스로 굽는다 (2026-10-09 신설 · 봄딩 전용)

왜 있나: 봄딩 글이 팬 사이트·위키·다른 블로그의 지도(위치 핀 그림)를 참고할 때, 남의 그림을 그대로 싣지 않고
  «바탕 지도 + 좌표 데이터»만 가져와 봄딩 디자인으로 다시 그리기 위해서다(사용자 지시 2026-10-09 ·
  정본 = bomding-blog-writer/references/output-format.md §1-9). 티어표는 tier-render.mjs, 표는 본문 HTML 표가 맡는다.

  python bd-mapcard.py --spec <spec.json> [--only <id>] [--scale 2] [--quality 88]

spec.json (경로는 spec 파일 기준 상대경로 또는 절대경로)
  {"outDir": "../img", "tape": "보물상자 지도", "sig": true,
   "source": "미니맵 = 인게임 이미지 © 게임사 · 상자 위치 = <출처>(<도메인>) <기준일> 기준",
   "cards": [{"id": "101010", "file": "map-101010.jpg",
              "eyebrow": "도깨비의세계 · 비명 동굴", "title": "음산한 폐광",
              "chips": ["상자 **5개**", "전투력 **234,000** 이상"],
              "base": "src/101010.webp",
              "pins": [{"n": 1, "kind": "a", "x": 29.71, "y": 65.61}],      # x·y = 바탕 그림 기준 %
              "legend": [{"kind": "a", "label": "전설 상자", "sub": "1개"}],
              "bubble": "5개 다 찾으면 **요혼석 30**을 받아요!"}]}
  · pin kind: a = 강조(로즈 + 하트) · b = 핑크 · c = 흰 바탕. 색만이 아니라 크기·테두리·하트로도 갈린다.
  · `**굵게**` 표기만 지원한다. 그 밖의 글자는 전부 HTML 이스케이프한다.

출력: 폭 693 × scale(기본 2 = 1386px — 네이버 본문 실폭의 2배, 도구함 이미지와 같은 규격) · 높이 자동.
  확장자가 .jpg 면 JPEG(quality), .png 면 PNG. 끝에 «<file> <W>x<H> <bytes>» 를 한 줄씩 찍고
  spec 옆에 <spec 이름>.out.json(파일별 치수 — 글의 width/height 속성에 그대로 쓴다)을 남긴다.

★출처 줄(`source`)은 비우지 못한다 — 디자인은 봄딩 것이어도 바탕 그림·좌표의 출처는 그대로다.
★이미지에 찍히는 글자에 조사 과정(«교차 확인»·파일명 등)을 넣지 않는다(output-format §1-8 ⑵와 같은 이유).
★핀이 서로 가까우면(가장 가까운 두 핀 < 58px) 자동으로 작은 핀을 쓴다. 그래도 겹치면 굽지 않고 exit 1.
디자인 값의 출처 = 도구함 봄딩 스킨(_toolbox/table.js DESIGNS.bomding: 로즈 #C93C7C · 핑크 #F58AB4 · 플럼 #2E2038 · 나눔스퀘어)
  + 인포그래픽 정본 봄딩 절(모눈·워시테이프·말풍선) + 시그니처 _toolbox/tier/sig/bomding.webp.
"""
import io, os, re, sys, json, html, math, shutil, argparse, tempfile, subprocess

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CHROME = os.environ.get('CHROME_PATH', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
SIG = os.path.join(ROOT, '_toolbox', 'tier', 'sig', 'bomding.webp')
FONT_CSS = 'https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/nanumsquare.css'
CARD_W, MAP_W = 693, 631

CSS = r"""
:root{--rose:#C93C7C;--pink:#F58AB4;--plum:#2E2038;--soft:#FFF4F8;--line:#F6D5E3;--ink:#4a4047;--sub:#9b8f95;--note:#7d6f76;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#ff00ff}
body{width:693px;font-family:"NanumSquare","나눔스퀘어","Malgun Gothic",sans-serif;color:var(--ink)}
.card{width:693px;padding:26px 24px 20px;background:
  linear-gradient(var(--line) 1px,transparent 1px) 0 0/100% 22px,
  linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/22px 100%,var(--soft);position:relative}
.tape{position:absolute;top:14px;left:34px;transform:rotate(-3deg);background:var(--rose);color:#fff;font-weight:800;font-size:14px;
  letter-spacing:.02em;padding:5px 16px 5px 14px;border-radius:2px;box-shadow:1px 2px 5px rgba(46,32,56,.18);
  background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 6px,transparent 6px 12px)}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:26px 2px 26px}
.ttl{font-size:30px;font-weight:800;color:var(--plum);line-height:1.15;word-break:keep-all}
.ttl small{display:block;font-size:15px;font-weight:700;color:var(--rose);margin-bottom:5px}
.chips{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto}
.chip{background:#fff;border:1.5px solid var(--rose);color:var(--plum);font-weight:800;font-size:15px;padding:5px 13px;border-radius:999px;white-space:nowrap}
.chip b{color:var(--rose)}
.mapwrap{position:relative;width:645px;margin:0 auto;background:#fff;padding:7px;border-radius:16px;box-shadow:2px 5px 16px rgba(46,32,56,.22)}
.map{position:relative;width:631px;border-radius:11px;overflow:hidden;background:#3d3532 center/100% 100% no-repeat}
.strip{position:absolute;width:62px;height:20px;background:var(--pink);opacity:.92;box-shadow:1px 2px 4px rgba(46,32,56,.2);
  background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.28) 0 5px,transparent 5px 10px)}
.strip.a{top:2px;left:-20px;transform:rotate(-38deg)}.strip.b{top:2px;right:-20px;transform:rotate(38deg)}
.pin{position:absolute;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:18px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.55)}
.pin.b{background:var(--pink);color:var(--plum)}
.pin.c{background:#fff;color:var(--plum);border-color:var(--plum);outline:2px solid #fff}
.pin.a{background:var(--rose);color:#fff;width:46px;height:46px;font-size:21px;outline:3px solid var(--rose);outline-offset:2px}
.pin.a:after{content:"";position:absolute;top:-17px;left:50%;width:22px;height:20px;transform:translateX(-50%);
  background:#fff;clip-path:path("M11 19 C4 13 0 9.5 0 5.5 C0 2.4 2.4 0 5.4 0 C7.6 0 9.7 1.2 11 3.2 C12.3 1.2 14.4 0 16.6 0 C19.6 0 22 2.4 22 5.5 C22 9.5 18 13 11 19 Z");
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
.tight .pin{width:30px;height:30px;font-size:14.5px;border-width:2.5px}
.tight .pin.a{width:36px;height:36px;font-size:16.5px;outline-width:2px;outline-offset:1.5px}
.tight .pin.a:after{top:-14px;width:18px;height:16px;clip-path:path("M9 15.5 C3.3 10.6 0 7.8 0 4.5 C0 2 2 0 4.4 0 C6.2 0 7.9 1 9 2.6 C10.1 1 11.8 0 13.6 0 C16 0 18 2 18 4.5 C18 7.8 14.7 10.6 9 15.5 Z")}
.legendrow{display:flex;gap:8px;margin:16px 2px 0}
.lg{flex:1;display:flex;align-items:center;gap:9px;background:#fff;border:1.5px dashed var(--pink);border-radius:12px;padding:8px 10px}
.lg .pin{position:static;transform:none;flex:0 0 auto;width:26px;height:26px;font-size:0;box-shadow:none;border-width:2px}
.lg .pin.a{width:26px;height:26px;outline-width:2px;outline-offset:1px}.lg .pin.a:after{display:none}
.lg .pin.c{outline:none}
.lg span{font-size:15px;font-weight:800;color:var(--plum);line-height:1.3}
.lg span em{display:block;font-style:normal;font-weight:700;font-size:14px;color:var(--note)}
.foot{display:flex;align-items:flex-end;gap:10px;margin-top:14px}
.bubble{position:relative;flex:1;background:#fff;border:2px solid var(--rose);border-radius:14px;padding:11px 14px;font-size:16.5px;font-weight:700;line-height:1.5;color:var(--ink);word-break:keep-all}
.bubble b{color:var(--rose);font-weight:800}
.bubble:after{content:"";position:absolute;right:-11px;bottom:16px;width:18px;height:18px;background:#fff;border-right:2px solid var(--rose);border-top:2px solid var(--rose);transform:rotate(45deg)}
.bubble.nosig:after{display:none}
.sig{flex:0 0 auto;width:84px;height:84px;object-fit:contain;margin-left:6px}
.src{margin-top:12px;font-size:13px;font-weight:400;color:var(--note);text-align:center;line-height:1.5}
"""


def rich(s):
    """`**굵게**` 만 <b> 로, 나머지는 이스케이프."""
    out = html.escape(str(s))
    out = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', out)
    return out.replace('\n', '<br>')


def image_size(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.size


def min_gap(pins, mh):
    pts = [(p['x'] / 100.0 * MAP_W, p['y'] / 100.0 * mh) for p in pins]
    best = 1e9
    for i, a in enumerate(pts):
        for b in pts[i + 1:]:
            best = min(best, math.hypot(a[0] - b[0], a[1] - b[1]))
    return best


def build(card, spec, work):
    base = card['_base']
    bw, bh = image_size(base)
    mh = round(MAP_W * bh / bw)
    bname = 'base' + os.path.splitext(base)[1]
    shutil.copy(base, os.path.join(work, bname))
    gap = min_gap(card['pins'], mh) if len(card['pins']) > 1 else 1e9
    tight = gap < 58                      # 기본 핀(강조 46px + 테두리)이 닿는 거리 → 작은 핀으로
    if gap < 36:                          # 작은 핀(강조 36px)으로도 겹친다
        raise SystemExit('핀 겹침: %s — 가장 가까운 두 핀 %.1fpx(작은 핀으로도 36px 필요). 좌표를 확인하거나 지도를 나눠 굽는다.' % (card['id'], gap))
    pins = ''.join('<div class="pin %s" style="left:%.2f%%;top:%.2f%%">%s</div>' % (
        html.escape(p.get('kind', 'b')), float(p['x']), float(p['y']), html.escape(str(p['n']))) for p in card['pins'])
    legend = ''.join('<div class="lg"><div class="pin %s"></div><span>%s<em>%s</em></span></div>' % (
        html.escape(l['kind']), rich(l['label']), rich(l.get('sub', ''))) for l in card.get('legend', []))
    chips = ''.join('<div class="chip">%s</div>' % rich(c) for c in card.get('chips', []))
    sig = spec.get('sig', True) and os.path.isfile(SIG)
    if sig:
        shutil.copy(SIG, os.path.join(work, 'sig.webp'))
    foot = ''
    if card.get('bubble'):
        foot = '<div class="foot"><div class="bubble%s">%s</div>%s</div>' % (
            '' if sig else ' nosig', rich(card['bubble']), '<img class="sig" src="sig.webp" alt="">' if sig else '')
    doc = ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="%s"><style>%s</style></head><body>'
           '<div class="card"><div class="tape">%s</div>'
           '<div class="head"><div class="ttl"><small>%s</small>%s</div><div class="chips">%s</div></div>'
           '<div class="mapwrap"><div class="strip a"></div><div class="strip b"></div>'
           '<div class="map%s" style="height:%dpx;background-image:url(%s)">%s</div></div>'
           '%s%s<div class="src">%s</div></div></body></html>') % (
        FONT_CSS, CSS, rich(spec.get('tape', '')), rich(card.get('eyebrow', '')), rich(card['title']), chips,
        ' tight' if tight else '', mh, bname, pins,
        ('<div class="legendrow">%s</div>' % legend) if legend else '', foot, rich(spec['source']))
    io.open(os.path.join(work, 'card.html'), 'w', encoding='utf-8').write(doc)
    return mh, tight, gap


def shoot(work, mh, scale):
    raw = os.path.join(work, 'raw.png')
    url = 'file:///' + os.path.join(work, 'card.html').replace('\\', '/')
    for extra in (620, 1100):
        if os.path.isfile(raw):
            os.remove(raw)
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
                        '--user-data-dir=' + os.path.join(work, 'prof'), '--force-device-scale-factor=%s' % scale,
                        '--window-size=%d,%d' % (CARD_W, mh + extra), '--virtual-time-budget=9000',
                        '--screenshot=' + raw, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        from PIL import Image
        im = Image.open(raw).convert('RGB')
        w, h = im.size
        px = im.load()
        mag = lambda c: c[0] > 240 and c[1] < 20 and c[2] > 240
        if not mag(px[w // 2, h - 1]):
            continue                      # 창이 모자라 카드가 잘렸다 — 더 큰 창으로 다시
        y = h - 1
        while y > 0 and mag(px[w // 2, y]):
            y -= 1
        return im.crop((0, 0, w, y + 1))
    raise SystemExit('렌더 실패: 카드가 창보다 길다(mh=%d)' % mh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--only', default='')
    ap.add_argument('--scale', type=float, default=2)
    ap.add_argument('--quality', type=int, default=88)
    a = ap.parse_args()
    spath = os.path.abspath(a.spec)
    sdir = os.path.dirname(spath)
    spec = json.load(io.open(spath, encoding='utf-8'))
    if not str(spec.get('source', '')).strip():
        raise SystemExit('spec.source(출처 줄)가 비었다 — 바탕 그림·좌표의 출처는 반드시 찍는다.')
    if not os.path.isfile(CHROME):
        raise SystemExit('크롬을 찾지 못했다: %s (CHROME_PATH 로 지정)' % CHROME)
    resolve = lambda p: p if os.path.isabs(p) else os.path.normpath(os.path.join(sdir, p))
    outdir = resolve(spec.get('outDir', '.'))
    os.makedirs(outdir, exist_ok=True)
    cards = [c for c in spec['cards'] if not a.only or str(c['id']) == a.only]
    if not cards:
        raise SystemExit('해당 카드 없음: %s' % a.only)
    for c in cards:
        c['_base'] = resolve(c['base'])
        if not os.path.isfile(c['_base']):
            raise SystemExit('바탕 그림 없음: %s' % c['_base'])
    opath = os.path.splitext(spath)[0] + '.out.json'
    done = {}
    if a.only and os.path.isfile(opath):
        done = json.load(io.open(opath, encoding='utf-8'))
    for c in cards:
        work = tempfile.mkdtemp(prefix='bdmap_')
        try:
            mh, tight, gap = build(c, spec, work)
            im = shoot(work, mh, a.scale)
            out = os.path.join(outdir, c['file'])
            if out.lower().endswith(('.jpg', '.jpeg')):
                im.save(out, 'JPEG', quality=a.quality, optimize=True, subsampling=0)
            else:
                im.save(out)
            done[c['file']] = {'id': str(c['id']), 'w': im.size[0], 'h': im.size[1], 'bytes': os.path.getsize(out), 'tight': tight,
                               'minGap': None if gap > 1e8 else round(gap, 1)}
            print('%s %dx%d %d%s' % (c['file'], im.size[0], im.size[1], os.path.getsize(out), ' (작은 핀)' if tight else ''))
        finally:
            shutil.rmtree(work, ignore_errors=True)
    json.dump(done, io.open(opath, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
