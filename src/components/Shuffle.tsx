import { useEffect, useRef, useState } from 'react'
import { synth } from '../audio/synth'

/**
 * The shuffle, before every hand.
 *
 * All twenty-eight tiles face down on the felt, pushed round in a few big
 * swirls the way hands wash them on a real table, and then drawn off to the
 * four seats, five each, with the rest pushed into the boneyard. The sound
 * is timed to it: a wash of clacks while the tiles are moving, and a run of
 * small clicks as they are drawn.
 *
 * Every position is worked out here and moved by a CSS transition, so the
 * tiles glide between spots instead of jumping, and the whole thing is
 * skipped down to a short pause for anyone who has asked for reduced motion.
 */

const TILES = 28
const SWIRLS = 6
const SWIRL_MS = 440
const DEAL_MS = 650

interface Pose {
  x: number
  y: number
  r: number
  o: number
}

export function Shuffle({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [poses, setPoses] = useState<Pose[]>(() => Array.from({ length: TILES }, () => ({ x: 0, y: 0, r: 0, o: 0 })))
  const [ms, setMs] = useState(SWIRL_MS)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const el = box.current!
    const { width, height } = el.getBoundingClientRect()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    const at = (t: number, f: () => void) => timers.push(window.setTimeout(f, t))

    // Anywhere on the felt, clear of the edge.
    const scatter = (spread: number): Pose[] =>
      Array.from({ length: TILES }, () => ({
        x: (Math.random() - 0.5) * width * spread,
        y: (Math.random() - 0.5) * height * spread,
        r: Math.random() * 360,
        o: 1,
      }))

    // Off to the seats, five each -- you at the bottom, then West, North,
    // East -- and the last eight pushed together into the boneyard in the
    // corner, where they stay.
    const dealt = (): Pose[] =>
      Array.from({ length: TILES }, (_, i) => {
        if (i >= 20) {
          const k = i - 20
          return { x: -width / 2 + 34 + (k % 4) * 15, y: -height / 2 + 34 + Math.floor(k / 4) * 26, r: 0, o: 1 }
        }
        const seat = i % 4
        const [dx, dy] = [[0, 0.75], [-0.75, 0], [0, -0.75], [0.75, 0]][seat]
        return { x: dx * width, y: dy * height, r: seat % 2 ? 90 : 0, o: 0 }
      })

    if (still) {
      synth.shuffle(0.6)
      at(700, () => done.current())
      return () => timers.forEach(clearTimeout)
    }

    synth.shuffle((SWIRLS * SWIRL_MS) / 1000)
    // A frame at the center first, so the first swirl has somewhere to come from.
    at(30, () => setPoses(scatter(0.5)))
    for (let k = 1; k < SWIRLS; k++) at(30 + k * SWIRL_MS, () => setPoses(scatter(0.55 + 0.1 * (k % 2))))
    at(30 + SWIRLS * SWIRL_MS, () => {
      setMs(DEAL_MS)
      setPoses(dealt())
      synth.draw(20, DEAL_MS / 1000)
    })
    at(30 + SWIRLS * SWIRL_MS + DEAL_MS + 80, () => done.current())
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="shuffle" ref={box} aria-label="Shuffling" role="status">
      {poses.map((p, i) => (
        <span
          key={i}
          className="tile-back"
          style={{
            transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) rotate(${p.r}deg)`,
            opacity: p.o,
            transitionDuration: `${ms}ms, ${ms}ms`,
            // Not all at once: hands on a table never move every tile together.
            transitionDelay: `${(i % 7) * 12}ms`,
          }}
        />
      ))}
    </div>
  )
}
