import { seatPeople, type Person } from './names'
import { makeRng, shuffle, type Rng } from './rng'
import { TILE_COUNT, count, has, isDouble, other, sortHand, tileOf, TILES, type Tile } from './tiles'

/**
 * All Fives, four players, each for themselves.
 *
 * Five tiles each and the other eight face down in the boneyard. A player
 * who cannot match an open end draws from it, one at a time, until he can;
 * only when the boneyard is empty does he knock and let the turn go by.
 * Play passes to the left, which from the seat at the bottom of the screen is
 * West, then North, then East.
 *
 * The first hand is opened by whoever was dealt the highest double, with
 * that double. Every later hand is led by the last hand's winner, with
 * anything.
 *
 * The points come as you play. After every tile the open ends are added up
 * -- a double on an end counts both halves -- and if the total is a
 * multiple of five, whoever laid it scores that many on the spot.
 *
 * A hand ends when somebody lays their last tile, or when nobody at the table
 * holds a tile that matches any open end. Whoever went out, or holds the lowest
 * count in a blocked hand, scores every pip left in the other three hands,
 * to the nearest five. The first to the target wins the game, the moment
 * they reach it, in the middle of a hand if that is where it happens.
 *
 * The first double laid is the spinner. The line runs through it like any
 * double, and once both of those sides are covered, its top and bottom open
 * too, and the line can grow four ways instead of two. Until then the
 * spinner counts both its halves in the total; after, only the ends count.
 */

export const SEATS = 4
export const HAND_SIZE = 5

export type Side = 'left' | 'right' | 'up' | 'down'
export const SIDES: readonly Side[] = ['left', 'right', 'up', 'down']

/** Where the spinner is: the first tile, or a double somewhere out along one arm of the line. */
export interface Spinner {
  tile: Tile
  arm: 'center' | 'left' | 'right'
  index: number
}

export interface End {
  side: Side
  value: number
}

export interface Move {
  tile: Tile
  side: Side
}

/** A tile on the table, away from the first one: the end it was laid against, and the end it leaves. */
export interface Link {
  tile: Tile
  inner: number
  outer: number
}

export interface Center {
  tile: Tile
  left: number
  right: number
}

export interface HandResult {
  /** Out, blocked, or somebody reached the target in the middle of the hand. */
  how: 'domino' | 'block' | 'reached'
  /** Null when a blocked hand ties for the lowest count, and nobody scores. */
  winner: number | null
  /** What went on the board: the pips, to the nearest five. */
  points: number
  /** The pips themselves, before rounding. */
  pips: number
  counts: number[]
  hands: Tile[][]
}

export type GameEvent =
  | { kind: 'deal'; hand: number; leader: number; mustOpen: Tile | null }
  | { kind: 'play'; seat: number; tile: Tile; side: Side | null; spinner: boolean }
  | { kind: 'pass'; seat: number; ends: number[] }
  | { kind: 'draw'; seat: number; tile: Tile }
  | { kind: 'score'; seat: number; points: number }
  | { kind: 'domino'; seat: number; points: number }
  | { kind: 'block'; seat: number | null; points: number; counts: number[] }
  | { kind: 'win'; seat: number }

export type Phase = 'play' | 'scored' | 'over'

/** To the nearest five: 22 is 20, 23 is 25. */
export const toFive = (n: number) => Math.round(n / 5) * 5

export class Game {
  readonly rng: Rng
  readonly target: number
  /** Who sits where: 'You', then the three at the table. */
  readonly people: Person[]
  readonly names: string[]

  hands: Tile[][] = []
  /** Face down in the middle, to be drawn by whoever cannot go. */
  boneyard: Tile[] = []
  center: Center | null = null
  left: Link[] = []
  right: Link[] = []
  up: Link[] = []
  down: Link[] = []
  spinner: Spinner | null = null

