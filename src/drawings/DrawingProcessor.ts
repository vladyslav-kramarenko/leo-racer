import { CONFIG } from '../game/config';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Decode, auto-orient, downscale to ~1536 px and re-encode through a canvas.
 * Re-encoding strips EXIF/GPS metadata, so the original photo never leaves the device.
 */
export async function preprocessImage(file: Blob, maxSide: number = CONFIG.drawings.maxUploadSide): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Unsupported image type');

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    // WebP keeps transparency and is small; browsers without WebP encoding fall back to PNG.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', CONFIG.drawings.uploadQuality),
    );
    if (!blob) throw new Error('Could not encode image');
    return blob;
  } finally {
    bitmap.close();
  }
}

export type ProcessFailure = 'quota' | 'globalLimit' | 'rateLimited' | 'unauthorized' | 'failed' | 'network' | 'timeout';

export type ProcessResult =
  | { ok: true; image: Blob; canMove: boolean; confidence: number | null }
  | { ok: false; reason: ProcessFailure; message: string };

export const FAILURE_MESSAGES: Record<ProcessFailure, string> = {
  quota: 'AI drawing limit reached.',
  globalLimit: 'AI drawing limit reached for today. Please try again tomorrow.',
  rateLimited: 'Too many drawings at once. Please wait a minute and try again.',
  unauthorized: 'AI access code is missing or wrong.',
  failed: 'AI processing failed.',
  network: 'AI processing failed. Check the internet connection.',
  timeout: 'AI processing failed. It took too long.',
};

/** Call the Worker. The frontend never knows which AI provider is behind it. */
export async function requestProcessing(
  image: Blob,
  installationId: string,
  accessToken: string,
  timeoutMs: number = CONFIG.drawings.requestTimeoutMs,
): Promise<ProcessResult> {
  const form = new FormData();
  const ext = image.type === 'image/png' ? 'png' : image.type === 'image/jpeg' ? 'jpg' : 'webp';
  form.append('image', image, `drawing.${ext}`);
  form.append('installationId', installationId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/v1/drawings/process', {
      method: 'POST',
      body: form,
      headers: accessToken ? { 'X-Leo-Alpha-Token': accessToken } : {},
      signal: controller.signal,
    });
    if (response.status === 429) return fail(await limitReason(response));
    if (response.status === 401 || response.status === 403) return fail('unauthorized');
    if (!response.ok) return fail('failed');

    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.startsWith('image/')) return fail('failed');
    const blob = await response.blob();
    const canMove = response.headers.get('X-Leo-Can-Move') === 'true';
    const confidenceHeader = Number.parseFloat(response.headers.get('X-Leo-Confidence') ?? '');
    return {
      ok: true,
      image: blob,
      canMove,
      confidence: Number.isFinite(confidenceHeader) ? confidenceHeader : null,
    };
  } catch (err) {
    if (controller.signal.aborted) return fail('timeout');
    console.warn('[leo] drawing request failed', err);
    return fail('network');
  } finally {
    clearTimeout(timer);
  }
}

function fail(reason: ProcessFailure): ProcessResult {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

async function limitReason(response: Response): Promise<ProcessFailure> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    if (body.error?.code === 'rate_limited') return 'rateLimited';
    if (body.error?.code === 'global_quota_exceeded') return 'globalLimit';
  } catch {
    // Fall through to the generic quota message.
  }
  return 'quota';
}
