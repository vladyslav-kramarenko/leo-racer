-- AI cost protection: a global daily cap and a per-installation rate limit.
-- Still no drawings and no personal data — only counters.
CREATE TABLE IF NOT EXISTS ai_global_usage (
    period TEXT PRIMARY KEY,           -- UTC day, e.g. 2026-10-02
    used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_rate_limit (
    installation_id TEXT NOT NULL,
    bucket TEXT NOT NULL,              -- UTC minute, e.g. 2026-10-02T14:05
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (installation_id, bucket)
);

CREATE INDEX IF NOT EXISTS ai_rate_limit_bucket ON ai_rate_limit (bucket);
