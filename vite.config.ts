import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const aiDev = process.env.LEO_AI_DEV === '1';

export default defineConfig({
  plugins: [cloudflare({ configPath: aiDev ? 'wrangler.ai-dev.jsonc' : 'wrangler.jsonc' })],
  define: {
    __LEO_AI_ENABLED__: JSON.stringify(aiDev),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
