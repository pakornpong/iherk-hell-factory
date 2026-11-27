# Notes, a row a cut

| cut | what changed | scan |
|---|---|---|
| 1 | first whole film | no pops; 6 holds of 0.5 s or more, 8.57 s in all (the opening 3.17 s, the end 2.62 s); -14.9 LUFS, -1.6 dBTP |
| 2 | opening set larger with a slow push; the camera goes in with each brush stroke and back for the walls; the three rooms cut to on the beat and much closer; the desk joins the library rows; tool bubbles leave before the draw-back; the end card comes forward and rings | 3 pops (see below); 4 holds, 3.93 s in all (the end card 2.62 s); -14.9 LUFS, -1.6 dBTP |
| 3 | sound only: the sessions go on chirping while the question hangs (the silent hole at 2.5 s is gone). The cut the first round of readers read | as cut 2 |
| 4 | after the readers (READINGS.md): the clock-in as three close scenes and a wide run; the door as a tile that becomes the bench; three distinct rooms; zones back under the first pieces; "Raise the walls."; small text set larger | 5 pops, all cuts on the beat; 3 holds, 3.45 s in all (the end card 2.62 s); -15.0 LUFS, -1.9 dBTP |
| 5 | after the second fault-finder: headlines stay up longer; tool bubbles sit just over their agents; the office fades as the camera closes on the door tile, so the floor never fills the frame bright; the day theme is cut and night closes slowly on the shared desks; the pointer places the pieces; one ring on the end card; "Watch them work, live." | 5 pops, all cuts on the beat; 4 holds, 4.12 s in all (the end card 2.62 s, the night wide 0.67 s); -14.9 LUFS, -1.5 dBTP |
| 6 | the Thai cut (`python sound.py th`): every word from `kit/lang.ts`, Thai set in Kanit beside Geist; the picture, camera and beats are cut 5's. Not read by any reader. The English film drawn from the same code is unchanged (its `sound.wav` is byte for byte the one cut 5 carried) | the same 5 pops, all cuts on the beat; 5 holds, 4.03 s in all (the end card in two parts, 1.22 s and 0.62 s; the night wide 0.83 s; the first 0.83 s, before the second session line; 0.53 s as the walls stand); -15.0 LUFS, -1.7 dBTP |

## The scan's lines, answered

- **Pops at 21.75, 22.50 and 23.25 s (frames 1305, 1350, 1395): meant.** They are the three cuts to the server room, the
  nap pods and the snack corner, each on its beat (`ROOMS` in `sound.py`) with its three-note chord on that frame.
- **Pops at 27.50 and 28.50 s (frames 1650, 1710): meant.** The cuts to the block of cubicles and to the Boss
  (`SCENES`), each with a knock and an agent's note on that frame.
- **Hold 24.37 to 25.03 s: chosen.** Night has just fallen on the whole office and "Night shift." is up; it is the rest
  before the camera starts closing on the desks for the clock-in.
- **Motion or patterns at 25.4 s:** that closing move, over the cubicles' stripes. Under WCAG's flash limit.
- **Hold 35.38 to 38.00 s: chosen.** It is the end card: the name, then its line a word at a time, then the two
  repository names; the card comes forward the whole time and the tile's light goes out in rings on the bar.
- **Motion or patterns at 23.25 s:** the cut to the vending machines, over the floor's checker. Not a flash by WCAG's
  measure (5 paired changes in the busiest second, under the limit).

## Sound, to check by ear

`vd sound` leaves three of its 16 named events to the ear: `TURNS[1]` (15.5 s) reads 260 ms late, `STAFF[1]` (26.38 s)
135 ms late and `STAFF[3]` (27.13 s) 125 ms late. Each has a louder sound just after it (the next turn, an agent's
tool chirp), which is where the measure finds its start.
