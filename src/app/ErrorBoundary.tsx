/**
 * ErrorBoundary — Shaheem
 * Catches render errors and shows a recoverable error screen.
 * `silent` renders nothing on error (used around optional overlays such as the assistant).
 */
import React from 'react';
import { TriangleAlert, RotateCcw, LayoutDashboard } from 'lucide-react';

interface Props { children: React.ReactNode; silent?: boolean }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Keep a trace in the console for debugging; the UI stays usable.
    console.error('[FarmWise] render error', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.silent) return null;

    return (
      <div className="fw-error-screen" role="alert">
        <div className="fw-empty-state__icon fw-error-screen__icon" aria-hidden="true">
          <TriangleAlert size={24} strokeWidth={1.75} />
        </div>
        <h1 className="fw-section-title">Something went wrong</h1>
        <p className="fw-error-screen__message">
          This page could not be displayed. Your saved farm has not been changed.
        </p>
        {this.state.error?.message && (
          <p className="fw-error-screen__detail">Details: {this.state.error.message}</p>
        )}
        <div className="fw-error-screen__actions">
          <button type="button" className="fw-btn fw-btn--secondary fw-btn--md" onClick={this.handleReset}>
            <span className="fw-btn__icon"><RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" /></span>
            <span className="fw-btn__label">Try again</span>
          </button>
          <button type="button" className="fw-btn fw-btn--primary fw-btn--md" onClick={() => { window.location.href = '/'; }}>
            <span className="fw-btn__icon"><LayoutDashboard size={18} strokeWidth={1.75} aria-hidden="true" /></span>
            <span className="fw-btn__label">Go to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }
}
