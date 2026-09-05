"""Append a numeric molded-plate height channel without altering existing RGB.

Input RGB: previous deterministic grain/scratches/roughness technical texture.
Output A: an original, approximate trapezoidal-projection height pattern for
the K2 model's dedicated textured panels. This is not a reproduction of a
proprietary production pattern. It encodes no color or baked illumination.

IMPORTANT: alpha is HEIGHT DATA, never opacity. Load as linear / non-color
data with RepeatWrapping; do not premultiply alpha or enable transparency.
"""

from pathlib import Path
import json
import argparse
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', required=True, type=Path, help='Original RGB numeric data from generate-surface-data.py')
parser.add_argument('--output', required=True, type=Path, help='Output directory for RGBA texture and diagnostic previews')
arguments = parser.parse_args()
ROOT = arguments.output.resolve()
ROOT.mkdir(parents=True, exist_ok=True)
SOURCE = arguments.source.resolve()
SIZE = 512
REPEATS = 8
PITCH = SIZE / REPEATS
SUPERSAMPLE = 4

source = Image.open(SOURCE)
assert source.mode == "RGB" and source.size == (SIZE, SIZE)
original_rgb = np.asarray(source, dtype=np.uint8).copy()

# Evaluate analytically on a 4x subpixel grid. A canonical cell repeats every
# 64 px horizontally; every second row shifts by half a cell. Eight rows make
# the top/bottom boundary periodic too.
coords = (np.arange(SIZE * SUPERSAMPLE, dtype=np.float64) + 0.5) / SUPERSAMPLE
yy, xx = np.meshgrid(coords, coords, indexing="ij")
row = np.floor(yy / PITCH).astype(np.int32)
px = ((xx - (row % 2) * PITCH * 0.5) % PITCH) - PITCH * 0.5
py = (yy % PITCH) - PITCH * 0.5

# Flat-topped angular trapezoids, wider at the bottom, separated by shallow
# channels. These dimensions are texture design choices, not real dimensions.
polygon = [(-21.5, -22.0), (21.5, -22.0), (28.0, 22.0), (-28.0, 22.0)]
nearest_sq = np.full_like(px, np.inf)
inside = np.ones_like(px, dtype=bool)
for index, a in enumerate(polygon):
    b = polygon[(index + 1) % len(polygon)]
    ax, ay = a
    vx, vy = b[0] - ax, b[1] - ay
    rx, ry = px - ax, py - ay
    t = np.clip((rx * vx + ry * vy) / (vx * vx + vy * vy), 0.0, 1.0)
    dx, dy = rx - t * vx, ry - t * vy
    nearest_sq = np.minimum(nearest_sq, dx * dx + dy * dy)
    inside &= (vx * ry - vy * rx) >= 0.0

signed_distance = np.sqrt(nearest_sq) * np.where(inside, 1.0, -1.0)

# The height climbs over a broad shallow bevel, with softened edge transitions
# and a genuinely flat plate interior. The rounded outer distance gives clean
# antialiased corner transitions without turning the plates into pebbles.
bevel_width = 5.25
rise = np.clip((signed_distance + 0.9) / bevel_width, 0.0, 1.0)
rise = rise * rise * (3.0 - 2.0 * rise)
height_high = 0.39 + 0.24 * rise
height = height_high.reshape(SIZE, SUPERSAMPLE, SIZE, SUPERSAMPLE).mean(axis=(1, 3))
alpha = np.rint(height * 255.0).astype(np.uint8)

rgba = np.dstack((original_rgb, alpha))
output = ROOT / "armory-surface-detail.png"
Image.fromarray(rgba, "RGBA").save(output, optimize=True)
Image.fromarray(alpha, "L").save(ROOT / "preview-trapezoid-height.png", optimize=True)
Image.fromarray(np.tile(alpha, (2, 2)), "L").save(ROOT / "preview-trapezoid-height-tiled.png", optimize=True)

# Contrast-stretched preview is for inspecting the pattern only, never sampling
# as material data; actual height keeps the grooves shallow.
preview = np.rint((alpha.astype(float) - alpha.min()) / (alpha.max() - alpha.min()) * 255).astype(np.uint8)
Image.fromarray(preview, "L").save(ROOT / "preview-trapezoid-height-contrast.png", optimize=True)

reloaded = np.asarray(Image.open(output), dtype=np.uint8)
assert np.array_equal(reloaded[..., :3], original_rgb), "Packed RGB changed"
assert np.array_equal(alpha, np.roll(alpha, 64, axis=1)), "Horizontal repeat changed"
assert np.array_equal(alpha, np.roll(alpha, 128, axis=0)), "Alternating row repeat changed"
assert np.array_equal(alpha, np.roll(np.roll(alpha, 64, axis=0), 32, axis=1)), "Stagger changed"
assert reloaded.shape == (SIZE, SIZE, 4)
assert alpha.min() >= 99 and alpha.max() <= 161

stats = {
    "file": output.name,
    "source_rgb": str(SOURCE),
    "size": [SIZE, SIZE],
    "mode": "RGBA",
    "rgb_byte_for_byte_match": bool(np.array_equal(reloaded[..., :3], original_rgb)),
    "alpha_semantic": "linear height data; not opacity; no premultiplication",
    "pattern": "8 by 8 staggered original approximate trapezoidal plates",
    "plate_count_per_tile": 64,
    "supersample": SUPERSAMPLE,
    "horizontal_pitch_px": PITCH,
    "vertical_pitch_px": PITCH,
    "alternate_row_offset_px": PITCH * 0.5,
    "height_min": float(alpha.min()) / 255.0,
    "height_max": float(alpha.max()) / 255.0,
    "height_mean": float(alpha.mean()) / 255.0,
    "height_std": float(alpha.std()) / 255.0,
    "flat_top_fraction": float((alpha == alpha.max()).mean()),
    "groove_floor_fraction": float((alpha == alpha.min()).mean()),
    "deterministic": True,
    "periodic_repeat_checks": "passed horizontal, two-row and staggered repeats",
    "output_bytes": output.stat().st_size,
}
(ROOT / "surface-detail-stats.json").write_text(json.dumps(stats, indent=2) + "\n")
print(json.dumps(stats, indent=2))
