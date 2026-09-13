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
  plugins: [tailwindcss(), copyLegacyScripts()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
