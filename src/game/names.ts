import { makeRng, shuffle } from './rng'

/**
 * Who is sitting at the table.
 *
 * Three men for each game, young and old mixed -- at least one of each,
 * because the table is better for the argument between them. They come from
 * their own stream of the seed rather than the deal's, so naming the players
 * can never change which tiles anybody gets.
 *
 * The compass points stay as the seats: play goes to the left, which from
 * the bottom of the screen is West, then North, then East.
 */

export const COMPASS = ['South', 'West', 'North', 'East'] as const

export type Age = 'old' | 'young'

export interface Person {
  name: string
  age: Age
}

const OLD = [
  'Pops', 'Old Man Ray', 'Uncle Winston', 'Big Earl', 'Don Ramón', 'Mr. Delroy', 'Grandpa Joe', 'Clarence',
  'Papi Tomás', 'Otis', 'Mr. Lucius', 'Tío Hector',
]
const YOUNG = [
  'Junior', 'Tito', 'DeShawn', 'Marcus', 'Kenny', 'Javi', 'Lil Mike', 'Andre', 'Darnell', 'Rico', 'Jaylen', 'Manny',
]

/** Everybody at the table, the player first. */
export function seatPeople(seed: number): Person[] {
  const rng = makeRng(seed ^ 0x4e414d45)
  const olds = shuffle(rng, OLD).map((name) => ({ name, age: 'old' as const }))
  const youngs = shuffle(rng, YOUNG).map((name) => ({ name, age: 'young' as const }))
  const third = rng() < 0.5 ? olds[1] : youngs[1]
  return [{ name: 'You', age: 'young' }, ...shuffle(rng, [olds[0], youngs[0], third])]
}

export const seatNames = (seed: number) => seatPeople(seed).map((p) => p.name)
