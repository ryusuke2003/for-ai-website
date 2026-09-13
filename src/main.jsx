import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { startTrayNavigation } from './desktop/trayNavigation.js';
import { startTrayTimerActions } from './desktop/trayTimerActions.js';
import { startTrayTimerSync } from './desktop/trayTimerSync.js';
import { startTodoLiveDragPreview } from './features/todo/todoLiveDragPreview.js';
import './tailwind.css';

delete globalThis.ONE_TIMER_RUNTIME;
delete globalThis.ONE_PROGRESS_RUNTIME;

startTrayTimerSync();
void startTrayTimerActions();
void startTrayNavigation();
startTodoLiveDragPreview();

function mountApp() {
  const root = document.querySelector('#root');
  if (!root) return;
  createRoot(root).render(<App />);
}

if (document.readyState === 'complete') {
  mountApp();
} else {
  document.addEventListener('DOMContentLoaded', mountApp, { once: true });
}
