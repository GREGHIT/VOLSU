import React from "react";

function DefaultFallback({ error, onRetry }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-4 py-8">
      <div className="theme-surface-panel w-full rounded-[28px] border border-red-200 bg-white/95 p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)]">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-500">Ошибка интерфейса</div>
        <h2 className="theme-readable-strong mt-3 text-2xl font-black text-slate-950">
          Страница столкнулась с неожиданной ошибкой.
        </h2>
        <p className="theme-readable-soft mt-3 text-sm leading-7 text-slate-600">
          Мы сохранили приложение в рабочем состоянии. Можно попробовать перезагрузить текущий экран и продолжить
          работу без полного обновления сайта.
        </p>
        {error?.message ? (
          <div className="theme-surface-inset theme-readable-soft mt-4 rounded-2xl border border-slate-300 px-4 py-3 text-sm">
            {error.message}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-xl border border-blue-400 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-blue-100"
          >
            Попробовать снова
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
          >
            Полностью перезагрузить
          </button>
        </div>
      </div>
    </div>
  );
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (typeof fallback === "function") {
        return fallback({ error, onRetry: this.handleRetry });
      }
      return <DefaultFallback error={error} onRetry={this.handleRetry} />;
    }

    return children;
  }
}
