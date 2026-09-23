/**
 * The synth, shared with its siblings.
 *
 * The engine below -- the scheduler, the six voices and the small kit -- is
 * the one written for the lemonade stand and carried through the cave game,
 * the starship, the seven powers and the world war. Same author, same
 * license, and deliberately not forked: a look-ahead scheduler is not the
 * part of a game worth writing six times.
 *
 * What is written *for this game* is everything under "the table", and the
 * score in `score.ts`. This is a game of tiles hitting wood, so that sound
 * gets the most care. The shuffle is the one sound that is recorded rather
 * than made, because nothing made sounded like twenty-eight real tiles.
 */

import shuffleUrl from './shuffle.mp3'

/**
 * The one recorded sound: real dominoes shuffled on a table, the first few
 * seconds of RobertWulfman's "Shuffling Dominos" on Freesound, which he
 * released into the public domain (CC0). Trimmed, leveled and faded here;
 * see NOTICE.md. Fetched as soon as the page loads, so it is in hand by the
 * time anybody presses Shuffle up.
 */
const shuffleBytes: Promise<ArrayBuffer | null> =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : fetch(shuffleUrl)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null)

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
}

/** "C#4" -> Hz. A4 = 440. */
export function noteToFreq(note: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return 0
  const semis = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12
  return 440 * Math.pow(2, (semis - 69) / 12)
}

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'saw' | 'noise'

export interface Track {
  wave: Wave
  gain: number
  /**
   * One entry per step. '.' rest, '=' sustain previous, otherwise a note.
   * Slashes stack notes into a chord: "F4/A4/C5". On a noise track the
   * letter picks the drum: K kick, S snare, C clap, H closed hat, O open hat.
   */
  notes: string[]
  /** Sweeping lowpass, the whole point of a funk bass. */
  filter?: { from: number; to: number; q?: number }
  /** Fraction of the note's length actually sounded; low values are stabs. */
  gate?: number
  /** Cents, for a fatter unison. */
  detune?: number
}

export interface Tune {
  bpm: number
  stepsPerBeat: number
  tracks: Track[]
  /** 0 is straight, ~0.15 is a light funk shuffle. Delays every other step. */
  swing?: number
}

/** Fourier series for a pulse wave of the given duty cycle. */
function pulseWave(ctx: AudioContext, duty: number, harmonics = 24): PeriodicWave {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
}

export class Synth {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private waves: Partial<Record<Wave, PeriodicWave>> = {}
  private noiseBuffer!: AudioBuffer
  private shuffleBuffer: Promise<AudioBuffer | null> | null = null

  private tune: Tune | null = null
  private step = 0
  private nextStepTime = 0
  private timer: number | null = null

  musicOn = true
  sfxOn = true

  /** Must be called from a user gesture the first time. */
  ensure(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(ctx.destination)

    /*
     * The buses open at whatever the toggles already say, not at full.
     * A one-shot calls `ensure` itself, so a game started with the sound
     * turned off would otherwise make exactly one noise -- the first one --
     * before anything got round to muting it.
     */
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicOn ? 0.55 : 0
    this.musicBus.connect(this.master)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0
    this.sfxBus.connect(this.master)

    this.waves.pulse12 = pulseWave(ctx, 0.125)
    this.waves.pulse25 = pulseWave(ctx, 0.25)
    this.waves.pulse50 = pulseWave(ctx, 0.5)

    const len = Math.floor(ctx.sampleRate * 1.5)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf

    return ctx
  }

