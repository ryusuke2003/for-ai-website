import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { progressActions } from './features/progress/progressStore.js';
import { tabCoordination } from './features/timer/tabGuard.js';
import './tailwind.css';

globalThis.ONE_REACT_PROGRESS_OVERVIEW = progressActions;
globalThis.ONE_TAB_COORDINATION = tabCoordination;

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
