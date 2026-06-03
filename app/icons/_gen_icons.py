# 쓰담(sseudam) PWA 설치 아이콘 생성 — icon.svg 의 마크를 PIL로 재현해 PNG로 굽는다.
# 마크: 코발트→바이올렛→코랄(웜) 그라데이션 라운드 사각 + 흰 글 카드 + 코랄 하트(다독임).
# 'any'(둥근 모서리 투명코너) + 'maskable'(풀블리드 정사각) 생성.
import math
import numpy as np
from PIL import Image, ImageDraw

SS = 4
BASE = 512
N = BASE * SS
COBALT = (76, 111, 255)    # #4C6FFF
VIOLET = (124, 92, 209)    # #7C5CD1
CORAL = (255, 138, 91)     # #FF8A5B

def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def gradient(n):
    # 대각(좌상→우하) 3-stop: 0=코발트, .55=바이올렛, 1=코랄
    yy, xx = np.mgrid[0:n, 0:n]
    t = (xx + yy) / (2 * (n - 1))
    r = np.empty((n, n)); g = np.empty((n, n)); b = np.empty((n, n))
    m = t <= 0.55
    tt = np.where(m, t / 0.55, (t - 0.55) / 0.45)
    for ch, (c0a, c1a, c0b, c1b) in enumerate([
        (COBALT[0], VIOLET[0], VIOLET[0], CORAL[0]),
        (COBALT[1], VIOLET[1], VIOLET[1], CORAL[1]),
        (COBALT[2], VIOLET[2], VIOLET[2], CORAL[2]),
    ]):
        lo = c0a + (c1a - c0a) * tt
        hi = c0b + (c1b - c0b) * tt
        arr = np.where(m, lo, hi)
        (r if ch == 0 else g if ch == 1 else b)[:] = arr
    a = np.full((n, n), 255.0)
    return Image.fromarray(np.dstack([r, g, b, a]).astype('uint8'), 'RGBA')

def comp(base, layer):
    return Image.alpha_composite(base, layer)

def rrect(x, y, w, h, rad, rgba):
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [x*SS, y*SS, (x+w)*SS, (y+h)*SS], radius=rad*SS, fill=rgba)
    return layer

def heart_layer(cx, cy, s, fill, outline, ow):
    # 파라메트릭 하트(아래로 뾰족). 512 좌표계 기준 cx,cy=중심, s=스케일
    pts = []
    for i in range(0, 361, 3):
        t = math.radians(i)
        x = 16 * math.sin(t)**3
        y = 13*math.cos(t) - 5*math.cos(2*t) - 2*math.cos(3*t) - math.cos(4*t)
        pts.append(((cx + x*s)*SS, (cy - y*s)*SS))
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.polygon(pts, fill=fill, outline=outline, width=int(ow*SS))
    return layer

def build(maskable):
    grad = gradient(N)
    if maskable:
        base = grad.copy()
    else:
        mask = Image.new('L', (N, N), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, N-1, N-1], radius=116*SS, fill=255)
        base = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        base.paste(grad, (0, 0), mask)
    # 흰 글 카드
    base = comp(base, rrect(100, 170, 312, 214, 44, (255, 255, 255, 255)))
    base = comp(base, rrect(142, 232, 150, 22, 11, (76, 111, 255, 255)))
    base = comp(base, rrect(142, 274, 228, 18, 9, (124, 92, 209, 140)))
    base = comp(base, rrect(142, 312, 150, 18, 9, (124, 92, 209, 82)))
    # 코랄 하트(다독임) — 카드 우상단, 흰 외곽선으로 분리
    base = comp(base, heart_layer(372, 196, 7.2, (255, 138, 91, 255), (255, 255, 255, 255), 8))
    return base

any_m = build(False)
mask_m = build(True)
any_m.resize((512, 512), Image.LANCZOS).save('icon-512.png')
any_m.resize((192, 192), Image.LANCZOS).save('icon-192.png')
mask_m.resize((512, 512), Image.LANCZOS).save('icon-maskable.png')
print('OK: 쓰담 아이콘 3종 생성(icon-192/512/maskable.png)')
