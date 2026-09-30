# Leo Racer — Technical Specification, MVP Alpha

## 1. Product Goal

**Leo Racer** is a browser-based driving toy for young children.

Primary interaction:

> Open the page → the vehicle is already driving → the child turns a physical steering wheel or presses arrow keys → control is immediately handed to the child → after several seconds without steering input, autopilot smoothly resumes.

The child cannot lose.

Secondary core interaction:

> A parent uploads a child’s drawing → AI cleans the image and determines `canMove` → the drawing appears in the game world as either a static or moving object.

### Primary audience

Primary MVP audience: **ages 2–4**.

Children ages 5–7 are useful as an additional test group, but requests from older children for missions, scoring, racing, progression, etc. must **not change the core MVP UX**.

---

## 2. MVP Scope

The MVP includes:

1. One endless 3D world: **Construction**.
2. One player vehicle: **yellow school bus**.
3. Automatic forward movement.
4. Keyboard steering.
5. Gamepad / steering-wheel steering using the Gamepad API.
6. Automatic switching between manual steering and autopilot.
7. Impossible-to-fail driving.
8. Basic sound.
9. Parent menu.
10. User drawing upload.
11. AI drawing processing.
12. Static and moving custom sprites.
13. Local persistence via IndexedDB.
14. Cloudflare deployment.
15. D1 used only for AI quota/usage.
16. Private GitHub repository during alpha.
17. Automatic deployment from `main`.
18. Preview deployment for pull requests.

The MVP does **not** include:

- City / Farm / Nature worlds
- phone → TV QR workflow
- user accounts
- cloud sync for drawings
- R2
- multiplayer
- scoring
- missions
- traffic rules
- realistic collisions
- physics engine
- pedals
- gear shifting
- touch driving
- payments/subscriptions
- public gallery
- AI-generated 3D models
- child profiles
- native mobile applications

---

## 3. Technology Stack

Recommended stack:

```text
TypeScript
Vite
Three.js
Cloudflare Vite Plugin
Cloudflare Workers
Cloudflare Workers Static Assets
Cloudflare D1
IndexedDB
Vitest
Playwright
GitHub
VS Code
npm
```

### React

Do **not** use React for the MVP.

The UI is intentionally small. Most interaction happens inside Three.js. Parent-facing controls can be implemented with regular HTML, CSS, and TypeScript.

If the UI grows substantially later, React can be introduced then.

---

## 4. Repository

Private GitHub repository:

```text
leo-racer
```

Suggested structure:

```text
leo-racer/
│
├── src/
│   ├── main.ts
│   │
│   ├── game/
│   │   ├── Game.ts
│   │   ├── GameLoop.ts
│   │   ├── SceneManager.ts
│   │   └── config.ts
│   │
│   ├── input/
│   │   ├── InputManager.ts
│   │   ├── KeyboardInput.ts
│   │   ├── GamepadInput.ts
│   │   └── SteeringState.ts
│   │
│   ├── driving/
│   │   ├── VehicleController.ts
│   │   ├── Autopilot.ts
│   │   └── SteeringMixer.ts
│   │
│   ├── world/
│   │   ├── WorldManager.ts
│   │   ├── RoadGenerator.ts
│   │   ├── ChunkManager.ts
│   │   ├── ObjectSpawner.ts
│   │   └── presets/
│   │       └── construction.ts
│   │
│   ├── vehicle/
│   │   ├── Bus.ts
│   │   └── VehicleModel.ts
│   │
│   ├── drawings/
│   │   ├── DrawingManager.ts
│   │   ├── DrawingProcessor.ts
│   │   ├── DrawingSprite.ts
│   │   └── DrawingStorage.ts
│   │
│   ├── storage/
│   │   ├── database.ts
│   │   └── settings.ts
│   │
│   ├── audio/
│   │   └── AudioManager.ts
│   │
│   └── ui/
│       ├── StartScreen.ts
│       ├── ParentMenu.ts
│       ├── WheelSetup.ts
│       └── DrawingDialog.ts
│
├── worker/
│   ├── index.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── processDrawing.ts
│   │   └── usage.ts
│   ├── ai/
│   │   ├── DrawingAI.ts
│   │   └── providers/
│   └── db/
│       └── usageRepository.ts
│
├── migrations/
│   └── 0001_initial.sql
│
├── public/
│   ├── models/
│   ├── textures/
│   ├── sounds/
│   └── icons/
│
├── tests/
│
├── docs/
│   ├── architecture.md
│   ├── ai-processing.md
│   └── hardware-testing.md
│
├── .github/
│   └── workflows/
│
├── wrangler.jsonc
├── vite.config.ts
├── package.json
├── tsconfig.json
├── README.md
├── THIRD_PARTY_NOTICES.md
└── .gitignore
```

