import type { Center, Link, Side, Spinner } from './game'
import { isDouble, type Tile } from './tiles'

/**
 * Where each tile on the table goes.
 *
 * The line is laid out from a hub: the spinner if there is one, otherwise
 * the first tile. From the hub it runs east and west, and once the spinner
 * opens, north and south too. When the spinner is not the first tile, the
 * part of the line between them is simply one of the spinner's arms, laid
 * back the other way, so the spinner always sits in the middle of the
 * table where everybody can see it.
 *
 * An arm that reaches the edge of its room turns a corner, always the same
 * way round -- east turns north, north turns west, west turns south, south
 * turns east -- so four arms wind outward like a pinwheel instead of into
 * each other. Each leg can run further than the last, which keeps the
 * windings apart. A tile that would still land on another is turned early.
 *
 * Units are half a tile: a tile is 2 long and 1 wide. (0, 0) is the middle
 * of the hub.
 */

export interface Spot {
  tile: Tile
  x: number
  y: number
  w: number
  h: number
  /** The number drawn at the left end, or the top end of a tile on end. */
  first: number
  second: number
  arm: 'center' | Side
  ghost?: boolean
  spinner?: boolean
}

export interface Line {
  center: Center | null
  left: readonly Link[]
  right: readonly Link[]
  up: readonly Link[]
  down: readonly Link[]
  spinner: Spinner | null
}

type Vec = [number, number]
interface Item {
  link: Link
  side: Side
  ghost?: boolean
}

const flip = (l: Link): Link => ({ tile: l.tile, inner: l.outer, outer: l.inner })
/** A quarter turn, anticlockwise on the screen: east to north, north to west. */
const turn = ([dx, dy]: Vec): Vec => [dy, -dx]

/**
 * `width` is how many half-tiles the table has across, which sets how far
 * each leg runs before it turns. Pads are places for a held tile at the
 * open ends, laid out like tiles but drawn as outlines.
 */
export function layout(line: Line, width: number, pads: Partial<Record<Side, Link>> = {}): Spot[] {
  const { center, left, right, up, down, spinner } = line
  if (!center) return []

  // The hub, and what runs off it in each direction, outward.
  let hub: { tile: Tile; first: number; second: number }
  let east: Item[]
  let west: Item[]
  const tag = (side: Side) => (l: Link): Item => ({ link: l, side })
  if (!spinner || spinner.arm === 'center') {
    hub = { tile: center.tile, first: center.left, second: center.right }
    east = right.map(tag('right'))
    west = left.map(tag('left'))
  } else if (spinner.arm === 'right') {
    const k = spinner.index
    hub = { tile: right[k].tile, first: right[k].inner, second: right[k].inner }
    east = right.slice(k + 1).map(tag('right'))
    west = [
      ...right.slice(0, k).reverse().map(flip).map(tag('right')),
      { link: { tile: center.tile, inner: center.right, outer: center.left }, side: 'left' as const },
      ...left.map(tag('left')),
    ]
  } else {
    const k = spinner.index
    hub = { tile: left[k].tile, first: left[k].inner, second: left[k].inner }
    west = left.slice(k + 1).map(tag('left'))
    east = [
      ...left.slice(0, k).reverse().map(flip).map(tag('left')),
      { link: { tile: center.tile, inner: center.left, outer: center.right }, side: 'right' as const },
      ...right.map(tag('right')),
    ]
  }
  const north = up.map(tag('up'))
  const south = down.map(tag('down'))
  if (pads.right) east.push({ link: pads.right, side: 'right', ghost: true })
  if (pads.left) west.push({ link: pads.left, side: 'left', ghost: true })
  if (pads.up) north.push({ link: pads.up, side: 'up', ghost: true })
  if (pads.down) south.push({ link: pads.down, side: 'down', ghost: true })

  const out: Spot[] = []
  const hubDouble = isDouble(hub.tile)
  out.push({
    tile: hub.tile,
    ...(hubDouble ? { x: -0.5, y: -1, w: 1, h: 2 } : { x: -1, y: -0.5, w: 2, h: 1 }),
    first: hub.first,
    second: hub.second,
    arm: 'center',
    spinner: spinner !== null,
  })

  // How far a leg may run: each further out than the one before.
  const reachX = Math.max(4, Math.floor(width / 4))
  const reachY = 3

  const clear = (s: { x: number; y: number; w: number; h: number }) =>
    out.every((o) => !(s.x < o.x + o.w - 1e-9 && o.x < s.x + s.w - 1e-9 && s.y < o.y + o.h - 1e-9 && o.y < s.y + s.h - 1e-9))

  const lay = (items: Item[], start: Vec, dir: Vec, halfAcross: number) => {
    let p = start
    let d = dir
    let across = halfAcross
    let leg = 0
    let run = 0

    /** The tile's rectangle, laid from open point `p` in direction `d`. */
    const place = (tile: Tile, p: Vec, d: Vec) => {
      const along = isDouble(tile) ? 1 : 2
      const wide = isDouble(tile) ? 2 : 1
      const cx = p[0] + (d[0] * along) / 2
      const cy = p[1] + (d[1] * along) / 2
      const w = d[0] !== 0 ? along : wide
      const h = d[0] !== 0 ? wide : along
      return { x: cx - w / 2, y: cy - h / 2, w, h, along, wide }
    }

    /** Round the corner: the next tile starts off the side of the last one's end. */
    const corner = (p: Vec, d: Vec, across: number): [Vec, Vec] => {
      const c: Vec = [p[0] - d[0] * 0.5, p[1] - d[1] * 0.5]
      const d2 = turn(d)
      return [[c[0] + d2[0] * across, c[1] + d2[1] * across], d2]
    }

    for (const item of items) {
      const { link } = item
      const limit = (d[0] !== 0 ? reachX : reachY) * (leg + 1)
      const along = isDouble(link.tile) ? 1 : 2
      let r = place(link.tile, p, d)
      if (run + along > limit || !clear(r)) {
        ;[p, d] = corner(p, d, across)
        leg++
        run = 0
        r = place(link.tile, p, d)
        // Still in the way: one more quarter turn is always room somewhere.
        if (!clear(r)) {
          ;[p, d] = corner(p, d, 0.5)
          leg++
          r = place(link.tile, p, d)
        }
      }
      // Which number is drawn first (left, or top) depends on which way the arm is running.
      const backwards = d[0] < 0 || d[1] < 0
      out.push({
        tile: link.tile,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        first: backwards ? link.outer : link.inner,
        second: backwards ? link.inner : link.outer,
        arm: item.side,
        ghost: item.ghost,
      })
      p = [p[0] + d[0] * r.along, p[1] + d[1] * r.along]
      run += r.along
      across = r.wide / 2
    }
  }

  const halfW = hubDouble ? 0.5 : 1
  const halfH = hubDouble ? 1 : 0.5
  lay(east, [halfW, 0], [1, 0], halfH)
  lay(west, [-halfW, 0], [-1, 0], halfH)
  lay(north, [0, -halfH], [0, -1], halfW)
  lay(south, [0, halfH], [0, 1], halfW)
  return out
}

export function bounds(spots: readonly Spot[]) {
  if (spots.length === 0) return { x0: -1, y0: -1, x1: 1, y1: 1 }
  return {
    x0: Math.min(...spots.map((s) => s.x)),
    y0: Math.min(...spots.map((s) => s.y)),
    x1: Math.max(...spots.map((s) => s.x + s.w)),
    y1: Math.max(...spots.map((s) => s.y + s.h)),
  }
}
