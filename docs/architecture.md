# Architecture

Leo Racer is three independent layers, plus a small session layer, wired together in [`src/game/Game.ts`](../src/game/Game.ts):

```text
DRIVE    keyboard / gamepad / tilt / touch ─► InputManager (steering -1..1 · brake · horn)
                                                   │
                                     SteeringMixer ◄─ Autopilot
                                                   ▼
                                           VehicleController
WORLD    WorldPreset ─► WorldManager ─► RoadGenerator · ChunkManager · ObjectSpawner · TrafficManager
CREATE   file ─► DrawingProcessor ─► Worker /api ─► DrawingManager (IndexedDB) ─► DrawingSpriteLayer
SESSION  SessionManager (play-time limit) ─► gentle ending: autopilot pulls over, cruise speed → 0
```

Each boundary is deliberately narrow:

| Boundary                 | Contract                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| Input → driving          | `getSteering(): number` (-1 left … +1 right), `isBraking()`, horn event, plus `isHeldActive()` |
| Driving → world          | `progress` along the road and `lateralOffset` from the centre line |
| Drawings → world         | `SpriteSource { id, image, moves, frequency }` and a `RoadPath.point(s, d)` |
| Session → driving        | `VehicleController.setCruiseScale()` and the autopilot `pullOver` input; global config is never mutated |
| Frontend → AI            | `POST /api/v1/drawings/process` → image + `X-Leo-Can-Move` / `X-Leo-Confidence` |
| Worker → AI vendor       | `DrawingAIProvider.process(image, { mimeType })`                  |

So a new wheel, a new world, or a new AI vendor each touches only one layer.

## DRIVE

- **KeyboardSteering** ([`src/input/KeyboardInput.ts`](../src/input/KeyboardInput.ts)) is a pure virtual-steering model.
  Holding a key ramps to ±1 over `rampUpMs` (420 ms). Releasing returns to 0 over `returnMs` (320 ms). Both keys together cancel.
- **GamepadInput** polls `navigator.getGamepads()`. It uses axis 0 until calibrated, then the calibrated axis with min/center/max, invert and deadzone.
  There are no device-specific assumptions. Any button honks.
- **CalibrationRecorder** records every axis while the parent turns the wheel and picks the widest range.
  A second step ("turn RIGHT and hold") sets `invertAxis`. The result is saved in `localStorage` (`leo.settings`).
- **TiltInput** ([`src/input/TiltInput.ts`](../src/input/TiltInput.ts)) uses DeviceOrientation.
  - It turns β/γ into the gravity direction in screen coordinates for portrait, landscape-left and landscape-right, then takes the tilt angle in the screen plane (clockwise = right).
  - Dead zone ±4°, full lock ±28°, low-pass smoothing. The orientation at START (or "Recenter") is straight ahead.
  - On iOS, permission is requested inside the START click. If tilt is unavailable, nothing breaks.
- **TouchBrake**: any pointer pressed in the bottom 28% of the canvas brakes; releasing every pointer lets go. It is multi-touch safe.
- **InputManager** picks whichever steering device was touched most recently. Tilt needs a bigger change (0.05) to take over. Brake is the OR of keyboard and touch.
- **SteeringMixer** does the manual ↔ autopilot hand-over:
  - Activity is measured against the value at the last detected activity (an anchor), not frame to frame. A slow, steady turn accumulates and is detected; jitter around a resting position is not.
  - A change greater than `INPUT_ACTIVITY_THRESHOLD` (0.03), or a held key or brake, switches to manual instantly.
  - After `MANUAL_IDLE_TIMEOUT_MS` (8000) with no activity, autopilot blends in over 1 s.
  - A wheel held still at full lock counts as idle by design, so old-wheel jitter or a resting hand never blocks autopilot.
- **Autopilot** has a target offset built from two slow sinusoids plus a lean into upcoming curvature.
  It follows that target with a PD controller and a slew-rate limit, so the steering is never random or abrupt.
- **VehicleController** is a kinematic model with no physics engine. It cruises at 8.3 m/s (~30 km/h) × a runtime `cruiseScale`.
  Holding the brake (`↓`/`S` or the touch zone) eases it to a stop at 6 m/s², and releasing picks up again at 3 m/s².
  Sideways motion scales with speed, so a stopped bus can't slide. A held brake counts as manual activity, so autopilot won't take over during a stop.
  Beyond `softLimit` (2.4 m), outward motion fades and a spring pulls the bus back. `hardLimit` (3.3 m) is a clamp.
  Garbage input (NaN, huge dt) is sanitised. The bus cannot stop, leave the road, crash or roll over.

All tunables live in [`src/game/config.ts`](../src/game/config.ts).

## WORLD

- **WorldPreset** ([`src/world/presets/types.ts`](../src/world/presets/types.ts)) is pure data: sky, terrain, road, props, traffic, audio.
  A new world is a new file in `presets/` plus a registry entry.
  New prop models go into the prop library ([`src/world/props.ts`](../src/world/props.ts)).
- **RoadGenerator** is a stateless infinite centre line (a sum of sinusoids along X, with forward = −Z).
  It provides a frame (forward/right vectors) and signed curvature.
- **ChunkManager** keeps a fixed pool of 9 road chunks (6 ahead, 2 behind, plus current).
  Passed chunks are reassigned ahead and their vertex buffers rewritten in place. It never allocates new meshes.
