# Dominoes

All Fives with a double-six set, in the browser: four at the table, five
tiles each and a boneyard, first to 250. One human against three computer players, old men
and young ones, every one of whom has something to say about your play.

## The table

**All Fives, the way it is played on a card table.** The rules are spelled
out on the landing page before anyone plays, and they follow
[pagat's All Fives](https://www.pagat.com/domino/cross/all_fives.html) with
one table's worth of house rules:

- five tiles each and eight in the boneyard; a player who cannot match
  draws, one tile at a time, and knocks only when the boneyard is empty;
- the highest double dealt opens the first hand; after that the winner of
  the last hand leads anything;
- the first double down is the spinner, marked with a star, and once both
  its sides are covered its top and bottom open, so the line runs four ways;
- after every tile the open ends are added up -- a double on an end counts
  both halves, and the spinner counts both halves until both its sides are
  covered -- and a multiple of five scores on the spot;
- going out, or the lowest count in a blocked hand, scores the pips left in
  the other hands to the nearest five;
- first to 250 wins, the moment they reach it, even in the middle of a hand.

The score sheet is kept the way it is at the table: a stroke for every five,
the fifth a slash through the four, so a box is twenty-five.

**No hints.** Nothing lights up to say which tiles fit or what a play would
score. You drag a tile to an end, or tap it and tap the end, and if it does
not match it comes back.

## The layout

`src/game/layout.ts`. The line is drawn from a hub -- the spinner once there
is one, otherwise the first tile -- so the spinner always sits in the middle
of the felt. Each arm turns its corners the same way round, like a pinwheel,
and each leg may run further than the last, so four arms wind outward without
meeting. `layout.test.ts` lays the table after every tile of hundreds of
hands at four widths and holds it to no tile on another and no tile floating
free.

## The bots

`src/game/bot.ts`. A bot knows what a careful player knows: its own tiles,
the table, how many each player holds, and which numbers each has knocked on.
It never looks at another hand. It prices each legal move -- points on the
board now first, then shedding weight, getting doubles down, keeping a hand it
can play, and leaving the next man stuck -- and plays the dearest. It blocks a
hand only when it is certain to hold the lowest count.

In tests a bot beats three players who always lay their heaviest tile, and
four bots win evenly from every seat.

## The talk

`src/game/talk.ts`. Every play gets a line from somebody, in a speech bubble
off the side of his seat: the man who played it, or whoever has an opinion.
It reads only what the table can see, so it never gives away a hand.

## The sound

The synth is the one the site's other games share. What is written for this
one is the table: a tile slammed onto an old folding card table (the crack,
the thin top booming, the loose legs rattling), knuckles for a knock, a pencil
stroke for every five on the sheet. The shuffle is a real recording, public
domain (CC0) from Freesound and credited in [NOTICE.md](NOTICE.md), with a
synthesized stand-in if it cannot be loaded. The music is a loop in the son idiom: clave, tumbao, piano on
the off-beats.

## Where it lives

<https://games.jcoffey.dev/dominoes/>, built straight from this repository's
`main`. This is AGPL, and section 13 asks that players be offered the source
of the version they are running. Building from the published ref is what
makes that offer true.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```
