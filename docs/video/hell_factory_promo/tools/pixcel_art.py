"""The pictures of the pixcel act, all drawn by iherk-pixcel itself:
  - the dual-monitor desk with its first N voxel operations (the model being written), every step on one canvas so the
    steps register, and the finished desk in its four directions;
  - three long rows of pieces from the office's own sprite atlas, for the library wall.
Writes media/px/*.png and px.gen.ts.   python tools/pixcel_art.py WORK_DIR"""
import json, pathlib, subprocess, sys
import numpy as np
from PIL import Image

WORK = pathlib.Path(sys.argv[1]); WORK.mkdir(parents=True, exist_ok=True)
OUT = pathlib.Path("media/px"); OUT.mkdir(parents=True, exist_ok=True)
REPO = pathlib.Path(__file__).resolve().parents[4]                       # the iherk-hell-factory checkout this film lives in
PIXCEL = REPO.parent / "iherk-pixcel"                                    # its sibling checkout
ATLAS = REPO / "runtime-assets"
SRC = json.loads((PIXCEL / "assets/office-starter/desk-dev-dual.pixcel.json").read_text())
STEPS = [1, 3, 4, 5, 7, 9, 10, 12, 14, 15, 17]
K, CW, CH, CX, CY = 6, 132, 108, 66, 76          # scale, the canvas in art pixels, and where the footprint's centre sits on it

def render(asset, dirs):
    p = WORK / f"{asset['id']}.pixcel.json"; p.write_text(json.dumps(asset))
    subprocess.run(["node", str(PIXCEL / "dist/cli/index.js"), "render", str(p), "--out", str(WORK / "out"), "--directions", dirs, "--format", "atlas"], check=True, capture_output=True)
    return json.loads((WORK / "out" / f"{asset['id']}.atlas.json").read_text()), Image.open(WORK / "out" / f"{asset['id']}.png").convert("RGBA")

def seat(meta, sheet, key, name):
    f = meta["frames"][key]; fr, iso = f["frame"], f["isometric"]; fx, fy = iso["footprintTiles"]
    ax, ay = iso["anchor"]["x"] - (fx - fy) * 16, iso["anchor"]["y"] - (fx + fy) * 8       # the footprint's centre in the sprite
    c = Image.new("RGBA", (CW, CH), (0, 0, 0, 0)); c.alpha_composite(sheet.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"])), (CX - ax, CY - ay))
    c.resize((CW * K, CH * K), Image.NEAREST).save(OUT / f"{name}.png", optimize=True)

man = {"w": CW * K, "h": CH * K, "k": K, "cx": CX * K, "cy": CY * K, "steps": [], "ops": []}
for n in STEPS:
    a = dict(SRC); a["id"] = f"desk-step-{n:02d}"; a["ops"] = SRC["ops"][:n]; a["frames"] = []; a["decals"] = []
    meta, sheet = render(a, "se"); seat(meta, sheet, f"{a['id']}/se/default", f"step_{n:02d}"); man["steps"].append({"n": n, "f": f"px/step_{n:02d}.png"})
a = dict(SRC); a["id"] = "desk-final"; a["frames"] = []
meta, sheet = render(a, "se,sw,nw,ne")
for d in ("se", "sw", "nw", "ne"): seat(meta, sheet, f"desk-final/{d}/default", f"desk_{d}")
man["dirs"] = [{"d": d, "f": f"px/desk_{d}.png"} for d in ("se", "sw", "nw", "ne")]
for o in SRC["ops"]:                                   # the model's own lines, as the film types them
    if o["op"] == "box": man["ops"].append(f'{{ "op": "box", "from": {json.dumps(o["from"])}, "to": {json.dumps(o["to"])}, "material": "{o["material"]}" }}')
    else: man["ops"].append('{ "op": "' + o["op"] + '", ' + ", ".join(f'"{k}": {json.dumps(v)}' for k, v in o.items() if k not in ("op", "part")) + " }")
man["opCount"] = len(SRC["ops"])

# ---- the library wall: pieces from the office's atlas, three to a scale, in three long rows
atlas = json.loads((ATLAS / "atlas-office.json").read_text()); sheet = Image.open(ATLAS / "atlas-office.png").convert("RGBA")
skip = ("agent-", "floor-", "wall-", "divider-", "bay-sign")
ids = sorted({k.split("/")[0] for k, v in atlas["frames"].items() if v["isometric"]["layer"] == "object" and not k.startswith(skip)})
pieces = []
for i in ids:
    key = next((k for k in (f"{i}/se/default", f"{i}/se/idle_0") if k in atlas["frames"]), None) or next((k for k in atlas["frames"] if k.startswith(i + "/se/")), None)
    if not key: continue
    fr = atlas["frames"][key]["frame"]
    if fr["w"] < 20 or fr["h"] < 24 or fr["h"] > 110: continue
    pieces.append((i, sheet.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))))
rng = np.random.default_rng(7); order = rng.permutation(len(pieces)); S, ROW_H, GAP = 3, 110 * 3, 54
rows = [[], [], []]
for j, o in enumerate(order): rows[j % 3].append(pieces[o])
man["wall"] = []
for r, row in enumerate(rows):
    w = sum(im.width * S + GAP for _, im in row); c = Image.new("RGBA", (w, ROW_H), (0, 0, 0, 0)); x = 0
    for _, im in row:
        big = im.resize((im.width * S, im.height * S), Image.NEAREST); c.alpha_composite(big, (x, ROW_H - big.height)); x += big.width + GAP
    # a row is cut in two so no picture is wider than a frame and a half
    half = w // 2
    for h, (x0, x1) in enumerate(((0, half), (half, w))):
        c.crop((x0, 0, x1, ROW_H)).save(OUT / f"wall_{r}_{h}.png", optimize=True)
    man["wall"].append({"w": w, "h": ROW_H, "half": half, "f": [f"px/wall_{r}_0.png", f"px/wall_{r}_1.png"], "n": len(row)})
man["wallCount"] = len(pieces)
pathlib.Path("px.gen.ts").write_text("// written by tools/pixcel_art.py: do not edit\nexport const PX = " + json.dumps(man, separators=(",", ":")) + " as const;\n")
print("steps", len(man["steps"]), "wall pieces", len(pieces), [(w["w"], w["n"]) for w in man["wall"]])
