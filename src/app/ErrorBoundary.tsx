import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '../ui'
import './app.css'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FarmWise render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fw-error" role="alert">
          <Card title="Something went wrong">
            <p>This screen failed to display. Your saved data has not been changed.</p>
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
