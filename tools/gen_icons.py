# -*- coding: utf-8 -*-
"""Generate Lulu Ledger Android icon set."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r'C:\app\assets\icon-gen'
os.makedirs(OUT, exist_ok=True)

FONT_CANDIDATES = [
    r'C:\Windows\Fonts\msyhbd.ttc',
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\simhei.ttf',
    r'C:\Windows\Fonts\simsun.ttc',
]

def find_font():
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    return None

FONT_PATH = find_font()
print(f'Using font: {FONT_PATH}')

BG_COLOR = (15, 17, 21, 255)
GLYPH_COLOR = (255, 255, 255, 255)
ACCENT_COLOR = (255, 199, 95, 255)
SAFE_RATIO = 0.66

def make_master(size, rounded):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        radius = int(size * 0.225)
        d.rounded_rectangle((0, 0, size, size), radius=radius, fill=BG_COLOR)
    else:
        d.rectangle((0, 0, size, size), fill=BG_COLOR)
    if FONT_PATH:
        glyph_size = int(size * 0.62)
        font = ImageFont.truetype(FONT_PATH, glyph_size)
        text = chr(0x8bb0)
        bbox = d.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (size - tw) // 2 - bbox[0]
        ty = (size - th) // 2 - bbox[1] - int(size * 0.02)
        d.text((tx, ty), text, font=font, fill=GLYPH_COLOR)
        accent_size = int(size * 0.18)
        font_a = ImageFont.truetype(FONT_PATH, accent_size)
        a_text = chr(0x00a5)
        ab = d.textbbox((0, 0), a_text, font=font_a)
        aw, ah = ab[2] - ab[0], ab[3] - ab[1]
        cx, cy = int(size * 0.78), int(size * 0.22)
        cr = int(size * 0.10)
        d.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=ACCENT_COLOR)
        d.text((cx - aw // 2 - ab[0], cy - ah // 2 - ab[1] - int(size * 0.005)),
               a_text, font=font_a, fill=BG_COLOR)
    return img

def make_foreground(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not FONT_PATH:
        return img
    glyph_size = int(size * SAFE_RATIO * 0.95)
    font = ImageFont.truetype(FONT_PATH, glyph_size)
    text = chr(0x8bb0)
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1] - int(size * 0.03)
    d.text((tx, ty), text, font=font, fill=GLYPH_COLOR)
    accent_size = int(size * 0.16)
    font_a = ImageFont.truetype(FONT_PATH, accent_size)
    a_text = chr(0x00a5)
    ab = d.textbbox((0, 0), a_text, font=font_a)
    aw, ah = ab[2] - ab[0], ab[3] - ab[1]
    cx, cy = int(size * 0.74), int(size * 0.22)
    cr = int(size * 0.09)
    d.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=ACCENT_COLOR)
    d.text((cx - aw // 2 - ab[0], cy - ah // 2 - ab[1] - int(size * 0.005)),
           a_text, font=font_a, fill=BG_COLOR)
    return img

master = make_master(1024, True)
master.save(os.path.join(OUT, 'icon-master.png'), 'PNG')
fg = make_foreground(1024)
fg.save(os.path.join(OUT, 'icon-foreground.png'), 'PNG')
make_master(1024, False).save(os.path.join(OUT, 'icon-square.png'), 'PNG')

DPI_SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
base = r'C:\app\android\app\src\main\res'
for dpi, sz in DPI_SIZES.items():
    folder = os.path.join(base, f'mipmap-{dpi}')
    os.makedirs(folder, exist_ok=True)
    r = master.resize((sz, sz), Image.LANCZOS)
    r.save(os.path.join(folder, 'ic_launcher.png'), 'PNG')
    r.save(os.path.join(folder, 'ic_launcher_round.png'), 'PNG')

ADAPTIVE_SIZES = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for dpi, sz in ADAPTIVE_SIZES.items():
    folder = os.path.join(base, f'mipmap-{dpi}')
    os.makedirs(folder, exist_ok=True)
    fg.resize((sz, sz), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher_foreground.png'), 'PNG')
    Image.new('RGBA', (sz, sz), BG_COLOR).save(os.path.join(folder, 'ic_launcher_background.png'), 'PNG')

print('Done')
