/** Storage for AI usage counters. D1 is used for nothing else. */
export interface UsageRepository {
  getUsed(installationId: string, period: string): Promise<number>;
  /**
   * Atomically increment the per-installation counter if it is below `limit`.
   * Returns the new count, or null if the limit was already reached.
   */
  tryIncrement(installationId: string, period: string, limit: number): Promise<number | null>;
  /** Give back a reserved request (e.g. when AI processing failed). */
  decrement(installationId: string, period: string): Promise<void>;

  /** Same as tryIncrement, for the global (all installations) daily counter. */
  tryIncrementGlobal(day: string, limit: number): Promise<number | null>;
  decrementGlobal(day: string): Promise<void>;

  /** Count a submission in a per-minute bucket; false when over the limit. Not refunded. */
  hitRateLimit(installationId: string, bucket: string, limit: number): Promise<boolean>;
}

/** Atomic "insert first use, or increment while under the limit". RETURNING is empty when refused. */
const UPSERT_UNDER_LIMIT = (table: string, keyCols: string, keyParams: string, counter: string, limitParam: string) =>
  `INSERT INTO ${table} (${keyCols}, ${counter}) VALUES (${keyParams}, 1)
   ON CONFLICT (${keyCols}) DO UPDATE SET ${counter} = ${counter} + 1 WHERE ${counter} < ${limitParam}
   RETURNING ${counter} AS value`;

export class D1UsageRepository implements UsageRepository {
  constructor(private readonly db: D1Database) {}

  async getUsed(installationId: string, period: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT used FROM ai_usage WHERE installation_id = ?1 AND period = ?2')
      .bind(installationId, period)
      .first<{ used: number }>();
    return row?.used ?? 0;
  }

  async tryIncrement(installationId: string, period: string, limit: number): Promise<number | null> {
    if (limit <= 0) return null;
    const row = await this.db
      .prepare(UPSERT_UNDER_LIMIT('ai_usage', 'installation_id, period', '?1, ?2', 'used', '?3'))
      .bind(installationId, period, limit)
      .first<{ value: number }>();
    return row ? row.value : null;
  }

  async decrement(installationId: string, period: string): Promise<void> {
    await this.db
      .prepare('UPDATE ai_usage SET used = MAX(used - 1, 0) WHERE installation_id = ?1 AND period = ?2')
      .bind(installationId, period)
      .run();
  }

  async tryIncrementGlobal(day: string, limit: number): Promise<number | null> {
    if (limit <= 0) return null;
    const row = await this.db
      .prepare(UPSERT_UNDER_LIMIT('ai_global_usage', 'period', '?1', 'used', '?2'))
      .bind(day, limit)
      .first<{ value: number }>();
    return row ? row.value : null;
  }

  async decrementGlobal(day: string): Promise<void> {
    await this.db.prepare('UPDATE ai_global_usage SET used = MAX(used - 1, 0) WHERE period = ?1').bind(day).run();
  }

  async hitRateLimit(installationId: string, bucket: string, limit: number): Promise<boolean> {
    if (limit <= 0) return false;
    const [, result] = await this.db.batch<{ value: number }>([
      // Keep the table tiny: drop buckets older than the current one.
      this.db.prepare('DELETE FROM ai_rate_limit WHERE bucket < ?1').bind(bucket),
      this.db
        .prepare(UPSERT_UNDER_LIMIT('ai_rate_limit', 'installation_id, bucket', '?1, ?2', 'count', '?3'))
        .bind(installationId, bucket, limit),
    ]);
    return (result.results?.length ?? 0) > 0;
  }
}
