import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const legacyScripts = [
  'theme-bootstrap.js',
  'timer-bootstrap.js',
  'app.js',
  'react-timer-controls-bridge.js',
  'storage-status.js',
  'completion-sound.js',
  'wake-lock.js',
  'theme.js',
  'stats.js',
  'daily-goal-progress.js',
  'tab-guard.js',
  'react-progress-overview-bridge.js',
  'backup.js',
  'custom-timer.js',
  'react-timer-settings-bridge.js',
  'react-timer-display-bridge.js',
  'shortcuts.js',
  'privacy-reset.js',
];

function injectReactEntry() {
  return {
    name: 'inject-react-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(
            '<html lang="ja">',
            '<html lang="ja" data-react-theme="1" data-react-timer-controls="1" data-react-timer-display="1" data-react-timer-settings="1" data-react-progress-overview="1">',
          )
          .replace(
            '<script src="app.js" defer></script>',
            '<script src="app.js" defer></script>\n  <script src="react-timer-controls-bridge.js" defer></script>',
          )
          .replace(
            '<script src="tab-guard.js" defer></script>',
            '<script src="tab-guard.js" defer></script>\n  <script src="react-progress-overview-bridge.js" defer></script>',
          )
          .replace(
            '<script src="custom-timer.js" defer></script>',
            '<script src="custom-timer.js" defer></script>\n  <script src="react-timer-settings-bridge.js" defer></script>\n  <script src="react-timer-display-bridge.js" defer></script>',
          )
          .replace(
            '<script type="module" data-vite-entry="/src/main.jsx"></script>',
            '<script type="module" src="/src/main.jsx"></script>',
          );
      },
    },
  };
}

function copyLegacyScripts() {
  let root;
  let outDir;

  return {
    name: 'copy-legacy-scripts',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await mkdir(outDir, { recursive: true });
      await Promise.all(
        legacyScripts.map((file) => copyFile(resolve(root, file), resolve(outDir, file))),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [injectReactEntry(), copyLegacyScripts()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
