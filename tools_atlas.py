# Build sprite atlas (quantized PNG) + tiled background JPEG from Pixel Adventure 1 (CC0)
# plus a few small Kenney emote/face icons still used for death comedy.
from PIL import Image, ImageEnhance, ImageOps
import json, base64, io, os

PA = '/workspace/assets_funny/pixel-adventure-1/'
MD = PA + 'Main Characters/Mask Dude/'
TR = PA + 'Terrain/Terrain (16x16).png'
E = '/workspace/assets_funny/kenney-emotes-pack/PNG/Vector/Style 1/'
S = '/workspace/assets_funny/kenney-shape-characters/PNG/Default/'
OUT_ASSETS = 'assets'
OUT_SRC = 'src'
os.makedirs(OUT_ASSETS, exist_ok=True)

sprites = {}
meta = {}
counts = {}

def nn_scale(im, k):
    return im.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)

def put(name, im):
    im = im.convert('RGBA')
    sprites[name] = im

def crop_alpha(im):
    bb = im.getbbox()
    if not bb:
        return im, [0, 0]
    return im.crop(bb), [bb[0], bb[1]]

# --- Mask Dude strips (32x32, 20 FPS). Pack at 4x nearest for crisp phone scaling. ---
CHAR_K = 4
def char_strip(name, path, step=1):
    im = Image.open(path).convert('RGBA')
    fw, fh = 32, 32
    n = im.width // fw
    kept = 0
    for i in range(0, n, step):
        fr = nn_scale(im.crop((i * fw, 0, (i + 1) * fw, fh)), CHAR_K)
        crop, off = crop_alpha(fr)
        key = '%s%d' % (name, kept)
        sprites[key] = crop
        meta[key] = off  # offset inside the full scaled 32*K frame
        kept += 1
    counts[name] = kept
    return kept

char_strip('idle', MD + 'Idle (32x32).png')
char_strip('run', MD + 'Run (32x32).png')
char_strip('up', MD + 'Jump (32x32).png')
char_strip('fall', MD + 'Fall (32x32).png')
char_strip('dizzy', MD + 'Hit (32x32).png')
# reuse hit frames for dead (no dedicated death strip in PA1)
char_strip('dead', MD + 'Hit (32x32).png')

# body box in the uncropped scaled frame (32*K): used to foot-align the sprite
# measured from idle0 full frame content
_idle_full = nn_scale(Image.open(MD + 'Idle (32x32).png').convert('RGBA').crop((0, 0, 32, 32)), CHAR_K)
_bb = _idle_full.getbbox()
BODY = list(_bb)  # [x0,y0,x1,y1] in scaled full frame

# --- Green grass tiles (16x16 at cols 6-8, rows 0-2), packed at 6x = 96 ---
TILE_K = 6
terrain = Image.open(TR).convert('RGBA')
def tile_at(c, r, name):
    t = nn_scale(terrain.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), TILE_K)
    put(name, t)
    return t

tile_at(6, 0, 'gtL')
tile_at(7, 0, 'gtM')
tile_at(8, 0, 'gtR')
tile_at(7, 1, 'dirt')
# broken / collapse variants: slightly darker, desaturated copies
def broken(src, name):
    im = sprites[src].copy()
    rgb = im.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(0.45)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.78)
    out = rgb.convert('RGBA')
    out.putalpha(im.split()[3])
    put(name, out)
broken('gtL', 'btL'); broken('gtM', 'btM'); broken('gtR', 'btR'); broken('dirt', 'bdirt')

# --- traps / items ---
def put_scaled(name, path, k, frame=None, fw=None, fh=None):
    im = Image.open(path).convert('RGBA')
    if frame is not None:
        im = im.crop((frame * fw, 0, (frame + 1) * fw, fh))
    put(name, nn_scale(im, k))

put_scaled('spikes', PA + 'Traps/Spikes/Idle.png', 6)
put_scaled('tramp0', PA + 'Traps/Trampoline/Idle.png', 4)
# Jump strip is 8 frames of 28x28; keep idle + a mid + a stretched frame
put_scaled('tramp1', PA + 'Traps/Trampoline/Jump (28x28).png', 4, frame=3, fw=28, fh=28)
put_scaled('tramp2', PA + 'Traps/Trampoline/Jump (28x28).png', 4, frame=5, fw=28, fh=28)
put_scaled('block', PA + 'Traps/Blocks/Idle.png', 4)
put_scaled('goal0', PA + 'Items/Checkpoints/End/End (Idle).png', 2)
put_scaled('goal1', PA + 'Items/Checkpoints/End/End (Pressed) (64x64).png', 2, frame=0, fw=64, fh=64)
put_scaled('start', PA + 'Items/Checkpoints/Start/Start (Idle).png', 2)
# grass tuft as a start-floor hint (optional)
tile_at(9, 1, 'tuftL')
tile_at(10, 1, 'tuftR')
# dust particle
put_scaled('particle', PA + 'Other/Dust Particle.png', 4)