  setMusic(on: boolean) {
    this.musicOn = on
    if (!this.ctx) return
    this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05)
  }

  setSfx(on: boolean) {
    this.sfxOn = on
    if (!this.ctx) return
    this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.02)
  }

  // ---------------------------------------------------------------- voices

  private voice(
    dest: AudioNode,
    wave: Wave,
    freq: number,
    at: number,
    dur: number,
    gain: number,
    opts: { filter?: Track['filter']; detune?: number } = {},
  ) {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    if (wave === 'triangle') osc.type = 'triangle'
    else if (wave === 'saw') osc.type = 'sawtooth'
    else osc.setPeriodicWave(this.waves[wave] ?? this.waves.pulse50!)
    osc.frequency.setValueAtTime(freq, at)
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, at)

    const env = ctx.createGain()
    const peak = Math.max(0.0001, gain)
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    env.gain.setValueAtTime(peak, at + Math.max(0.02, dur * 0.6))
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)

    let node: AudioNode = osc
    if (opts.filter) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = opts.filter.q ?? 6
      lp.frequency.setValueAtTime(opts.filter.from, at)
      lp.frequency.exponentialRampToValueAtTime(
        Math.max(60, opts.filter.to),
        at + Math.max(0.05, dur),
      )
      osc.connect(lp)
      node = lp
    }

    node.connect(env).connect(dest)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  /** A small kit: pitched-sine kick, noise-and-tone snare, clap, two hats. */
  private drum(dest: AudioNode, kind: string, at: number, gain: number) {
    const ctx = this.ensure()

    if (kind === 'K') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(130, at)
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.11)
      const env = ctx.createGain()
      env.gain.setValueAtTime(gain * 1.5, at)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
      osc.connect(env).connect(dest)
      osc.start(at)
      osc.stop(at + 0.26)
      return
    }

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    const env = ctx.createGain()
    let dur = 0.05

    if (kind === 'S' || kind === 'C') {
      filter.type = 'bandpass'
      filter.frequency.value = kind === 'S' ? 1900 : 1300
      filter.Q.value = kind === 'S' ? 0.9 : 2.4
      dur = kind === 'S' ? 0.16 : 0.1
      if (kind === 'S') {
        // A little body under the crack.
        const tone = ctx.createOscillator()
        tone.type = 'triangle'
        tone.frequency.setValueAtTime(210, at)
        tone.frequency.exponentialRampToValueAtTime(150, at + 0.09)
        const tenv = ctx.createGain()
        tenv.gain.setValueAtTime(gain * 0.6, at)
        tenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
        tone.connect(tenv).connect(dest)
        tone.start(at)
        tone.stop(at + 0.12)
      }
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 7200
      dur = kind === 'O' ? 0.22 : 0.035
    }

    env.gain.setValueAtTime(gain, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    noise.connect(filter).connect(env).connect(dest)
    noise.start(at)
    noise.stop(at + dur + 0.02)
  }

  // ------------------------------------------------------------- sequencer

  playTune(tune: Tune, restart = true) {
    this.ensure()
    if (this.tune === tune && this.timer !== null && !restart) return
    this.stopTune()
    this.tune = tune
    this.step = 0
    this.nextStepTime = this.ctx!.currentTime + 0.08
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stopTune() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.tune = null
  }

  get playing() {
    return this.timer !== null
  }

  private schedule() {
    const ctx = this.ctx
    const tune = this.tune
    if (!ctx || !tune) return
    const stepDur = 60 / tune.bpm / tune.stepsPerBeat
    const length = Math.max(...tune.tracks.map((t) => t.notes.length))
    const swing = tune.swing ?? 0

    while (this.nextStepTime < ctx.currentTime + 0.2) {
      // A shuffle pushes every other step late without moving the downbeats.
      const at = this.nextStepTime + (this.step % 2 === 1 ? swing * stepDur : 0)

      for (const track of tune.tracks) {
        const note = track.notes[this.step % track.notes.length]
        if (!note || note === '.' || note === '=') continue

        // A note runs until the next step that is not a sustain marker.
        let held = 1
        for (let i = 1; i < length; i++) {
          if (track.notes[(this.step + i) % track.notes.length] === '=') held++
          else break
        }
        const dur = held * stepDur * (track.gate ?? 0.95)

        if (track.wave === 'noise') {
          this.drum(this.musicBus, note, at, track.gain)
          continue
        }

        for (const part of note.split('/')) {
          const f = noteToFreq(part)
          if (!f) continue
          this.voice(this.musicBus, track.wave, f, at, dur, track.gain, {
            filter: track.filter,
            detune: track.detune,
          })
        }
      }
      this.nextStepTime += stepDur
      this.step = (this.step + 1) % length
    }
  }

  // ------------------------------------------------------------------ sfx

  private seq(notes: [string, number][], wave: Wave = 'pulse25', gain = 0.22) {
    const ctx = this.ensure()
    let t = ctx.currentTime + 0.01
    for (const [note, dur] of notes) {
      if (note !== '.') this.voice(this.sfxBus, wave, noteToFreq(note), t, dur, gain)
      t += dur
    }
  }

  /** A click on the map. Small, dry, and not a musical note. */
  tap() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 1.4
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.1, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.035)
    src.connect(bp).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + 0.05)
  }

  /** A choice made: a territory picked, a number settled. */
  written() {
    this.seq([['B4', 0.045], ['E5', 0.08]], 'triangle', 0.14)
  }

  /** Something the rules will not take. */
  reject() {
    this.seq([['A3', 0.09], ['D#3', 0.18]], 'saw', 0.16)
  }

  // ------------------------------------------------------------ the table

  /**
   * One short woody knock: a burst of bandpassed noise with a touch of pitch
   * under it. Everything a tile does on a table is made of these.
   */
  private knockAt(at: number, freq: number, gain: number, dur = 0.05) {
    const ctx = this.ensure()
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 4
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(bp).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + dur + 0.02)

    const body = ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(freq / 4, at)
    body.frequency.exponentialRampToValueAtTime(freq / 7, at + dur)
    const benv = ctx.createGain()
    benv.gain.setValueAtTime(gain * 0.7, at)
    benv.gain.exponentialRampToValueAtTime(0.0001, at + dur * 1.4)
    body.connect(benv).connect(this.sfxBus)
    body.start(at)
    body.stop(at + dur * 1.4 + 0.02)
  }

  /**
   * One hard little ping: a few milliseconds of noise through a narrow
   * resonant filter, which is what a hard tile striking another hard tile
   * sounds like -- a click with a short bright ring on it.
   */
  private ping(at: number, freq: number, q: number, gain: number, decay: number) {
    const ctx = this.ensure()
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 1 + Math.random()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    src.connect(bp).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + decay + 0.02)
  }

  /**
   * A tile slammed down on an old folding card table.
   *
   * Four things at once. The crack of the tile's edge hitting the top; the
   * thin top itself, which booms low and dies fast because it is a sheet of
   * board on a frame; the panel ringing a little higher; and, just behind
   * it, the loose metal legs rattling. `power` is how hard: a double, a
   * heavy tile and going out all come down harder, the way people play.
   */
  smack(power = 0.7) {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const p = Math.max(0.2, Math.min(1, power))

    // The crack.
    const crack = ctx.createBufferSource()
    crack.buffer = this.noiseBuffer
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const cenv = ctx.createGain()
    cenv.gain.setValueAtTime(0.55 * p, at)
    cenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.012)
    crack.connect(hp).connect(cenv).connect(this.sfxBus)
    crack.start(at)
    crack.stop(at + 0.03)
    this.ping(at, 3400 + Math.random() * 900, 14, 0.12 * p, 0.05)

    // The top, booming.
    const boom = ctx.createOscillator()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(128, at)
    boom.frequency.exponentialRampToValueAtTime(78, at + 0.16)
    const benv = ctx.createGain()
    benv.gain.setValueAtTime(0.0001, at)
    benv.gain.exponentialRampToValueAtTime(0.7 * p, at + 0.004)
    benv.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
    boom.connect(benv).connect(this.sfxBus)
    boom.start(at)
    boom.stop(at + 0.22)

    // The panel, a little higher and hollow.
    const panel = ctx.createBufferSource()
    panel.buffer = this.noiseBuffer
    panel.playbackRate.value = 0.7
    const pb = ctx.createBiquadFilter()
    pb.type = 'bandpass'
    pb.frequency.value = 240
    pb.Q.value = 2.5
    const penv = ctx.createGain()
    penv.gain.setValueAtTime(1.3 * p, at)
    penv.gain.exponentialRampToValueAtTime(0.0001, at + 0.13)
    panel.connect(pb).connect(penv).connect(this.sfxBus)
    panel.start(at)
    panel.stop(at + 0.15)

    // The legs.
    for (let i = 0; i < 4; i++) {
      this.ping(at + 0.018 + i * (0.016 + Math.random() * 0.01), 1500 + Math.random() * 700, 9, 0.05 * p * (1 - i / 5), 0.03)
    }
  }

  /** Knuckles on the same table: two hollow raps. */
  knock() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [t, g] of [[0, 0.5], [0.17, 0.42]] as const) {
      this.knockAt(at + t, 420, g, 0.08)
      const thump = ctx.createOscillator()
      thump.type = 'sine'
      thump.frequency.setValueAtTime(150, at + t)
      thump.frequency.exponentialRampToValueAtTime(95, at + t + 0.1)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.35, at + t)
      env.gain.exponentialRampToValueAtTime(0.0001, at + t + 0.12)
      thump.connect(env).connect(this.sfxBus)
      thump.start(at + t)
      thump.stop(at + t + 0.14)
    }
  }

  /**
   * The shuffle, for real: the recording, cut to however long the tiles are
   * moving on screen and faded out there. If the recording could not be had,
   * the synthesized one below stands in, so there is always a shuffle.
   */
  shuffle(seconds = 2.6) {
    const ctx = this.ensure()
    this.shuffleBuffer ??= shuffleBytes.then((b) => (b ? ctx.decodeAudioData(b) : null)).catch(() => null)
    const asked = ctx.currentTime
    void this.shuffleBuffer.then((buf) => {
      if (!buf) return this.synthShuffle(seconds)
      // However long the decode took comes off the front, so it still ends with the tiles.
      const late = Math.max(0, ctx.currentTime - asked)
      const length = Math.min(buf.duration, seconds + 0.6) - late
      if (length <= 0.1) return
      const at = ctx.currentTime + 0.01
      const src = ctx.createBufferSource()
      src.buffer = buf
      const env = ctx.createGain()
      env.gain.setValueAtTime(1, at)
      env.gain.setValueAtTime(1, at + Math.max(0, length - 0.35))
      env.gain.linearRampToValueAtTime(0.0001, at + length)
      src.connect(env).connect(this.sfxBus)
      src.start(at, late, length)
    })
  }

  /**
   * The synthesized shuffle, for when the recording is not there: twenty-
   * eight tiles washed round face down under two flat hands.
   *
   * Listen to a real one and it is not a handful of clicks. It is a
   * continuous, dense clatter -- a hundred-odd collisions a second, each a
   * hard click with a short bright ring -- over the dry scrape of tiles
   * sliding on the tabletop, and the whole thing surges with every push of
   * the hands, twice or so a second. Now and then a tile knocks the table
   * itself, lower. That is what is built here.
   */
  private synthShuffle(seconds: number) {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const surges = 2.2
    // How hard the hands are pushing at time t: never quite still.
    const push = (t: number) => 0.25 + 0.75 * Math.sin(Math.PI * surges * t) ** 2
    const fade = (t: number) => Math.min(1, t / 0.15, (seconds - t) / 0.3)

    // The scrape, following the hands.
    const scrape = ctx.createBufferSource()
    scrape.buffer = this.noiseBuffer
    scrape.loop = true
    const shp = ctx.createBiquadFilter()
    shp.type = 'highpass'
    shp.frequency.value = 1400
    const slp = ctx.createBiquadFilter()
    slp.type = 'lowpass'
    slp.frequency.value = 7000
    const senv = ctx.createGain()
    senv.gain.setValueAtTime(0.0001, at)
    for (let t = 0; t <= seconds; t += 0.05) senv.gain.linearRampToValueAtTime(0.045 * push(t) * fade(t) + 0.0001, at + t)
    scrape.connect(shp).connect(slp).connect(senv).connect(this.sfxBus)
    scrape.start(at)
    scrape.stop(at + seconds + 0.05)

    // The clatter.
    let t = 0
    while (t < seconds) {
      const level = push(t) * fade(t)
      this.ping(at + t, 2200 + Math.random() * 4300, 10 + Math.random() * 10, (0.025 + Math.random() * 0.075) * level, 0.015 + Math.random() * 0.035)
      if (Math.random() < 0.05) this.knockAt(at + t, 700 + Math.random() * 400, 0.08 * level, 0.04)
      // Busier while the hands are pushing.
      t += (0.004 + Math.random() * 0.014) / (0.4 + level)
    }
  }

  /** One tile pulled out of the boneyard: slid across the felt, then a click as it joins the hand. */
  slide() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(1800, at)
    bp.frequency.linearRampToValueAtTime(2600, at + 0.22)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.linearRampToValueAtTime(0.07, at + 0.05)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
    src.connect(bp).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + 0.26)
    this.ping(at + 0.25, 3000 + Math.random() * 800, 12, 0.1, 0.035)
    this.ping(at + 0.27, 2400 + Math.random() * 600, 10, 0.06, 0.03)
  }

  /** Tiles drawn off the pile to the four seats: slid out in fives, a click as each one stops. */
  draw(count = 28, seconds = 0.65) {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (let i = 0; i < count; i++) {
      const t = at + (i / count) * seconds + Math.random() * 0.01
      this.ping(t, 2800 + Math.random() * 2000, 12, 0.05 + Math.random() * 0.04, 0.03)
    }
  }

  /**
   * Out. The last tile slapped down, then a short run up to a held note --
   * brighter when it is yours.
   */
  domino(mine: boolean) {
    this.smack(1)
    const run: [string, number][] = mine
      ? [['.', 0.12], ['C5', 0.08], ['E5', 0.08], ['G5', 0.08], ['C6', 0.4]]
      : [['.', 0.12], ['G4', 0.1], ['E4', 0.1], ['C4', 0.35]]
    this.seq(run, 'triangle', 0.16)
  }

  /**
   * Points going on the score sheet: a pencil stroke for every five. A
   * stroke is a short scratch of bright noise, swept a little as the lead
   * drags, and the slash that closes a box of twenty-five is longer.
   */
  tally(marks: number, closes = false) {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.28
    const n = Math.min(marks, 8)
    for (let i = 0; i < n; i++) {
      const t = at + i * 0.13
      const long = closes && i === n - 1
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.8
      bp.frequency.setValueAtTime(3600, t)
      bp.frequency.linearRampToValueAtTime(long ? 5200 : 4400, t + (long ? 0.16 : 0.07))
      const env = ctx.createGain()
      const len = long ? 0.17 : 0.075
      env.gain.setValueAtTime(0.0001, t)
      env.gain.linearRampToValueAtTime(0.11, t + 0.01)
      env.gain.setValueAtTime(0.11, t + len * 0.7)
      env.gain.exponentialRampToValueAtTime(0.0001, t + len)
      src.connect(bp).connect(env).connect(this.sfxBus)
      src.start(t)
      src.stop(t + len + 0.02)
    }
  }

  /** Nobody can go. Two falling notes, and the table goes quiet. */
  blocked() {
    this.seq([['E4', 0.14], ['C4', 0.14], ['G3', 0.45]], 'triangle', 0.15)
  }

  // ---------------------------------------------------------- the endings

  private bell(at: number, note: string, partials: readonly (readonly [number, number, number])[]) {
    const ctx = this.ensure()
    const f = noteToFreq(note)
    for (const [mult, gain, dur] of partials) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * mult
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, at)
      env.gain.exponentialRampToValueAtTime(gain, at + 0.01)
      env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      osc.connect(env).connect(this.sfxBus)
      osc.start(at)
      osc.stop(at + dur + 0.05)
    }
  }

  /** The game is yours. Bells, going up. */
  victory() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, note] of ['F4', 'A4', 'C5', 'F5', 'C5', 'F5'].entries()) {
      this.bell(at + i * 0.32, note, [[1, 0.13, 2.4], [2.76, 0.05, 1], [5.4, 0.025, 0.5]])
    }
  }

  /** Somebody else's game: the same bells, fewer of them, coming down. */
  defeat() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, note] of ['C5', 'A4', 'F4', 'C4'].entries()) {
      this.bell(at + i * 0.45, note, [[1, 0.12, 2.8], [2.76, 0.04, 1.1]])
    }
  }
}

export const synth = new Synth()