---

## 5. Application Architecture

```text
                        ┌───────────────┐
                        │   Keyboard    │
                        └───────┬───────┘
                                │
                        ┌───────▼───────┐
                        │   Gamepad     │
                        │ / wheel API   │
                        └───────┬───────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  InputManager   │
                       │ normalized -1..1│
                       └────────┬────────┘
                                │
                   ┌────────────▼────────────┐
                   │     SteeringMixer       │
                   │                         │
                   │ manual ↔ autopilot      │
                   └────────────┬────────────┘
                                │
                                ▼
                       VehicleController
                                │
                                ▼
                     Endless Road / World
```

Key principle:

The game world must not know which physical input device is being used.

The input interface exposes only:

```ts
getSteering(): number
```

where:

```text
-1 = full left
 0 = center
+1 = full right
```

This allows later support for:

- Xbox controllers
- Logitech G29
- Thrustmaster wheels
- touch controls
- phone tilt controls

without changing the driving or world logic.

---

## 6. Startup UX

After loading:

```text
LEO RACER

[ START DRIVING ]
```

No login, no world selector, no instruction screens.

After pressing `START DRIVING`:

- audio may start
- fullscreen may be offered, but not required
- vehicle starts moving
- autopilot is initially active

The in-game screen should contain **no persistent child-facing UI**.

---

## 7. Keyboard Input

Required mappings:

```text
←  = steer left
→  = steer right

A  = steer left
D  = steer right
```

Keyboard steering must be smoothed.

Do not jump instantly from:

```text
0 → +1
```

Instead use virtual steering, for example:

```text
0
0.2
0.4
0.6
0.8
1.0
```

over approximately **350–500 ms** while holding a key.

After release, steering returns to center over approximately **250–400 ms**.

All timing values must be configurable.

---

## 8. Steering Wheel / Gamepad API

Use the browser Gamepad API.

Primary MVP hardware:

**Logitech MOMO Racing Wheel**

However, the code must not contain wheel-specific assumptions except optional device profiles.

### Detection

Use:

```js
navigator.getGamepads()
```

Track:

- `gamepad.id`
- axes
- buttons
- index

### Calibration

Parent Menu action:

```text
Calibrate Wheel
```

Prompt:

```text
Turn the wheel left and right.
```

During calibration, observe all axes and select the axis with the largest measured movement range.

Store:

```text
gamepad.id
steeringAxis
invertAxis
min
center
max
deadzone
```

in local storage / IndexedDB.

### Default fallback

Before calibration:

```text
axis 0
```

may be used as a default assumption.

### Dead zone

Initial default:

```text
0.04
```

Small wheel jitter must not count as human input.

---

## 9. Manual / Autopilot Behaviour

Do **not** expose separate `DRIVE` and `DEMO` buttons.

The experience is continuous.

Initial state:

```text
autopilot
```

Any meaningful steering activity immediately switches to:

```text
manual
```

After no meaningful steering activity for:

```text
8 seconds
```

the system transitions back to autopilot.

Config value:

```ts
MANUAL_IDLE_TIMEOUT_MS = 8000
```

### Human input detection

Only count input activity when:

```text
abs(currentSteering - previousSteering) > INPUT_ACTIVITY_THRESHOLD
```

Suggested initial value:

```text
0.03
```

This prevents old-wheel axis jitter from blocking autopilot.

### Transition timing

Manual takeover:

```text
<100 ms perceived latency
```

Autopilot takeover:

Smoothly blend over approximately:

```text
1 second
```

Example:

```text
manual = 1.0
autopilot = 0.0

↓

manual = 0.7
autopilot = 0.3

↓

manual = 0.0
autopilot = 1.0
```

---

## 10. Driving Model

Do **not** use a full physics engine.

Not required:

- Rapier
- Cannon
- realistic tyre physics
- rigid-body collisions

Minimal state:

```text
progressAlongRoad
lateralOffset
steering
speed
```

Forward speed is constant.

Visual target:

```text
20–30 km/h
```

The exact physical value is not important.

Steering affects:

- lateral offset
- slight vehicle yaw
- slight camera response

---

## 11. Impossible-to-Fail Requirement

This is a hard product requirement.

The child may:

- hold the steering wheel fully left
- hold the steering wheel fully right
- keep it turned for one minute
- release the wheel completely
- press left and right together

None of these actions may cause:

- falling
- crashing
- game over
- reset screens
- vehicle rollover
- permanent road departure
- stopped gameplay

Use:

```text
soft lane boundary
+
hard invisible boundary
```

The child should feel that steering matters, while the game quietly keeps the vehicle inside a safe playable corridor.

---

## 12. Autopilot

Autopilot should:

- continue forward
- use road curvature/lookahead
- keep the vehicle near the road center
- gently vary lateral position
- avoid looking perfectly robotic

Do not use abrupt random steering.

Suggested logic:

```text
road lookahead
+
low-frequency sinusoidal lateral variation
```

---

## 13. Construction World

First world preset:

```text
construction
```

Visual direction:

**friendly low-poly / toy-like**

Not realistic simulation.

Suggested props:

- excavator
- dump truck
- crane
- cones
- barriers
- gravel
- construction signs
- unfinished bridge
- pipes
- concrete blocks

The first implementation does not need every prop.

Minimal initial content:

```text
road
terrain
sky
5–7 repeating construction props
school bus
```

---

## 14. World Preset Architecture

Even though MVP has only one world, world configuration must already use a reusable structure.

Example:

```ts
interface WorldPreset {
  id: string;
  sky: unknown;
  terrain: unknown;
  road: unknown;
  props: unknown;
  traffic: unknown;
  audio: unknown;
}
```

Future presets:

```text
construction
nature
city
farm
```

must be addable without changing the core engine.

---

## 15. Endless World

Use chunk recycling.

Example:

```text
6 chunks ahead
2 chunks behind
```

When a chunk is passed:

```text
old chunk
→ recycle
→ move ahead
→ regenerate
```

Do not continuously create new Three.js objects forever.

Use pooling where practical.

---

## 16. Performance Targets

Primary development device:

**Surface Book 3 + Chromium-based browser**

Targets:

```text
60 FPS preferred
30 FPS minimum
```

Target hardware:

Typical laptop from approximately the last **5–7 years**.

Performance requirements:

- cap renderer pixel ratio
- avoid expensive real-time shadows everywhere
- minimize draw calls
- use instancing for repeated objects
- use low-poly assets
- use compressed textures
- reuse/pool objects

The MVP must not require a gaming GPU.

---

## 17. Camera

Third-person camera:

```text
        camera
          ↓
       🚌 bus
          ↓
        road
```

Camera may gently react to steering.

Do not use:

- strong camera shake
- aggressive motion blur
- sudden camera rotation

Visual motion should remain comfortable for young children.

---

## 18. Audio

Minimum audio:

- looping engine sound
- ambient construction/world sound
- horn

If the wheel has a suitable button:

```text
button → horn
```

Parent Menu control:

```text
Sound ON/OFF
```

---

## 19. Parent Menu

Child-facing gameplay should not expose menus.

Open Parent Menu by:

```text
hold ESC for ~2 seconds
```

Later, touch devices can use a hidden long-press corner gesture.

Parent Menu MVP:

```text
Resume

Add Drawing
Manage Drawings

Calibrate Wheel

World
  Construction

Sound
  On / Off

Fullscreen

Diagnostics
```

---

## 20. Draw Your World

This feature is part of the Alpha MVP because it is one of the main product differentiators.