  phase: Phase = 'play'
  current = 0
  leader = 0
  handNo = 0
  /** The highest double dealt, which has to open the first hand. Null once it is down, and in every later hand. */
  mustOpen: Tile | null = null
  scores = [0, 0, 0, 0]
  /**
   * What everybody at the table knows about who is out of which number: a
   * player who knocks on a 3 and a 5 holds neither. Reset every hand. The bots
   * read this and the hand sizes, and never anybody's tiles.
   */
  voids: boolean[][] = []
  played: Tile[] = []
  result: HandResult | null = null
  winner: number | null = null
  events: GameEvent[] = []

  constructor(seed: number, target = 250) {
    this.rng = makeRng(seed)
    this.target = target
    this.people = seatPeople(seed)
    this.names = this.people.map((p) => p.name)
    this.deal(null)
  }

  // ------------------------------------------------------------ dealing

  private deal(leader: number | null) {
    for (;;) {
      const deck = shuffle(
        this.rng,
        Array.from({ length: TILE_COUNT }, (_, t) => t),
      )
      const hands = Array.from({ length: SEATS }, (_, s) => deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE))
      const boneyard = deck.slice(SEATS * HAND_SIZE)
      if (leader !== null) return this.setUp(hands, leader, null, boneyard)
      // The highest double dealt opens. Nobody dealt a double at all is a
      // misdeal, and the tiles go back in and round again.
      for (let n = 6; n >= 0; n--) {
        const d = tileOf(n, n)
        const holder = hands.findIndex((h) => h.includes(d))
        if (holder >= 0) return this.setUp(hands, holder, d, boneyard)
      }
    }
  }

  /** A hand from given tiles. The deal uses it, and so do the tests. */
  setUp(hands: Tile[][], leader: number, mustOpen: Tile | null, boneyard: Tile[] = []) {
    this.hands = hands.map(sortHand)
    this.boneyard = [...boneyard]
    this.center = null
    this.left = []
    this.right = []
    this.up = []
    this.down = []
    this.spinner = null
    this.played = []
    this.voids = Array.from({ length: SEATS }, () => Array(7).fill(false))
    this.result = null
    this.phase = 'play'
    this.handNo++
    this.leader = leader
    this.current = leader
    this.mustOpen = mustOpen
    this.events.push({ kind: 'deal', hand: this.handNo, leader, mustOpen })
  }

  nextHand() {
    if (this.phase !== 'scored' || !this.result) throw new Error('the hand is not over')
    // A tied block scores nothing, and the lead moves on to the left.
    this.deal(this.result.winner ?? (this.leader + 1) % SEATS)
  }

  // -------------------------------------------------------------- state

  arm(side: Side): Link[] {
    return side === 'left' ? this.left : side === 'right' ? this.right : side === 'up' ? this.up : this.down
  }

  /**
   * Whether the spinner's top and bottom are open: both sides of it along the
   * line are covered. On the first tile that is one tile each way; out on an
   * arm, its inner side is the line itself, so one tile beyond it will do.
   */
  get spinnerOpen(): boolean {
    const sp = this.spinner
    if (!sp) return false
    if (sp.arm === 'center') return this.left.length > 0 && this.right.length > 0
    return this.arm(sp.arm).length > sp.index + 1
  }

  /** Every open end and the number showing on it. Empty before the first tile. */
  get ends(): End[] {
    const c = this.center
    if (!c) return []
    const tip = (side: Side, start: number): End => {
      const a = this.arm(side)
      return { side, value: a.length ? a[a.length - 1].outer : start }
    }
    const out = [tip('left', c.left), tip('right', c.right)]
    if (this.spinner && this.spinnerOpen) {
      const n = TILES[this.spinner.tile][0]
      out.push(tip('up', n), tip('down', n))
    }
    return out
  }

  /** The numbers showing, each once. What a knock gives away. */
  get endValues(): number[] {
    return [...new Set(this.ends.map((e) => e.value))]
  }

  /**
   * The count: every open end added up, the way All Fives adds them. A
   * double on the end of an arm counts both halves. The first tile, alone,
   * counts both its ends; a double there counts both halves once. The
   * spinner's top and bottom count only once something is on them.
   */
  get count(): number {
    const c = this.center
    if (!c) return 0
    if (!this.left.length && !this.right.length) return c.left + c.right
    const tip = (arm: Link[]) => {
      const l = arm[arm.length - 1]
      return isDouble(l.tile) ? 2 * l.inner : l.outer
    }
    const d = isDouble(c.tile) ? 2 : 1
    let n = (this.left.length ? tip(this.left) : d * c.left) + (this.right.length ? tip(this.right) : d * c.right)
    if (this.up.length) n += tip(this.up)
    if (this.down.length) n += tip(this.down)
    return n
  }

  /** What the count would score: itself if it is a multiple of five, otherwise nothing. */
  get scoring(): number {
    const n = this.count
    return n > 0 && n % 5 === 0 ? n : 0
  }

  fits(t: Tile, side: Side): boolean {
    if (!this.center) return this.mustOpen === null || t === this.mustOpen
    const end = this.ends.find((e) => e.side === side)
    return end !== undefined && has(t, end.value)
  }

  /** Every move open to a seat: each tile, on each end it matches. */
  legal(seat = this.current): Move[] {
    if (this.phase !== 'play' || seat !== this.current) return []
    const hand = this.hands[seat]
    if (!this.center) {
      return hand.filter((t) => this.mustOpen === null || t === this.mustOpen).map((tile) => ({ tile, side: 'right' as const }))
    }
    const ends = this.ends
    const moves: Move[] = []
    for (const tile of hand) for (const e of ends) if (has(tile, e.value)) moves.push({ tile, side: e.side })
    return moves
  }

  // -------------------------------------------------------------- moves

  play(tile: Tile, side: Side) {
    if (this.phase !== 'play') throw new Error('the hand is over')
    const seat = this.current
    const hand = this.hands[seat]
    const at = hand.indexOf(tile)
    if (at < 0) throw new Error('not in hand')
    if (!this.fits(tile, side)) throw new Error('does not fit')

    const first = !this.center
    let spun = false
    if (first) {
      const [a, b] = TILES[tile]
      this.center = { tile, left: a, right: b }
      this.mustOpen = null
      if (isDouble(tile)) {
        this.spinner = { tile, arm: 'center', index: 0 }
        spun = true
      }
    } else {
      const end = this.ends.find((e) => e.side === side)!.value
      const arm = this.arm(side)
      arm.push({ tile, inner: end, outer: other(tile, end) })
      if (!this.spinner && isDouble(tile) && (side === 'left' || side === 'right')) {
        this.spinner = { tile, arm: side, index: arm.length - 1 }
        spun = true
      }
    }
    hand.splice(at, 1)
    this.played.push(tile)
    this.events.push({ kind: 'play', seat, tile, side: first ? null : side, spinner: spun })

    const points = this.scoring
    if (points) {
      this.scores[seat] += points
      this.events.push({ kind: 'score', seat, points })
      if (this.scores[seat] >= this.target) return this.finish('reached', seat)
    }

    if (hand.length === 0) return this.finish('domino', seat)
    if (this.blocked()) return this.finish('block', null)
    this.current = (seat + 1) % SEATS
  }

  /** Whether the player to move must draw: nothing fits, and there is something to draw. */
  get mustDraw(): boolean {
    return this.phase === 'play' && !!this.center && this.legal().length === 0 && this.boneyard.length > 0
  }

  /**
   * Take one tile from the boneyard. Only for a player with nothing that
   * fits; the turn stays with him, to play what he drew or draw again.
   */
  draw(): Tile {
    if (!this.mustDraw) throw new Error(this.boneyard.length ? 'a player who can play must' : 'the boneyard is empty')
    const seat = this.current
    // Drawing says as much as knocking does: he holds none of these numbers.
    for (const v of this.endValues) this.voids[seat][v] = true
    const tile = this.boneyard.pop()!
    this.hands[seat] = sortHand([...this.hands[seat], tile])
    this.events.push({ kind: 'draw', seat, tile })
    // Everybody else is still to go before anyone could be stuck, so a draw
    // never blocks the hand: the next pass or play will see to that.
    return tile
  }

  pass() {
    if (this.phase !== 'play') throw new Error('the hand is over')
    if (this.legal().length) throw new Error('a player who can play must')
    if (this.boneyard.length) throw new Error('draw first')
    const seat = this.current
    const values = this.endValues
    for (const v of values) this.voids[seat][v] = true
    this.events.push({ kind: 'pass', seat, ends: values })
    if (this.blocked()) return this.finish('block', null)
    this.current = (seat + 1) % SEATS
  }

  /**
   * The boneyard is empty and nobody holds a tile that matches any open end.
   * (A spinner that is not open yet is itself the end on its unfinished
   * side, so its number is counted.) While there are tiles to draw the hand
   * is never blocked: somebody has to draw them first.
   */
  private blocked(): boolean {
    if (this.boneyard.length) return false
    const values = this.endValues
    return this.hands.every((h) => h.every((t) => !values.some((v) => has(t, v))))
  }

  /**
   * The numbers that would be showing after a move, without making it. The
   * tile goes down, the ends are read, and it comes straight back up.
   */
  endsAfter(tile: Tile, side: Side): number[] {
    if (!this.center) {
      const [a, b] = TILES[tile]
      return [...new Set([a, b])]
    }
    const spinner = this.spinner
    const end = this.ends.find((e) => e.side === side)!.value
    const arm = this.arm(side)
    arm.push({ tile, inner: end, outer: other(tile, end) })
    if (!spinner && isDouble(tile) && (side === 'left' || side === 'right')) this.spinner = { tile, arm: side, index: arm.length - 1 }
    const values = this.endValues
    arm.pop()
    this.spinner = spinner
    return values
  }

  /** What a move would score as it goes down, without making it. */
  scoreAfter(tile: Tile, side: Side): number {
    if (!this.center) {
      const [a, b] = TILES[tile]
      return (a + b) % 5 === 0 && a + b > 0 ? a + b : 0
    }
    const end = this.ends.find((e) => e.side === side)!.value
    const arm = this.arm(side)
    arm.push({ tile, inner: end, outer: other(tile, end) })
    const points = this.scoring
    arm.pop()
    return points
  }

  private finish(how: HandResult['how'], seat: number | null) {
    const counts = this.hands.map(count)
    let winner = seat
    if (how === 'reached') {
      this.result = { how, winner, points: 0, pips: 0, counts, hands: this.hands.map((h) => [...h]) }
      this.phase = 'over'
      this.winner = seat
      this.events.push({ kind: 'win', seat: seat! })
      return
    }
    if (how === 'block') {
      const low = Math.min(...counts)
      const lowest = counts.flatMap((c, s) => (c === low ? [s] : []))
      winner = lowest.length === 1 ? lowest[0] : null
    }
    const pips = winner === null ? 0 : counts.reduce((sum, c, s) => (s === winner ? sum : sum + c), 0)
    const points = toFive(pips)
    if (winner !== null) this.scores[winner] += points

    this.result = { how, winner, points, pips, counts, hands: this.hands.map((h) => [...h]) }
    this.events.push(how === 'domino' ? { kind: 'domino', seat: seat!, points } : { kind: 'block', seat: winner, points, counts })

    if (winner !== null && this.scores[winner] >= this.target) {
      this.phase = 'over'
      this.winner = winner
      this.events.push({ kind: 'win', seat: winner })
    } else this.phase = 'scored'
  }
}
