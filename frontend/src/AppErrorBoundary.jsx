import { Component } from 'react';
import { reloadForNewVersion } from './version-recovery';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Не удалось открыть страницу Lessonfold:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="try-page">
        <h1 className="page-title" role="alert">Не удалось открыть страницу</h1>
        <p className="muted">Обновите страницу. Если ошибка повторится, вернитесь на главную кабинета.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => reloadForNewVersion({ force: true })}>Обновить страницу</button>
          <button type="button" className="btn btn-secondary" onClick={() => { window.location.hash = '#/'; this.setState({ failed: false }); }}>На главную</button>
        </div>
      </main>
    );
  }
}
