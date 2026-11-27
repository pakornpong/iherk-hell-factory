# Pictures, type and sound in this film

Every picture is the maker's own software drawing itself. Nothing here comes from a third party.

| what | where it came from | licence |
|---|---|---|
| `media/office/*.png` (floor tiles, slab, walls, 210 furniture pieces, the whole office in its office, day and night themes, 39 seated agents in two poses) | the running Hell Factory at `127.0.0.1:7140`, the maker's real 20 × 20 office, photographed in stages by `tools/capture.mjs` (read-only) and cut into layers by `tools/layers.py` | the maker's own work (repository `iherk-hell-factory`) |
| `media/px/step_*.png`, `media/px/desk_*.png` | `iherk-pixcel` rendering its own sample model `assets/office-starter/desk-dev-dual.pixcel.json`, with its first N operations and in four directions (`tools/pixcel_art.py`) | the maker's own work (repository `iherk-pixcel`) |
| `media/px/wall_*.png` | 83 pieces cut from Hell Factory's sprite atlas `runtime-assets/atlas-office.png`, which pixcel drew | the maker's own work |
| Geist, Geist Mono (embedded in `kit/fonts.gen.ts`) | Vercel | SIL Open Font License 1.1 (`media/fonts/OFL-Geist.txt`, `OFL-GeistMono.txt`) |
| Kanit, Thai block only (embedded in `kit/thai.gen.ts`; used by the Thai cut) | Cadson Demak, from the copy installed on this machine (`~/Library/Fonts/Kanit-Regular.ttf`, `Kanit-Medium.ttf`), subset by `tools/thai_font.py` | SIL Open Font License 1.1 (`media/fonts/OFL-Kanit.txt`) |
| `media/sound.wav` | made in code by `sound.py` from sines, squares and noise | the film's own |

The session lines in the opening (`npm run build`, `src/api/routes.ts` …) are examples written for the film; the tool
names are the real ones each agent reports. The counts on screen (400 tiles, 210 pieces, 39 agents) are counts of what
is drawn. "7,500+" is the catalogue size the Hell Factory README states (starter set, 112 props, 7,390-item library).
