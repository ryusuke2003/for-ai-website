import tailwindcss from '@tailwindcss/vite';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const legacyScripts = [
  'theme-bootstrap.js',
  'timer-bootstrap.js',
  'app.js',
  'legacy/interop/timer.js',
  'storage-status.js',
  'completion-sound.js',
  'wake-lock.js',
  'theme.js',
  'stats.js',
  'daily-goal-progress.js',
  'tab-guard.js',
  'backup.js',
  'custom-timer.js',
  'legacy/interop/settings-progress.js',
  'shortcuts.js',
  'privacy-reset.js',
  'legacy/interop/progress-backup.js',
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
            '<html lang="ja" data-react-theme="1" data-react-timer-state="1" data-react-timer-controls="1" data-react-timer-settings="1" data-react-progress-overview="1" data-react-progress-details="1" data-react-backup-panel="1">',
          )
          .replace(
            '<script src="app.js" defer></script>',
            '<script src="app.js" defer></script>\n  <script src="legacy/interop/timer.js" defer></script>',
          )
          .replace(
            '<script src="custom-timer.js" defer></script>',
            '<script src="custom-timer.js" defer></script>\n  <script src="legacy/interop/settings-progress.js" defer></script>',
          )
          .replace(
            '<script src="privacy-reset.js" defer></script>',
            '<script src="privacy-reset.js" defer></script>\n  <script src="legacy/interop/progress-backup.js" defer></script>',
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
      await Promise.all(
        legacyScripts.map(async (file) => {
          const source = resolve(root, file);
          const destination = resolve(outDir, file);
          await mkdir(dirname(destination), { recursive: true });
          await copyFile(source, destination);
        }),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), injectReactEntry(), copyLegacyScripts()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
