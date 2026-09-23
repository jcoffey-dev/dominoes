import type { Game } from '../game/game'
import { COMPASS } from '../game/names'
import { TILES, type Tile } from '../game/tiles'
import { TileFace } from './Tile'

/** What each seat last did this hand, for the little speech bubble. */
export function lastActs(g: Game): ('knock' | 'play' | null)[] {
  const acts: ('knock' | 'play' | null)[] = [null, null, null, null]
  for (let i = g.events.length - 1; i >= 0; i--) {
    const e = g.events[i]
    if (e.kind === 'deal') break
    if ((e.kind === 'play' || e.kind === 'pass') && acts[e.seat] === null) acts[e.seat] = e.kind === 'play' ? 'play' : 'knock'
  }
  return acts
}

/** An opponent: name, score, and the backs of the tiles they hold. */
export function Seat({
  game,
  seat,
  where,
  act,
  hidden,
  says,
}: {
  game: Game
  seat: number
  where: 'west' | 'north' | 'east'
  act: 'knock' | 'play' | null
  /** Still shuffling: nobody holds anything yet. */
  hidden: boolean
  /** What he is saying, if anything. */
  says: string | null
}) {
  const turn = game.phase === 'play' && game.current === seat && !hidden
  const held = hidden ? 0 : game.hands[seat].length
  return (
    <section className={`seat ${where}${turn ? ' turn' : ''}`} aria-label={`${game.names[seat]}, ${COMPASS[seat]}, ${held} tiles, ${game.scores[seat]} points`}>
      <header>
        <strong>{game.names[seat]}</strong>
        <span className="pts">{game.scores[seat]}</span>
      </header>
      <span className="compass">{COMPASS[seat].toLowerCase()}</span>
      <div className="backs" aria-hidden="true">
        {Array.from({ length: held }, (_, i) => (
          <span key={i} className="back" />
        ))}
      </div>
      <p className="bubble">{turn ? 'thinking…' : act === 'knock' ? 'knocked' : ' '}</p>
      {says && (
        <p key={says} className="speech" role="status">
          {says}
        </p>
      )}
    </section>
  )
}

/** Tiles face up, small, for the end of a hand. */
export function Shown({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <span className="shown">
      {tiles.map((t) => (
        <TileFace key={t} first={TILES[t][1]} second={TILES[t][0]} />
      ))}
      {tiles.length === 0 && <span className="dim">out</span>}
    </span>
  )
}
