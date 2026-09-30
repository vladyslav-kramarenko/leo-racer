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
| 429    | Monthly limit reached (`AI_MONTHLY_LIMIT`)     | "AI drawing limit reached." with USE ORIGINAL |
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

## Quota

- D1 table `ai_usage(installation_id, period, used)`. `period` is the UTC `YYYY-MM`.
- The reservation is a single atomic upsert: `INSERT … ON CONFLICT DO UPDATE SET used = used + 1 WHERE used < limit RETURNING used`.
- The limit comes from the `AI_MONTHLY_LIMIT` env var (default 20). It is never hardcoded in the frontend.
- `installationId` is a random UUID stored in `localStorage` as `leo.installationId`. No other identity exists.

## Privacy note

The Parent Menu privacy text is in [`src/ui/ParentMenu.ts`](../src/ui/ParentMenu.ts) (`PRIVACY_NOTE`).
**Before the alpha goes out, update its wording to match the chosen provider and that provider's data-retention terms**, for example API retention for abuse monitoring.
