import type { GameEvent } from '../game/game'
import { isDouble, pips } from '../game/tiles'
import { synth } from './synth'

/**
 * What a batch of events sounds like.
 *
 * At a steady pace a batch is one move and gets its sound. At speed it can
 * be a whole round of the table, and four clacks at once are one clatter --
 * so a batch makes at most one noise, the most important thing in it, in this
 * order: the game, the hand, a tile (and its points), a draw, a knock. A fresh deal makes no sound
 * here: the shuffle on screen makes its own, in time with the tiles.
 */
export function playFor(events: readonly GameEvent[], human: number) {
  if (!synth.sfxOn || events.length === 0) return
  const find = <K extends GameEvent['kind']>(kind: K) =>
    events.findLast((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind)

  const win = find('win')
  if (win) return win.seat === human ? synth.victory() : synth.defeat()
  const out = find('domino')
  if (out) return synth.domino(out.seat === human)
  if (find('block')) return synth.blocked()
  const play = find('play')
  // Harder for a double and for weight, the way people slam them -- and a
  // play that scores comes down hardest of all, then goes on the sheet.
  const score = find('score')
  if (play) synth.smack(score ? 1 : isDouble(play.tile) ? 0.95 : 0.45 + pips(play.tile) / 24)
  if (score) synth.tally(score.points / 5)
  if (play) return
  if (find('draw')) return synth.slide()
  if (find('pass')) return synth.knock()
}