Parent selects:

```text
ADD DRAWING
```

Supported formats:

```text
JPEG
PNG
WebP
```

---

## 21. Client-Side Image Preprocessing

Do not send an original 20 MP photograph directly to the server.

Before upload, the browser should:

1. decode the image
2. correct orientation
3. resize longest side to approximately `1536 px`
4. redraw through Canvas
5. strip EXIF/metadata
6. encode a new image blob

The server should therefore never receive the original source photograph.

Benefits:

- lower privacy risk
- smaller upload
- lower latency
- potentially lower AI processing cost

---

## 22. AI Processing Contract

Frontend calls:

```text
POST /api/v1/drawings/process
```

Request:

```text
multipart/form-data

image=<processed image blob>
installationId=<uuid>
```

The AI operation should conceptually perform:

> Preserve the child’s recognizable drawing and style, remove the background, clean edges, gently correct perspective when useful, and determine whether the depicted object can move by itself.

The AI must **not** redesign the object into a realistic replacement.

Bad:

```text
child drawing
→ photorealistic Lamborghini
```

Desired:

```text
child drawing
→ same child drawing, cleaned
```

---

## 23. AI Result

Minimum metadata:

```json
{
  "canMove": true,
  "confidence": 0.91
}
```

Plus a ready-to-use image:

```text
transparent PNG or WebP
```

Preferred HTTP response:

```text
Content-Type: image/png

X-Leo-Can-Move: true
X-Leo-Confidence: 0.91
```

Avoid Base64 image payloads inside JSON unless technically necessary.

---

## 24. AI Provider Abstraction

Do not couple the game logic directly to any AI provider.

Interface:

```ts
interface DrawingAIProvider {
  process(image: ArrayBuffer): Promise<ProcessedDrawing>;
}
```

Possible worker-side adapters:

```text
OpenAI
Gemini
other provider
```

The frontend must not know which provider is used.

---

## 25. AI Behaviour

If:

```text
canMove = false
```

the object becomes a static roadside sprite.

Examples:

```text
tree
house
cone
flower
```

If:

```text
canMove = true
```

the object becomes a moving sprite.

The engine does **not** need to know whether the object is:

- a car
- a dinosaur
- a dog
- a tractor

For MVP, `canMove` is enough.

---

## 26. Moving Drawing Behaviour

Use predefined movement patterns:

```text
same direction
opposite direction
parallel/far movement
crossing far ahead
```

Randomly select one valid pattern.

AI must never generate runtime movement code.

AI only returns:

```text
canMove
```

---

## 27. Static Drawings

Static drawings:

- appear beside the road
- scale correctly with perspective
- may use billboard orientation toward the camera
- do not participate in collision logic

---

## 28. Manual Classification Override

Parent must be able to change:

```text
MOVES
↔
STAYS
```

AI classification is advisory, not authoritative.

---

## 29. AI Failure Handling

If AI processing fails:

```text
AI processing failed.

[ TRY AGAIN ]
[ USE ORIGINAL ]
```

`USE ORIGINAL` adds the uploaded image as a static sprite.

AI failure must never stop driving gameplay.

---

## 30. Local Storage

User-created drawings are stored locally by default.

Use IndexedDB.

Suggested schema:

```text
customAssets
------------
id
createdAt
processedImage
canMove
manualOverride
version
```

The original uploaded file does not need to be retained.

After page reload, custom drawings must still be available.

---

## 31. Server-Side Image Storage

Do **not** use R2 in MVP.

No cloud storage for user drawings.

Flow:

```text
browser
  ↓
Worker
  ↓
AI provider
  ↓
Worker
  ↓
browser
  ↓
IndexedDB
```

The Worker does not retain the image.

---

## 32. D1

Use D1 only for AI quota tracking.

Database name:

```text
leo-racer-alpha
```

Minimal table:

```sql
CREATE TABLE ai_usage (
    installation_id TEXT NOT NULL,
    period TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (installation_id, period)
);
```

Example period:

```text
2026-09
```

---

## 33. Installation Identity

On first run:

```js
crypto.randomUUID()
```

Store locally as:

```text
leo.installationId
```

Do not collect:

- email
- user name
- child name
- child age
- account data

---

## 34. AI Quota

Environment variable:

```text
AI_MONTHLY_LIMIT
```

Alpha example:

```text
20
```

Do not hardcode the limit in frontend code.

Worker logic:

```text
check D1 usage
↓
if under limit
    process
else
    HTTP 429
```

UI message:

```text
AI drawing limit reached.
```

---

## 35. Privacy

MVP principle:

**Do not collect child data.**

Do not store:

- child names
- ages
- child photos
- video
- microphone input
- location
- advertising identifiers

Parent Menu should contain a short privacy note such as:

> Drawings sent for AI processing are temporarily transmitted to the AI service and are not stored by Leo Racer.

Final wording must match the actual selected AI provider and implementation.

---

## 36. Analytics

Do **not** add:

- Google Analytics
- Meta Pixel
- advertising SDKs

for the alpha.

Collect only local diagnostics:

```text
session duration
manual driving time
autopilot time
time to first input
number of drawings
keyboard/gamepad used
FPS
```

Parent Menu action:

```text
Export diagnostics
```

Output:

```text
JSON download or copy
```

This allows testers to share diagnostic information without child telemetry being sent automatically.

---

## 37. Cloudflare Architecture

```text
                    Cloudflare
                ┌────────────────┐
                │     Worker     │
                │                │
Browser ───────►│ Static Assets  │
                │                │
                │ /api/*         │
                │      │         │
                └──────┼─────────┘
                       │
                 ┌─────▼─────┐
                 │    D1     │
                 └───────────┘

                       │
                       ▼

                External AI API
```

Frontend and Worker should be deployed as one Cloudflare application.

---

## 38. Local Development

Expected workflow:

```bash
git clone <repository>
cd leo-racer

npm install
npm run dev
```

Required scripts:

```text
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run deploy
```

Use the Cloudflare Vite integration for local runtime parity with production.

---

## 39. Secrets

Local secrets:

```text
.dev.vars
```

Must be in `.gitignore`.

Example:

```text
AI_API_KEY=...
AI_PROVIDER=...
AI_MONTHLY_LIMIT=20
```

Production secrets must be stored only in Cloudflare environment settings/secrets.

Never expose AI keys as:

```text
VITE_AI_API_KEY
```

Anything in the frontend bundle must be assumed public.

---

## 40. Private GitHub Clarification

A private repository does **not** make deployed frontend code private.

Browser-delivered JavaScript can always be inspected.

Therefore:

- no secrets in frontend code
- no private API keys in Vite environment variables
- sensitive credentials exist only Worker-side

---

## 41. Git Workflow

Use:

```text
main
  ↑
feature/*
```

Examples:

```text
feature/gamepad
feature/autopilot
feature/drawings
```

Flow:

```text
feature branch
→ PR
→ review/test
→ merge main
```

No `develop` branch is needed for alpha.

---

## 42. CI/CD

Prefer Cloudflare GitHub integration for the initial alpha.

Expected flow:

```text
push feature branch / PR
    ↓
Cloudflare preview
    ↓
test
    ↓
merge main
    ↓
production deploy
```

GitHub Actions can be introduced later if needed.

---

## 43. Environments

Initial environments:

```text
local
alpha
```

### Local

```text
localhost
local D1
mock or real AI
```

### Alpha

Example:

```text
leo-racer-alpha.<workers.dev>
```

A custom domain is not required initially.

Later:

```text
leo-racer.app
```

---

## 44. Alpha Protection

The static game may live on an unadvertised alpha URL.

The AI endpoint should still be protected with at least:

- simple alpha access token
- quota enforcement

Later options:

- Cloudflare Turnstile
- rate limiting
- stronger authentication

---

## 45. Error Handling

Backend failures must never interrupt the driving loop.

Examples:

```text
AI timeout
D1 unavailable
drawing upload failure
network disconnected
```

The driving game must remain functional because the game core is fully client-side.

---

## 46. Offline

Do **not** implement a full PWA/service worker during early alpha.

Reason:

