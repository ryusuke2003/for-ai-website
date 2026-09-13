import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const legacyScripts = [
  'theme-bootstrap.js',
  'timer-bootstrap.js',
  'app.js',
  'storage-status.js',
  'completion-sound.js',
  'wake-lock.js',
  'theme.js',
  'stats.js',
  'daily-goal-progress.js',
  'tab-guard.js',
  'backup.js',
  'custom-timer.js',
  'shortcuts.js',
  'privacy-reset.js',
];

function injectReactEntry() {
  return {
    name: 'inject-react-entry',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html
        .replace('<html lang="ja">', '<html lang="ja" data-react-theme="1">')
        .replace(
          '<script type="module" data-vite-entry="/src/main.jsx"></script>',
          '<script type="module" src="/src/main.jsx"></script>',
        );
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
