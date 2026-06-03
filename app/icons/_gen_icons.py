# 블로그 컴퍼니 PWA 설치 아이콘 생성 — icon.svg 의 브랜드 마크를 PIL로 동일 재현해 PNG로 굽는다.
# 'any'(둥근 모서리, 투명 코너) + 'maskable'(풀블리드 정사각, 코너까지 채움) 변형 생성.
import numpy as np
from PIL import Image, ImageDraw

SS = 4                      # 슈퍼샘플(4x) 후 다운스케일 → 부드러운 에지
BASE = 512
N = BASE * SS
C1 = (76, 111, 255)         # #4C6FFF
C2 = (124, 92, 209)         # #7C5CD1

def gradient(n):
    yy, xx = np.mgrid[0:n, 0:n]
    t = (xx + yy) / (2 * (n - 1))
    r = C1[0] + (C2[0] - C1[0]) * t
    g = C1[1] + (C2[1] - C1[1]) * t
    b = C1[2] + (C2[2] - C1[2]) * t
    a = np.full((n, n), 255.0)
    arr = np.dstack([r, g, b, a]).astype('uint8')
    return Image.fromarray(arr, 'RGBA')

def rrect_layer(x, y, w, h, rad, rgba):
    """투명 레이어에 둥근 사각형 하나를 그려 반환(알파 합성용)."""
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    yo = y + 6  # icon.svg 의 glyph translate(0,6)
    d.rounded_rectangle([x*SS, yo*SS, (x+w)*SS, (yo+h)*SS], radius=rad*SS, fill=rgba)
    return layer

# 글리프 구성(좌표=512 viewBox 기준), 흰 카드는 알파로 겹쳐 블렌딩
GLYPH = [
    (150, 120, 212, 150, 34, (255, 255, 255, int(255*.30))),
    (128, 154, 256, 172, 38, (255, 255, 255, int(255*.55))),
    (104, 190, 304, 196, 42, (255, 255, 255, 255)),
    (150, 246, 160,  26, 13, (76, 111, 255, 255)),
    (150, 300, 212,  20, 10, (124, 92, 209, int(255*.55))),
    (150, 340, 120,  20, 10, (124, 92, 209, int(255*.35))),
]

def compose(maskable):
    grad = gradient(N)
    if maskable:
        base = grad.copy()                                  # 풀블리드 정사각
    else:
        mask = Image.new('L', (N, N), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, N-1, N-1], radius=116*SS, fill=255)
        base = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        base.paste(grad, (0, 0), mask)                      # 둥근 코너(투명)
    for (x, y, w, h, r, rgba) in GLYPH:
        base = Image.alpha_composite(base, rrect_layer(x, y, w, h, r, rgba))
    return base

any_master = compose(False)
mask_master = compose(True)
any_master.resize((512, 512), Image.LANCZOS).save('icon-512.png')
any_master.resize((192, 192), Image.LANCZOS).save('icon-192.png')
mask_master.resize((512, 512), Image.LANCZOS).save('icon-maskable.png')
print('OK: icon-192.png, icon-512.png, icon-maskable.png 생성')
