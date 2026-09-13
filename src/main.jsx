import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { startTrayNavigation } from './desktop/trayNavigation.js';
import { startTrayTimerSync } from './desktop/trayTimerSync.js';
import { startTodoLiveDragPreview } from './features/todo/todoLiveDragPreview.js';
import './tailwind.css';

delete globalThis.ONE_TIMER_RUNTIME;
delete globalThis.ONE_PROGRESS_RUNTIME;

startTrayTimerSync();
void startTrayNavigation();
startTodoLiveDragPreview();

function syncTrayViewportScroll() {
  const compactTray = window.location.hash === '#tray-todo' || window.location.hash === '#tray-timer';
  const overflow = compactTray ? 'hidden' : '';

  document.documentElement.style.overflow = overflow;
  if (document.body) {
    document.body.style.overflow = overflow;
  }

  if (compactTray) {
    window.scrollTo(0, 0);
  }
}

window.addEventListener('hashchange', syncTrayViewportScroll);

function mountApp() {
  const root = document.querySelector('#root');
  if (!root) return;
  syncTrayViewportScroll();
  createRoot(root).render(<App />);
}

if (document.readyState === 'complete') {
  mountApp();
} else {
  document.addEventListener('DOMContentLoaded', mountApp, { once: true });
}
