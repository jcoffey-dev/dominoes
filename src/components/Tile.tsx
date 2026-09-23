/**
 * A tile, drawn in half-tile units: 2 by 1 lying down, 1 by 2 on end.
 *
 * Pips sit where they sit on a real set. A six on a tile standing up is two
 * columns of three; lying down it turns with the tile and becomes two rows,
 * which is what everybody's eye already expects.
 */

const P = 0.27
const Q = 1 - P
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[P, P], [Q, Q]],
  3: [[P, P], [0.5, 0.5], [Q, Q]],
  4: [[P, P], [Q, P], [P, Q], [Q, Q]],
  5: [[P, P], [Q, P], [0.5, 0.5], [P, Q], [Q, Q]],
  6: [[P, 0.24], [P, 0.5], [P, 0.76], [Q, 0.24], [Q, 0.5], [Q, 0.76]],
}

function Half({ n, x, y, lying }: { n: number; x: number; y: number; lying: boolean }) {
  return (
    <>
      {PIPS[n].map(([px, py], i) => (
        <circle key={i} className="pip" cx={x + (lying ? py : px)} cy={y + (lying ? px : py)} r={0.088} />
      ))}
    </>
  )
}

export function TileG({
  x,
  y,
  w,
  h,
  first,
  second,
  className = '',
}: {
  x: number
  y: number
  w: number
  h: number
  first: number
  second: number
  className?: string
}) {
  const lying = w > h
  return (
    <g className={`tile ${className}`}>
      <rect x={x + 0.03} y={y + 0.03} width={w - 0.06} height={h - 0.06} rx={0.13} />
      {lying ? (
        <line x1={x + 1} y1={y + 0.16} x2={x + 1} y2={y + h - 0.16} />
      ) : (
        <line x1={x + 0.16} y1={y + 1} x2={x + w - 0.16} y2={y + 1} />
      )}
      <Half n={first} x={x} y={y} lying={lying} />
      <Half n={second} x={lying ? x + 1 : x} y={lying ? y : y + 1} lying={lying} />
    </g>
  )
}

/** A tile on its own, standing up, for a hand. */
export function TileFace({ first, second }: { first: number; second: number }) {
  return (
    <svg className="face" viewBox="0 0 1 2" aria-hidden="true">
      <TileG x={0} y={0} w={1} h={2} first={first} second={second} />
    </svg>
  )
}
