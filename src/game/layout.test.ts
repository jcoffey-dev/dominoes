import { describe, expect, it } from 'vitest'
import { step } from './bot'
import { Game } from './game'
import { layout, type Spot } from './layout'

const overlap = (a: Spot, b: Spot) =>
  a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9

/** Two tiles share a stretch of edge. */
const touch = (a: Spot, b: Spot) => {
  const sideBySide = (Math.abs(a.x + a.w - b.x) < 1e-9 || Math.abs(b.x + b.w - a.x) < 1e-9) && a.y < b.y + b.h && b.y < a.y + a.h
  const stacked = (Math.abs(a.y + a.h - b.y) < 1e-9 || Math.abs(b.y + b.h - a.y) < 1e-9) && a.x < b.x + b.w && b.x < a.x + a.w
  return sideBySide || stacked
}

/** Plays hands out, and lays the table after every tile. */
function* tables(seeds: number) {
  for (let seed = 1; seed <= seeds; seed++) {
    const g = new Game(seed)
    while (g.phase === 'play') {
      step(g)
      yield g
    }
  }
}

describe('the table', () => {
  for (const width of [10, 14, 20, 26]) {
    it(`never lays one tile over another, ${width} half-tiles wide`, () => {
      // One expect at the end: tens of thousands of them are what is slow.
      const bad: string[] = []
      for (const g of tables(200)) {
        const spots = layout(g, width)
        if (spots.length !== g.played.length) bad.push('count')
        for (let i = 0; i < spots.length; i++) {
          for (let j = i + 1; j < spots.length; j++) if (overlap(spots[i], spots[j])) bad.push(`overlap ${i} ${j}`)
          if (i > 0 && !spots.some((o, j) => j !== i && touch(spots[i], o))) bad.push(`floating ${i}`)
        }
      }
      expect(bad.slice(0, 5)).toEqual([])
    })
  }

  it('grows four ways once the spinner opens', () => {
    let four = 0
    for (const g of tables(200)) if (g.up.length && g.down.length) four++
    expect(four).toBeGreaterThan(0)
  })

  it('marks the spinner, and only the spinner', () => {
    for (const g of tables(60)) {
      const marked = layout(g, 20).filter((s) => s.spinner)
      expect(marked.map((s) => s.tile)).toEqual(g.spinner ? [g.spinner.tile] : [])
    }
  })
})
