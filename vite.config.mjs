import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const PROD_STYLE_CSP = "style-src 'self';";
const DEV_STYLE_CSP = "style-src 'self' 'unsafe-inline';";

function allowViteDevStyles() {
  return {
    name: 'allow-vite-dev-styles',
    apply: 'serve',
    transformIndexHtml(html) {
      if (!html.includes(PROD_STYLE_CSP)) {
        throw new Error('Expected production style-src directive was not found in index.html');
      }

      return html.replace(PROD_STYLE_CSP, DEV_STYLE_CSP);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), allowViteDevStyles()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
