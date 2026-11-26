# AI drawing processing

## Flow

```text
browser: decode → auto-orient → resize ≤1536 px → canvas → WebP (EXIF stripped)
   │  POST /api/v1/drawings/process   (multipart: image, installationId; header X-Leo-Alpha-Token)
   ▼
Worker: alpha token → validate → D1 quota reserve → provider.process() → response
   │  200 image/png   X-Leo-Can-Move: true   X-Leo-Confidence: 0.91
   ▼
browser: IndexedDB customAssets → sprite in the world
```

The Worker does not store the image. It exists only in memory for the duration of the request.

## Responses

| Status | Meaning                                        | UI                                        |
| ------ | ---------------------------------------------- | ----------------------------------------- |
| 200    | Image body plus `X-Leo-Can-Move` / `X-Leo-Confidence` | Drawing added; parent can switch MOVES/STAYS |
| 400/413/415 | Bad upload                                | "AI processing failed." with TRY AGAIN / USE ORIGINAL |
| 401    | Missing or wrong alpha access code             | "AI access code is missing or wrong."     |
| 429 `quota_exceeded` | Monthly per-install limit reached | "AI drawing limit reached." with USE ORIGINAL |
| 429 `global_quota_exceeded` | Global daily cap reached | "AI drawing limit reached for today…" with USE ORIGINAL |
| 429 `rate_limited` | More than 3 submissions in a minute (`Retry-After: 60`) | "Too many drawings at once…" with TRY AGAIN / USE ORIGINAL |
| 502    | Provider failed (the reserved quota is refunded) | TRY AGAIN / USE ORIGINAL                |
| 503    | Not configured, or D1 unavailable (fails closed) | TRY AGAIN / USE ORIGINAL                |

## Providers

Selected with `AI_PROVIDER`. The frontend never knows which one is in use.

| Provider | Notes |
| -------- | ----- |
| `mock` (default) | Returns the uploaded image unchanged, with a deterministic pseudo-random `canMove` and confidence 0.5. For local development and CI. No alpha token is required when this provider is active. |
| `openai` | Two parallel calls. First, `POST /v1/images/edits` (model `AI_IMAGE_MODEL`, default `gpt-image-1`) with `background=transparent`, `input_fidelity=high` and a "preserve the child's drawing, only clean it" prompt. Second, a low-detail vision call (`AI_CLASSIFIER_MODEL`, default `gpt-4.1-mini`) with a strict JSON schema `{ canMove, confidence }`. Requires the `AI_API_KEY` secret. |

To add a provider, implement `DrawingAIProvider` in `worker/ai/providers/` and add it to `createDrawingProvider()`.

**Before enabling a real provider:** confirm the model names and parameters against the vendor's current API docs.
The defaults above are configurable for this reason.
Then run a batch of real children's drawings through it to check that the result stays "the same drawing, cleaned" and never a redesign.

## Quota and cost protection

Flow for every submission:

```text
rate limit (per installation, per UTC minute)
  ↓
per-installation monthly quota  — reserve
  ↓
global daily quota              — reserve (on refusal, the installation reservation is given back)
  ↓
call AI
  ↓
refund both on provider failure
```

| Limit | Env var | Default | D1 table |
|---|---|---|---|
| Per installation per month | `AI_MONTHLY_LIMIT` | 20 | `ai_usage(installation_id, period YYYY-MM, used)` |
| All installations per UTC day | `AI_GLOBAL_DAILY_LIMIT` | 200 | `ai_global_usage(period YYYY-MM-DD, used)` |
| Submissions per installation per minute | `AI_RATE_LIMIT_PER_MINUTE` | 3 | `ai_rate_limit(installation_id, bucket YYYY-MM-DDTHH:MM, count)` |

- **Atomic reservation:** every reservation is a single upsert, `INSERT … ON CONFLICT DO UPDATE SET n = n + 1 WHERE n < limit RETURNING n`. An empty result means the limit is reached.
- **Rate-limit table:** old buckets are deleted on each check, so the table stays tiny. Rate-limited attempts are not refunded.
- **Fail closed:** if D1 is unavailable, the endpoint returns 503 and no AI money is spent.
- **Limits are server-side only:** they are never hardcoded in the frontend.
- **Identity:** `installationId` is a random UUID stored in `localStorage` as `leo.installationId`. No other identity exists.
- **Before a public link:** keep relying on these caps, not on dashboard alerts. Consider Cloudflare IP rate limiting or Turnstile only if abuse appears.

## Privacy note

The Parent Menu privacy text is in [`src/ui/ParentMenu.ts`](../src/ui/ParentMenu.ts) (`PRIVACY_NOTE`).
**Before the alpha goes out, update its wording to match the chosen provider and that provider's data-retention terms**, for example API retention for abuse monitoring.

## Validation before enabling a real provider

Per the roadmap, **measure before optimising**. Run 20–50 real images through the real provider with `AI_PROVIDER=openai`. Include:

- **Media:** marker, crayon, pencil and coloured pencil drawings; white and coloured paper.
- **Photo conditions:** imperfect lighting, angled phone photos, cluttered backgrounds.
- **Subjects:** a toy photograph; side-view and front-view cars; a tree, a house, an animal; an abstract drawing.

Record per image: latency, cleanup success, background-removal quality, whether a child would still say "that is my drawing", MOVES/STAYS correctness, failures, and cost.
Keep the current two parallel calls (cleanup + classification) until these numbers say otherwise.
