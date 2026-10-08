import React from 'react';

/**
 * Catches render errors anywhere below it and shows a recoverable fallback instead of a blank page.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center text-fg">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm opacity-80">
          The page hit an unexpected error. Reloading usually fixes it; if it keeps happening, please let us know.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-md border border-current px-4 py-2 text-sm font-medium hover:opacity-80"
        >
          Reload page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
