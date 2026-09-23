import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { playFor } from './audio/play'
import { PORCH } from './audio/score'
import { synth } from './audio/synth'
import { Landing } from './components/Landing'
import { lastActs, Seat, Shown } from './components/Seats'
import { Shuffle } from './components/Shuffle'
import { Side } from './components/Side'
import { Table } from './components/Table'
import { TileFace } from './components/Tile'
import { leanings, step, type Leaning } from './game/bot'
import { banter, comeback } from './game/talk'
import { fiveLines } from './game/trash'
import { Game, SEATS, type Side as End } from './game/game'
import { count, TILES, tileName, type Tile } from './game/tiles'

export type Speed = 'steady' | 'quick' | 'instant'

const HUMAN = 0
const TARGET = 250

/**
 * How long a man takes over his turn, in milliseconds, at steady.
 *
 * Like a real table: nobody plays the instant it comes round. A man with
 * one tile that fits still looks at it a second; a man with choices turns
 * his tiles over in his hand; a man with nothing takes a moment to be sure
 * before he knocks. The old men take their time, and nobody hurries them.
 */
function thinking(game: Game, speed: Speed): number {
  const moves = game.legal().length
  // A man fishing in the boneyard reaches for each tile quicker than he thinks over a play.
  const base = game.mustDraw ? 700 : moves === 0 ? 1600 : moves === 1 ? 1800 : 2400 + Math.min(moves, 5) * 300
  const old = game.people[game.current].age === 'old' ? 1.3 : 1
  const t = (base + Math.random() * 1500) * old
  return speed === 'steady' ? t : t * 0.4
}

/** How long a line of talk stays up. */
const TALK_MS = 3600

