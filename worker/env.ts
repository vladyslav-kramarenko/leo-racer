export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** 'mock' (default) or 'openai'. */
  AI_PROVIDER?: string;
  /** Monthly AI requests per installation. */
  AI_MONTHLY_LIMIT?: string;
  /** AI requests per UTC day across all installations (cost cap). */
  AI_GLOBAL_DAILY_LIMIT?: string;
  /** AI submissions per minute per installation. */
  AI_RATE_LIMIT_PER_MINUTE?: string;
  /** Secret. Provider API key — Worker-side only, never in the frontend bundle. */
  AI_API_KEY?: string;
  /** Secret. Shared alpha access code required by /api/v1/drawings/process. */
  ALPHA_ACCESS_TOKEN?: string;
  /** Optional model overrides for the OpenAI adapter. */
  AI_IMAGE_MODEL?: string;
  AI_CLASSIFIER_MODEL?: string;
}