- **ObjectSpawner** creates one `InstancedMesh` per prop kind, so each kind is one draw call.
  - Every chunk slot owns a fixed range of instances. Placement is deterministic per chunk index.
  - Props can be limited to one side of the road (e.g. no trees in the sea) and can carry per-instance colour tints, e.g. for houses and cars.
- **Animated parts** are declared as data in the prop library: `spin`, `swing`, `blink` (kept < 3 Hz), `cycle` and `slide`.
  `slide` is a conveyor loop: N copies one step apart, so gondola cabins glide endlessly between the stations.
  Examples: crane jibs, windmill blades, excavator booms, dump-truck beds, tree crowns, barrier beacons, traffic lights.
  Each part is its own `InstancedMesh`; only placed instances are updated each frame.
- **Ground bands** are coloured strips that follow the road (sea and beach, crop fields, sidewalks). They are rebuilt in place with each chunk.
- **Hills/mountains** take height and width ranges and optional snow caps from the preset.
- **TrafficManager** ([`src/traffic/`](../src/traffic/)) keeps a fixed pool of 8 vehicles.
  - They drive in their lanes: same direction ahead of the bus at +1.8 m, or oncoming at −1.8 m.
  - When the bus approaches, each one makes way via [`laneAvoidance.ts`](../src/world/laneAvoidance.ts): its own shoulder first, otherwise the other side.
  - There are no collisions. As a last resort an overlapping NPC is recycled.
  - Parent density setting: Off, Low, Normal or Busy.
- **World switching** saves `worldId` and reloads the page rather than hot-swapping Three.js resources.
- **Toy style:** all models share rounded or chamfered shapes and common parts from [`toyParts.ts`](../src/world/toyParts.ts) (wheels with rims, lights, framed glass).
  Instanced props use a 44-triangle chamfer box; only hero silhouettes (bus, car bodies) use smooth rounding.
- **Landmarks** (`every: { chunks, offset }` on a prop spec) are placed exactly once in every N-th chunk instead of being picked at random, so a big building shows up now and then.
- **Skyline:** an optional ring of distant tower silhouettes that follows the bus like the hills, on one or both sides.
- **Guideway** ([`Guideway.ts`](../src/world/Guideway.ts)): an optional elevated rail along the road, with a train that overtakes the bus or comes the other way.
  The beam is one mesh rewritten per chunk slot; columns and train cars are instanced.
- **Worlds:** Construction, Nature, Farm, City.
  - Nature is a coastal mountain road. Now and then a small mountain with a gondola appears behind the forest.
  - City is Vancouver-inspired and simplified: glass towers, a seawall along False Creek, a SkyTrain line, cherry blossoms, and landmarks (a geodesic science dome, a sail-roofed pier, a lookout tower, the steam clock).
  - Worlds differ only in preset data. There is no `if (world === …)` anywhere in the engine.
- Terrain is a single plane that follows the bus while its texture stays fixed in world space.
  The sky dome and horizon hills also follow the bus.
- Performance: pixel ratio is capped at 1.5, there are no real-time shadows (a blob shadow sits under the bus), and props are low-poly vertex-coloured.
  Measured with busy traffic: about 40–56 draw calls and 70k–145k triangles per frame, depending on the world. Diagnostics shows both.

## CREATE

1. **Preprocess** ([`DrawingProcessor.ts`](../src/drawings/DrawingProcessor.ts)): `createImageBitmap(file, { imageOrientation: 'from-image' })`, then resize so the longest side is ≤ 1536 px, redraw on a canvas, and encode WebP.
   The original photo and its EXIF metadata never leave the device.
2. **Worker** ([`worker/routes/processDrawing.ts`](../worker/routes/processDrawing.ts)):
   1. Check the alpha token.
   2. Validate the upload.
   3. Atomically reserve quota in D1.
   4. Call the provider.
   5. Return the image with metadata in headers. On AI failure the reserved quota is refunded.
3. **DrawingManager** stores `customAssets` in IndexedDB: `id, createdAt, processedImage, canMove, manualOverride, version, frequency`.
4. **DrawingSpriteLayer** renders billboards with `THREE.Sprite`:
   - Static drawings stand beside the road.
   - Moving drawings use a roadside pattern (`sameDirection`, `oppositeDirection`, `parallelFar`, `crossingFar`) or, 45% of the time, a lane pattern (`laneSameDirection`, `laneOppositeDirection`). Lane drawings make way for the bus like traffic does.
   - The parent's MOVES/STAYS choice overrides the AI result.
   - **Frequency:** Rare, Normal or Often sets a weighted pick. The same drawing is not shown twice in a row.
   - Every appearance is counted as an impression in the local diagnostics.

The AI never produces movement code. It only answers `canMove`.

## Failure isolation

The game core is fully client-side.
Network, AI, D1 or storage failures only affect the Parent Menu dialogs: they offer **TRY AGAIN** or **USE ORIGINAL** and never interrupt the drive.
The render loop catches per-frame exceptions and keeps going.

## SESSION

- **SessionManager** ([`src/session/`](../src/session/)) is a pure state machine: `idle → running → ending → finished`.
  - Time only counts while simulating, so Parent Menu time never counts.
  - The limit can change mid-session.
- **Gentle ending** runs over 25 s by default:
  1. Autopilot is forced, and the child's steering and brake are ignored; the horn still works.
  2. The bus pulls over to the right shoulder.
  3. The cruise speed eases to 0, and the engine fades.
  4. The calm "ALL DONE!" screen fades in.
- **Restart** requires a parent: hold `Esc` (or the corner) → **Start another session**.
