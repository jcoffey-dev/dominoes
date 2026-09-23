import { describe, expect, it } from 'vitest'
import { Game } from './game'
import { DOUBLE_SIX, TILES, TILE_COUNT, count, tileOf } from './tiles'

const t = tileOf

describe('the set', () => {
  it('is twenty-eight different tiles with 168 pips between them', () => {
    expect(TILE_COUNT).toBe(28)
    expect(new Set(TILES.map(([a, b]) => `${a}${b}`)).size).toBe(28)
    expect(count(TILES.map((_, i) => i))).toBe(168)
  })
})

describe('the deal', () => {
  it('gives five to each of four and leaves eight in the boneyard', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = new Game(seed)
      expect(g.hands.map((h) => h.length)).toEqual([5, 5, 5, 5])
      expect(g.boneyard).toHaveLength(8)
      expect(new Set([...g.hands.flat(), ...g.boneyard]).size).toBe(28)
    }
  })

  it('makes the holder of the highest double dealt open the first hand, with it and nothing else', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = new Game(seed)
      const high = Math.max(...g.hands.flat().filter((x) => TILES[x][0] === TILES[x][1]))
      expect(g.mustOpen).toBe(high)
      expect(g.hands[g.current]).toContain(high)
      expect(g.legal()).toEqual([{ tile: high, side: 'right' }])
    }
  })
})

describe('play', () => {
  it('matches ends and moves them', () => {
    const g = new Game(1)
    g.setUp(
      [
        [t(6, 6), t(0, 0), t(0, 1), t(0, 2), t(0, 3), t(0, 4), t(0, 5)],
        [t(6, 4), t(1, 1), t(1, 2), t(1, 3), t(1, 4), t(1, 5), t(0, 6)],
        [t(6, 5), t(2, 2), t(2, 3), t(2, 4), t(2, 5), t(1, 6), t(2, 6)],
        [t(3, 3), t(3, 4), t(3, 5), t(3, 6), t(4, 4), t(4, 5), t(4, 6)],
      ],
      0,
      DOUBLE_SIX,
    )
    g.play(t(6, 6), 'right')
    expect(g.endValues).toEqual([6])
    expect(g.current).toBe(1)
    g.play(t(6, 4), 'right')
    expect(g.ends.map((e) => e.value)).toEqual([6, 4])
    expect(() => g.play(t(2, 2), 'left')).toThrow()
    g.play(t(6, 5), 'left')
    // Both sides of the spinner are covered, so its top and bottom open.
    expect(g.ends.map((e) => [e.side, e.value])).toEqual([['left', 5], ['right', 4], ['up', 6], ['down', 6]])
    // A tile that fits two ends is two moves.
    expect(g.legal().filter((m) => m.tile === t(4, 5)).map((m) => m.side)).toEqual(['left', 'right'])
  })

  it('makes a player with nothing that fits draw, one tile at a time, before he may knock', () => {
    const g = new Game(1)
    g.setUp(
      [[t(6, 6), t(0, 0)], [t(1, 1), t(1, 2)], [t(3, 3)], [t(4, 4)]],
      0,
      DOUBLE_SIX,
      [t(2, 3), t(6, 1), t(0, 5)],
    )
    g.play(t(6, 6), 'right')
    expect(() => g.pass()).toThrow()
    expect(g.mustDraw).toBe(true)
    expect(g.draw()).toBe(t(0, 5))
    expect(g.voids[1][6]).toBe(true)
    expect(g.mustDraw).toBe(true)
    expect(g.draw()).toBe(t(6, 1))
    // Now he has a six: no more drawing, and no knocking either.
    expect(g.mustDraw).toBe(false)
    expect(() => g.draw()).toThrow()
    expect(g.current).toBe(1)
    g.play(t(6, 1), 'right')
  })

  it('refuses a knock from a player who can play, and remembers the numbers a knock gives away', () => {
    const g = new Game(1)
    g.setUp(
      [
        [t(6, 6), t(0, 0), t(0, 1), t(0, 2), t(0, 3), t(0, 4), t(0, 5)],
        [t(1, 1), t(1, 2), t(1, 3), t(1, 4), t(1, 5), t(2, 2), t(2, 3)],
        [t(6, 5), t(0, 6), t(2, 4), t(2, 5), t(1, 6), t(2, 6), t(3, 3)],
        [t(3, 4), t(3, 5), t(3, 6), t(4, 4), t(4, 5), t(4, 6), t(5, 5)],
      ],
      0,
      DOUBLE_SIX,
    )
    g.play(t(6, 6), 'right')
    expect(g.legal()).toEqual([])
    g.pass()
    expect(g.voids[1][6]).toBe(true)
    expect(() => g.pass()).toThrow()
  })
})

