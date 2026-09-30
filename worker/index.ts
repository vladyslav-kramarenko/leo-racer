import type { Env } from './env';
import { error } from './http';
import { handleHealth } from './routes/health';
import { handleProcessDrawing } from './routes/processDrawing';
import { handleUsage } from './routes/usage';

/**
 * One Cloudflare application: static assets for the game + a tiny /api for AI drawings.
 * The game itself is fully client-side and keeps working if anything here fails.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (pathname === '/api/v1/health' && request.method === 'GET') return handleHealth();
      if (pathname === '/api/v1/usage' && request.method === 'GET') return await handleUsage(request, env);
      if (pathname === '/api/v1/drawings/process') {
        if (request.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST.');
        return await handleProcessDrawing(request, env);
      }
      return error(404, 'not_found', 'Not found.');
    } catch (err) {
      console.error('unhandled API error', err);
      return error(500, 'internal', 'Something went wrong.');
    }
  },
} satisfies ExportedHandler<Env>;