interface Held {
  tile: Tile
  /** Where the pointer is, while dragging; null when the tile was tapped and lifted. */
  at: { x: number; y: number } | null
}

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'game'>('landing')
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const gameRef = useRef<Game | null>(null)
  const leanRef = useRef<Leaning[]>([])
  const seen = useRef(0)

  const [speed, setSpeed] = useState<Speed>('steady')
  const [music, setMusic] = useState(true)
  const [sfx, setSfx] = useState(true)
  const [held, setHeld] = useState<Held | null>(null)
  const [hot, setHot] = useState<End | null>(null)
  const [leaving, setLeaving] = useState(false)
  /** The tiles are being washed and drawn. Nobody plays until they are. */
  const [shuffling, setShuffling] = useState(false)
  const shufflingRef = useRef(false)
  shufflingRef.current = shuffling
  /** Takes down the listeners of the drag in progress, if there is one. */
  const dropDrag = useRef<(() => void) | null>(null)
  /** What each man last said, and when it came down. */
  const [talk, setTalk] = useState<Record<number, { text: string; id: number }>>({})
  const [refusal, setRefusal] = useState<string | null>(null)
  /** The player's five lines on offer, when the trash-talk menu is open. */
  const [lines, setLines] = useState<string[] | null>(null)
  /** Points just scored, called out big on the felt for a moment. */
  const [callout, setCallout] = useState<{ seat: number; points: number; id: number } | null>(null)

  const g = gameRef.current

  const say = useCallback((seat: number, text: string) => {
    const id = Date.now() + Math.random()
    setTalk((t) => ({ ...t, [seat]: { text, id } }))
    window.setTimeout(() => setTalk((t) => (t[seat]?.id === id ? Object.fromEntries(Object.entries(t).filter(([k]) => Number(k) !== seat)) : t)), TALK_MS)
  }, [])

  /** Everything that happens goes through here: the sound, the talk, and a redraw. */
  const settle = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    const fresh = game.events.slice(seen.current)
    seen.current = game.events.length
    playFor(fresh, HUMAN)
    const scored = fresh.findLast((e) => e.kind === 'score')
    if (scored?.kind === 'score') {
      const id = Date.now()
      setCallout({ seat: scored.seat, points: scored.points, id })
      window.setTimeout(() => setCallout((c) => (c?.id === id ? null : c)), 1800)
    }
    // One line per batch, about the last thing in it that anybody would talk about.
    for (let i = fresh.length - 1; i >= 0; i--) {
      const chat = banter(fresh[i], game, game.people, HUMAN, Math.random)
      if (chat) {
        say(chat.seat, chat.text)
        break
      }
    }
    if (game.phase === 'over') synth.stopTune()
    dropDrag.current?.()
    setHeld(null)
    setHot(null)
    setRefusal(null)
    bump()
  }, [bump, say])

  // ------------------------------------------------------ the other three

  // Keyed on the version, not on every render: a line of talk going up or
  // coming down must not restart a man's think.
  useEffect(() => {
    const game = gameRef.current
    if (!game || screen !== 'game' || game.phase !== 'play' || shuffling) return
    if (game.current === HUMAN) return

    if (speed === 'instant') {
      // Straight round to the next thing that needs a person. A hand is at
      // most a few dozen moves; the ceiling is for a bug, not a game.
      const id = window.setTimeout(() => {
        for (let i = 0; i < 200 && game.phase === 'play' && game.current !== HUMAN; i++) step(game, leanRef.current[game.current])
        settle()
      }, 250)
      return () => window.clearTimeout(id)
    }

    const id = window.setTimeout(() => {
      step(game, leanRef.current[game.current])
      settle()
    }, thinking(game, speed))
    return () => window.clearTimeout(id)
  }, [version, screen, shuffling, speed, settle])

  // ------------------------------------------------------------- sound

  useEffect(() => {
    synth.setMusic(music)
  }, [music])
  useEffect(() => {
    synth.setSfx(sfx)
  }, [sfx])

  // ---------------------------------------------------------- starting

  const start = () => {
    synth.ensure()
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0
    gameRef.current = new Game(seed, TARGET)
    leanRef.current = leanings(seed, SEATS)
    seen.current = 0
    setHeld(null)
    setTalk({})
    setLeaving(false)
    setShuffling(true)
    setScreen('game')
    if (music) synth.playTune(PORCH)
    settle()
  }

  /** The player says something. Most of the time, somebody answers. */
  const talkTrash = (text: string) => {
    say(HUMAN, text)
    setLines(null)
    if (Math.random() < 0.7) {
      const back = comeback(gameRef.current!.people, HUMAN, Math.random)
      window.setTimeout(() => say(back.seat, back.text), 1300 + Math.random() * 900)
    }
  }

  const leave = () => {
    synth.stopTune()
    gameRef.current = null
    setScreen('landing')
  }

  const nextHand = () => {
    gameRef.current?.nextHand()
    setShuffling(true)
    settle()
  }

  // ------------------------------------------------ the player's moves

  const mine = g !== null && g.phase === 'play' && g.current === HUMAN && !shuffling

  /**
   * Whether the player may put a tile down right now, asked of the game
   * itself rather than of whatever this render remembered: a drag outlives
   * the render it started in, and it must not land on somebody else's turn.
   */
  const myTurn = () => {
    const game = gameRef.current
    return game !== null && game.phase === 'play' && game.current === HUMAN && !shufflingRef.current
  }

  /**
   * Put the held tile down at an end. If it does not match there, it goes
   * back in the hand with a noise, and that is all the table says about it.
   */
  const put = (tile: Tile, side: End) => {
    const g = gameRef.current
    if (!g || !myTurn() || !g.hands[HUMAN].includes(tile)) return
    if (!g.fits(tile, side)) {
      synth.reject()
      setHeld(null)
      setHot(null)
      setRefusal(g.center ? 'That one doesn’t go there.' : 'The double six opens the first hand.')
      return
    }
    g.play(tile, side)
    settle()
  }

  const knock = () => {
    const g = gameRef.current
    if (!g || !myTurn()) return
    if (g.legal().length) {
      synth.reject()
      setRefusal('You can’t knock with a play in your hand.')
      return
    }
    if (g.boneyard.length) {
      synth.reject()
      setRefusal('Not while there’s tiles in the boneyard. Draw.')
      return
    }
    g.pass()
    settle()
  }

  /** Take a tile from the boneyard. Refused, with no more said, if anything in hand would go. */
  const draw = () => {
    const g = gameRef.current
    if (!g || !myTurn()) return
    if (!g.center) return
    if (!g.boneyard.length) {
      synth.reject()
      setRefusal('The boneyard’s empty.')
      return
    }
    if (g.legal().length) {
      synth.reject()
      setRefusal('You can’t draw with a play in your hand.')
      return
    }
    g.draw()
    settle()
  }

  /** Which end, if any, a point on the screen is over: the one under it, or the nearest within reach. */
  const endAt = (x: number, y: number): End | null => {
    const under = document.elementFromPoint(x, y)?.closest('[data-side]')
    if (under) return under.getAttribute('data-side') as End
    let best: End | null = null
    let dist = 70
    for (const el of document.querySelectorAll('.pad')) {
      const r = el.getBoundingClientRect()
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2))
      if (d < dist) {
        dist = d
        best = el.getAttribute('data-side') as End
      }
    }
    return best
  }

  /** Pick a tile up. Drag it to an end and let go, or tap it to lift it and then tap an end. */
  const grab = (tile: Tile, e: React.PointerEvent) => {
    if (!myTurn() || e.button !== 0) return
    e.preventDefault()
    // Only ever one drag. A pointer-up the browser never delivered must not
    // leave an old one listening, ready to drop a tile on the next click.
    dropDrag.current?.()
    const sx = e.clientX
    const sy = e.clientY
    let dragging = false
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      if (!dragging) synth.tap()
      dragging = true
      setHeld({ tile, at: { x: ev.clientX, y: ev.clientY } })
      setHot(endAt(ev.clientX, ev.clientY))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      dropDrag.current = null
    }
    const up = (ev: PointerEvent) => {
      stop()
      if (!dragging) {
        // A tap: lift it, or put it back if it was already lifted.
        setHeld((h) => (h?.tile === tile ? null : { tile, at: null }))
        setRefusal(null)
        synth.tap()
        return
      }
      const side = ev.type === 'pointerup' ? endAt(ev.clientX, ev.clientY) : null
      setHot(null)
      if (side) put(tile, side)
      else setHeld(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    dropDrag.current = stop
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeld(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (screen === 'landing' || !g) {
    return <Landing target={TARGET} onStart={start} />
  }

  const acts = lastActs(g)
  const lastPlay = g.events.findLast((e) => e.kind === 'play' || e.kind === 'deal')
  const last = lastPlay?.kind === 'play' ? lastPlay.tile : null
  const ended = g.phase === 'over'
  const lifted = held?.tile ?? null

  return (
    <div className="app">
      <header>
        <h1>Dominoes</h1>
        <nav className="ways">
          <label>
            Pace{' '}
            <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
              <option value="steady">real</option>
              <option value="quick">quick</option>
              <option value="instant">instant</option>
            </select>
          </label>
          <button
            type="button"
            className="sound"
            aria-pressed={music}
            onClick={() => {
              const on = !music
              setMusic(on)
              if (on && !ended) synth.playTune(PORCH, false)
            }}
          >
            Music
          </button>
          <button type="button" className="sound" aria-pressed={sfx} onClick={() => setSfx(!sfx)}>
            Sound
          </button>
          {leaving ? (
            <>
              <button type="button" className="leave" onClick={leave}>
                Yes, leave the table
              </button>
              <button type="button" className="sound" onClick={() => setLeaving(false)}>
                Keep playing
              </button>
            </>
          ) : (
            <button type="button" className="leave" onClick={() => (ended ? leave() : setLeaving(true))}>
              New game
            </button>
          )}
        </nav>
      </header>

      <main className="room">
        {([[2, 'north'], [1, 'west'], [3, 'east']] as const).map(([seat, where]) => (
          <Seat key={seat} game={g} seat={seat} where={where} act={acts[seat]} hidden={shuffling} says={talk[seat]?.text ?? null} />
        ))}

        <Table game={g} shuffling={shuffling} held={mine ? lifted : null} hot={hot} last={last} onEnd={(side) => lifted !== null && put(lifted, side)} onDraw={draw}>
          {shuffling && <Shuffle onDone={() => setShuffling(false)} />}
          {callout && (
            <p key={callout.id} className={`callout seat-${callout.seat}`} aria-live="polite">
              <span>{callout.points}</span>
              <small>{callout.seat === HUMAN ? 'you score' : g.names[callout.seat]}</small>
            </p>
          )}
          {g.phase !== 'play' && g.result && <Result game={g} onNext={nextHand} onLeave={leave} />}
        </Table>

        <section className={`mine${mine ? ' turn' : ''}`} aria-label="Your tiles">
          <header>
            <strong>You</strong>
            <span className="pts">{g.scores[HUMAN]}</span>
            <button type="button" className="trash" aria-expanded={lines !== null} onClick={() => setLines(lines ? null : fiveLines())}>
              Talk trash
            </button>
          </header>
          {talk[HUMAN] && (
            <p key={talk[HUMAN].text} className="speech" role="status">
              {talk[HUMAN].text}
            </p>
          )}
          {lines && (
            <div className="trash-menu" role="menu" aria-label="Say something">
              {lines.map((l) => (
                <button key={l} type="button" role="menuitem" onClick={() => talkTrash(l)}>
                  {l}
                </button>
              ))}
              <button type="button" className="more" onClick={() => setLines(fiveLines())}>
                Five more
              </button>
            </div>
          )}
          <ul className="hand">
            {(shuffling ? [] : g.hands[HUMAN]).map((t) => (
              <li key={t}>
                <button
                  type="button"
                  className={`held${lifted === t ? (held?.at ? ' dragging' : ' lifted') : ''}`}
                  disabled={!mine}
                  aria-pressed={lifted === t}
                  aria-label={`The ${tileName(t)}`}
                  onPointerDown={(e) => grab(t, e)}
                  onClick={(e) => {
                    // Keyboard only: a pointer has already been handled on the way down.
                    if (e.detail === 0) setHeld((h) => (h?.tile === t ? null : { tile: t, at: null }))
                  }}
                >
                  <TileFace first={TILES[t][1]} second={TILES[t][0]} />
                </button>
              </li>
            ))}
          </ul>
          {mine && (
            <p className="row pick">
              {lifted !== null && g.center && (
                <>
                  <button type="button" onClick={() => put(lifted, 'left')}>
                    Left end
                  </button>
                  <button type="button" onClick={() => put(lifted, 'right')}>
                    Right end
                  </button>
                </>
              )}
              {lifted !== null && !g.center && (
                <button type="button" onClick={() => put(lifted, 'right')}>
                  Lead it
                </button>
              )}
              {g.center && (
                <>
                  <button type="button" className="knock" onClick={draw}>
                    Draw
                  </button>
                  <button type="button" className="knock" onClick={knock}>
                    Knock
                  </button>
                </>
              )}
              {refusal && <span className="refusal">{refusal}</span>}
            </p>
          )}
        </section>
      </main>

      <Side game={g} human={HUMAN} shuffling={shuffling} />

      {held?.at && (
        <div className="floating" style={{ left: held.at.x, top: held.at.y }} aria-hidden="true">
          <TileFace first={TILES[held.tile][1]} second={TILES[held.tile][0]} />
        </div>
      )}
    </div>
  )
}

/** The end of a hand: everybody's tiles turned over, and the count. */
function Result({ game, onNext, onLeave }: { game: Game; onNext: () => void; onLeave: () => void }) {
  const r = game.result!
  const over = game.phase === 'over'
  const you = r.winner === HUMAN
  const headline = over
    ? r.how === 'reached'
      ? game.winner === HUMAN
        ? `You hit ${game.target}. The game is yours.`
        : `${game.names[game.winner!]} hits ${game.target} and takes the game.`
      : game.winner === HUMAN
      ? 'You win the game.'
      : `${game.names[game.winner!]} wins the game.`
    : r.how === 'domino'
      ? you
        ? 'Domino! You went out.'
        : `${game.names[r.winner!]} went out.`
      : r.winner === null
        ? 'Blocked, and tied.'
        : `Blocked. ${you ? 'Your' : `${game.names[r.winner]}’s`} count is lowest.`
  const sub =
    r.how === 'reached'
      ? 'It ended on that tile, in the middle of the hand. Here is what everybody was holding.'
      : r.winner === null
      ? 'Two hands tie for the lowest count, so nobody scores. The lead passes to the left.'
      : `${r.pips} pips left in the other hands. ${you ? 'You score' : `${game.names[r.winner]} scores`} ${r.points}.`
  const final = over ? [...game.scores].map((s, i) => `${game.names[i]} ${s}`).join(' · ') : null

  return (
    <div className="ending" role="dialog" aria-live="polite" aria-label={headline}>
      <h2>{headline}</h2>
      <p>{sub}</p>
      <table className="reveal">
        <tbody>
          {r.hands.map((h, s) => (
            <tr key={s} className={s === r.winner ? 'won' : ''}>
              <th>{game.names[s]}</th>
              <td>
                <Shown tiles={h} />
              </td>
              <td className="num">{count(h)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {final && <p className="final">{final}</p>}
      <div className="row">
        {over ? (
          <button type="button" className="go" onClick={onLeave}>
            Another game
          </button>
        ) : (
          <button type="button" className="go" onClick={onNext} autoFocus>
            Next hand
          </button>
        )}
      </div>
    </div>
  )
}
