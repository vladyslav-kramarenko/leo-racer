import { error } from './http';
import { handleHealth } from './routes/health';
interface PublicEnv { ASSETS: Fetcher }
/** Public release has no AI provider, database or drawing upload route. */
export default {
  async fetch(request: Request, env: PublicEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/v1/health' && request.method === 'GET') return handleHealth();
    if (pathname.startsWith('/api/')) return error(404, 'not_found', 'Not found.');
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<PublicEnv>;
