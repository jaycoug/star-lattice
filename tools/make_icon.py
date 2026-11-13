"""Stage 1: the app's icon, a six-kite star on a night-sky tile, written as app/icon.svg and
app/icon.ico (16, 24, 32, 48, 64 and 256 px, PNG-compressed), and PNGs at 192, 256 and 512 px. Standard library only.

Usage (from the project folder):  python tools/make_icon.py

The kites follow shared/star.js: slot p's tip at -120 + 60p degrees, a kite being
[center, waist at angle - 30, tip, waist at angle + 30] with waist = tip / sqrt(3). Each kite
is shrunk toward its own center so a thin line of sky shows between them, as on the map. The
colors are the life organizer's six categories (content/life.json).
"""
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COLORS = ['#8172e1', '#008ede', '#009aaf', '#2b9c79', '#7a965c', '#a48e64']
SKY = '#141a33'
TIP = 0.42        # tip radius, as a share of the tile
GAP = 0.86        # each kite's size about its own center
CORNER = 0.22     # the tile's corner radius, as a share of the tile


def kites():
    """Six kite polygons in unit coordinates (the tile is 0..1, centered at 0.5)."""
    out = []
    for slot in range(6):
        angle = math.radians(-120 + 60 * slot)
        waist = TIP / math.sqrt(3)
        pts = [(0.0, 0.0),
               (waist * math.cos(angle - math.pi / 6), waist * math.sin(angle - math.pi / 6)),
               (TIP * math.cos(angle), TIP * math.sin(angle)),
               (waist * math.cos(angle + math.pi / 6), waist * math.sin(angle + math.pi / 6))]
        cx = sum(p[0] for p in pts) / 4
        cy = sum(p[1] for p in pts) / 4
        pts = [(0.5 + cx + GAP * (x - cx), 0.5 + cy + GAP * (y - cy)) for x, y in pts]
        out.append((pts, COLORS[slot]))
    return out


def svg():
    polys = ''.join(
        f'<polygon points="{" ".join(f"{x * 64:.2f},{y * 64:.2f}" for x, y in pts)}" fill="{color}"/>'
        for pts, color in kites())
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<rect width="64" height="64" rx="{CORNER * 64:.1f}" fill="{SKY}"/>{polys}</svg>\n')


def rgb(hexcolor):
    return tuple(int(hexcolor[i:i + 2], 16) for i in (1, 3, 5))


def inside(poly, x, y):
    """Point in a convex polygon (either winding)."""
    sign = 0
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if c:
            if sign and (c > 0) != (sign > 0):
                return False
            sign = c
    return True


def in_tile(x, y):
    r = CORNER
    dx = max(r - x, 0, x - (1 - r))
    dy = max(r - y, 0, y - (1 - r))
    return dx * dx + dy * dy <= r * r


def render(size, ss=4):
    """RGBA rows for a size x size icon, supersampled ss x ss per pixel."""
    shapes = [(pts, rgb(c)) for pts, c in kites()]
    sky = rgb(SKY)
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size
                    y = (py + (sy + 0.5) / ss) / size
                    if not in_tile(x, y):
                        continue
                    color = sky
                    for pts, c in shapes:
                        if inside(pts, x, y):
                            color = c
                            break
                    acc[0] += color[0]; acc[1] += color[1]; acc[2] += color[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] // n
            if a:
                cover = acc[3] / 255
                row += bytes((round(acc[0] / cover), round(acc[1] / cover), round(acc[2] / cover), a))
            else:
                row += b'\0\0\0\0'
        rows.append(bytes(row))
    return rows


def png(size, ss=4):
    rows = render(size, ss)
    raw = b''.join(b'\0' + r for r in rows)
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def ico(sizes):
    images = [png(s) for s in sizes]
    head = struct.pack('<HHH', 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = b''
    for s, data in zip(sizes, images):
        entries += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    return head + entries + b''.join(images)


if __name__ == '__main__':
    (ROOT / 'app' / 'icon.svg').write_text(svg(), encoding='utf-8')
    (ROOT / 'app' / 'icon.ico').write_bytes(ico([16, 24, 32, 48, 64, 256]))
    for size in (192, 256, 512):   # stage 2: 192 and 512 for the installable app (manifest.webmanifest)
        (ROOT / 'app' / f'icon-{size}.png').write_bytes(png(size, ss=2 if size > 256 else 4))
    print('wrote app/icon.svg, app/icon.ico, app/icon-192.png, app/icon-256.png, app/icon-512.png')
