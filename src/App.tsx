import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';

const AppV2 = lazy(() => import('./v2/AppV2'));
const LegacyApp = lazy(() => import('./LegacyApp'));

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Amber Club failed to start', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ alignItems: 'center', background: '#123b3b', color: '#fff4dc', display: 'flex', fontFamily: 'system-ui, sans-serif', inset: 0, justifyContent: 'center', padding: 24, position: 'fixed', textAlign: 'center' }}>
        <section>
          <h1 style={{ fontFamily: 'Georgia, serif', margin: '0 0 10px' }}>Amber Club не смог запуститься</h1>
          <p style={{ color: '#f3e7d3', margin: '0 0 18px' }}>Перезагрузите страницу или откройте сохранённую классическую версию.</p>
          <a href="?legacy=1" style={{ background: '#f4b740', borderRadius: 12, color: '#123b3b', display: 'inline-block', fontWeight: 800, padding: '12px 18px', textDecoration: 'none' }}>
            Открыть классическую версию
          </a>
        </section>
      </main>
    );
  }
}

export default function App() {
  const legacyRequested = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('legacy') === '1';

  return (
    <AppErrorBoundary>
      <Suspense fallback={(
        <main style={{ alignItems: 'center', background: '#123b3b', color: '#fff4dc', display: 'flex', fontFamily: 'system-ui, sans-serif', inset: 0, justifyContent: 'center', position: 'fixed' }}>
          Загружаем Amber Club…
        </main>
      )}>
        {legacyRequested ? <LegacyApp /> : <AppV2 />}
      </Suspense>
    </AppErrorBoundary>
  );
}
