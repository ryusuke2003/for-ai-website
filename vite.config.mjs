import tailwindcss from '@tailwindcss/vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const SCRIPT_TAG_PATTERN = /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi;

function classicScriptPaths(html) {
  const paths = [];
  const seen = new Set();

  for (const match of html.matchAll(SCRIPT_TAG_PATTERN)) {
    const attributes = `${match[1]} ${match[3]}`;
    if (/\btype\s*=\s*["']module["']/i.test(attributes)) continue;

    const scriptPath = match[2];
    if (
      scriptPath.startsWith('/')
      || scriptPath.includes('..')
      || /^[a-z][a-z0-9+.-]*:/i.test(scriptPath)
      || seen.has(scriptPath)
    ) {
      if (seen.has(scriptPath)) continue;
      throw new Error(`Unsupported classic script path in index.html: ${scriptPath}`);
    }

    seen.add(scriptPath);
    paths.push(scriptPath);
  }

  return paths;
}

function emitClassicScriptsFromIndex() {
  let root;

  return {
    name: 'emit-classic-scripts-from-index',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      const html = await readFile(resolve(root, 'index.html'), 'utf8');
      const scriptPaths = classicScriptPaths(html);

      await Promise.all(
        scriptPaths.map(async (scriptPath) => {
          const source = await readFile(resolve(root, scriptPath));
          this.emitFile({
            type: 'asset',
            fileName: scriptPath,
            source,
          });
        }),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), emitClassicScriptsFromIndex()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
