import { describe, expect, it } from 'vitest';
import type { DrawingAIProvider } from '../../../worker/ai/DrawingAI';
import type { UsageRepository } from '../../../worker/db/usageRepository';
import type { Env } from '../../../worker/env';
import { currentPeriod } from '../../../worker/http';
import { parseLimit, reserveQuota } from '../../../worker/quota';
import { handleProcessDrawing } from '../../../worker/routes/processDrawing';

class MemoryRepo implements UsageRepository {
  readonly rows = new Map<string, number>();
  failing = false;
  private key(id: string, p: string) {
    return `${id}|${p}`;
  }
  async getUsed(id: string, p: string) {
    if (this.failing) throw new Error('D1 unavailable');
    return this.rows.get(this.key(id, p)) ?? 0;
  }
  async tryIncrement(id: string, p: string, limit: number) {
    if (this.failing) throw new Error('D1 unavailable');
    const used = this.rows.get(this.key(id, p)) ?? 0;
    if (limit <= 0 || used >= limit) return null;
    this.rows.set(this.key(id, p), used + 1);
    return used + 1;
  }
  async decrement(id: string, p: string) {
    const used = this.rows.get(this.key(id, p)) ?? 0;
    this.rows.set(this.key(id, p), Math.max(0, used - 1));
  }
}

const ID = '3f1c2a9e-5b7d-4c1e-9a2b-1234567890ab';

describe('quota logic', () => {
  it('parses the limit from env with a safe default', () => {
    expect(parseLimit('20')).toBe(20);
    expect(parseLimit('0')).toBe(0);
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit('abc')).toBe(20);
    expect(parseLimit('-3')).toBe(20);
  });

  it('allows requests under the limit and blocks after', async () => {
    const repo = new MemoryRepo();
    for (let i = 1; i <= 3; i++) {
      const d = await reserveQuota(repo, ID, '2026-09', 3);
      expect(d).toEqual({ allowed: true, used: i, limit: 3 });
    }
    const blocked = await reserveQuota(repo, ID, '2026-09', 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.used).toBe(3);
  });

  it('counts per installation and per month', async () => {
    const repo = new MemoryRepo();
    await reserveQuota(repo, ID, '2026-09', 1);
    expect((await reserveQuota(repo, ID, '2026-10', 1)).allowed).toBe(true);
    expect((await reserveQuota(repo, '00000000-0000-4000-8000-000000000000', '2026-09', 1)).allowed).toBe(true);
    expect((await reserveQuota(repo, ID, '2026-09', 1)).allowed).toBe(false);
  });

  it('formats the period as YYYY-MM in UTC', () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 8, 30, 23, 59)))).toBe('2026-09');
    expect(currentPeriod(new Date(Date.UTC(2027, 0, 1)))).toBe('2027-01');
  });
});

describe('POST /api/v1/drawings/process', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const okProvider: DrawingAIProvider = {
    name: 'fake',
    process: async () => ({ image: png.buffer, mimeType: 'image/png', canMove: true, confidence: 0.91 }),
  };
  const failingProvider: DrawingAIProvider = {
    name: 'fake',
    process: async () => {
      throw new Error('AI timeout');
    },
  };
  const env = (extra: Partial<Env> = {}) =>
    ({ AI_PROVIDER: 'mock', AI_MONTHLY_LIMIT: '2', ALPHA_ACCESS_TOKEN: 'secret', ...extra }) as Env;

  const request = (token = 'secret', id = ID, type = 'image/png') => {
    const form = new FormData();
    form.append('image', new File([png], 'drawing.png', { type }));
    form.append('installationId', id);
    return new Request('https://leo.test/api/v1/drawings/process', {
      method: 'POST',
      body: form,
      headers: token ? { 'X-Leo-Alpha-Token': token } : {},
    });
  };

  it('returns the image with canMove headers', async () => {
    const res = await handleProcessDrawing(request(), env(), { repo: new MemoryRepo(), provider: okProvider });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Leo-Can-Move')).toBe('true');
    expect(res.headers.get('X-Leo-Confidence')).toBe('0.91');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
  });

  it('rejects a missing or wrong alpha token', async () => {
    const repo = new MemoryRepo();
    expect((await handleProcessDrawing(request(''), env(), { repo, provider: okProvider })).status).toBe(401);
    expect((await handleProcessDrawing(request('nope'), env(), { repo, provider: okProvider })).status).toBe(401);
  });

  it('refuses real providers when no alpha token is configured', async () => {
    const res = await handleProcessDrawing(request(''), env({ ALPHA_ACCESS_TOKEN: undefined, AI_PROVIDER: 'openai' }), {
      repo: new MemoryRepo(),
      provider: okProvider,
    });
    expect(res.status).toBe(503);
  });

  it('validates installationId and image type', async () => {
    const deps = { repo: new MemoryRepo(), provider: okProvider };
    expect((await handleProcessDrawing(request('secret', 'not-a-uuid'), env(), deps)).status).toBe(400);
    expect((await handleProcessDrawing(request('secret', ID, 'image/gif'), env(), deps)).status).toBe(415);
  });

  it('returns 429 once the monthly limit is reached', async () => {
    const deps = { repo: new MemoryRepo(), provider: okProvider };
    expect((await handleProcessDrawing(request(), env(), deps)).status).toBe(200);
    expect((await handleProcessDrawing(request(), env(), deps)).status).toBe(200);
    expect((await handleProcessDrawing(request(), env(), deps)).status).toBe(429);
  });

  it('refunds quota when AI fails', async () => {
    const repo = new MemoryRepo();
    const res = await handleProcessDrawing(request(), env(), { repo, provider: failingProvider });
    expect(res.status).toBe(502);
    expect(await repo.getUsed(ID, currentPeriod())).toBe(0);
  });

  it('fails closed when D1 is unavailable', async () => {
    const repo = new MemoryRepo();
    repo.failing = true;
    expect((await handleProcessDrawing(request(), env(), { repo, provider: okProvider })).status).toBe(503);
  });
});
