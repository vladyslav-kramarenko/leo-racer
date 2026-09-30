# Architecture

Leo Racer is three independent layers wired together in [`src/game/Game.ts`](../src/game/Game.ts):

```text
DRIVE   keyboard / gamepad / wheel ─► InputManager (-1..1) ─► SteeringMixer ◄─ Autopilot
                                                                │
                                                                ▼
                                                        VehicleController
WORLD   WorldPreset ─► WorldManager ─► RoadGenerator · ChunkManager · ObjectSpawner
CREATE  file ─► DrawingProcessor ─► Worker /api ─► DrawingManager (IndexedDB) ─► DrawingSpriteLayer
```

Each boundary is deliberately narrow:

| Boundary                 | Contract                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| Input → driving          | `getSteering(): number` (-1 left … +1 right), plus `isHeldActive()` |
| Driving → world          | `progress` along the road and `lateralOffset` from the centre line |
| Drawings → world         | `SpriteSource { id, image, moves }` and a `RoadPath.point(s, d)`  |
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
- **InputManager** picks whichever device was touched most recently.
- **SteeringMixer** does the manual ↔ autopilot hand-over:
  - A change greater than `INPUT_ACTIVITY_THRESHOLD` (0.03), or a held key, switches to manual instantly.
  - After `MANUAL_IDLE_TIMEOUT_MS` (8000) with no activity, autopilot blends in over 1 s.
  - A wheel held still at full lock counts as idle by design, so old-wheel jitter or a resting hand never blocks autopilot.
- **Autopilot** has a target offset built from two slow sinusoids plus a lean into upcoming curvature.
  It follows that target with a PD controller and a slew-rate limit, so the steering is never random or abrupt.
- **VehicleController** is a kinematic model with no physics engine. It cruises at a constant 7.5 m/s (~27 km/h).
  Holding the brake (`↓`/`S`) eases it to a stop at 6 m/s², and releasing picks up again at 3 m/s².
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
  Every chunk slot owns a fixed range of instances. Placement is deterministic per chunk index.
- Terrain is a single plane that follows the bus while its texture stays fixed in world space.
  The sky dome and horizon hills also follow the bus.
- Performance: pixel ratio is capped at 1.5, there are no real-time shadows (a blob shadow sits under the bus), and props are low-poly vertex-coloured.
  A frame is roughly 25 draw calls.

## CREATE

1. **Preprocess** ([`DrawingProcessor.ts`](../src/drawings/DrawingProcessor.ts)): `createImageBitmap(file, { imageOrientation: 'from-image' })`, then resize so the longest side is ≤ 1536 px, redraw on a canvas, and encode WebP.
   The original photo and its EXIF metadata never leave the device.
2. **Worker** ([`worker/routes/processDrawing.ts`](../worker/routes/processDrawing.ts)):
   1. Check the alpha token.
   2. Validate the upload.
   3. Atomically reserve quota in D1.
   4. Call the provider.
   5. Return the image with metadata in headers. On AI failure the reserved quota is refunded.
3. **DrawingManager** stores `customAssets` in IndexedDB: `id, createdAt, processedImage, canMove, manualOverride, version`.
4. **DrawingSpriteLayer** renders billboards with `THREE.Sprite`:
   - Static drawings stand beside the road.
   - Moving drawings use one of `sameDirection`, `oppositeDirection`, `parallelFar` or `crossingFar`.
   - The parent's MOVES/STAYS choice overrides the AI result.

The AI never produces movement code. It only answers `canMove`.

## Failure isolation

The game core is fully client-side.
Network, AI, D1 or storage failures only affect the Parent Menu dialogs: they offer **TRY AGAIN** or **USE ORIGINAL** and never interrupt the drive.
The render loop catches per-frame exceptions and keeps going.