describe('the count', () => {
  const at = (hands: number[][]) => {
    const g = new Game(1)
    g.setUp(hands, 0, null)
    return g
  }

  it('adds the open ends, with a double on an end counting both halves', () => {
    const g = at([[t(5, 5), t(0, 0)], [t(5, 0), t(1, 1)], [t(0, 3), t(2, 2)], [t(6, 6), t(4, 4)]])
    g.play(t(5, 5), 'right')
    expect(g.count).toBe(10) // the spinner alone: both halves
    expect(g.scores[0]).toBe(10)
    g.play(t(5, 0), 'right')
    expect(g.count).toBe(10) // spinner still counts, one side open: 10 + 0
    expect(g.scores[1]).toBe(10)
    g.play(t(0, 3), 'right')
    expect(g.count).toBe(13)
    expect(g.scores[2]).toBe(0)
  })

  it('stops counting the spinner once both its sides are covered', () => {
    const g = at([[t(5, 5), t(1, 1)], [t(5, 0), t(2, 2)], [t(5, 3), t(4, 4)], [t(6, 6), t(3, 3)]])
    g.play(t(5, 5), 'right')
    g.play(t(5, 0), 'right')
    g.play(t(5, 3), 'left')
    expect(g.count).toBe(3) // 3 + 0: the spinner has dropped out
    expect(g.ends.map((e) => e.side)).toEqual(['left', 'right', 'up', 'down'])
  })

  it('scores the first tile if it is a multiple of five', () => {
    const g = at([[t(6, 4), t(1, 1)], [t(2, 2)], [t(3, 3)], [t(0, 0)]])
    g.play(t(6, 4), 'right')
    expect(g.scores[0]).toBe(10)
  })

  it('ends the game the moment somebody reaches the target', () => {
    const g = new Game(1, 10)
    g.setUp([[t(5, 5), t(1, 1)], [t(2, 2)], [t(3, 3)], [t(0, 0)]], 0, null)
    g.play(t(5, 5), 'right')
    expect(g.phase).toBe('over')
    expect(g.winner).toBe(0)
    expect(g.result?.how).toBe('reached')
  })
})

describe('scoring', () => {
  it('keeps the board in fives', async () => {
    const { toFive } = await import('./game')
    expect([0, 2, 3, 12, 13, 22, 23, 29, 31].map(toFive)).toEqual([0, 0, 5, 10, 15, 20, 25, 30, 30])
  })


  it('gives the player who goes out every pip left in the other hands, to the nearest five', () => {
    const g = new Game(1)
    g.setUp([[t(6, 6)], [t(1, 2)], [t(3, 4)], [t(0, 6)]], 0, null)
    g.play(t(6, 6), 'right')
    expect(g.result).toMatchObject({ how: 'domino', winner: 0, pips: 3 + 7 + 6, points: 15 })
    expect(g.scores).toEqual([15, 0, 0, 0])
    expect(g.phase).toBe('scored')
  })

  it('gives a blocked hand to the lowest count', () => {
    // Every six but the last is already somewhere nobody can use it: once
    // the 6-6 goes down against a six, there is no six left in any hand.
    const g = new Game(1)
    g.setUp([[t(6, 6), t(0, 1)], [t(4, 5)], [t(2, 2)], [t(3, 3)]], 0, null)
    g.play(t(6, 6), 'right')
    expect(g.result).toMatchObject({ how: 'block', winner: 0, pips: 9 + 4 + 6, points: 20 })
  })

  it('scores nobody when the lowest count is tied, and moves the lead left', () => {
    const g = new Game(1)
    g.setUp([[t(6, 6), t(0, 2)], [t(1, 1)], [t(4, 5)], [t(3, 5)]], 0, null)
    g.play(t(6, 6), 'right')
    expect(g.result).toMatchObject({ how: 'block', winner: null, points: 0 })
    g.nextHand()
    expect(g.current).toBe(1)
    expect(g.mustOpen).toBeNull()
  })

  it('ends the game at the target', () => {
    const g = new Game(1, 10)
    g.setUp([[t(6, 6)], [t(1, 2)], [t(3, 4)], [t(0, 5)]], 0, null)
    g.play(t(6, 6), 'right')
    expect(g.phase).toBe('over')
    expect(g.winner).toBe(0)
  })
})
