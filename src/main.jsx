import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { TimerControls } from './components/TimerControls.jsx';
import { TimerDisplay } from './components/TimerDisplay.jsx';

function mountComponent(selector, component) {
  const root = document.querySelector(selector);
  if (!root) return;
  createRoot(root).render(component);
}

function mountReactUi() {
  mountComponent('#react-theme-root', <ThemeSwitcher />);
  mountComponent('#react-hero-root', <HeroIntro />);
  mountComponent('#react-timer-display-root', <TimerDisplay />);
  mountComponent('#react-timer-controls-root', <TimerControls />);
  mountComponent('#react-footer-root', <AppFooter />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountReactUi, { once: true });
} else {
  mountReactUi();
}
