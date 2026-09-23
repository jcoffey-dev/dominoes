import type { Game, GameEvent } from './game'
import type { Age, Person } from './names'
import { isDouble, pips } from './tiles'

/**
 * The table talk.
 *
 * Nobody plays dominoes in silence. Every tile gets a word from somebody:
 * the man who laid it, or whoever has an opinion about it, which at this
 * table is everyone. The old men talk like they have been winning since
 * before the young ones were born; the young ones talk like it is about
 * to stop.
 *
 * It is flavor and nothing else. It reads the same things the bots read --
 * what just happened, the score, how many tiles each man holds -- and it
 * says nothing about anybody's hand that the table does not already know.
 */

type Say = (who: string) => string
type Lines = Record<Age, readonly (string | Say)[]>

/** Laying a tile, nothing special about it. */
const PLAY: Lines = {
  old: [
    'Learn something, young man.',
    'Watch and learn.',
    'I was doing this before your daddy was born.',
    'Mm-hm. That’s how it’s done.',
    'Don’t rush me. I got all night.',
    'Pay attention, now.',
    'Ahh, look at that.',
    'Somebody count for me, my glasses are in the car.',
    'That’s forty years of practice right there.',
    'Too easy.',
  ],
  young: [
    'Yeah, that’s me. That’s all me.',
    'Keep up, old man.',
    'Easy work.',
    'Y’all ain’t ready.',
    'Put that on my tab.',
    'Say less.',
    'Oh, I’m cooking tonight.',
    'That’s a problem for somebody.',
    'I’m just getting warm.',
    'Too smooth.',
  ],
}

/** Slamming a big tile down. */
const HEAVY: Lines = {
  old: ['FEEL that one!', 'Heavy! Pick THAT up!', 'That’s grown-man weight.', 'Hear that table? That’s respect.'],
  young: ['BOOM!', 'Get that outta here!', 'Heavy hands tonight!', 'Shook the whole table!'],
}

/** Laying a double. */
const DOUBLE: Lines = {
  old: ['Double. Like my blood pressure.', 'Two for the price of one.', 'Doubles, baby.'],
  young: ['Double trouble!', 'Doubled up. Deal with it.', 'Two of ’em. Crossways. Beautiful.'],
}

/** The first double: the spinner. */
const SPINNER: Lines = {
  old: ['There’s your spinner, boys. Four ways now.', 'Spinner’s down. Now it gets interesting.'],
  young: ['SPINNER! Open it up!', 'Spinner on the table. Four ways, let’s go.'],
}

/** Setting the high double to open the game. */
const SET: Lines = {
  old: ['High double. Let’s go to work.', 'Sit down, boys. School is in session.'],
  young: ['Big double on the table. Y’all better pray.', 'Opening heavy. Let’s eat.'],
}

/** Going to the boneyard. */
const DRAW_SELF: Lines = {
  old: ['Going fishing. Don’t look at me.', 'Boneyard. I’m shopping, that’s all.', 'Hmph. Let me see what’s in the yard.'],
  young: ['Man, boneyard again?', 'Fishing. Don’t say nothing.', 'Hold on, hold on, I’m shopping.'],
}

/** Somebody else is drawing. */
const DRAW_OTHER: Lines = {
  old: [(w) => `${w} going to the boneyard again. Buy something nice.`, (w) => `Keep digging, ${w}.`],
  young: [(w) => `${w} out here fishing! HA!`, (w) => `Look at ${w} shopping in the yard.`],
}

/** The player is drawing. */
const DRAW_YOU: Lines = {
  old: ['Go on, draw. We’ll wait.', 'Boneyard’s that way, son.'],
  young: ['Fishing already?! Ha!', 'Draw, draw, draw. Take your time, rookie.'],
}

/** Having to knock. */
const KNOCK_SELF: Lines = {
  old: ['Pass. Don’t start.', 'Knock knock. Not a word from you.', 'I’m letting you have one. Out of pity.', 'Hmph. Pass.'],
  young: ['Man, pass. This deal is rigged.', 'Knock. Whoever shuffled, I’m looking at you.', 'Pass. I’m chilling.', 'Nah. Pass. Relax.'],
}

