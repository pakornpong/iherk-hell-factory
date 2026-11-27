"""The sound of the Hell Factory film, written before the picture (BOARD.md, "Sound"). Music first: one chord a bar in
F major from the bar the first tile lands in, a pattern under it, and the things that are placed as its tune. Every
event the picture shows has its beat here, and this file writes those beats to kit/times.gen.ts, so the film and the
sound read one clock.
  python sound.py [en|th]     writes media/sound.wav (48 kHz stereo) and kit/times.gen.ts; the language (English if not given)
                              is the film's: the picture reads it from the same file (kit/lang.ts holds the words)
Everything is made here from sines, squares and noise. No samples, no service. 120 beats a minute: a beat is 30 frames."""
import json, pathlib, re, subprocess, sys, wave
import numpy as np

SR, FPS, FB, BEATS = 48000, 60, 30, 76
FB = int((json.loads(pathlib.Path("score.json").read_text(encoding="utf-8")).get("music") or {}).get("fb") or FB)   # a track mapped by vd audio --tempo-map sets the beat
BEAT = FB / FPS
N = int(BEATS * BEAT * SR) + SR
rng = np.random.default_rng(11)
STEMS = {k: [np.zeros(N), np.zeros(N)] for k in ("keys", "bass", "drums", "tune", "fx")}

# ---- the film's events, in beats. The picture imports these (kit/times.gen.ts).
NSTAFF = 39                                                          # the seated agents the office was photographed with (office.gen.ts)
T = {
    "LOGS": [0, 0.75, 1.5, 2.25, 3, 3.75], "ASK0": 2.5, "ASK_PER": 2.0, "COLLAPSE": 6.75,    # sessions at work, the question typed, all of it falling to one point
    "TILE": 8, "SPREAD": 9.5, "SPREAD_LEN": 2.6, "PAINT": [13, 14.5], "PAINT_LEN": 1.1, "WALLS": 16,   # one tile; the floor; two strokes of the brush; the walls
    "ZONES": [18, 19.5, 21, 22.5], "ZONE_LEN": 1.0,                  # four zones dragged out
    "DOOR": 24, "OPS": [25, 25.5, 26, 26.5, 27, 27.5, 28, 28.25, 28.5, 28.75, 29], "SCREEN": 29.5,   # into one tile: the desk written a voxel operation at a time, then its screens
    "TURNS": [30.5, 31, 31.5, 32], "LIB": 32.5, "OUT": 35,     # it turns through its other three directions and home; the library behind it; out through the door
    "BUILD0": 36, "ROWS0": 36, "ROW_STEP": 0.18, "ROWS_N": 36,      # back on the floor: the office goes up, a diagonal at a time
    "ROOMS": [43.5, 45, 46.5], "SHIFT": [48, 48],                    # three rooms seen close; then night (the day theme was cut after the readers: SHIFT[0] is kept only as the bar it was on)
    "CLOCKIN": 52,
    "SCENES": [55, 57, 59],                                           # from the shared desks to a block of cubicles, to the Boss, then everyone
    "STAFF": [52, 52.75, 53.5, 54.25] + [55, 55.33, 55.67, 56, 56.33, 56.67] + [57] + [round(59.25 + i * 0.1, 2) for i in range(NSTAFF - 11)],     # each agent sits down
    "BUBBLES": [52.4, 53.15, 53.9, 54.65, 55.6, 56.4, 60, 60.6, 61.2, 62.2, 63.4, 64.6, 65.6, 66.6],   # what they are doing, one after another
    "ASK": 62, "ANSWER": 64, "END": 68, "MARK": 70, "LINE": 71.5, "CREDIT": 73,
}
LINES = {"en": "Where do your AI agents work?", "th": "AI agent ของคุณทำงานที่ไหน?"}
LANG = sys.argv[1] if len(sys.argv) > 1 else "en"
if LANG not in LINES: raise SystemExit(f"no such language: {LANG} (one of {', '.join(LINES)})")
LINE = LINES[LANG]
KEYS = re.findall(r".[\u0E31\u0E33-\u0E3A\u0E47-\u0E4E]*", LINE)      # what one keystroke shows: a letter with the marks above and below it (kit/lang.ts splits it the same way)
T["ASK_PER"] = round(58 / len(KEYS), 3)                              # frames a keystroke: the question takes the same 58 frames to type in either language

