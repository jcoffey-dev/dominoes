import { TileFace } from './Tile'

/**
 * The page before the table.
 *
 * Everybody has played dominoes, and almost everybody learned it from a
 * table with its own house rules. So the rules are stated in full -- they
 * are short -- along with the places where tables differ, and which way this
 * one goes.
 */
export function Landing({ target, onStart }: { target: number; onStart: () => void }) {
  return (
    <div className="landing">
      <header>
        <h1>Dominoes</h1>
        <p className="tagline">
          All Fives with a double-six set, four at the table, first to 250. You against three old hands and young bucks, each for himself, and every one of them has something to say.
        </p>
        <div className="hero" aria-hidden="true">
          <TileFace first={6} second={6} />
          <TileFace first={6} second={4} />
          <TileFace first={4} second={1} />
          <TileFace first={1} second={0} />
        </div>
      </header>

      <div className="cols">
        <section>
          <h2>The whole game</h2>
          <p>
            All Fives. Five tiles each, and the other eight face down in the boneyard.
          </p>
          <ol>
            <li>
              <strong>The first hand</strong> is opened by whoever was dealt the highest double, with that
              double. After that, whoever won the last hand leads, with any tile they like.
            </li>
            <li>
              <strong>Play goes to the left.</strong> Match a number on any open end. Doubles lie crosswise.
              Nothing that matches? Draw from the boneyard, one at a time, until something does. Only when the
              boneyard is empty do you knock and let the turn pass.
            </li>
            <li>
              <strong>The spinner</strong> is the first double down, marked with a star. Once both its sides are
              covered, its top and bottom open too, and the line runs four ways.
            </li>
            <li>
              <strong>Score as you play.</strong> After every tile, add up the open ends. A multiple of five --
              5, 10, 15, 20 and on -- goes straight on your sheet.
            </li>
            <li>
              <strong>The hand ends</strong> when somebody plays their last tile, or when nobody can match any end
              and it is blocked.
            </li>
          </ol>
          <p>
            Whoever goes out scores the pips left in the other three hands, to the nearest five. In a blocked
            hand, the lowest count scores them instead. First to {target} wins, the moment they get there.
          </p>
        </section>

        <section>
          <h2>Counting the ends</h2>
          <p>
            A double on the end of the line counts both halves: the 5–5 out on an end is ten. The spinner counts
            both halves too, until both its sides are covered; after that only the ends count, and its top and
            bottom count once something is on them. The first tile alone counts both ends, so leading the 5–0,
            6–4 or 5–5 scores straight away.
          </p>
          <h2>The sheet</h2>
          <p>
            Scores go down the way they do at the table: a stroke for every five, and the fifth stroke a slash
            across the four, so every box is twenty-five. Ten boxes is the game.
          </p>
          <h2>At this table</h2>
          <p>
            Each man plays for himself. Drag a tile to an open end, or tap it and tap the end; hit Draw, or the
            boneyard, to fish. Nobody tells you what fits, or what it scores -- count it yourself. A draw or a
            knock tells everybody which numbers you are out of, and these three are listening. They know what a careful player knows and nothing else: they never
            see your hand.
          </p>
        </section>
      </div>

      <div className="choose">
        <button type="button" className="start" onClick={onStart}>
          Shuffle up
        </button>
        <p className="dim">First to {target} wins.</p>
      </div>

      <footer>
        <p className="ways">
          {/*
            Absolute rather than "/", because this game is served from a
            subdirectory in production and from the root in development.
          */}
          <a href="https://games.jcoffey.dev/">The rest of the games</a>
          {' · '}
          <a href="https://git.coffeylabs.org/jcoffey-dev/dominoes">Source</a>
        </p>
        <p>
          Dominoes is free software under the{' '}
          <a href="https://www.gnu.org/licenses/agpl-3.0.html">GNU Affero General Public License, version 3 or later</a>.
          It comes with no warranty whatsoever. You may use, study, change and share it; if you run a changed version
          where other people can reach it, they are entitled to its source.
        </p>
        <p>
          The game is centuries old and belongs to everybody. Every tile on the screen and every note of the music is
          generated in code in this repository. The shuffle is a real one: “Shuffling Dominos” by RobertWulfman
          on <a href="https://freesound.org/people/RobertWulfman/sounds/220839/">Freesound</a>, in the public
          domain.
        </p>
      </footer>
    </div>
  )
}
