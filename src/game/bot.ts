import { SEATS, type Game, type Move } from './game'
import { makeRng } from './rng'
import { TILE_COUNT, TILES, count, has, isDouble, pips, type Tile } from './tiles'

/**
 * How a computer player chooses a tile.
 *
 * It knows what anybody at a real table knows: its own tiles, every tile on
 * the table, how many each player holds and how many are in the boneyard,
 * and which numbers each of them has knocked or drawn on. It never looks at another hand. Everything below is worked out
 * from those, the way a careful player counts.
 *
 * Each legal move is priced, and the dearest is played. What makes a move
 * good, roughly in order of how much it usually matters:
 *
 * - it goes out, which ends the argument;
 * - it scores: the ends add up to a multiple of five, and the points are
 *   on the board now instead of maybe later;
 * - it blocks the hand when this player is sure to have the lowest count,
 *   and never when it is not;
 * - it leaves ends the next player has already knocked on, or numbers
 *   nobody else can hold -- especially when somebody is down to a tile or two;
 * - it sheds weight, because every pip still held at the end is a point for
 *   somebody else;
 * - it gets a double down, since a double only ever fits one number;
 * - it leaves this player something to play next time round.
 */

export interface Leaning {
  /** Appetite for dumping heavy tiles early. */
  shed: number
  /** Hurry to get doubles off the hand. */
  doubles: number
  /** Care for keeping a playable hand. */
  hold: number
  /** Relish for leaving a neighbor stuck. */
  spite: number
}

/**
 * Each bot leans a little one way or another, so three of them are not the
 * same player three times. The lean comes from the seed, so a seed still
 * replays a whole game exactly.
 */
export function leanings(seed: number, n: number): Leaning[] {
  const rng = makeRng(seed ^ 0x5eed)
  const around = () => 0.75 + rng() * 0.5
  return Array.from({ length: n }, () => ({ shed: around(), doubles: around(), hold: around(), spite: around() }))
}

export const EVEN: Leaning = { shed: 1, doubles: 1, hold: 1, spite: 1 }

/** The move this seat would make, or null to knock. */
export function decide(g: Game, lean: Leaning = EVEN): Move | null {
  const moves = g.legal()
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]
  let best = moves[0]
  let bestScore = -Infinity
  for (const m of moves) {
    const s = price(g, g.current, m, lean)
    if (s > bestScore) {
      best = m
      bestScore = s
    }
  }
  return best
}

/**
 * One action: play what `decide` picks, or draw one tile if nothing fits and
 * there is something to draw, or knock. A draw leaves the turn with the same
 * player, so the loop in the app paces every tile drawn, the way a man at a
 * table draws them one at a time. The tests go through here too.
 */
export function step(g: Game, lean: Leaning = EVEN): Move | 'draw' | null {
  const m = decide(g, lean)
  if (m) g.play(m.tile, m.side)
  else if (g.mustDraw) {
    g.draw()
    return 'draw'
  } else g.pass()
  return m
}

export function price(g: Game, seat: number, m: Move, lean: Leaning): number {
  const hand = g.hands[seat]
  const after = hand.filter((t) => t !== m.tile)
  if (after.length === 0) return 1e9

  const [a, b] = TILES[m.tile]
  const showing = g.endsAfter(m.tile, m.side)
  const matches = (t: Tile) => showing.some((v) => has(t, v))

  // Tiles this seat cannot see: in somebody else's hand.
  const seen = new Set<Tile>([...g.played, ...hand])
  const unseen: Tile[] = []
  for (let t = 0; t < TILE_COUNT; t++) if (!seen.has(t)) unseen.push(t)
  const outThere = unseen.some(matches)

  // The hand locks after this move if nobody can possibly follow it --
  // which, with tiles still in the boneyard, is not yet: they get drawn first.
  if (g.boneyard.length === 0 && !outThere && !after.some(matches)) {
    // Certain, not probable: each opponent is given the lightest tiles they
    // could possibly be holding, and this seat still has to come in under
    // every one of them. "Probably lowest" is a coin that costs the whole
    // hand when it lands wrong.
    const mine = count(after)
    const light = [...unseen].sort((x, y) => pips(x) - pips(y))
    const floor = (k: number) => count(light.slice(0, g.hands[(seat + k) % SEATS].length))
    const sure = unseen.length > 0 && [1, 2, 3].every((k) => mine < floor(k))
    return sure ? 5e8 - mine : -5e8
  }

  // Points on the board now are worth more than anything that might happen later.
  let s = 2.2 * g.scoreAfter(m.tile, m.side) + lean.shed * (a + b)
  if (isDouble(m.tile)) s += lean.doubles * 5

  const follow = after.filter(matches).length
  s += lean.hold * 2.5 * Math.min(follow, 3)
  s += lean.hold * new Set(after.flatMap((t) => TILES[t])).size

  for (let k = 1; k < SEATS; k++) {
    const o = (seat + k) % SEATS
    const weight = k === 1 ? 1 : 0.45
    const close = g.hands[o].length <= 2 ? 2.5 : 1
    const stuck = !outThere || showing.every((v) => g.voids[o][v])
    if (stuck) s += lean.spite * 6 * weight * close
    else if (close > 1) s -= lean.spite * 4 * weight
  }

  // A tie in everything else goes to the heavier tile, not to whichever
  // happened to be dealt first.
  return s + pips(m.tile) * 0.01
}