def tt(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 8) / np.sqrt(1 + (f / hi) ** 8); return np.fft.irfft(X, len(x))
def put(stem, x, beat, gain=1.0, pan=0.0):
    a = int(round(beat * BEAT * SR)); n = min(len(x), N - a)
    if n <= 0 or a < 0: return
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    STEMS[stem][0][a:a + n] += x[:n] * gain * gl * 1.414; STEMS[stem][1][a:a + n] += x[:n] * gain * gr * 1.414

# ---- the instruments
def ep(m, d=1.6, bright=1.0):
    """an electric piano note: a sine bent by itself, with a short tine on top"""
    t = tt(d); f = hz(m)
    x = np.sin(2 * np.pi * f * t + 1.3 * bright * np.exp(-t / 0.22) * np.sin(2 * np.pi * f * t)) * np.exp(-t / (0.9 * d))
    x += 0.34 * bright * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.09) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.5)
    return x * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.08) * 0.32
def chord(ms, d=1.6, bright=1.0):
    x = np.zeros(int(d * SR))
    for i, m in enumerate(ms):
        n = ep(m, d, bright); a = int(i * 0.008 * SR); x[a:] += n[:len(x) - a]         # rolled a little, as a hand does
    return x / np.sqrt(len(ms))
def bass(m, d=0.5):
    t = tt(d); f = hz(m)
    x = 0.6 * np.sin(2 * np.pi * f * t) + 0.8 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.2) + 0.35 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.1)
    return x * np.minimum(1, t / 0.006) * np.exp(-t / (0.7 * d)) * np.minimum(1, (d - t) / 0.04) * 0.5
def kick(g=1.0):
    t = tt(0.3); ph = 2 * np.pi * np.cumsum(46 + 70 * np.exp(-t / 0.03)) / SR
    return (np.sin(ph) * np.exp(-t / 0.09) + band(rng.standard_normal(len(t)), 1500, 5000) * 0.5 * np.exp(-t / 0.005)) * g * 0.8
def hat(g=1.0, d=0.03):
    t = tt(0.12); return band(rng.standard_normal(len(t)), 6500, 12000) * np.exp(-t / d) * g * 0.5
def shaker(g=1.0):
    t = tt(0.11); return band(rng.standard_normal(len(t)), 3200, 9000) * np.minimum(1, t / 0.012) * np.exp(-t / 0.035) * g * 0.45
def clap(g=1.0):
    t = tt(0.24); x = np.zeros(len(t))
    for at in (0, 0.009, 0.02):
        a = int(at * SR); k = t[:len(t) - a]; x[a:] += band(rng.standard_normal(len(k)), 900, 3600) * np.exp(-k / 0.012)
    x += band(rng.standard_normal(len(t)), 1000, 3000) * 0.5 * np.exp(-t / 0.07)
    return x * g * 1.3
def snap(g=1.0):
    t = tt(0.1); return (band(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t / 0.011) * 1.6 + np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.008) * 0.3) * g
def pluck(m, g=1.0, d=0.7):
    """a wooden bar: the tune of the replies"""
    t = tt(d); f = hz(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.2) + 0.32 * np.sin(2 * np.pi * 4.0 * f * t) * np.exp(-t / 0.035) + 0.12 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t / 0.012)
    return (x + band(rng.standard_normal(len(t)), 1500, 5000) * 0.25 * np.exp(-t / 0.004)) * np.minimum(1, t / 0.002) * g * 0.5
