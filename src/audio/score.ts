import type { Tune } from './synth'

/**
 * The score: one loop for the table, and what it is.
 *
 * Not a quotation of anything. Dominoes is the game on the porch and in the
 * park across the Caribbean, so the idiom is the one that goes with it --
 * a son clave, a bass that lands ahead of the beat, piano stabs on the
 * off-beats -- and none of that belongs to anybody. The tune over the top is
 * this game's own.
 *
 * F major, four bars: I, IV, V7, I, and round again. The bass is the
 * tumbao: it plays the fifth on the "and" of two and jumps to the next
 * chord's root on four, so every bar arrives before it starts. The clave is
 * 3-2, on a pitched tick rather than a drum, because a clave is a pair of
 * sticks and a drum kit does not have one.
 */

const bar = (...steps: string[]) => steps

export const PORCH: Tune = {
  bpm: 100,
  stepsPerBeat: 4,
  tracks: [
    {
      // The tune.
      wave: 'triangle',
      gain: 0.2,
      gate: 0.85,
      notes: [
        ...bar('A4', '=', '=', 'C5', '=', '=', 'F5', '=', '=', '=', 'E5', '=', 'D5', '=', 'C5', '='),
        ...bar('D5', '=', '=', '=', '.', '.', 'D5', '=', 'F5', '=', '=', '=', 'D5', '=', 'A#4', '='),
        ...bar('C5', '=', '=', 'E5', '=', '=', 'G5', '=', '=', '=', 'F5', '=', 'E5', '=', 'D5', '='),
        ...bar('C5', '=', '=', '=', '=', '=', 'A4', '=', '=', '=', '.', '.', '.', '.', '.', '.'),
      ],
    },
    {
      // Piano, on the off-beats.
      wave: 'pulse25',
      gain: 0.035,
      gate: 0.45,
      notes: [
        ...bar('.', '.', 'F4/A4/C5', '.', '.', '.', 'F4/A4/C5', '.', '.', '.', 'F4/A4/C5', '.', '.', '.', 'F4/A4/C5', '.'),
        ...bar('.', '.', 'F4/A#4/D5', '.', '.', '.', 'F4/A#4/D5', '.', '.', '.', 'F4/A#4/D5', '.', '.', '.', 'F4/A#4/D5', '.'),
        ...bar('.', '.', 'E4/G4/A#4', '.', '.', '.', 'E4/G4/A#4', '.', '.', '.', 'E4/G4/C5', '.', '.', '.', 'E4/G4/A#4', '.'),
        ...bar('.', '.', 'F4/A4/C5', '.', '.', '.', 'F4/A4/C5', '.', '.', '.', 'F4/A4/C5', '.', '.', '.', 'F4/A4/C5', '.'),
      ],
    },
    {
      // The tumbao.
      wave: 'triangle',
      gain: 0.26,
      gate: 0.9,
      notes: [
        ...bar('=', '=', '=', '=', '=', '=', 'C3', '=', '=', '=', '=', '=', 'A#1', '=', '=', '='),
        ...bar('=', '=', '=', '=', '=', '=', 'F2', '=', '=', '=', '=', '=', 'C2', '=', '=', '='),
        ...bar('=', '=', '=', '=', '=', '=', 'G2', '=', '=', '=', '=', '=', 'F2', '=', '=', '='),
        ...bar('=', '=', '=', '=', '=', '=', 'C3', '=', '=', '=', '=', '=', 'F2', '=', '=', '='),
      ],
    },
    {
      // The clave, 3-2, twice.
      wave: 'triangle',
      gain: 0.07,
      gate: 0.12,
      notes: [
        ...bar('E6', '.', '.', '.', '.', '.', 'E6', '.', '.', '.', '.', '.', 'E6', '.', '.', '.'),
        ...bar('.', '.', '.', '.', 'E6', '.', '.', '.', 'E6', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('E6', '.', '.', '.', '.', '.', 'E6', '.', '.', '.', '.', '.', 'E6', '.', '.', '.'),
        ...bar('.', '.', '.', '.', 'E6', '.', '.', '.', 'E6', '.', '.', '.', '.', '.', '.', '.'),
      ],
    },
    {
      // A shaker on the eighths, and a soft low drum on one.
      wave: 'noise',
      gain: 0.05,
      notes: Array.from({ length: 64 }, (_, i) => (i % 16 === 0 ? 'K' : i % 2 === 0 ? 'H' : '.')),
    },
  ],
}
