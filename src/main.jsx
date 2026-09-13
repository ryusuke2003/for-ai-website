import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';

function hydrateComponent(selector, component) {
  const root = document.querySelector(selector);
  if (!root) return;
  hydrateRoot(root, component);
}

hydrateComponent('#react-hero-root', <HeroIntro />);
hydrateComponent('#react-footer-root', <AppFooter />);
