# Notice, credits and provenance

## What this is

An independent implementation of All Fives, the domino game, written from
scratch in TypeScript in 2026: one human against three computer players.

## The game

Dominoes is centuries old and belongs to everybody; so do All Fives and its
spinner. The rules here follow the published descriptions at
[pagat.com](https://www.pagat.com/domino/cross/all_fives.html), with the house
rules stated on the landing page. Rules are ideas, not expression, and nothing
of anybody's text is reproduced.

## What is ours

Everything else: the rules engine, the layout, the bots and their reasoning,
the table talk, the interface, the music and every other sound effect, and
every word on screen. Every tile is drawn in code, and every sound but one is
synthesized in code; there are no image files.

## The shuffle

The one recorded sound is the shuffle, in `src/audio/shuffle.mp3`: the first
3.6 seconds of **"Shuffling Dominos" by RobertWulfman** on Freesound,

- <https://freesound.org/people/RobertWulfman/sounds/220839/>, CC0 1.0
  (public domain dedication)

trimmed, leveled and faded at both ends for this game. CC0 asks for nothing,
not even credit. It is credited anyway, because it was the only shuffle that
sounded like a shuffle. If the file cannot be loaded, the game falls back to a
synthesized one.

## License

Copyright (C) 2026 John Coffey.

This program is free software: you can redistribute it and/or modify it under
the terms of the **GNU Affero General Public License** as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version. See [LICENSE](LICENSE).

AGPL rather than plain GPL because this is served over a network. Section 13
means anyone who runs a modified copy of this for other people over a network
has to offer them its source.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

*None of the above is legal advice.*