/** Somebody else just knocked, and this man has a word about it. */
const KNOCK_OTHER: Lines = {
  old: [
    (w) => `${w}, you knocking already? Go home.`,
    (w) => `Look at ${w} knocking. Just like his daddy.`,
    (w) => `${w} got nothing. Nothing!`,
    (w) => `Hear that, ${w}? That’s the sound of losing.`,
  ],
  young: [
    (w) => `${w} knocking?! Ha! Somebody take his chair.`,
    (w) => `Ohhh, ${w} is STUCK.`,
    (w) => `${w} ain’t got it, y’all!`,
    (w) => `Knock knock, ${w}. Who’s there? Not you.`,
  ],
}

/** The player knocked. */
const KNOCK_YOU: Lines = {
  old: ['You knocking, son? Sit up straight.', 'Pass? Already? Lord.', 'That’s okay. Everybody starts somewhere.'],
  young: ['You knocking?! Somebody get the camera!', 'Bro, you got NOTHING.', 'Ain’t nothing in that hand but air.'],
}

/** The player just laid a tile. */
const AFTER_YOU: Lines = {
  old: ['That’s what you went with? Hm.', 'Not bad for a rookie.', 'I seen worse. Not much worse.', 'Take your time, take your time.'],
  young: ['Oh, that’s cute.', 'You sure about that?', 'Okay, okay. I see you.', 'That’s all you got?'],
}

/** Scoring: the count is a multiple of five, and he calls it. */
const SCORE: Lines = {
  old: [
    (n) => `${n}! Mark me down, and use a sharp pencil.`,
    (n) => `That’s ${n}. Write it big.`,
    (n) => `${n}. Been counting since before you could.`,
    (n) => `Gimme my ${n}.`,
    (n) => `${n}! Put another stick on my house.`,
  ],
  young: [
    (n) => `${n}! Mark it! MARK IT!`,
    (n) => `That’s ${n}, baby! Write it down!`,
    (n) => `${n} on the board. Y’all watching?`,
    (n) => `Count it: ${n}. Easy money.`,
    (n) => `${n}! Somebody get the pencil!`,
  ],
}

/** The player scored. */
const YOU_SCORED: Lines = {
  old: [
    (n) => `Mm. Give the boy his ${n}.`,
    (n) => `${n}? Even a broken clock.`,
    (n) => `Fine. ${n}. Don’t let it go to your head.`,
  ],
  young: [
    (n) => `${n}?! Who taught you that?`,
    (n) => `Aight, aight, mark him ${n}. Lucky.`,
    (n) => `${n}. Enjoy it, that’s your last.`,
  ],
}

/** Down to the last tile. */
const LAST_ONE: Lines = {
  old: ['One left. Get your money ready.', 'Last one, boys. Say your prayers.'],
  young: ['One tile, y’all! ONE!', 'Last one. Somebody better stop me.'],
}

/** Going out. */
const DOMINO: Lines = {
  old: ['DOMINO! Count ’em up and weep.', 'DOMINÓ! Pay the old man!', 'Domino. Like taking candy from babies.'],
  young: ['DOMINOOO! Count it up!', 'DOMINO! Somebody write that DOWN!', 'Out! Pay me, pay me, pay me!'],
}

/** Somebody else went out. */
const LOST_HAND: Lines = {
  old: ['Lucky. Pure luck.', 'Hmph. Even a blind hog finds an acorn.', 'Enjoy it. It won’t last.'],
  young: ['Man, what?! Reshuffle!', 'That’s crazy. Deal again.', 'Nah, that was luck, and everybody saw it.'],
}

/** A blocked hand. */
const BLOCKED: Lines = {
  old: ['Locked up tight. Count your bones.', 'She’s closed! Everybody show your hand.'],
  young: ['Blocked?! Count it up, count it up!', 'Nobody can go! Flip ’em!'],
}

/** Winning the game. */
const WIN: Lines = {
  old: ['That’s game. Same time next week, boys.', 'Game! Tell your mama I said hello.', 'Game. Somebody fetch me a cold one.'],
  young: ['GAME! I told y’all! I TOLD Y’ALL!', 'That’s game! Run it back if you want another one!', 'Game over. Y’all can stay mad.'],
}

