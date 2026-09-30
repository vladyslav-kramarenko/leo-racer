import { D1UsageRepository, type UsageRepository } from '../db/usageRepository';
import type { Env } from '../env';
import { currentPeriod, error, json, UUID_RE } from '../http';
import { parseLimit } from '../quota';

/** GET /api/v1/usage?installationId=<uuid> → { used, limit, period } */
export async function handleUsage(request: Request, env: Env, repo?: UsageRepository): Promise<Response> {
  const id = new URL(request.url).searchParams.get('installationId') ?? '';
  if (!UUID_RE.test(id)) return error(400, 'bad_installation_id', 'installationId must be a UUID.');
  const period = currentPeriod();
  try {
    const used = await (repo ?? new D1UsageRepository(env.DB)).getUsed(id, period);
    return json({ used, limit: parseLimit(env.AI_MONTHLY_LIMIT), period });
  } catch (err) {
    console.error('usage lookup failed', err);
    return error(503, 'unavailable', 'Usage is temporarily unavailable.');
  }
}
