/** Storage for AI usage counters. D1 is used for nothing else in the MVP. */
export interface UsageRepository {
  getUsed(installationId: string, period: string): Promise<number>;
  /**
   * Atomically increment the counter if it is below `limit`.
   * Returns the new count, or null if the limit was already reached.
   */
  tryIncrement(installationId: string, period: string, limit: number): Promise<number | null>;
  /** Give back a reserved request (e.g. when AI processing failed). */
  decrement(installationId: string, period: string): Promise<void>;
}

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
    // Single statement: insert the first use, or increment only while under the limit.
    const row = await this.db
      .prepare(
        `INSERT INTO ai_usage (installation_id, period, used) VALUES (?1, ?2, 1)
         ON CONFLICT (installation_id, period) DO UPDATE SET used = used + 1 WHERE used < ?3
         RETURNING used`,
      )
      .bind(installationId, period, limit)
      .first<{ used: number }>();
    return row ? row.used : null;
  }

  async decrement(installationId: string, period: string): Promise<void> {
    await this.db
      .prepare('UPDATE ai_usage SET used = MAX(used - 1, 0) WHERE installation_id = ?1 AND period = ?2')
      .bind(installationId, period)
      .run();
  }
}