def bubble(f0, g=1.0):
    """a message arriving: a short upward chirp"""
    t = tt(0.09); ph = 2 * np.pi * np.cumsum(f0 * (1 + 1.3 * t / 0.09)) / SR
    return np.sin(ph) * np.sin(np.pi * np.minimum(1, t / 0.09)) ** 2 * g * 0.5
def chip(m, g=1.0, d=0.22):
    """a square note, the sound of one voxel operation"""
    t = tt(d); f = hz(m); x = np.zeros(len(t))
    for h in range(1, 14, 2): x += np.sin(2 * np.pi * h * f * t) / h * (1 if h * f < 9000 else 0)
    return x * np.minimum(1, t / 0.003) * np.exp(-t / (0.45 * d)) * g * 0.3
def knock(g=1.0):
    t = tt(0.16); return (np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.035) + band(rng.standard_normal(len(t)), 350, 1400) * 1.5 * np.exp(-t / 0.014)) * g * 0.7
def key(g=1.0):
    t = tt(0.03); return (np.sin(2 * np.pi * 2100 * t) * np.exp(-t / 0.003) + band(rng.standard_normal(len(t)), 3000, 9000) * 0.5 * np.exp(-t / 0.0015)) * g
def tick(g=1.0):
    t = tt(0.05); return np.sin(2 * np.pi * 1250 * t) * np.exp(-t / 0.008) * g * 0.6
def swell(d=1.0):
    t = tt(d); return band(rng.standard_normal(len(t)), 1800, 9000) * (t / d) ** 2.2 * np.minimum(1, (d - t) / 0.02) * 0.5
def whoosh(d=0.5):
    t = tt(d); x = rng.standard_normal(len(t)); k = np.sin(np.pi * t / d) ** 2
    return (band(x, 500, 2500) * (1 - t / d) + band(x, 2500, 8000) * (t / d)) * k * 0.6
def firework(g=1.0, d=1.1):
    """far off: a soft thump, then a crackle that thins out"""
    t = tt(d); x = band(rng.standard_normal(len(t)), 40, 260) * 5 * np.exp(-t / 0.08)
    cr = np.zeros(len(t))
    for _ in range(int(70 * g) + 20):
        a = int((0.06 + rng.random() ** 1.6 * (d - 0.15)) * SR); k = np.arange(min(700, len(t) - a)) / SR
        cr[a:a + len(k)] += rng.random() * np.sin(2 * np.pi * (2500 + 5000 * rng.random()) * k) * np.exp(-k / 0.002)
    x += cr * np.exp(-t / 0.45) * 0.9 + band(rng.standard_normal(len(t)), 2500, 9000) * 0.25 * np.exp(-t / 0.3) * np.minimum(1, t / 0.05)
    return x * g * 0.55

# ---- the harmony: one chord a bar from the bar the first tile lands in (bar 2, beat 8). [voicing, bass note]
CH = [([57, 60, 64, 65], 41), ([57, 60, 62, 65], 38), ([58, 62, 65, 69], 34), ([58, 60, 65, 67], 36)]     # Fmaj7, Dm7, B flat maj7, C7sus
BAR0 = int(T["TILE"]) // 4
def bar_chord(bar): return CH[(bar - BAR0) % 4]
SCALE = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89]                  # F major without its fourth and seventh: nothing placed can sound wrong

