import { createDrawingProvider, type DrawingAIProvider } from '../ai/DrawingAI';
import { D1UsageRepository, type UsageRepository } from '../db/usageRepository';
import type { Env } from '../env';
import { currentPeriod, error, UUID_RE } from '../http';
import { parseLimit, refundQuota, reserveQuota } from '../quota';
import { checkAlphaAccess } from './auth';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface ProcessDeps {
  repo?: UsageRepository;
  provider?: DrawingAIProvider;
  now?: Date;
}

/**
 * POST /api/v1/drawings/process
 * multipart/form-data: image=<blob>, installationId=<uuid>
 * → image/png body with X-Leo-Can-Move / X-Leo-Confidence headers.
 * The image passes through memory only; it is never stored.
 */
export async function handleProcessDrawing(request: Request, env: Env, deps: ProcessDeps = {}): Promise<Response> {
  const denied = checkAlphaAccess(request, env);
  if (denied) return denied;

  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (contentLength > MAX_UPLOAD_BYTES + 64 * 1024) return error(413, 'too_large', 'Image is too large.');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, 'bad_request', 'Expected multipart/form-data.');
  }

  const installationId = form.get('installationId');
  const image = form.get('image');
  if (typeof installationId !== 'string' || !UUID_RE.test(installationId)) {
    return error(400, 'bad_installation_id', 'installationId must be a UUID.');
  }
  if (!(image instanceof File)) return error(400, 'missing_image', 'image is required.');
  if (!ACCEPTED.has(image.type)) return error(415, 'unsupported_type', 'Use JPEG, PNG or WebP.');
  if (image.size > MAX_UPLOAD_BYTES) return error(413, 'too_large', 'Image is too large.');

  let provider: DrawingAIProvider;
  try {
    provider = deps.provider ?? createDrawingProvider(env);
  } catch (err) {
    console.error('AI provider misconfigured', err);
    return error(503, 'not_configured', 'AI processing is not available.');
  }

  const repo = deps.repo ?? new D1UsageRepository(env.DB);
  const period = currentPeriod(deps.now);
  const limit = parseLimit(env.AI_MONTHLY_LIMIT);

  let decision;
  try {
    decision = await reserveQuota(repo, installationId, period, limit);
  } catch (err) {
    // Fail closed: without quota tracking we don't spend AI money.
    console.error('quota check failed', err);
    return error(503, 'quota_unavailable', 'AI processing is temporarily unavailable.');
  }
  if (!decision.allowed) {
    return new Response(JSON.stringify({ error: { code: 'quota_exceeded', message: 'AI drawing limit reached.' } }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Leo-Quota-Used': String(decision.used),
        'X-Leo-Quota-Limit': String(decision.limit),
      },
    });
  }

  try {
    const result = await provider.process(await image.arrayBuffer(), { mimeType: image.type });
    return new Response(result.image, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Cache-Control': 'no-store',
        'X-Leo-Can-Move': String(result.canMove),
        'X-Leo-Confidence': result.confidence.toFixed(2),
        'X-Leo-Quota-Used': String(decision.used),
        'X-Leo-Quota-Limit': String(decision.limit),
      },
    });
  } catch (err) {
    console.error('AI processing failed', err instanceof Error ? err.message : err);
    await refundQuota(repo, installationId, period);
    return error(502, 'ai_failed', 'AI processing failed.');
  }
}
