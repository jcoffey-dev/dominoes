import { describe } from '../game/describe'
import { Tally } from './Tally'
import { SEATS, type Game } from '../game/game'

/**
 * The column beside the table: what is happening now, the score, and the
 * hand so far in words. The log is only this hand -- the previous hands are
 * in the score, and nobody scrolls back through them -- which is short
 * enough to read top to bottom, in the order it happened.
 */
export function Side({ game, human, shuffling }: { game: Game; human: number; shuffling: boolean }) {
  const start = game.events.findLastIndex((e) => e.kind === 'deal')
  // Nothing about the new hand until the tiles are in people's hands.
  const lines = shuffling ? [] : describe(game.events.slice(start), human, game.names)

  return (
    <aside className="side">
      <section className="now" aria-live="polite">
        <p>{shuffling ? 'Shuffling…' : now(game, human)}</p>
      </section>

      <section>
        <h2>
          Score <span className="dim small">first to {game.target}</span>
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th />
              <th>points</th>
              <th>tiles</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SEATS }, (_, s) => (
              <tr key={s} className={!shuffling && game.phase === 'play' && game.current === s ? 'now' : ''}>
                <th>{game.names[s]}</th>
                <td className="marks">
                  <Tally points={game.scores[s]} />
                </td>
                <td>{game.scores[s]}</td>
                <td>{shuffling ? '–' : game.hands[s].length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="log">
        <h2>This hand</h2>
        <ol>
          {lines.map((l, i) => (
            <li key={i} className={l.heading ? 'heading' : ''}>
              {l.text}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}

/**
 * One line on what is happening. On the player's turn it says only that it
 * is their turn: which tiles fit is for them to see, as it is at any table.
 */
function now(g: Game, human: number): string {
  if (g.phase === 'over') return g.winner === human ? 'The game is yours.' : `${g.names[g.winner!]} has the game.`
  if (g.phase === 'scored') return 'The hand is over.'
  if (g.current !== human) return `${g.names[g.current]} to play.`
  if (!g.center) return g.mustOpen !== null ? 'You have the high double. Put it down to start.' : 'Your lead.'
  return 'Your turn.'
}
