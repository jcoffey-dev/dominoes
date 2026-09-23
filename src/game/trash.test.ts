import { expect, it } from 'vitest'
import { fiveLines, POOL_SIZE, trashLine } from './trash'

it('holds exactly a million lines, every one different', () => {
  expect(POOL_SIZE).toBe(1_000_000)
  // Neighbors differ in their last pick, and the far ends differ in every pick.
  const sample = [0, 1, 49, 50, 1999, 2000, 49_999, 50_000, 999_998, 999_999]
  expect(new Set(sample.map(trashLine)).size).toBe(sample.length)
  expect(trashLine(0)).toBe('Yo, you play like a raccoon with oven mitts on.')
  expect(trashLine(999_999)).toBe('Straight up, you been playing like a weather man at halftime.')
})

it('offers five different lines at a time', () => {
  for (let i = 0; i < 50; i++) expect(new Set(fiveLines()).size).toBe(5)
})
