import { expect, it } from 'vitest'
import { describe as tell } from './describe'
import { Game } from './game'
import { DOUBLE_SIX, tileOf as t } from './tiles'

it('tells the hand in plain words, with "you" for the player', () => {
  const g = new Game(1)
  g.events = []
  g.setUp([[t(6, 6), t(0, 1)], [t(2, 3)], [t(3, 4)], [t(1, 6)]], 0, DOUBLE_SIX)
  g.play(t(6, 6), 'right')
  g.pass()
  expect(tell(g.events, 0, ['You', 'West', 'North', 'East']).map((l) => l.text)).toEqual([
    'Hand 2',
    'You have the high double, the double six.',
    'You set the double six. The spinner.',
    'West knocks: no six.',
  ])
})
