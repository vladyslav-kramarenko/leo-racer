import type { Env } from '../env';
import { error, safeEqual } from '../http';

/**
 * Simple alpha protection for AI endpoints. If ALPHA_ACCESS_TOKEN is not configured,
 * access is only allowed with the free mock provider (local development).
 * Returns an error response, or null when the request may proceed.
 */
export function checkAlphaAccess(request: Request, env: Env): Response | null {
  const expected = env.ALPHA_ACCESS_TOKEN;
  if (!expected) {
    if ((env.AI_PROVIDER ?? 'mock').toLowerCase() === 'mock') return null;
    return error(503, 'not_configured', 'AI access is not configured.');
  }
  const provided = request.headers.get('X-Leo-Alpha-Token') ?? '';
  if (!provided || !safeEqual(provided, expected)) return error(401, 'unauthorized', 'Invalid access code.');
  return null;
}
