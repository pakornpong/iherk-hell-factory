"""Cuts the photographed office (tools/capture.mjs) into the film's layers: each stage minus the stage before it, cropped,
with where it sits. Writes media/office/*.png and office.gen.ts.
  python tools/layers.py RAW_DIR"""
import hashlib, json, pathlib, sys
import cv2
import numpy as np
from PIL import Image

RAW = pathlib.Path(sys.argv[1]); OUT = pathlib.Path("media/office"); OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.png"): old.unlink()
BG = {"office": (33, 34, 38), "night": (10, 14, 26), "day": (203, 213, 225)}
REPO = pathlib.Path(__file__).resolve().parents[4]                       # the iherk-hell-factory checkout this film lives in
ATLAS = REPO / "runtime-assets"
info = json.loads((RAW / "info-build.json").read_text())
staff_info = json.loads((RAW / "info-staff.json").read_text())

def load(n): return np.asarray(Image.open(RAW / f"{n}.png").convert("RGB")).astype(np.int16)
def changed(a, b):
    m = np.abs(a - (np.array(b, dtype=np.int16) if isinstance(b, tuple) else b)).sum(2) > 0
    m[1840:, 2680:] = False
    return m
def save(rgb, mask, name, box=None):
    """the pixels of rgb under mask, cropped to the mask's box (or the box given); returns where it sits"""
    ys, xs = np.where(mask)
    if len(xs) == 0: return None
    x0, y0, x1, y1 = box or (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    out = np.dstack([rgb[y0:y1, x0:x1].astype(np.uint8), (mask[y0:y1, x0:x1] * 255).astype(np.uint8)])
    Image.fromarray(out, "RGBA").save(OUT / f"{name}.png", optimize=True)
    return {"f": f"office/{name}.png", "x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}

man = {}
bg, floor, walls = load("bg"), load("floor"), load("walls")
man["slab"] = save(bg, changed(bg, BG["office"]), "slab")
man["floor"] = save(floor, changed(floor, bg), "floor")
man["walls"] = save(walls, changed(walls, floor), "walls")

# ---- the furniture, a diagonal at a time (back to front), each cut into the pieces that stand apart
prev, rows, total = walls, [], 0
for k in sorted(d for d in info["depths"] if float(d).is_integer()):
    cur = load(f"d_{int(k)}"); m = changed(cur, prev)
    if m.sum() == 0: continue
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8), iterations=2), connectivity=8)
    comps = sorted(range(1, n), key=lambda i: stats[i, cv2.CC_STAT_LEFT])
    groups = []
    for i in comps:                                  # crumbs join the piece before them; a long row is kept to ten pieces
        if groups and stats[i, cv2.CC_STAT_AREA] < 900: groups[-1].append(i)
        else: groups.append([i])
    while len(groups) > 10:
        j = min(range(len(groups) - 1), key=lambda j: sum(stats[i, cv2.CC_STAT_AREA] for i in groups[j] + groups[j + 1]))
        groups[j] += groups.pop(j + 1)
    pieces = []
    for gi, g in enumerate(groups):
        p = save(cur, m & np.isin(lab, g), f"d{int(k)}_{gi}")
        if p: pieces.append(p)
    rows.append({"k": int(k), "pieces": pieces}); total += len(pieces); prev = cur
man["rows"] = rows
full = load("full")
assert changed(full, prev).sum() == 0, "the last diagonal is not the whole office"
man["full"] = save(full, changed(full, BG["office"]), "full")
for theme in ("night", "day"):
    t = load(f"{theme}_full"); man[theme] = save(t, changed(t, BG[theme]), theme)

