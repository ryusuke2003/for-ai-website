import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { TimerControls } from './components/TimerControls.jsx';

function mountComponent(selector, component) {
  const root = document.querySelector(selector);
  if (!root) return;
  createRoot(root).render(component);
}

mountComponent('#react-theme-root', <ThemeSwitcher />);
mountComponent('#react-hero-root', <HeroIntro />);
mountComponent('#react-timer-controls-root', <TimerControls />);
mountComponent('#react-footer-root', <AppFooter />);
