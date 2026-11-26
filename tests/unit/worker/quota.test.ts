import { describe, expect, it } from 'vitest';
import type { DrawingAIProvider } from '../../../worker/ai/DrawingAI';
import type { UsageRepository } from '../../../worker/db/usageRepository';
import type { Env } from '../../../worker/env';
import { currentDay, currentMinute, currentPeriod } from '../../../worker/http';
import { parseLimit, refundQuota, reserveQuota, type QuotaKeys, type QuotaLimits } from '../../../worker/quota';
import { handleProcessDrawing } from '../../../worker/routes/processDrawing';

/** In-memory twin of the D1 repository with the same "increment while under limit" semantics. */
class MemoryRepo implements UsageRepository {
  readonly usage = new Map<string, number>();
  readonly global = new Map<string, number>();
  readonly rate = new Map<string, number>();
  failing = false;

  private check() {
    if (this.failing) throw new Error('D1 unavailable');
  }
  private bump(map: Map<string, number>, key: string, limit: number): number | null {
    const used = map.get(key) ?? 0;
    if (limit <= 0 || used >= limit) return null;
    map.set(key, used + 1);
    return used + 1;
  }
  async getUsed(id: string, p: string) {
    this.check();
    return this.usage.get(`${id}|${p}`) ?? 0;
  }
  async tryIncrement(id: string, p: string, limit: number) {
    this.check();
    return this.bump(this.usage, `${id}|${p}`, limit);
  }
  async decrement(id: string, p: string) {
    const k = `${id}|${p}`;
    this.usage.set(k, Math.max(0, (this.usage.get(k) ?? 0) - 1));
  }
  async tryIncrementGlobal(day: string, limit: number) {
    this.check();
    return this.bump(this.global, day, limit);
  }
  async decrementGlobal(day: string) {
    this.global.set(day, Math.max(0, (this.global.get(day) ?? 0) - 1));
  }
  async hitRateLimit(id: string, bucket: string, limit: number) {
    this.check();
    return this.bump(this.rate, `${id}|${bucket}`, limit) !== null;
  }
}

const ID = '3f1c2a9e-5b7d-4c1e-9a2b-1234567890ab';
const OTHER = '00000000-0000-4000-8000-000000000000';
const keys = (id = ID, minute = '2026-10-02T14:05', day = '2026-10-02', month = '2026-10'): QuotaKeys => ({
  installationId: id,
  month,
  day,
  minute,
});
const limits = (over: Partial<QuotaLimits> = {}): QuotaLimits => ({ monthly: 20, globalDaily: 200, perMinute: 100, ...over });

