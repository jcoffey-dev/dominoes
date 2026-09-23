import { Component, type ReactNode } from 'react'

/**
 * If anything in the game throws while drawing, say so and offer a way on,
 * instead of leaving the player looking at an empty page. The error goes to
 * the console for whoever wants to report it.
 */
export class Crash extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Dominoes crashed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="landing crashed" role="alert">
        <h1>Dominoes</h1>
        <p>Somebody knocked the table over. The game hit an error and can’t carry on.</p>
        <p className="dim small">{this.state.error.message}</p>
        <button type="button" className="go" onClick={() => window.location.reload()}>
          Start over
        </button>
      </div>
    )
  }
}
