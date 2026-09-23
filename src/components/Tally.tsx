/**
 * A score the way it goes down on the back of an envelope at the table:
 * one stroke for every five points, and the fifth stroke a slash through
 * the four before it, so each box is twenty-five. Two boxes to a line, and
 * a new line every fifty, so a game to 250 is five full lines.
 */
export function Tally({ points }: { points: number }) {
  const marks = Math.floor(points / 5)
  const houses = Array.from({ length: Math.ceil(marks / 5) }, (_, i) => Math.min(5, marks - i * 5))
  const lines: number[][] = []
  for (let i = 0; i < houses.length; i += 2) lines.push(houses.slice(i, i + 2))
  if (marks === 0) return <span className="tally empty">—</span>
  return (
    <span className="tally" role="img" aria-label={`${points} points`}>
      {lines.map((line, i) => (
        <span key={i} className="tally-line">
          {line.map((n, j) => (
            <svg key={j} className="house" viewBox="0 0 30 22" aria-hidden="true">
              {Array.from({ length: Math.min(n, 4) }, (_, k) => (
                <line key={k} x1={5 + k * 6} y1={3} x2={5 + k * 6} y2={19} />
              ))}
              {n === 5 && <line className="slash" x1={1} y1={18} x2={27} y2={4} />}
            </svg>
          ))}
        </span>
      ))}
    </span>
  )
}
