/**
 * The player's own trash talk: a million canned lines, five at a time.
 *
 * Nobody writes a million lines. Four short lists do it instead -- how the
 * line opens, what it goes after, what it is compared to, and how the
 * comparison ends -- and every way of picking one from each is a line:
 * 20 × 25 × 40 × 50 is exactly 1,000,000. A line's number is its four picks
 * read as one mixed-radix number, so every number from 0 to 999,999 is a
 * different line and none is ever stored.
 *
 * They are meant to be dumb. That is the point of them.
 */

const OPENERS = [
  'Yo,', 'Man,', 'Listen,', 'Real talk,', 'No offense,', 'Bless your heart,', 'Look here,', 'Ay,',
  'Not gonna lie,', 'With all due respect,', 'Hate to say it,', 'Honestly,', 'Ha,', 'Lord have mercy,',
  'Somebody tell him,', 'I’m just saying,', 'Hold up,', 'Say what you want,', 'Between you and me,', 'Straight up,',
] as const

const JABS = [
  'you play like', 'you shuffle like', 'you count like', 'you slam tiles like', 'you think like',
  'that play looked like', 'your hand looks like', 'your strategy is', 'watching you is like watching', 'you knock like',
  'you fish the boneyard like', 'you hold your tiles like', 'you talk trash like', 'you sit at this table like',
  'you celebrate like', 'your spinner game is', 'your whole family plays like', 'you take your time like',
  'you read the board like', 'you defend like', 'you score like', 'that last move was', 'you lose like',
  'you smile like', 'you been playing like',
] as const

const LIKE = [
  'a raccoon', 'a Roomba', 'my grandma', 'a toddler', 'a sleepy mall cop', 'a golden retriever',
  'a substitute teacher', 'a lost tourist', 'a pigeon', 'a vending machine', 'a used car salesman', 'a mime',
  'a lawn chair', 'a wet sock', 'a potato', 'a GPS', 'a flip phone', 'a DMV clerk', 'a sleepy cat', 'a traffic cone',
  'a folding chair', 'a rookie', 'a garden gnome', 'a bowl of soup', 'a confused goat', 'a karaoke drunk',
  'a parking meter', 'a broken ice machine', 'a telemarketer', 'a scarecrow', 'a turtle', 'a dial-up modem',
  'a birthday clown', 'a screen door', 'a lawn flamingo', 'a busted piñata', 'a Sunday school teacher', 'a squirrel',
  'a hot dog vendor', 'a weather man',
] as const

const TAILS = [
  'with oven mitts on.', 'trying to parallel park.', 'at a funeral.', 'on a Tuesday.', 'who lost his glasses.',
  'in the rain.', 'after Thanksgiving dinner.', 'stuck in traffic.', 'with the hiccups.', 'on its first day.',
  'in flip-flops.', 'at 3 a.m.', 'doing its taxes.', 'in a wind tunnel.', 'that just woke up.', 'with no batteries.',
  'at a job interview.', 'reading the manual upside down.', 'during a blackout.', 'on roller skates.', 'at the DMV.',
  'on a sugar crash.', 'in a hurricane.', 'that lost the remote.', 'with mittens on.', 'in the wrong church.',
  'at a spelling bee.', 'on the last day of school.', 'after two naps.', 'on dial-up.', 'with a sprained ankle.',
  'at a surprise party.', 'in slow motion.', 'in a three-piece suit.', 'with its eyes closed.', 'that forgot the rules.',
  'in a mall parking lot.', 'on the first day of spring.', 'after one beer.', 'with stage fright.', 'in a hot tub.',
  'at a magic show.', 'on a treadmill.', 'that owes me money.', 'at a bingo hall.', 'that got stood up.', 'on a boat.',
  'with a cold.', 'in a museum.', 'at halftime.',
] as const

export const POOL_SIZE = OPENERS.length * JABS.length * LIKE.length * TAILS.length

/** Line number `n`, 0 to POOL_SIZE - 1. */
export function trashLine(n: number): string {
  let k = n
  const tail = TAILS[k % TAILS.length]
  k = Math.floor(k / TAILS.length)
  const like = LIKE[k % LIKE.length]
  k = Math.floor(k / LIKE.length)
  const jab = JABS[k % JABS.length]
  k = Math.floor(k / JABS.length)
  const opener = OPENERS[k % OPENERS.length]
  return `${opener} ${jab} ${like} ${tail}`
}

/** Five different lines, drawn at random from the whole pool. */
export function fiveLines(rng: () => number = Math.random): string[] {
  const picked = new Set<number>()
  while (picked.size < 5) picked.add(Math.floor(rng() * POOL_SIZE))
  return [...picked].map(trashLine)
}
