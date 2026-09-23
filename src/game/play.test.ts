import { describe, expect, it } from 'vitest'
import { EVEN, leanings, step } from './bot'
import { Game, SEATS } from './game'
import { makeRng } from './rng'
import { count, pips } from './tiles'

/**
 * Plays a whole game. A seat without a bot plays at random, or, if `greedy`,
 * always its heaviest tile -- the rule of thumb most people start with.
 */
function playOut(seed: number, bots: boolean[], target = 250, greedy = false) {
  const g = new Game(seed, target)
  const lean = leanings(seed, SEATS)
  const rng = makeRng(seed * 7 + 1)
  let hands = 0
  while (g.phase !== 'over') {
    if (g.phase === 'scored') {
      g.nextHand()
      continue
    }
    const seat = g.current
    if (bots[seat]) step(g, lean[seat])
    else {
      const moves = g.legal()
      if (moves.length === 0) {
        if (g.mustDraw) g.draw()
        else g.pass()
      }
      else {
        const m = greedy
          ? moves.reduce((x, y) => (pips(y.tile) > pips(x.tile) ? y : x))
          : moves[Math.floor(rng() * moves.length)]
        g.play(m.tile, m.side)
      }
    }
    // Nothing is ever lost or doubled. Thrown rather than expected: an
    // expect on every move of thousands of games is most of the run time.
    if (g.phase === 'play' && g.played.length + g.boneyard.length + g.hands.reduce((n, h) => n + h.length, 0) !== 28) {
      throw new Error(`seed ${seed}: tiles went missing`)
    }
    if (g.phase !== 'play') hands++
  }
  return { g, hands }
}

describe('whole games', () => {
  it('always finish, with the scores adding up', () => {
    const rounds: number[] = []
    for (let seed = 1; seed <= 200; seed++) {
      const { g, hands } = playOut(seed, [true, true, true, true])
      expect(g.winner).not.toBeNull()
      expect(g.scores[g.winner!]).toBeGreaterThanOrEqual(250)
      for (const s of g.scores) expect(s % 5).toBe(0)
      rounds.push(hands)
    }
    const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length
    // First to 250, scoring fives as they fall: measured at about six hands.
    expect(avg).toBeGreaterThan(3)
    expect(avg).toBeLessThan(12)
  })

  it('leave a knock only to a player who has nothing that fits', () => {
    const g = new Game(3)
    for (let i = 0; i < 400 && g.phase !== 'over'; i++) {
      if (g.phase === 'scored') {
        g.nextHand()
        continue
      }
      const before = g.legal().length
      const bones = g.boneyard.length
      const m = step(g, EVEN)
      // Nothing fits: draw while there is something to draw, then knock.
      if (before === 0) expect(m).toBe(bones ? 'draw' : null)
      else expect(m).not.toBeNull()
    }
  })

  it('a bot beats three players who play at random, clearly', () => {
    let wins = 0
    const N = 400
    for (let seed = 1; seed <= N; seed++) {
      const { g } = playOut(seed, [true, false, false, false])
      if (g.winner === 0) wins++
    }
    // One seat in four would win by chance.
    expect(wins / N).toBeGreaterThan(0.4)
  })

  it('a bot beats three players who always lay their heaviest tile', () => {
    // Measured at 54% over two thousand games; one in four is chance.
    let wins = 0
    const N = 400
    for (let seed = 1; seed <= N; seed++) if (playOut(seed, [true, false, false, false], 250, true).g.winner === 0) wins++
    expect(wins / N).toBeGreaterThan(0.4)
  })

  it('no seat is favored when four bots play', () => {
    const seats = [0, 0, 0, 0]
    for (let seed = 1; seed <= 400; seed++) seats[playOut(seed, [true, true, true, true]).g.winner!]++
    for (const s of seats) expect(s).toBeGreaterThan(70)
  })

  it('a blocked hand is scored from what is actually left', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { g } = playOut(seed, [true, true, true, true], 1)
      const r = g.result!
      expect(r.counts).toEqual(r.hands.map(count))
    }
  })
})