describe('quota logic', () => {
  it('parses limits from env with safe defaults', () => {
    expect(parseLimit('20')).toBe(20);
    expect(parseLimit('0')).toBe(0);
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit('abc')).toBe(20);
    expect(parseLimit('-3')).toBe(20);
    expect(parseLimit(undefined, 200)).toBe(200);
  });

  it('per-installation: allows under the limit and blocks after', async () => {
    const repo = new MemoryRepo();
    for (let i = 1; i <= 3; i++) {
      expect(await reserveQuota(repo, keys(), limits({ monthly: 3 }))).toEqual({ allowed: true, used: i, limit: 3 });
    }
    const blocked = await reserveQuota(repo, keys(), limits({ monthly: 3 }));
    expect(blocked).toMatchObject({ allowed: false, reason: 'quota_exceeded', used: 3 });
  });

  it('per-installation counts per installation and per month', async () => {
    const repo = new MemoryRepo();
    await reserveQuota(repo, keys(), limits({ monthly: 1 }));
    expect((await reserveQuota(repo, keys(ID, 'm', '2026-11-01', '2026-11'), limits({ monthly: 1 }))).allowed).toBe(true);
    expect((await reserveQuota(repo, keys(OTHER), limits({ monthly: 1 }))).allowed).toBe(true);
    expect((await reserveQuota(repo, keys(), limits({ monthly: 1 }))).allowed).toBe(false);
  });

  it('global daily limit applies across installations', async () => {
    const repo = new MemoryRepo();
    expect((await reserveQuota(repo, keys(ID), limits({ globalDaily: 2 }))).allowed).toBe(true);
    expect((await reserveQuota(repo, keys(OTHER), limits({ globalDaily: 2 }))).allowed).toBe(true);
    const third = await reserveQuota(repo, keys('11111111-1111-4111-8111-111111111111'), limits({ globalDaily: 2 }));
    expect(third).toMatchObject({ allowed: false, reason: 'global_quota_exceeded' });
    // A new UTC day starts fresh.
    expect((await reserveQuota(repo, keys(ID, 'x', '2026-10-03'), limits({ globalDaily: 2 }))).allowed).toBe(true);
  });

  it('a global refusal gives the per-installation reservation back', async () => {
    const repo = new MemoryRepo();
    await reserveQuota(repo, keys(OTHER), limits({ globalDaily: 1 }));
    await reserveQuota(repo, keys(ID), limits({ globalDaily: 1 }));
    expect(await repo.getUsed(ID, '2026-10')).toBe(0);
  });

  it('rate limit: max N submissions per minute per installation', async () => {
    const repo = new MemoryRepo();
    const l = limits({ perMinute: 3 });
    for (let i = 0; i < 3; i++) expect((await reserveQuota(repo, keys(), l)).allowed).toBe(true);
    expect(await reserveQuota(repo, keys(), l)).toMatchObject({ allowed: false, reason: 'rate_limited' });
    // Other installations and the next minute are unaffected.
    expect((await reserveQuota(repo, keys(OTHER), l)).allowed).toBe(true);
    expect((await reserveQuota(repo, keys(ID, '2026-10-02T14:06'), l)).allowed).toBe(true);
    // Rate-limited attempts do not consume monthly quota.
    expect(await repo.getUsed(ID, '2026-10')).toBe(4);
  });

  it('refund gives back both the per-installation and the global reservation', async () => {
    const repo = new MemoryRepo();
    await reserveQuota(repo, keys(), limits());
    await refundQuota(repo, keys());
    expect(await repo.getUsed(ID, '2026-10')).toBe(0);
    expect(repo.global.get('2026-10-02')).toBe(0);
  });

  it('formats UTC periods', () => {
    const d = new Date(Date.UTC(2026, 9, 2, 23, 59, 30));
    expect(currentPeriod(d)).toBe('2026-10');
    expect(currentDay(d)).toBe('2026-10-02');
    expect(currentMinute(d)).toBe('2026-10-02T23:59');
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
  const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

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

  it('returns 429 quota_exceeded once the monthly limit is reached', async () => {
    const deps = { repo: new MemoryRepo(), provider: okProvider };
    expect((await handleProcessDrawing(request(), env(), deps)).status).toBe(200);
    expect((await handleProcessDrawing(request(), env(), deps)).status).toBe(200);
    const res = await handleProcessDrawing(request(), env(), deps);
    expect(res.status).toBe(429);
    expect(await code(res)).toBe('quota_exceeded');
  });

  it('returns 429 global_quota_exceeded at the global daily cap', async () => {
    const deps = { repo: new MemoryRepo(), provider: okProvider };
    const e = env({ AI_GLOBAL_DAILY_LIMIT: '1' });
    expect((await handleProcessDrawing(request('secret', OTHER), e, deps)).status).toBe(200);
    const res = await handleProcessDrawing(request(), e, deps);
    expect(res.status).toBe(429);
    expect(await code(res)).toBe('global_quota_exceeded');
  });

  it('returns 429 rate_limited with Retry-After when submitting too fast', async () => {
    const deps = { repo: new MemoryRepo(), provider: okProvider, now: new Date(Date.UTC(2026, 9, 2, 10, 0, 5)) };
    const e = env({ AI_MONTHLY_LIMIT: '50', AI_RATE_LIMIT_PER_MINUTE: '3' });
    for (let i = 0; i < 3; i++) expect((await handleProcessDrawing(request(), e, deps)).status).toBe(200);
    const res = await handleProcessDrawing(request(), e, deps);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await code(res)).toBe('rate_limited');
  });

  it('refunds both quotas when AI fails', async () => {
    const repo = new MemoryRepo();
    const now = new Date();
    const res = await handleProcessDrawing(request(), env(), { repo, provider: failingProvider, now });
    expect(res.status).toBe(502);
    expect(await repo.getUsed(ID, currentPeriod(now))).toBe(0);
    expect(repo.global.get(currentDay(now))).toBe(0);
  });

  it('fails closed when D1 is unavailable', async () => {
    const repo = new MemoryRepo();
    repo.failing = true;
    expect((await handleProcessDrawing(request(), env(), { repo, provider: okProvider })).status).toBe(503);
  });
});
