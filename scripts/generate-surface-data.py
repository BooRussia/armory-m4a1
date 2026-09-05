"""Generate deterministic, tileable numeric surface data, not a color texture.

RGB channels (sample as linear/non-color data):
  R: fine isotropic micro-height / grain, centered at 0.5.
  G: sparse, finite, tapered hairline scratches; zero means no scratch.
  B: subtle multiscale roughness variation, centered at 0.5.

There is no baked lighting, metalness, color, or specific wear placement here.
The runtime material decides the physical response and scratch intensity.
Every operation is periodic, so a repeating sampler can wrap the tile.
"""

from pathlib import Path
import json
import argparse
import numpy as np
from PIL import Image, ImageDraw

SIZE = 512
SEED = 0x4D344131
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True, help='Output directory for packed data and diagnostic previews')
ROOT = parser.parse_args().output.resolve()
ROOT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(SEED)


def periodic_blur(field: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian convolution on a torus: no edge padding or discontinuity."""
    fy = np.fft.fftfreq(SIZE)[:, None]
    fx = np.fft.fftfreq(SIZE)[None, :]
    kernel = np.exp(-2.0 * np.pi**2 * sigma**2 * (fx * fx + fy * fy))
    return np.fft.ifft2(np.fft.fft2(field) * kernel).real


def unit(field: np.ndarray) -> np.ndarray:
    return (field - field.mean()) / max(float(field.std()), 1e-8)


# An isotropic spectrum avoids visible directional grain on rotated meshes.
white = rng.standard_normal((SIZE, SIZE))
grain = unit(0.72 * unit(periodic_blur(white, 0.36))
             + 0.28 * unit(periodic_blur(white, 0.92)))
grain = np.clip(0.5 + 0.105 * grain, 0.08, 0.92)

# Blends broad periodic scales. The shader applies a small roughness amplitude.
roughness_field = sum(
    weight * unit(periodic_blur(rng.standard_normal((SIZE, SIZE)), sigma))
    for sigma, weight in [(6.0, 0.35), (19.0, 0.40), (54.0, 0.25)]
)
roughness = np.clip(0.5 + 0.072 * unit(roughness_field), 0.2, 0.8)

# Analytic anti-aliased segments use wrapped relative coordinates. Each segment
# is short enough for its nearest toroidal copy to be unambiguous. Ends taper
# rather than making infinitely long stripes or circular bright endpoints.
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
xx += 0.5
yy += 0.5
scratches = np.zeros((SIZE, SIZE), dtype=np.float64)
scratch_descriptors = []
for index in range(88):
    cx, cy = rng.uniform(0, SIZE, size=2)
    length = float(rng.uniform(10.0, 90.0))
    angle = float(rng.normal(0.0, 0.20) if index % 5 else rng.uniform(-np.pi/2, np.pi/2))
    width = float(rng.uniform(0.25, 0.56))
    strength = float(rng.uniform(0.36, 0.78))
    dx = (xx - cx + SIZE / 2.0) % SIZE - SIZE / 2.0
    dy = (yy - cy + SIZE / 2.0) % SIZE - SIZE / 2.0
    along = dx * np.cos(angle) + dy * np.sin(angle)
    across = -dx * np.sin(angle) + dy * np.cos(angle)
    end_taper = np.clip((length / 2.0 - np.abs(along)) / max(2.5, length * 0.17), 0, 1)
    end_taper = end_taper * end_taper * (3.0 - 2.0 * end_taper)
    # Subpixel line width receives Gaussian coverage; no binary jagged edges.
    coverage = np.exp(-0.5 * (across / width)**2)
    scratches = np.maximum(scratches, strength * end_taper * coverage)
    scratch_descriptors.append({"length_px": length, "angle_degrees": float(np.degrees(angle))})

rgb = np.rint(np.stack([grain, scratches, roughness], axis=-1) * 255).astype(np.uint8)
packed = ROOT / "surface-detail.png"
Image.fromarray(rgb, "RGB").save(packed, optimize=True)

names = ["R - isotropic grain height", "G - finite scratches", "B - roughness variation"]
preview_paths = []
for i, name in enumerate(["grain-height", "scratch-mask", "roughness-variation"]):
    path = ROOT / f"preview-{name}.png"
    Image.fromarray(rgb[..., i], "L").save(path, optimize=True)
    preview_paths.append(path.name)

sheet = Image.new("RGB", (SIZE * 3, SIZE + 32), (24, 24, 24))
draw = ImageDraw.Draw(sheet)
for channel, title in enumerate(names):
    draw.text((channel * SIZE + 12, 10), title, fill=(220, 220, 220))
    sheet.paste(Image.fromarray(rgb[..., channel], "L"), (channel * SIZE, 32))
sheet.save(ROOT / "surface-data-channels.png", optimize=True)

stats = {"resolution": [SIZE, SIZE], "seed": SEED, "scratch_count": 88,
         "scratch_length_range_px": [10, 90], "color_space": "linear / non-color data",
         "packed_file": packed.name, "channel_previews": preview_paths, "channels": {}}
for i, name in enumerate(["R_grain_height", "G_scratch_mask", "B_roughness_variation"]):
    data = rgb[..., i].astype(np.float64) / 255.0
    seam = np.mean(np.concatenate([np.abs(data[:, 0]-data[:, -1]), np.abs(data[0, :]-data[-1, :])]))
    interior = (np.abs(np.diff(data, axis=0)).mean() + np.abs(np.diff(data, axis=1)).mean()) / 2
    stats["channels"][name] = {
        "min": round(float(data.min()), 5), "max": round(float(data.max()), 5),
        "mean": round(float(data.mean()), 5), "std": round(float(data.std()), 5),
        "wrap_neighbor_gradient": round(float(seam), 6),
        "interior_neighbor_gradient": round(float(interior), 6),
    }
stats["scratch_coverage_above_0.03"] = round(float((rgb[..., 1] > 0.03 * 255).mean()), 6)
assert rgb.shape == (512, 512, 3)
assert 0.49 < grain.mean() < 0.51 and 0.49 < roughness.mean() < 0.51
assert 0.005 < stats["scratch_coverage_above_0.03"] < 0.045
assert rgb[..., 1].min() == 0
assert Image.open(packed).mode == "RGB"
(ROOT / "surface-data-stats.json").write_text(json.dumps(stats, indent=2) + "\n")
print(json.dumps(stats, indent=2))