for bar in range(BAR0, BEATS // 4):
    b0 = bar * 4; ms, root = bar_chord(bar)
    bench = T["DOOR"] <= b0 < T["BUILD0"]; build = T["BUILD0"] <= b0 < T["SHIFT"][0]; shift = T["SHIFT"][0] <= b0 < T["CLOCKIN"]
    live = T["CLOCKIN"] <= b0 < T["ANSWER"]; answer = T["ANSWER"] <= b0 < T["END"]; ending = b0 >= T["END"]
    if ending:
        if bar == T["END"] // 4: put("keys", chord([53, 57, 60, 64, 67], 6.0, 0.7), b0, 0.9)
        continue
    # the keys: on one, and pushed before three
    put("keys", chord(ms + [ms[1] + 12], 1.5, 1.0 if live else 0.8), b0, 0.8, pan=-0.15)
    if not shift: put("keys", chord([n + 12 for n in ms[1:]], 0.9, 0.7), b0 + 1.5, 0.5, pan=0.15)
    if live: put("keys", chord(ms[1:], 0.6, 0.7), b0 + 3, 0.45, pan=0.15)
    # the bass, from the walls
    if b0 >= T["WALLS"] and not shift:
        for at, m, d in ((0, root, 0.7), (1.5, root, 0.4), (2.5, root + 7, 0.4), (3.5, root + 12, 0.3)):
            put("bass", bass(m, d), b0 + at, 0.8)
    if shift: put("bass", bass(root, 1.6), b0, 0.9)
    # the drums: a shaker from the first tile; a kick and a snap from the walls; lighter on the bench; four on the floor once they clock in
    if not shift:
        for e in range(8): put("drums", shaker(0.55 if e % 2 else 0.3), b0 + e * 0.5, 2.6, pan=0.3)
    if (T["WALLS"] <= b0 < T["DOOR"]) or build or answer:
        put("drums", kick(0.7), b0, 0.7); put("drums", kick(0.6), b0 + 2, 0.7); put("drums", snap(), b0 + 1, 0.8, pan=-0.2); put("drums", snap(), b0 + 3, 0.8, pan=-0.2)
    if build:
        for q in range(4): put("drums", hat(0.6), b0 + q + 0.5, 1.5, pan=-0.3)
    if bench:
        put("drums", kick(0.55), b0, 0.6); put("drums", snap(0.7), b0 + 2, 0.6, pan=-0.2)
    if live:
        for q in range(4):
            put("drums", kick(), b0 + q, 0.8); put("drums", hat(0.7), b0 + q + 0.5, 1.8, pan=-0.3)
        put("drums", clap(), b0 + 1, 0.8, pan=0.1); put("drums", clap(), b0 + 3, 0.8, pan=0.1)

# ---- bars 1 and 2, the sessions with nowhere to be: no chord. A tick on each beat, and every session line a chirp out of tune with the last.
for b in range(int(T["TILE"])): put("drums", tick(), b, 0.35 if b < T["COLLAPSE"] else 0.0)
for i, b in enumerate(T["LOGS"]):
    put("fx", bubble(520 * 2 ** (rng.uniform(-5, 6) / 12)), b, 0.8, pan=(-0.5 if i % 3 else 0.5))
for i, b in enumerate((4.6, 5.2, 5.75, 6.3)):                             # they go on working while the question hangs there
    put("fx", bubble(520 * 2 ** (rng.uniform(-5, 6) / 12), 0.7), b, 0.5, pan=(0.4 if i % 2 else -0.4))
for i, ch in enumerate(KEYS):                                       # the question is typed
    if ch != " ": put("fx", key(), T["ASK0"] + i * T["ASK_PER"] / FB, 0.14, pan=-0.3 + 0.6 * i / len(KEYS))
for i in range(11):                                                # they fall into one point
    put("fx", bubble(900 * 2 ** (-i / 4.0), 0.7), T["COLLAPSE"] + i * 0.085, 0.6, pan=0.6 - 0.12 * i)
put("fx", tick(1.0), T["SPREAD"], 0.5)                             # the pointer takes hold of the tile
# ---- the floor: one tile, a knock; the rest run out from it as a soft roll that climbs; each stroke of the brush a brushed run; the walls, a knock
put("fx", knock(1.2), T["TILE"], 1.0); put("tune", pluck(65, 1.0, 1.0), T["TILE"], 0.7)
for i in range(26):
    put("tune", pluck(SCALE[(i * 2) % 7] + 12 * (i // 14), 0.5, 0.22), T["SPREAD"] + i * T["SPREAD_LEN"] / 26, 0.3, pan=-0.6 + 1.2 * rng.random())
for j, b in enumerate(T["PAINT"]):
    put("fx", tick(1.0), b, 0.5); put("fx", whoosh(T["PAINT_LEN"] * BEAT), b, 0.3, pan=-0.3 + 0.6 * j)
    for i in range(8): put("tune", pluck(SCALE[i % 5 + 2 * j] , 0.5, 0.2), b + (i + 0.5) * T["PAINT_LEN"] / 8, 0.28, pan=-0.3 + 0.6 * j)
put("fx", swell(BEAT * 1.0), T["WALLS"] - 1.0, 0.4); put("fx", knock(1.2), T["WALLS"], 0.95)
# ---- the zones: a press, a drag that rises, and the zone's own two notes as it is let go
for i, (b, mo) in enumerate(zip(T["ZONES"], ((72, 77), (69, 76), (70, 77), (72, 79)))):
    put("fx", tick(1.0), b, 0.5); put("fx", whoosh(T["ZONE_LEN"] * BEAT * 0.9), b, 0.22, pan=-0.4 + 0.25 * i)
    put("tune", pluck(mo[0], 0.8), b + T["ZONE_LEN"], 0.5, pan=-0.2); put("tune", pluck(mo[1], 0.8), b + T["ZONE_LEN"] + 0.25, 0.5, pan=0.2)
# ---- the door into one tile, and the desk written an operation at a time: square notes that climb the chord, and the screens come on
put("fx", whoosh(0.9), T["DOOR"] - 0.2, 0.55); put("fx", knock(0.9), T["DOOR"] + 1, 0.0)
OPS = [53, 57, 60, 65, 64, 69, 72, 70, 74, 77, 81]
for i, b in enumerate(T["OPS"]): put("tune", chip(OPS[i]), b, 0.75, pan=-0.35 + 0.07 * i)
put("fx", knock(0.8), T["SCREEN"], 0.6); put("tune", chip(84, 1.0, 0.5), T["SCREEN"], 0.7); put("tune", chip(89, 1.0, 0.6), T["SCREEN"] + 0.25, 0.7)
for i, (b, m) in enumerate(zip(T["TURNS"], (74, 77, 81, 84))):
    put("fx", whoosh(0.22), b - 0.3, 0.3, pan=-0.3 + 0.2 * i); put("tune", chip(m, 1.0, 0.4), b, 0.7, pan=-0.3 + 0.2 * i); put("fx", tick(0.9), b, 0.4)
put("fx", whoosh(0.8), T["LIB"], 0.3, pan=0.4)
# ---- back to the floor: the desk is placed, a knock; then the office goes up a diagonal at a time, the tune climbing as it comes forward
put("fx", whoosh(0.6), T["OUT"], 0.5); put("fx", knock(1.2), T["BUILD0"], 1.0)
CELL = [0, 2, 4, 2, 1, 3, 5, 3, 2, 4, 6, 4, 3, 5, 7, 5, 4, 6, 8, 6, 5, 7, 9, 7, 6, 8, 10, 8, 7, 9, 10, 9, 8, 10, 9, 10]
for i in range(T["ROWS_N"]):
    b = T["ROWS0"] + i * T["ROW_STEP"]
    put("tune", pluck(SCALE[CELL[i]], 0.8, 0.35), b, 0.55, pan=-0.5 + i / T["ROWS_N"])
    put("fx", knock(0.35), b, 0.22, pan=-0.5 + i / T["ROWS_N"])
put("tune", pluck(89, 1.0, 1.0), T["ROWS0"] + T["ROWS_N"] * T["ROW_STEP"], 0.7)
for i, (b, mo) in enumerate(zip(T["ROOMS"], ((77, 81, 84), (74, 77, 81), (72, 76, 79)))):          # three rooms, three small chords
    put("fx", whoosh(0.35), b - 0.6, 0.3, pan=-0.4 + 0.4 * i)
    for j, m in enumerate(mo): put("tune", pluck(m, 0.8), b + 0.25 * j, 0.5, pan=-0.2 + 0.2 * j)
# ---- the shifts: the room changes on the bar. Day is bright and bare; night comes in low
put("fx", knock(1.0), T["SHIFT"][1], 0.8); put("keys", chord([50, 57, 60, 65], 2.2, 0.5), T["SHIFT"][1], 0.9); put("tune", pluck(62, 1.0, 1.2), T["SHIFT"][1], 0.6)
for i, m in enumerate((69, 72, 74, 77)): put("tune", pluck(m, 0.7, 0.6), T["SHIFT"][1] + 2 + i * 0.5, 0.4, pan=-0.3 + 0.2 * i)      # the screens, waiting
put("fx", swell(BEAT * 1.5), T["CLOCKIN"] - 1.5, 0.55)
# ---- they clock in: the tune. Each agent a note, in cells that climb; the first few alone, then a run. Once they sit, they type
put("fx", knock(1.2), T["CLOCKIN"], 0.9)
RUN = [65, 69, 72, 77, 74, 72, 67, 72, 74, 79, 77, 74, 69, 72, 77, 81, 79, 77, 72, 77, 81, 84, 81, 79, 74, 77, 81, 86, 84, 81, 77, 81, 84, 89, 86, 84, 81, 84, 89]
for i, b in enumerate(T["STAFF"]):
    put("tune", pluck(RUN[i], 1.0 if i < 11 else 0.8, 0.5 if i < 11 else 0.3), b, 0.75 if i < 11 else 0.5, pan=-0.5 + ((i * 7) % 11) / 11)
    for k in range(int(4 + (T["ANSWER"] - b) * 3)):                # that agent's keys, until the answer
        put("fx", key(0.6), b + 0.4 + rng.random() * (T["ANSWER"] - b - 0.4), 0.05, pan=-0.7 + 1.4 * rng.random())
for i, b in enumerate(T["BUBBLES"]): put("fx", bubble((698.5, 880, 1046.5, 784, 1174.7)[i % 5]), b, 0.6 if i < 6 else 0.4, pan=-0.4 + 0.2 * (i % 5))
for b in T["SCENES"][:2]: put("fx", knock(0.8), b, 0.6)             # the cuts   # the same chirp as the opening, in tune now
# ---- the question comes back and is answered
for i, ch in enumerate(KEYS):
    if ch != " ": put("fx", key(), T["ASK"] + i * 1.2 / FB, 0.12, pan=-0.3 + 0.6 * i / len(KEYS))
put("fx", knock(1.2), T["ANSWER"], 0.9); put("tune", pluck(84, 1.0), T["ANSWER"], 0.8); put("tune", pluck(89, 1.0), T["ANSWER"] + 0.25, 0.8)
# ---- the end: everything draws back to one tile; the name on two notes, a fourth apart
put("fx", whoosh(1.0), T["END"], 0.4)
put("tune", pluck(72, 1.0, 1.2), T["MARK"], 0.8); put("tune", pluck(77, 1.0, 1.6), T["MARK"] + 0.5, 0.9); put("fx", knock(0.9), T["MARK"], 0.6)
put("keys", chord([53, 60, 64, 67, 69], 4.5, 0.6), T["MARK"], 0.7)
put("fx", tick(0.8), T["LINE"], 0.35)

# ---- the mix
GAIN = {"keys": 0.95, "bass": 0.85, "drums": 1.0, "tune": 1.3, "fx": 1.3}
L = sum(STEMS[k][0] * GAIN[k] for k in STEMS); R = sum(STEMS[k][1] * GAIN[k] for k in STEMS)
def air(x):                                                     # a shelf: what is above about 2.5 kHz comes up 5 dB, so the top is not dull
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 + 0.8 / (1 + (2500 / np.maximum(f, 1)) ** 4); return np.fft.irfft(X, len(x))
L, R = air(L), air(R)
mix = np.stack([L, R], 1); mix = np.tanh(mix * 1.2) / np.tanh(1.2)
end = int(BEATS * BEAT * SR); fade = int(1.6 * SR); mix = mix[:end]; mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
mix *= 0.7 / np.abs(mix).max()
out = pathlib.Path("media"); out.mkdir(exist_ok=True); raw = out / "sound-raw.wav"; final = out / "sound.wav"
with wave.open(str(raw), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
TARGET = -15.0
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(raw), "-af", f"loudnorm=I={TARGET}:TP=-2.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
m = json.loads(p.stderr[p.stderr.rindex("{"):p.stderr.rindex("}") + 1])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", f"loudnorm=I={TARGET}:TP=-2.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", str(SR), "-c:a", "pcm_s16le", str(final)], check=True)
raw.unlink()

# ---- the one clock, written for the picture (kit/times.gen.ts) and for vd: the rate, the beat, the length, the events,
# and the cues (each named event a sound starts on, in seconds), which vd sound checks the mix against. One line each,
# `export const NAME = JSON;`, so vd reads the same file the picture imports.
CLOCK = {"FPS": FPS, "FB": FB, "BEATS": BEATS, "DURATION": round(BEATS * BEAT, 6), "BPM": round(60 / BEAT, 6)}
CUES = [[n, T[n]] for n in ("TILE", "WALLS", "SCREEN", "BUILD0", "CLOCKIN", "ANSWER", "MARK")]
CUES += [["SHIFT[1]", T["SHIFT"][1]]] + [[f"TURNS[{i}]", b] for i, b in enumerate(T["TURNS"])] + [[f"STAFF[{i}]", b] for i, b in enumerate(T["STAFF"][:4])]
CUES = sorted(([n, round(b * BEAT, 4)] for n, b in CUES), key=lambda c: c[1])
pathlib.Path("kit/times.gen.ts").write_text("// generated by sound.py: the film's clock and its events in beats, the same numbers the sound was made from\n"
                                            + "".join(f"export const {k} = {json.dumps(v)};\n" for k, v in (("CLOCK", CLOCK), ("TIMES", T), ("LANG", LANG), ("LINE", LINE), ("CUES", CUES))), encoding="utf-8", newline="\n")
score = pathlib.Path("score.json"); s = json.loads(score.read_text(encoding="utf-8"))
if (s.get("fps"), s.get("duration"), s.get("bpm")) != (FPS, CLOCK["DURATION"], CLOCK["BPM"]):          # the score's clock is this one
    s.update(fps=FPS, duration=CLOCK["DURATION"], bpm=CLOCK["BPM"]); score.write_text(json.dumps(s, indent=1), encoding="utf-8", newline="\n")
mono = mix.mean(1); bar = int(4 * BEAT * SR)
rows = [20 * np.log10(np.sqrt((mono[i:i + bar] ** 2).mean()) + 1e-9) for i in range(0, len(mono) - bar + 1, bar)]
print(f"{final}: {BEATS * BEAT:.1f} s; before levelling {m['input_i']} LUFS, true peak {m['input_tp']} dBTP, range {m['input_lra']} LU; levelled to {TARGET} LUFS")
print("level each bar (dB):", " ".join(f"{r:4.0f}" for r in rows))
for k in STEMS:
    s = (STEMS[k][0] + STEMS[k][1]) * GAIN[k] / 2; print(f"  {k:6s} rms {20 * np.log10(np.sqrt((s[:end] ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
X = np.abs(np.fft.rfft(mono)) ** 2; fr = np.fft.rfftfreq(len(mono), 1 / SR); tot = X.sum()
print("  ".join(f"{lo}-{hi} Hz {100 * X[(fr >= lo) & (fr < hi)].sum() / tot:.0f}%" for lo, hi in [(20, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 16000)]))
