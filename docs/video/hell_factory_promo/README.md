# Hell Factory — launch film

A 38-second motion film for `iherk-hell-factory` and `iherk-pixcel`: one empty floor is tiled, painted, zoned and
furnished by hand, the pieces are shown coming from pixcel's voxel models, and then the agents clock in.
1920 × 1080 at 60 frames a second, composition `film`. Made as raea code with the video-decompiler skill, started from
its worked film Plus One.

The claim it makes: **the office is yours to design, freely.** Every picture is the product's own output — the maker's
real office photographed from the running app in stages, and pixcel's own renders.

## Run it

`vd` is `python ~/.claude/skills/video-decompiler/tools/vd.py`, with the Python of `~/.venvs/video-decompiler`.

```
python sound.py                 # writes media/sound.wav and kit/times.gen.ts (run again whenever a beat moves)
python sound.py th              # the same for the Thai cut: every command after it draws the film in Thai
vd look --at 4.4,12,20,27,33    # moments as one picture
vd export                       # the film with its sound, then the scan; output in ~/.vd/out/hell_factory_promo/
```

## What is where

| file | holds |
|---|---|
| `BOARD.md` | the film on one page, written before the code |
| `sound.py` | the music, every sound, and the table `T` of every event's beat. It writes `kit/times.gen.ts` |
| `film.tsx` | the camera table, the ground's mood, and the order of the layers |
| `office.tsx` | the office in the world the camera looks at: tiles, walls, the 210 pieces, themes, staff, zones, tool bubbles |
| `acts.tsx` | what sits on the screen: the sessions and their question, the large words, the counts, pixcel's bench, the pointer, the mark |
| `office.gen.ts`, `px.gen.ts` | where every layer sits, written by the two tools below |
| `kit/` | the clock, colours, curves and plain parts (`core.tsx`), the ground (`field.tsx`), embedded Geist |
| `kit/lang.ts` | every word on screen, in English and in Thai |
| `kit/thai.gen.ts`, `tools/thai_font.py` | Kanit's Thai block, embedded with its letter widths, and the tool that writes it |
| `media/office/`, `media/px/` | the pictures; `media/SOURCES.md` says where each came from |
| `tools/capture.mjs` | photographs the running office in stages through the agent Chrome (read-only: it only GETs `/api/state`) |
| `tools/layers.py` | cuts those photographs into layers and writes `office.gen.ts` |
| `tools/pixcel_art.py` | renders the desk model step by step and in four directions with pixcel, and the library rows |

## Two languages

The film is cut in English and in Thai from the same code. The language is the one `sound.py` was last run with
(`python sound.py` for English, `python sound.py th` for Thai): it writes `LANG` and the typed question into
`kit/times.gen.ts`, and the picture takes its words from `kit/lang.ts` by it. Only the keystrokes of the typed question
differ in the sound (29 in English, 23 in Thai, over the same 58 frames); every other event is on the same beat.

Thai is set in Kanit beside Geist: Geist has no Thai letters, so a line with Thai in it also names Kanit's Thai block,
Medium beside Geist 600 and Regular beside the lighter weights. A Thai line is not tracked, its lines stand 1.2 apart
(marks stack above and below the letters), and labels that are capitals in English are set a third larger, since Thai
has no capitals. Names the product itself shows stay as they are in both cuts: tool names, zone names, SE/SW/NW/NE,
HELL FACTORY, the repository names, and the words session, agent, voxel, server and sprite.

`vd export` names its file after the folder, not the language: copy the Thai export away before making the English
one again. Leave the folder in English (`python sound.py`) when done.

## Making the pictures again

The office changes as it is used, so the layers are a photograph of one day. To take it again, with Hell Factory running
on `127.0.0.1:7140` and the agent Chrome on `127.0.0.1:9222`:

```
node tools/capture.mjs RAW build      # floor, walls, a diagonal of furniture at a time, day and night
node tools/capture.mjs RAW staff      # the seated agents, two poses, office and night
python tools/layers.py RAW            # media/office/*.png and office.gen.ts
python tools/pixcel_art.py WORK       # media/px/*.png and px.gen.ts
```

`NSTAFF` in `sound.py` is the number of seated agents `layers.py` reports; change it if the count changes.