# Kenney emotes / faces (comedy overlays; small)
def put_maxw(name, path, maxw):
    im = Image.open(path).convert('RGBA')
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    if maxw and im.width > maxw:
        im = im.resize((maxw, int(round(im.height * maxw / im.width))), Image.Resampling.LANCZOS)
    put(name, im)

for e in ['laugh', 'swirl', 'stars', 'drops', 'exclamation', 'question']:
    put_maxw('emo_' + e, E + 'emote_' + e + '.png', 72)
for f in ['h', 'f', 'k']:
    put_maxw('face_' + f, S + 'face_' + f + '.png', None)

# --- pack atlas ---
items = sorted(sprites.items(), key=lambda kv: (-kv[1].height, -kv[1].width, kv[0]))
W = 1024
x = y = rowh = 0
rects = {}
for name, im in items:
    if x + im.width + 2 > W:
        x = 0
        y += rowh + 2
        rowh = 0
    rects[name] = [x, y, im.width, im.height]
    x += im.width + 2
    rowh = max(rowh, im.height)
H = y + rowh
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for name, im in sprites.items():
    r = rects[name]
    atlas.paste(im, (r[0], r[1]), im)
q = atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
buf = io.BytesIO()
q.save(buf, 'PNG', optimize=True)
png = buf.getvalue()
atlas.save(os.path.join(OUT_ASSETS, 'atlas_full.png'))
open(os.path.join(OUT_ASSETS, 'atlas.png'), 'wb').write(png)

# --- 3:2 stage background, tiled PA1 Green (with a hint of Blue at the top) ---
green = Image.open(PA + 'Background/Green.png').convert('RGBA')
blue = Image.open(PA + 'Background/Blue.png').convert('RGBA')
bw, bh = 720, 480
bg = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
# tile blue on the top third, green on the rest, then blend
for yy in range(0, bh, blue.height):
    for xx in range(0, bw, blue.width):
        bg.alpha_composite(blue, (xx, yy))
# green overlay from mid-up, stronger toward bottom
mask = Image.new('L', (bw, bh), 0)
for yy in range(bh):
    # 0 at top, 255 from ~30% down
    v = 0 if yy < bh * 0.15 else min(255, int(255 * (yy - bh * 0.15) / (bh * 0.35)))
    for xx in range(bw):
        pass
# faster mask
pix = bytearray(bw * bh)
for yy in range(bh):
    if yy < bh * 0.12:
        v = 0
    elif yy < bh * 0.45:
        v = int(255 * (yy - bh * 0.12) / (bh * 0.33))
    else:
        v = 255
    start = yy * bw
    pix[start:start + bw] = bytes([v]) * bw
mask = Image.frombytes('L', (bw, bh), bytes(pix))
green_layer = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
for yy in range(0, bh, green.height):
    for xx in range(0, bw, green.width):
        green_layer.alpha_composite(green, (xx, yy))
bg.paste(green_layer, (0, 0), mask)
bg_rgb = bg.convert('RGB')
jpg_buf = io.BytesIO()
bg_rgb.save(jpg_buf, 'JPEG', quality=82)
jpg = jpg_buf.getvalue()
bg_rgb.save(os.path.join(OUT_ASSETS, 'bg.jpg'), quality=82)

atlas_obj = {
    'r': rects,
    'o': meta,
    'n': counts,
    'bear': {'scale': CHAR_K, 'body': BODY},  # key kept for art3 compatibility
    'atlasSrc': './assets/atlas.png',
    'bgSrc': './assets/bg.jpg'
}
js = 'var ATLAS = ' + json.dumps(atlas_obj, separators=(',', ':')) + ';\n'
open(os.path.join(OUT_SRC, 'atlas_meta.js'), 'w').write(js)
# also write a data-URI copy for the optional single-file prototype (kept small; dist uses files)
atlas_obj_inline = dict(atlas_obj)
atlas_obj_inline['img'] = 'data:image/png;base64,' + base64.b64encode(png).decode()
atlas_obj_inline['bg'] = 'data:image/jpeg;base64,' + base64.b64encode(jpg).decode()
# do not write huge atlas_data.js by default — dist uses files. Write meta only.
print('atlas', W, 'x', H, 'png', len(png), 'bytes; bg jpg', len(jpg), 'bytes; js meta', len(js), 'counts', counts, 'body', BODY, 'sprites', len(sprites))
