import type { UsageRepository } from './db/usageRepository';

export const DEFAULT_MONTHLY_LIMIT = 20;

export function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MONTHLY_LIMIT;
}

export type QuotaDecision = { allowed: true; used: number; limit: number } | { allowed: false; used: number; limit: number };

/** Check-and-reserve one AI request for this installation and period. */
export async function reserveQuota(
  repo: UsageRepository,
  installationId: string,
  period: string,
  limit: number,
): Promise<QuotaDecision> {
  const used = await repo.tryIncrement(installationId, period, limit);
  if (used === null) return { allowed: false, used: await repo.getUsed(installationId, period), limit };
  return { allowed: true, used, limit };
}

/** Give a reserved request back after a failed AI call, so failures don't eat the quota. */
export async function refundQuota(repo: UsageRepository, installationId: string, period: string): Promise<void> {
  try {
    await repo.decrement(installationId, period);
  } catch (err) {
    console.error('quota refund failed', err);
  }
}