/** The player won the game. */
const YOU_WON: Lines = {
  old: ['Well, damn. Beginner’s luck.', 'Hmph. I let you have that one.', 'Good game, young man. Don’t get cocky.'],
  young: ['Run it back. Right now.', 'Nah, that was a fluke. Again!', 'Okay, okay. Respect. Now deal.'],
}

/** The player talked trash, and somebody is not having it. */
const COMEBACK: Lines = {
  old: [
    'Boy, hush and play.',
    'Talk is cheap. Tiles ain’t.',
    'I been insulted by better men than you.',
    'Cute. Write that one down for your memoirs.',
    'Keep talking. I’ll keep counting.',
    'Your mouth is writing checks your hand can’t cash.',
  ],
  young: [
    'That’s the best you got?',
    'Bro wrote that on a napkin.',
    'Words don’t score, rookie.',
    'Okay, comedian. Scoreboard.',
    'Who laughed? Nobody laughed.',
    'Say that again when you got points.',
  ],
}

export interface Chat {
  seat: number
  text: string
}

const pick = (rng: () => number, lines: readonly (string | Say)[], who: string) => {
  const l = lines[Math.floor(rng() * lines.length)]
  return typeof l === 'string' ? l : l(who)
}

/**
 * Who says what after an event, or nothing. `human` never talks: the words
 * are the bots'. `rng` is not the game's, so talking changes no tile.
 */
export function banter(e: GameEvent, g: Game, people: readonly Person[], human: number, rng: () => number): Chat | null {
  const bots = people.map((_, s) => s).filter((s) => s !== human)
  const other = (not: number) => {
    const pool = bots.filter((s) => s !== not)
    return pool[Math.floor(rng() * pool.length)]
  }
  const say = (seat: number, lines: Lines, who = '') => ({ seat, text: pick(rng, lines[people[seat].age], who) })

  switch (e.kind) {
    case 'play': {
      if (e.seat === human) return say(other(human), AFTER_YOU)
      if (g.phase === 'play' && g.hands[e.seat].length === 1) return say(e.seat, LAST_ONE)
      if (e.side === null && isDouble(e.tile) && g.handNo === 1) return say(e.seat, SET)
      if (e.spinner) return say(e.seat, SPINNER)
      if (pips(e.tile) >= 10) return say(e.seat, HEAVY)
      if (isDouble(e.tile) && rng() < 0.7) return say(e.seat, DOUBLE)
      return say(e.seat, PLAY)
    }
    case 'pass':
      if (e.seat === human) return say(other(human), KNOCK_YOU)
      // Half the time he makes an excuse; the other half somebody else gets there first.
      return rng() < 0.5 ? say(e.seat, KNOCK_SELF) : say(other(e.seat), KNOCK_OTHER, people[e.seat].name)
    case 'draw':
      // Not every tile drawn: a man drawing four gets one remark, not four.
      if (rng() < 0.55) return null
      if (e.seat === human) return say(other(human), DRAW_YOU)
      return rng() < 0.5 ? say(e.seat, DRAW_SELF) : say(other(e.seat), DRAW_OTHER, people[e.seat].name)
    case 'score':
      return e.seat === human ? say(other(human), YOU_SCORED, String(e.points)) : say(e.seat, SCORE, String(e.points))
    case 'domino':
      return e.seat === human ? say(other(human), LOST_HAND) : say(e.seat, DOMINO)
    case 'block':
      return say(e.seat !== null && e.seat !== human ? e.seat : other(human), BLOCKED)
    case 'win':
      return e.seat === human ? say(other(human), YOU_WON) : say(e.seat, WIN)
    default:
      return null
  }
}

/** A bot answering the player's trash talk: one of the three, at random. */
export function comeback(people: readonly Person[], human: number, rng: () => number): Chat {
  const bots = people.map((_, s) => s).filter((s) => s !== human)
  const seat = bots[Math.floor(rng() * bots.length)]
  return { seat, text: pick(rng, COMEBACK[people[seat].age], '') }
}
