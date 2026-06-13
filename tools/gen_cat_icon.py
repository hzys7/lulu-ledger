# -*- coding: utf-8 -*-
"""Generate Lulu Ledger cat icon (v3 — refined)."""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = r'C:\app\assets\icon-gen'
os.makedirs(OUT, exist_ok=True)
W = 1024

COL_BG_TOP     = (252, 245, 230, 255)
COL_BG_BOT     = (235, 220, 190, 255)
COL_FUR        = (178, 165, 148, 255)
COL_FUR_DARK   = (88, 75, 62, 255)
COL_INNER_EAR  = (245, 195, 175, 255)
COL_NOSE       = (210, 130, 130, 255)
COL_INNER_NOSE = (170, 90, 95, 255)
COL_MUZZLE     = (250, 245, 235, 255)
COL_CHIN       = (252, 248, 240, 255)
COL_EYE_LIGHT  = (195, 225, 170, 255)
COL_EYE_DARK   = (70, 110, 55, 255)
COL_PUPIL      = (20, 20, 15, 255)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def vgrad(size, top, bot):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        c = lerp(top, bot, y / (size - 1))
        for x in range(size):
            px[x, y] = c
    return img

def round_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    return m

def make_master():
    sz = W
    bg = vgrad(sz, COL_BG_TOP, COL_BG_BOT)
    d = ImageDraw.Draw(bg)
    cx, cy = sz / 2, sz / 2

    # Head
    head_w = sz * 0.70
    head_h = sz * 0.62
    head_x0 = cx - head_w / 2
    head_y0 = cy - head_h / 2 + sz * 0.05
    head_x1 = cx + head_w / 2
    head_y1 = head_y0 + head_h

    # EARS — extend up from the top edge of the head.
    # We draw the head first, then OVERLAY the ears so the base
    # is hidden by the head's top arc. Use a single polygon that
    # includes a notch on the bottom for a clean join.
    ear_h = sz * 0.22
    ear_w = sz * 0.26
    # Left ear
    le_left  = head_x0 + sz * 0.02
    le_right = le_left + ear_w
    le_outer = (le_left - sz * 0.02, head_y0 + sz * 0.06)
    le_inner = (le_right + sz * 0.005, head_y0 - sz * 0.01)
    le_peak  = (le_left + ear_w * 0.50, head_y0 - ear_h)
    d.polygon([le_outer, le_peak, le_inner, (le_right, head_y0 + sz * 0.08)],
              fill=COL_FUR)
    # Right ear
    re_right = head_x1 - sz * 0.02
    re_left  = re_right - ear_w
    re_outer = (re_right + sz * 0.02, head_y0 + sz * 0.06)
    re_inner = (re_left - sz * 0.005, head_y0 - sz * 0.01)
    re_peak  = (re_right - ear_w * 0.50, head_y0 - ear_h)
    d.polygon([re_outer, re_peak, re_inner, (re_left, head_y0 + sz * 0.08)],
              fill=COL_FUR)

    # Now draw the head ON TOP, which will cover the lower portion of the ear
    # triangles, making them look attached to the head naturally.
    d.rounded_rectangle((head_x0, head_y0, head_x1, head_y1),
                        radius=sz * 0.30, fill=COL_FUR)

    # Inner ears (pink) — drawn AFTER head, so they sit inside the ears
    inset = sz * 0.045
    # left inner ear
    d.polygon([(le_left + inset, head_y0 + sz * 0.04),
               (le_right - inset, head_y0 + sz * 0.04),
               ((le_left + le_right) / 2, head_y0 - ear_h * 0.45)],
              fill=COL_INNER_EAR)
    # right inner ear
    d.polygon([(re_left + inset, head_y0 + sz * 0.04),
               (re_right - inset, head_y0 + sz * 0.04),
               ((re_left + re_right) / 2, head_y0 - ear_h * 0.45)],
              fill=COL_INNER_EAR)

    # Forehead M pattern (curved) — draw curved lines via arcs
    # We'll draw two thin curved lines forming the M
    # Center vertical stripe (curved slightly)
    sw = max(2, int(sz * 0.012))
    # left diagonal of M (from upper inner to outer mid)
    d.arc((cx - sz * 0.13, head_y0 + sz * 0.02, cx - sz * 0.02, head_y0 + sz * 0.22),
          start=200, end=340, fill=COL_FUR_DARK, width=sw)
    # right diagonal of M (mirror)
    d.arc((cx + sz * 0.02, head_y0 + sz * 0.02, cx + sz * 0.13, head_y0 + sz * 0.22),
          start=200, end=340, fill=COL_FUR_DARK, width=sw)
    # central short vertical stripe
    d.arc((cx - sz * 0.025, head_y0 + sz * 0.06, cx + sz * 0.025, head_y0 + sz * 0.22),
          start=180, end=360, fill=COL_FUR_DARK, width=sw)

    # Muzzle
    muz_w = sz * 0.52
    muz_h = sz * 0.34
    muz_x0 = cx - muz_w / 2
    muz_y0 = cy + sz * 0.02
    d.ellipse((muz_x0, muz_y0, muz_x0 + muz_w, muz_y0 + muz_h),
              fill=COL_MUZZLE)

    # Cheek stripes
    for sign in (-1, 1):
        d.polygon([(head_x0 + sz * 0.07, cy + sz * 0.01),
                   (head_x0 + sz * 0.09, cy + sz * 0.01),
                   (head_x0 + sz * 0.16, cy + sz * 0.07),
                   (head_x0 + sz * 0.14, cy + sz * 0.07)],
                  fill=COL_FUR_DARK)
        d.polygon([(head_x1 - sz * 0.09, cy + sz * 0.01),
                   (head_x1 - sz * 0.07, cy + sz * 0.01),
                   (head_x1 - sz * 0.16, cy + sz * 0.07),
                   (head_x1 - sz * 0.14, cy + sz * 0.07)],
                  fill=COL_FUR_DARK)

    # Eyes
    eye_r = sz * 0.090
    eye_y = cy - sz * 0.02
    eye_dx = sz * 0.135
    # Sclera
    for sign in (-1, 1):
        ex = cx + sign * eye_dx
        d.ellipse((ex - eye_r * 1.05, eye_y - eye_r * 0.95,
                   ex + eye_r * 1.05, eye_y + eye_r * 0.95),
                  fill=(255, 255, 255, 255))
    # Iris
    for sign in (-1, 1):
        ex = cx + sign * eye_dx
        d.ellipse((ex - eye_r * 0.85, eye_y - eye_r * 0.70,
                   ex + eye_r * 0.85, eye_y + eye_r * 0.85),
                  fill=COL_EYE_LIGHT)
    # Iris outline
    for sign in (-1, 1):
        ex = cx + sign * eye_dx
        d.ellipse((ex - eye_r * 0.85, eye_y - eye_r * 0.70,
                   ex + eye_r * 0.85, eye_y + eye_r * 0.85),
                  outline=COL_EYE_DARK, width=max(1, int(sz * 0.006)))
    # Pupil
    pupil_w = eye_r * 0.18
    pupil_h = eye_r * 0.95
    for sign in (-1, 1):
        ex = cx + sign * eye_dx
        d.ellipse((ex - pupil_w, eye_y - pupil_h / 2,
                   ex + pupil_w, eye_y + pupil_h / 2),
                  fill=COL_PUPIL)
    # Eye highlight
    for sign in (-1, 1):
        ex = cx + sign * eye_dx - eye_r * 0.30
        ey = eye_y - eye_r * 0.25
        d.ellipse((ex - sz * 0.020, ey - sz * 0.020,
                   ex + sz * 0.020, ey + sz * 0.020),
                  fill=(255, 255, 255, 255))
    # Thin upper eyelid line (just a slim arc, not a thick chord)
    sw_lid = max(1, int(sz * 0.008))
    for sign in (-1, 1):
        ex = cx + sign * eye_dx
        d.arc((ex - eye_r * 1.10, eye_y - eye_r * 0.60,
               ex + eye_r * 1.10, eye_y + eye_r * 0.60),
              start=190, end=350, fill=COL_FUR_DARK, width=sw_lid)

    # Nose
    nose_w = sz * 0.085
    nose_h = sz * 0.060
    nose_y = cy + sz * 0.085
    d.polygon([(cx - nose_w / 2, nose_y),
               (cx + nose_w / 2, nose_y),
               (cx, nose_y + nose_h)], fill=COL_NOSE)
    d.ellipse((cx - nose_w * 0.20, nose_y - nose_h * 0.12,
               cx + nose_w * 0.20, nose_y + nose_h * 0.20),
              fill=COL_INNER_NOSE)

    # Mouth
    mouth_y = nose_y + nose_h + sz * 0.005
    d.line([(cx, mouth_y), (cx, mouth_y + sz * 0.022)],
           fill=COL_FUR_DARK, width=max(2, int(sz * 0.008)))
    d.arc((cx - sz * 0.08, mouth_y - sz * 0.005, cx, mouth_y + sz * 0.045),
          start=20, end=75, fill=COL_FUR_DARK, width=max(2, int(sz * 0.009)))
    d.arc((cx, mouth_y - sz * 0.005, cx + sz * 0.08, mouth_y + sz * 0.045),
          start=105, end=160, fill=COL_FUR_DARK, width=max(2, int(sz * 0.009)))

    # Whiskers (3 each side, drawn on top of muzzle)
    whisker_color = (100, 80, 60, 220)
    sw_w = max(1, int(sz * 0.004))
    for sign in (-1, 1):
        for i, dy in enumerate([-sz * 0.030, 0, sz * 0.030]):
            wx0 = cx + sign * (muz_w * 0.42)
            wy0 = cy + sz * 0.16 + dy
            wx1 = wx0 + sign * sz * 0.16
            wy1 = wy0 + dy * 0.5
            d.line([(wx0, wy0), (wx1, wy1)], fill=whisker_color, width=sw_w)

    # Apply rounded corner mask
    mask = round_mask(sz, int(sz * 0.225))
    out = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out

def make_foreground():
    sz = W
    master = make_master()
    crop_box = (int(sz * 0.06), int(sz * 0.04), int(sz * 0.94), int(sz * 0.96))
    cat = master.crop(crop_box)
    canvas = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
    canvas.paste(cat, (0, 0), cat)
    return canvas

master = make_master()
master.save(os.path.join(OUT, 'cat-master.png'), 'PNG')
fg = make_foreground()
fg.save(os.path.join(OUT, 'cat-foreground.png'), 'PNG')
print('done')
