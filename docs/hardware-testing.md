# Hardware testing checklist

Primary device: **Surface Book 3 + Chromium-based browser (Edge or Chrome)**. Primary wheel: **Logitech MOMO Racing**.

Open the Parent Menu (hold `Esc` for 2 s) → Diagnostics → Overlay: **Shown** to watch the live values while testing.

## Logitech MOMO

| # | Check | How | Pass |
|---|-------|-----|------|
| 1 | MOMO detected | Plug in, turn the wheel once. Diagnostics shows the gamepad id | ☐ |
| 2 | Calibration finds the right axis | Parent Menu → Calibrate Wheel → turn fully left/right. The highlighted axis is the wheel, not a pedal | ☐ |
| 3 | Direction is correct | Calibration step 2 ("turn RIGHT and hold"), then in game: turning right moves the bus right | ☐ |
| 4 | Full left/right normalise | Diagnostics "normalized" reaches −1.000 and +1.000 at the stops, and 0.000 at rest | ☐ |
| 5 | Jitter does not block autopilot | Let go of the wheel. Within ~8 s the mode shows `autopilot` and stays there | ☐ |
| 6 | Wheel held at full lock | Hold the wheel fully turned without moving it. Autopilot returns after ~8 s and the bus stays on the road | ☐ |
| 7 | Instant takeover | Any wheel movement during autopilot → mode `manual` immediately | ☐ |
| 8 | Horn | A wheel button honks | ☐ |
| 9 | Disconnect does not crash | Unplug while driving. The bus keeps driving on autopilot | ☐ |
| 10 | Reconnect works | Plug back in and turn. Steering works again with the saved calibration | ☐ |

## Tablet (tilt + touch brake)

| # | Check | How | Pass |
|---|-------|-----|------|
| 1 | Tilt starts automatically | On a tablet, press START (iOS: allow motion access) | ☐ |
| 2 | Direction is correct in **both** landscape orientations | Turn the tablet like a wheel to the right. The bus goes right. Rotate the tablet 180° and repeat | ☐ |
| 3 | Straight ahead at rest | Hold still. Diagnostics shows `tilt ~0°`, and autopilot returns after ~8 s | ☐ |
| 4 | Recenter works | Hold the tablet at an angle → Parent Menu → Recenter Tilt Steering | ☐ |
| 5 | Invert fallback | If a device steers the wrong way: Parent Menu → Invert tilt | ☐ |
| 6 | Touch brake | Press the bottom of the screen. The bus stops, a red brake sign shows, the tail lights flash | ☐ |
| 7 | Multi-touch | Two fingers on the brake, lift one: still braking. Lift both: drives on | ☐ |
| 8 | No accidental Parent Menu | Taps around the screen don't open it; only a 2 s long-press in the top-left corner does | ☐ |

## Child test (2–4 years)

| # | Check | Pass |
|---|-------|------|
| 1 | The child understands they are driving within a minute | ☐ |
| 2 | Full lock for a minute, releasing, mashing keys → no crash, no stop, no reset | ☐ |
| 3 | Camera motion is comfortable (no complaints, no motion discomfort) | ☐ |
| 4 | The child does not reach the Parent Menu by accident | ☐ |
| 5 | Sound volume is pleasant | ☐ |
| 6 | Session ending (e.g. 5 min) feels calm; the child cannot restart it alone | ☐ |

## Performance

| Check | Target | Result |
|-------|--------|--------|
| FPS on Surface Book 3 (diagnostics) | ≥ 60 preferred, ≥ 30 minimum | |
| FPS on an older laptop (5–7 years) | ≥ 30 | |
| Draw calls / triangles (diagnostics) | ≤ 60 / ≤ 150k (measured 40–56 / 70k–145k, busy traffic) | |
| FPS on a tablet with busy traffic | ≥ 30 | |

## Known browser caveats

- Browsers only expose a gamepad after the first button press or axis movement on that page.
- In fullscreen, a single `Esc` press exits fullscreen (browser behaviour). Hold `Esc` again to open the Parent Menu.
- Chrome may only report some wheels with a limited axis range until the vendor driver (Logitech G HUB / Gaming Software) is installed.
  Calibration handles any range ≥ 0.3.
