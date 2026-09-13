import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppFooter } from './components/AppFooter.jsx';
import { HeroIntro } from './components/HeroIntro.jsx';
import { ProgressDetails } from './components/ProgressDetails.jsx';
import { ProgressOverview } from './components/ProgressOverview.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { TimerControls } from './components/TimerControls.jsx';
import { TimerDisplay } from './components/TimerDisplay.jsx';
import { TimerSettings } from './components/TimerSettings.jsx';

function mountComponent(selector, component) {
  const root = document.querySelector(selector);
  if (!root) return;
  createRoot(root).render(component);
}

function wrapSiblingRange(rootId, start, end) {
  const existing = document.querySelector(`#${rootId}`);
  if (existing) return existing;
  if (!start || !end || start.parentElement !== end.parentElement) return null;

  const root = document.createElement('div');
  root.id = rootId;
  start.before(root);

  let current = start;
  while (current) {
    const next = current.nextSibling;
    root.append(current);
    if (current === end) break;
    current = next;
  }

  return root;
}

function ensureProgressOverviewRoot() {
  const start = document.querySelector('#done-button')?.closest('.controls');
  const end = document.querySelector('#streak-status');
  return wrapSiblingRange('react-progress-overview-root', start, end);
}

function ensureProgressDetailsRoot() {
  const start = document.querySelector('#daily-goal-input')?.closest('.presets');
  const activity = document.querySelector('#activity-grid')?.closest('.activity');
  const trailingHint = activity?.nextElementSibling?.classList.contains('hint')
    ? activity.nextElementSibling
    : activity;
  return wrapSiblingRange('react-progress-details-root', start, trailingHint);
}

function mountReactUi() {
  mountComponent('#react-theme-root', <ThemeSwitcher />);
  mountComponent('#react-hero-root', <HeroIntro />);
  mountComponent('#react-timer-display-root', <TimerDisplay />);
  mountComponent('#react-timer-controls-root', <TimerControls />);
  mountComponent('#react-timer-settings-root', <TimerSettings />);
  ensureProgressOverviewRoot();
  mountComponent('#react-progress-overview-root', <ProgressOverview />);
  ensureProgressDetailsRoot();
  mountComponent('#react-progress-details-root', <ProgressDetails />);
  mountComponent('#react-footer-root', <AppFooter />);
}

if (document.readyState === 'complete') {
  mountReactUi();
} else {
  document.addEventListener('DOMContentLoaded', mountReactUi, { once: true });
}
