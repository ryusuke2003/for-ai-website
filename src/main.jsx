import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';

function mountComponent(selector, component) {
  const root = document.querySelector(selector);
  if (!root) return;
  createRoot(root).render(component);
}

mountComponent('#react-hero-root', <HeroIntro />);
mountComponent('#react-footer-root', <AppFooter />);