Aggressive service-worker caching can make development and debugging more difficult by serving stale JS/assets.

Add offline/PWA support after the core stabilizes.

---

## 47. Tests

### Unit tests

Required coverage:

```text
keyboard steering smoothing
deadzone
manual activity detection
8-second idle timeout
manual/autopilot blending
lane limits
quota logic
world preset loading
```

### Browser tests

Playwright:

```text
page loads
START works
keyboard steers vehicle
parent menu opens
drawing dialog opens
reload does not crash
```

### Hardware test

Manual checklist:

```text
Logitech MOMO detected
calibration identifies correct axis
full left/right normalize correctly
jitter does not block autopilot
disconnect does not crash
reconnect works
```

---

## 48. Diagnostics

Parent diagnostics should show:

```text
FPS
resolution
devicePixelRatio

input source
gamepad ID
steering axis
raw steering
normalized steering

manual/autopilot state

world chunks
active sprites

app version
```

Debug overlay should only be available from Parent Menu or development mode.

---

## 49. Asset Policy

Use:

- original assets
- permissively licensed assets
- CC0 assets
- MIT-compatible code/resources

If Paper Aquarium code or ideas are directly reused, preserve required MIT attribution/license notices.

Do not copy restricted 3D assets.

Maintain:

```text
THIRD_PARTY_NOTICES.md
```

from the beginning.

---

## 50. Definition of Done — Alpha MVP

### Scenario 1 — Regular Laptop

User opens the alpha URL.

Presses:

```text
START DRIVING
```

The bus starts moving automatically.

`← →` work.

After steering stops, autopilot resumes after approximately 8 seconds.

Any new steering input immediately returns control to the user.

---

### Scenario 2 — Logitech MOMO

Connect MOMO.

Open:

```text
Parent Menu → Calibrate Wheel
```

Turn wheel left and right.

Correct axis is detected.

Bus reacts smoothly and in the correct direction.

After the wheel is inactive for approximately 8 seconds, autopilot resumes.

---

### Scenario 3 — Two-Year-Old Child

The child can:

```text
turn the wheel however they want
```

The child cannot:

```text
lose
crash
fall
stop gameplay
```

---

### Scenario 4 — Drawing

Parent selects:

```text
Add Drawing
```

Then:

```text
select image
→ browser resizes it
→ Worker calls AI
→ cleaned transparent image + canMove returned
→ object appears in the world
```

After refresh, the object remains available.

---

### Scenario 5 — AI Failure

Internet or AI API is unavailable.

Driving continues normally.

Parent can choose:

```text
Retry
```

or:

```text
Use Original
```

---

### Scenario 6 — Deployment

Developer merges a PR into:

```text
main
```

Cloudflare automatically:

```text
builds
deploys
```

The new alpha build becomes available without manual file upload.

---

## 51. Implementation Order

Recommended sequence:

```text
M0
Repository + Vite + Three.js + Cloudflare deploy

M1
Bus + endless road + Construction world

M2
Keyboard + autopilot + impossible-to-fail steering

M3
Gamepad/MOMO + calibration

M4
Parent menu + diagnostics + sound

M5
IndexedDB + Add Drawing UI

M6
Worker + D1 quota + AI provider abstraction

M7
Custom static/moving drawing sprites

M8
Alpha hardening + tests + friends deployment
```

### Gate

Do **not** begin AI implementation until M1–M3 work correctly with:

- a real child
- a real Logitech MOMO wheel

---

## 52. Architectural Principles

Treat Leo Racer as three independent layers:

```text
DRIVE
keyboard / wheel / autopilot

WORLD
Construction / later City / Nature / Farm

CREATE
drawing → AI → sprite
```

These layers should not depend on each other’s internal implementation.

This allows:

- adding a new wheel without changing the world
- adding Farm without changing the input system
- changing AI provider without touching Three.js
- changing the renderer without rewriting quota logic

---

# MVP Product Rule

Every feature should support this core loop:

> The vehicle is always moving.  
> The child can take control at any moment.  
> The child cannot fail.  
> The world can gradually become filled with the child’s own drawings.

Anything that does not strengthen this loop should stay out of the Alpha MVP.