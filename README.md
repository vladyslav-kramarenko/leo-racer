# Leo Racer — MVP Alpha

A browser driving toy for children aged 2–4. The yellow school bus is always driving.
The child can take the wheel (keyboard or a real steering wheel) at any moment and cannot fail.
After 8 seconds without steering, autopilot smoothly takes over again.
Parents can add a child's drawing, which appears in the world as a static or moving object.

- **Stack:** TypeScript, Vite, Three.js, Cloudflare Workers + Static Assets + D1, IndexedDB, Vitest, Playwright. No React.
- **Spec:** [task.md](task.md). **Architecture:** [docs/architecture.md](docs/architecture.md).

## Quick start

```bash
npm install
npx wrangler d1 migrations apply leo-racer-alpha --local   # once: local quota table
npm run dev                                                # http://localhost:5173
```

Local development uses the **mock** AI provider. It returns the image unchanged with a pseudo-random `canMove`.
No API key is needed, and no alpha token is required while the provider is `mock`.
To try a real provider, copy `.dev.vars.example` to `.dev.vars` and fill it in.

## Controls

| Who    | Action                                   | Input                                     |
| ------ | ---------------------------------------- | ----------------------------------------- |
| Child  | Steer                                    | `←` `→` or `A` `D`, or a steering wheel / gamepad |
| Child  | Horn                                     | `Space` / `H`, or any wheel button        |
| Parent | Parent Menu                              | Hold `Esc` ~2 s, or press and hold the top-left corner |

The Parent Menu covers: Add / Manage Drawings, Calibrate Wheel, World, Sound, Fullscreen, Diagnostics (overlay and export), and the privacy note.
Add `?debug` to the URL in dev mode to show the diagnostics overlay immediately.

## Scripts

| Script               | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Vite dev server with the Worker running locally (Cloudflare Vite plugin) |
| `npm run build`      | Typecheck + production build (`dist/client`, `dist/leo_racer_alpha`) |
| `npm run preview`    | Build and preview the production bundle locally        |
| `npm run typecheck`  | `tsc -b` for app, worker and tooling                   |
| `npm run lint`       | ESLint                                                 |
| `npm run test`       | Vitest unit tests                                      |
| `npm run test:e2e`   | Playwright browser tests (run `npx playwright install chromium` once) |
| `npm run deploy`     | Build and `wrangler deploy`                            |

## Deploying to Cloudflare (alpha)

1. Create the D1 database and copy the printed `database_id` into [wrangler.jsonc](wrangler.jsonc):
   ```bash
   npx wrangler d1 create leo-racer-alpha
   npm run db:migrate:remote
   ```
2. Set secrets. They are Worker-side only and never go in `VITE_*` variables:
   ```bash
   npx wrangler secret put ALPHA_ACCESS_TOKEN   # shared code you give to alpha testers
   npx wrangler secret put AI_API_KEY           # only when AI_PROVIDER=openai
   ```
   `AI_PROVIDER` and `AI_MONTHLY_LIMIT` are plain vars in `wrangler.jsonc`, or can be set in the dashboard.
3. Connect the private GitHub repo in **Cloudflare dashboard → Workers & Pages → leo-racer-alpha → Settings → Builds**:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Non-production branch deploy command: `npx wrangler versions upload`. This gives each PR a preview URL.
   - Production branch: `main`

After that, merging to `main` builds and deploys automatically ([spec §42](task.md)).
[.github/workflows/ci.yml](.github/workflows/ci.yml) runs typecheck, lint and unit tests on every PR.

## Implementation gate

The spec says **not to start AI work until M1–M3 have been tested with a real child and a real Logitech MOMO**.
The AI path is implemented behind a provider abstraction, but it defaults to `mock`.
Switch `AI_PROVIDER` to `openai` only after that gate is passed. See [docs/hardware-testing.md](docs/hardware-testing.md).

## Privacy

No accounts, analytics, ads or child data. Drawings live only in the browser (IndexedDB).
The AI endpoint receives a resized, metadata-free copy of a drawing, passes it to the AI provider, and returns the result without storing it.
D1 stores only `(installation_id, period, used)` for the monthly quota. See [docs/ai-processing.md](docs/ai-processing.md).
