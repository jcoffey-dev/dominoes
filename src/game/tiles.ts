/**
 * The double-six set: every pair of numbers from blank to six, once each,
 * which is twenty-eight tiles. A tile is its index into TILES, and each pair
 * is stored low end first.
 */

export type Tile = number

export const TILES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b])
  return out
})()

export const TILE_COUNT = TILES.length

export const tileOf = (a: number, b: number): Tile =>
  TILES.findIndex(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b))

export const DOUBLE_SIX = tileOf(6, 6)

export const pips = (t: Tile) => TILES[t][0] + TILES[t][1]
export const isDouble = (t: Tile) => TILES[t][0] === TILES[t][1]
export const has = (t: Tile, n: number) => TILES[t][0] === n || TILES[t][1] === n

/** The end left showing when this tile is laid against `n`. */
export const other = (t: Tile, n: number) => (TILES[t][0] === n ? TILES[t][1] : TILES[t][0])

export const count = (hand: readonly Tile[]) => hand.reduce((sum, t) => sum + pips(t), 0)

export const NUMBERS = ['blank', 'one', 'two', 'three', 'four', 'five', 'six'] as const

/** "6–4", or "double six". Written high end first, the way people say them. */
export function tileName(t: Tile): string {
  const [a, b] = TILES[t]
  return a === b ? `double ${NUMBERS[a]}` : `${b}–${a}`
}

/** Highest first: doubles by their number, then by the high end, then the low. */
export function sortHand(hand: readonly Tile[]): Tile[] {
  return [...hand].sort((x, y) => {
    const [xa, xb] = TILES[x]
    const [ya, yb] = TILES[y]
    return yb - xb || ya - xa
  })
}
