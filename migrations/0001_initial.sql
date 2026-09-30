-- AI quota tracking only. No drawings, no personal data.
CREATE TABLE IF NOT EXISTS ai_usage (
    installation_id TEXT NOT NULL,
    period TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (installation_id, period)
);
