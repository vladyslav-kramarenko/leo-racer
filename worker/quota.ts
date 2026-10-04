import type { UsageRepository } from './db/usageRepository';

export const DEFAULT_MONTHLY_LIMIT = 20;
export const DEFAULT_GLOBAL_DAILY_LIMIT = 200;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 3;

export function parseLimit(raw: string | undefined, fallback: number = DEFAULT_MONTHLY_LIMIT): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export interface QuotaKeys {
  installationId: string;
  /** UTC month, e.g. 2026-10. */
  month: string;
  /** UTC day, e.g. 2026-10-02. */
  day: string;
  /** UTC minute, e.g. 2026-10-02T14:05. */
  minute: string;
}

export interface QuotaLimits {
  monthly: number;
  globalDaily: number;
  perMinute: number;
}

export type QuotaDecision =
  | { allowed: true; used: number; limit: number }
  | { allowed: false; reason: 'rate_limited' | 'quota_exceeded' | 'global_quota_exceeded'; used: number; limit: number };

/**
 * Check-and-reserve one AI request:
 *   rate limit → per-installation monthly quota → global daily quota → reserve both.
 * If the global reservation fails, the installation reservation is given back.
 */
export async function reserveQuota(repo: UsageRepository, keys: QuotaKeys, limits: QuotaLimits): Promise<QuotaDecision> {
  if (!(await repo.hitRateLimit(keys.installationId, keys.minute, limits.perMinute))) {
    return { allowed: false, reason: 'rate_limited', used: limits.perMinute, limit: limits.perMinute };
  }

  const used = await repo.tryIncrement(keys.installationId, keys.month, limits.monthly);
  if (used === null) {
    return { allowed: false, reason: 'quota_exceeded', used: await repo.getUsed(keys.installationId, keys.month), limit: limits.monthly };
  }

  const global = await repo.tryIncrementGlobal(keys.day, limits.globalDaily);
  if (global === null) {
    await repo.decrement(keys.installationId, keys.month);
    return { allowed: false, reason: 'global_quota_exceeded', used: limits.globalDaily, limit: limits.globalDaily };
  }
  return { allowed: true, used, limit: limits.monthly };
}

/** Give both reservations back after a failed AI call, so failures don't eat the quota. */
export async function refundQuota(repo: UsageRepository, keys: QuotaKeys): Promise<void> {
  await Promise.all([
    repo.decrement(keys.installationId, keys.month).catch((err) => console.error('quota refund failed', err)),
    repo.decrementGlobal(keys.day).catch((err) => console.error('global quota refund failed', err)),
  ]);
}
