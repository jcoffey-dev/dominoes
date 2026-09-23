import { useEffect, useRef, useState } from 'react'
import type { Game, Link, Side } from '../game/game'
import { bounds, layout } from '../game/layout'
import { has, other, TILES, type Tile } from '../game/tiles'
import { TileG } from './Tile'

/**
 * The felt, and the line of play on it.
 *
 * How long a row runs before it turns depends on how wide the table is, so a
 * phone gets short rows of big-enough tiles instead of one long row of tiny
 * ones. While the player holds a tile, both open ends are marked as places
 * to put it down -- whether it fits there or not is for the player to see.
 */
export function Table({
  game,
  shuffling,
  held,
  hot,
  last,
  onEnd,
  onDraw,
  children,
}: {
  game: Game
  shuffling: boolean
  /** A tile in the player's hand, lifted or being dragged. Both ends open up for it, fit or not. */
  held: Tile | null
  /** The end the dragged tile is over. */
  hot: Side | null
  last: Tile | null
  onEnd: (side: Side) => void
  /** Draw from the boneyard, if the player may. */
  onDraw: () => void
  children?: React.ReactNode
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(640)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setPx(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // About 28 pixels a half-tile, in whole tiles, never so few that a
  // crosswise double and a corner cannot both fit.
  const width = Math.max(10, Math.min(26, 2 * Math.floor(px / 56)))

  // Where the held tile would go at each open end. Only the place is drawn,
  // never the tile in it: the table does not tell anybody what fits where.
  const pads: Partial<Record<Side, Link>> = {}
  if (held !== null) {
    for (const e of game.ends) pads[e.side] = { tile: held, inner: e.value, outer: has(held, e.value) ? other(held, e.value) : e.value }
  }
  const lead = held !== null && !game.center
  const spots = lead
    ? layout({ ...game, center: { tile: held, left: TILES[held][1], right: TILES[held][0] } }, width).map((s) => ({ ...s, ghost: true, arm: 'right' as const }))
    : layout(game, width, pads)

  const b = bounds(spots)
  const y0 = Math.min(b.y0, -3) - 0.6
  const y1 = Math.max(b.y1, 3) + 0.6
  const x0 = -width / 2 - 0.6
  const w = width + 1.2

  return (
    <div className="felt" ref={wrap}>
      <svg className="line" viewBox={`${x0} ${y0} ${w} ${y1 - y0}`} role="img" aria-label={tableLabel(game)}>
        {spots.map((s) =>
          s.ghost ? (
            <g
              key={`pad-${s.arm}`}
              className={`pad${hot === s.arm ? ' hot' : ''}`}
              data-side={s.arm}
              role="button"
              tabIndex={0}
              aria-label={game.center ? (s.arm === 'up' ? 'The top of the spinner' : s.arm === 'down' ? 'The bottom of the spinner' : `The ${s.arm} end`) : 'The middle of the table'}
              onClick={() => onEnd(s.arm as Side)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEnd(s.arm as Side)
                }
              }}
            >
              {/* A generous target: the outline, and a margin round it to aim at. */}
              <rect className="aim" x={s.x - 0.6} y={s.y - 0.6} width={s.w + 1.2} height={s.h + 1.2} />
              <rect className="spot" x={s.x + 0.05} y={s.y + 0.05} width={s.w - 0.1} height={s.h - 0.1} rx={0.13} />
            </g>
          ) : (
            <g key={s.tile}>
              <TileG {...s} className={`${s.tile === last ? 'last' : ''}${s.spinner ? ' spinner' : ''}`} />
              {s.spinner && (
                // The spinner's mark: a small star at its corner, so the table can see which double opens four ways.
                <g className="spin-mark" transform={`translate(${s.x + s.w}, ${s.y})`}>
                  <title>The spinner</title>
                  <circle r={0.42} />
                  <path d={star(0.3, 0.13)} />
                </g>
              )}
            </g>
          ),
        )}
      </svg>
      {!game.center && game.phase === 'play' && !shuffling && !lead && (
        <p className="waiting">{game.mustOpen !== null ? 'Waiting for the high double.' : 'Waiting for the lead.'}</p>
      )}
      {!shuffling && game.phase === 'play' && (
        // The boneyard: what is left face down, in the corner where the shuffle pushed it.
        <button type="button" className="boneyard" onClick={onDraw} aria-label={`The boneyard, ${game.boneyard.length} tiles. Draw one.`}>
          <span className="pile" aria-hidden="true">
            {game.boneyard.map((t) => (
              <span key={t} className="tile-back small" />
            ))}
          </span>
          <span className="label">{game.boneyard.length ? `boneyard ${game.boneyard.length}` : 'boneyard empty'}</span>
        </button>
      )}
      {children}
    </div>
  )
}

/** A five-pointed star centered on the origin. */
function star(outer: number, inner: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`
  })
  return `M${pts.join('L')}Z`
}

function tableLabel(g: Game): string {
  if (!g.center) return 'The table is empty.'
  const n = g.played.length
  const ends = g.ends.map((e) => `${e.value} ${e.side === 'up' ? 'at the top' : e.side === 'down' ? 'at the bottom' : `on the ${e.side}`}`)
  return `${n} tile${n === 1 ? '' : 's'} down. The ends show ${ends.join(', ')}.`
}