# ---- the staff: what each seated agent adds to the office, in two poses of typing
for theme, base in (("office", full), ("night", load("night_full"))):
    a, b = load(f"{theme}_staff_a"), load(f"{theme}_staff_b")
    ma, mb = changed(a, base), changed(b, base)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cv2.dilate((ma | mb).astype(np.uint8), np.ones((5, 5), np.uint8), iterations=2), connectivity=8)
    people = []
    for i in sorted(range(1, n), key=lambda i: (stats[i, cv2.CC_STAT_TOP] + stats[i, cv2.CC_STAT_HEIGHT], stats[i, cv2.CC_STAT_LEFT])):
        if stats[i, cv2.CC_STAT_AREA] < 500: continue
        x0, y0 = stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP]; box = (x0, y0, x0 + stats[i, cv2.CC_STAT_WIDTH], y0 + stats[i, cv2.CC_STAT_HEIGHT])
        j = len(people)
        pa = save(a, ma & (lab == i), f"s_{theme}_{j}_a", box); pb = save(b, mb & (lab == i), f"s_{theme}_{j}_b", box)
        if pa and pb: people.append({**pa, "g": pb["f"]})
    man["staff" if theme == "office" else "staffNight"] = people

# ---- the floor, a tile at a time: the tile sprite's own shape, laid where the app drew it
atlas = json.loads((ATLAS / "atlas-office.json").read_text()); fr = atlas["frames"]["floor-corridor-tile/se/default"]["frame"]
spr = np.asarray(Image.open(ATLAS / "atlas-office.png").convert("RGBA"))[fr["y"]:fr["y"] + fr["h"], fr["x"]:fr["x"] + fr["w"], 3] > 0
tile = np.kron(spr, np.ones((2, 2), dtype=bool)); th, tw = tile.shape
fm = changed(floor, bg); W_, D_ = info["campus"]["w"], info["campus"]["d"]
best = None
for ox in range(1280, 1312):
    for oy in range(290, 316):
        # tile (0,0) and the three other corners must lie wholly on the floor
        ok = sum(int(fm[oy + (tx + ty) * 32: oy + (tx + ty) * 32 + th, ox + (tx - ty) * 64: ox + (tx - ty) * 64 + tw][tile].sum()) for tx, ty in ((0, 0), (W_ - 1, 0), (0, D_ - 1), (W_ - 1, D_ - 1)))
        if best is None or ok > best[0]: best = (ok, ox, oy)
_, OX, OY = best
union = np.zeros_like(fm); imgs = {}; tiles = []; kinds = {}
for f in info["campus"]["floors"]:
    x, y = OX + (f["tx"] - f["ty"]) * 64, OY + (f["tx"] + f["ty"]) * 32
    crop = np.dstack([floor[y:y + th, x:x + tw].astype(np.uint8), (tile * 255).astype(np.uint8)]); crop[~tile] = 0
    h = hashlib.md5(crop.tobytes()).hexdigest()
    if h not in imgs: imgs[h] = len(imgs); Image.fromarray(crop, "RGBA").save(OUT / f"t_{imgs[h]}.png")
    union[y:y + th, x:x + tw] |= tile
    tiles.append([f["tx"], f["ty"], imgs[h], {"floor-office-carpet": 0, "floor-corridor-tile": 1}.get(f["assetId"], 2)])
    if f["assetId"] == "floor-office-carpet": kinds.setdefault((f["tx"] + f["ty"]) % 2, {}).setdefault(imgs[h], 0); kinds[(f["tx"] + f["ty"]) % 2][imgs[h]] += 1
base = [max(kinds[p], key=kinds[p].get) for p in (0, 1)]
man["tiles"] = {"ox": int(OX), "oy": int(OY), "w": int(tw), "h": int(th), "n": len(imgs), "base": base, "list": tiles}
man["bg"] = {k: "#%02x%02x%02x" % v for k, v in BG.items()}
man["counts"] = info["campus"]["counts"]; man["zones"] = info["campus"]["zones"]; man["customZones"] = info["campus"]["customZones"]
man["staffInfo"] = staff_info["office"]
pathlib.Path("office.gen.ts").write_text("// written by tools/layers.py from the photographed office: do not edit\nexport const OFFICE = " + json.dumps(man, separators=(",", ":")) + " as const;\n")
print(f"rows {len(rows)}, pieces {total}, staff {len(man['staff'])}/{len(man['staffNight'])}, tile images {len(imgs)}, tile origin {OX},{OY}, tiles cover {int((union & fm).sum())} of floor {int(fm.sum())} (outside {int((union & ~fm).sum())}), base {base}")
print("files", len(list(OUT.glob('*.png'))), "bytes", sum(p.stat().st_size for p in OUT.glob('*.png')))
