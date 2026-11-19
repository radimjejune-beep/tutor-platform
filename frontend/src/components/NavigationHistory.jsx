// components/NavigationHistory.jsx — история навигации для умного возврата
import { useEffect, useState } from 'react';

const MAX_HISTORY = 20;

class NavigationHistory {
  constructor() {
    this.history = [];
    this.listeners = new Set();
  }

  push(path) {
    // Не добавляем дубликаты подряд
    if (this.history[this.history.length - 1] === path) return;

    this.history.push(path);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this.notify();
  }

  getRecent(limit = 7) {
    // Уникальные последние посещенные страницы
    const seen = new Set();
    const result = [];

    for (let i = this.history.length - 1; i >= 0 && result.length < limit; i--) {
      if (!seen.has(this.history[i])) {
        seen.add(this.history[i]);
        result.push(this.history[i]);
      }
    }

    return result;
  }

  canGoBack() {
    return this.history.length > 1;
  }

  goBack() {
    if (this.history.length > 1) {
      this.history.pop(); // Убираем текущую
      const prev = this.history[this.history.length - 1];
      this.notify();
      return prev;
    }
    return null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(l => l([...this.history]));
  }

  clear() {
    this.history = [];
    this.notify();
  }
}

export const navHistory = new NavigationHistory();

// Хук для использования истории в компонентах
export function useNavigationHistory() {
  const [history, setHistory] = useState(navHistory.history);

  useEffect(() => {
    return navHistory.subscribe(setHistory);
  }, []);

  return {
    history,
    recent: navHistory.getRecent(),
    canGoBack: navHistory.canGoBack(),
    goBack: navHistory.goBack.bind(navHistory),
  };
}
