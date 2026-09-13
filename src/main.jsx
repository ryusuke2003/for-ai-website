import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './tailwind.css';

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
