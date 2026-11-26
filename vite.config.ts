import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig(({ command, isPreview }) => {
  // AI is an opt-in local development feature; production builds can never enable it.
  const aiDev = command === 'serve' && !isPreview && process.env.LEO_AI_DEV === '1';
  return {
    plugins: [cloudflare({ configPath: aiDev ? 'wrangler.ai-dev.jsonc' : 'wrangler.jsonc' })],
    define: {
      __LEO_AI_ENABLED__: JSON.stringify(aiDev),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
  };
});
