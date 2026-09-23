import type { GameEvent } from './game'
import { isDouble, NUMBERS, tileName } from './tiles'

/**
 * The log, in words, with "you" for the player and everybody else by name.
 */

const WHERE = {
  left: 'on the left',
  right: 'on the right',
  up: 'on top of the spinner',
  down: 'under the spinner',
} as const

export interface Line {
  seat: number | null
  text: string
  heading?: boolean
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

export function describe(events: readonly GameEvent[], human: number, names: readonly string[]): Line[] {
  const who = (s: number) => (s === human ? 'You' : names[s])
  const verb = (s: number, you: string, they: string) => (s === human ? you : they)
  const lines: Line[] = []
  for (const e of events) {
    switch (e.kind) {
      case 'deal':
        lines.push({ seat: null, heading: true, text: `Hand ${e.hand}` })
        // A later hand's lead says itself when the tile goes down.
        if (e.mustOpen !== null) {
          lines.push({ seat: e.leader, text: `${who(e.leader)} ${verb(e.leader, 'have', 'has')} the high double, the ${tileName(e.mustOpen)}.` })
        }
        break
      case 'play':
        lines.push({
          seat: e.seat,
          text: e.side
            ? `${who(e.seat)} ${verb(e.seat, 'play', 'plays')} the ${tileName(e.tile)} ${WHERE[e.side]}${e.spinner ? '. The spinner' : ''}.`
            : isDouble(e.tile)
              ? `${who(e.seat)} ${verb(e.seat, 'set', 'sets')} the ${tileName(e.tile)}${e.spinner ? '. The spinner' : ''}.`
              : `${who(e.seat)} ${verb(e.seat, 'lead', 'leads')} the ${tileName(e.tile)}.`,
        })
        break
      case 'pass':
        lines.push({
          seat: e.seat,
          text: `${who(e.seat)} ${verb(e.seat, 'knock', 'knocks')}: ${e.ends.map((n) => `no ${NUMBERS[n]}`).join(', ')}.`,
        })
        break
      case 'draw':
        lines.push({ seat: e.seat, text: `${who(e.seat)} ${verb(e.seat, 'draw', 'draws')}.` })
        break
      case 'score':
        lines.push({ seat: e.seat, text: `${who(e.seat)} ${verb(e.seat, 'score', 'scores')} ${e.points}.` })
        break
      case 'domino':
        lines.push({ seat: e.seat, text: `${who(e.seat)} ${verb(e.seat, 'go', 'goes')} out, for ${plural(e.points, 'point')}.` })
        break
      case 'block':
        lines.push({
          seat: e.seat,
          text:
            e.seat === null
              ? 'Blocked, and the lowest count is tied. Nobody scores.'
              : `Blocked. ${who(e.seat)} ${verb(e.seat, 'have', 'has')} the lowest count, for ${plural(e.points, 'point')}.`,
        })
        break
      case 'win':
        lines.push({ seat: e.seat, heading: true, text: e.seat === human ? 'You win the game.' : `${who(e.seat)} wins the game.` })
        break
    }
  }
  return lines
}
