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

## Wheel gears

- **Calibrate Wheel → Assign gear buttons**: press gear up, release, then press a different button for gear down. The bindings must persist after reload and steering/pedal recalibration.
- Defaults are Gamepad API button indices 5 (up) and 4 (down). Reserved shift buttons must not honk; other wheel buttons still honk.
- Each press changes one gear; holding, reconnecting with a button held, or pressing both shift buttons together must not repeatedly shift.
- A new session starts in gear 3. Repeated downshifts stop at gear 1; repeated upshifts stop at gear 5.
- Base speed factors are 0.65 / 0.85 / 1 / 1.2 / 1.45. Engine pitch factors are 1.45 / 1.2 / 1 / 0.84 / 0.72. Speed changes smoothly, and an upshift audibly lowers the engine tone.
- Gas applies 1.5×–3× to the selected base speed. Brake must still stop the bus; shifts during the session ending must not change gear or prevent stopping.
- Diagnostics shows the current gear and its unboosted cruising speed.

## Browser haptic feedback

- Diagnostics → **vibration** reports `available`, `unsupported`, or `unavailable` (the actuator rejected an effect).
- In **Calibrate Wheel**, use **Test vibration** for one short impulse.
- If supported, touching traffic or a moving drawing in a road lane produces a short impulse. Ordinary despawning must not.
- While driving, steer outward at either road boundary: gentle pulses repeat and grow towards the hard boundary. Steering inward, driving near the centre, or standing still must not trigger road pulses.
- Opening Parent Menu, changing tab, losing focus, finishing a session, or disconnecting the wheel must stop the feedback. Returning to the game must allow feedback again.
- This uses Gamepad API `dual-rumble`. It does not implement directional wheel torque. A force-feedback wheel whose driver exposes no browser vibration needs a native Windows bridge.

## Wheel pedals

- Hold `Esc` for 2 seconds, open **Calibrate Wheel**, and calibrate steering with both pedals released.
- In the pedal step, release both pedals and click **Pedals released — Next**. Fully press only the brake, hold it, and click **Save brake pedal**.
- Check the live brake percentage: released = 0%, fully pressed = 100%. Pressing only the accelerator must not brake.
- Use **Calibrate accelerator pedal**, release both pedals, continue, then hold only the accelerator fully pressed and save it. Released = 0%, fully pressed = 100%.
- In game, the accelerator varies speed linearly from 1.5× at the start of active travel to 3× at full press. The first 10% ignores jitter; released = normal speed. Holding `↑` / `W` requests 3× regardless of pedal position. Release to return to normal cruising speed. Holding the brake must stop the bus even while accelerating; releasing both must resume normal driving.
- Pressing gas or `↑` / `W` must produce an immediate, distinct rising engine sound. Stronger pedal pressure makes it louder and higher; releasing fades it out. Mute and the session ending must still silence it.
- Holding the accelerator during the session ending must not prevent the bus from stopping.
- Test disconnecting while braking: pedal braking must release. Reconnect the same wheel and check that the saved calibration still works.
- Test both separate and combined pedal modes. Recalibrate after changing driver mode.
- Diagnostics shows **all axes** and **brake pedal**. If Windows sees a pedal but no browser axis changes, check the driver/device mode; calibration requires an axis exposed to the browser.
- Existing steering-only calibrations remain valid. Use **Calibrate brake pedal** after wheel calibration to add or update the pedal.
- Saved pedal calibration is the default for the same wheel after reload. Recalibrating steering must preserve both pedals. **Reset calibration** explicitly clears the saved default.

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

## Six horn sounds

Keyboard gears: **Left Shift** shifts down, **Right Shift** shifts up. Each press changes one gear; holding Shift does not repeat. The cartoon gear number appears on each successful shift. Shifting is ignored in the parent menu and during the session ending.

While driving, press keyboard **1–6** (top row or numpad) to test: double beep, truck horn, bicycle bell, happy melody, high-low horn, and cartoon toot. **Space / H** plays the first sound.

On the wheel, the first six buttons not assigned to either gear set play sounds 1–6 in button-number order. Gear buttons remain reserved for shifting. Additional buttons repeat the six sounds. Hold a button to check that it only triggers once; release and press again to replay. Test with sound enabled and the parent menu closed.

## Night City

Select City in either world picker. Check the blue night sky, full moon and stars, dark False Creek water and mountain silhouettes, warm/cool tower windows, shop-front lights and illuminated Science World, Harbour Centre and steam-clock faces. Lamp pools and the bus headlights should make the road and markings easy to read; there should be no strobing. SkyTrain windows must follow their cars and disappear with them. Drive through multiple recycled chunks: light pools must remain aligned under the street lamps and no lights should accumulate. Pause/resume, then switch to Farm and back through the Parent Menu; the world change should resume driving immediately, and Farm should keep its daytime lighting. Reload must retain City and the night thumbnail. Check desktop and phone views with normal traffic.

## Sea to Sky steam freight

Sea to Sky has a ground-level railway on the forest side. A steam locomotive, coal tender, five loaded ore wagons and red caboose pass in alternating directions. Check the first approaching train soon after entering Sea to Sky, then a following train after another 14–24 seconds between trains. Wheels, connecting rods and chimney steam should animate; opening the parent menu pauses them. Track and cars should follow the road curves and remain clear of rocks, trees and the driving corridor.

The models are a fictional early twentieth-century BC freight train, inspired by the region's railway and mining history. Historical references: [Railway Museum of BC's 1910 PGE steam locomotive](https://www.wcra.org/exhibit/pacific-great-eastern-2-6-2st/) and [Britannia Mine Museum's historical FAQs](https://www.britanniaminemuseum.ca/pages/historical-faqs). This is a visual homage rather than a reconstruction of Britannia's ore transportation route.

## Construction pipe installation

An excavation site appears on the left around 120–160 m into Construction, then every 320 m. Check that the blue main sits below ground, with soil walls, timber shoring and an open working end under the excavator bucket. Spare pipes, spoil piles and red/white guards sit outside the trench. Drive past several sites: recycled chunks must restore the ground without leaving holes in unrelated places. Other roadside machinery should not spawn in the excavation.

## Nature forest and wildlife crossings

Nature is a separate Banff-inspired forest world. Confirm all six location cards appear in both menus, and that an old saved coastal Nature selection upgrades to Sea to Sky. Nature has forest on both sides, snowy Rockies, elk, moose, bears, bighorn sheep and wolves. Animals stand outside the driving corridor and turn their heads gently. A grass-covered overpass appears around 80–120 m, repeating every 320 m; the bus passes underneath while an elk walks across the top. Trees must not block the bridge portal or ramps. Parent-menu pause must also pause the crossing animal.

## Winter ski village

Santa's red sleigh first appears after about 4 seconds of driving, crosses the road ahead over 12 seconds, then returns from the other side after a 25–40 second break. Check four galloping reindeer (one with a red nose), presents, curved gold runners and Santa waving. The flight clears the ski village and remains ahead at normal or boosted speed. Parent-menu pause must freeze the sleigh, waving hand and reindeer legs; resume must continue the same flight.

Select Winter on the entrance screen, then drive past the ski slope on the right (around 40–80 m), skating pond on the left (160–200 m), and sled hill on the right (280–320 m). These scenes repeat every 400 m. Skiers descend on the snow, open chairs carry passengers up and down the cables, and skaters follow loops on the ice. Forest props must leave the scenes clear, and the road must stay open. Check warm chalet windows, chimney smoke, snowmen, snow forts, foxes and white hares. At Normal traffic density, look for an orange snowplow with a wide blade and pickups with roof-mounted skis; other cars must leave enough room for the blade. Opening the Parent Menu must pause snow and all moving scenes. Changing to Winter there must resume driving directly. Reloading must keep Winter selected, and all six cards plus START must fit on desktop and phone screens.

Design reference: [Parks Canada on Banff wildlife crossings](https://www.parks.canada.ca/nature/science/especes-species/routes-roads?wbdisable=true). The world uses original toy models inspired by the park, with no attempt to recreate a specific road or exact bridge.

## Autumn Farm harvest

A harvest ride appears on the right around 120–160 m and repeats every 240 m. Look for an open-cab green tractor with a driver and three colourful wagons carrying visitors in autumn jackets and hats. The train follows a dirt oval slowly (one lap in 50 seconds); wagons must follow its turns, drawbars must remain connected, and the entire ride must stay outside the driving corridor. Hay bales, pumpkins and bunting decorate the middle of the oval. Random props must stay out of the ride field, including its edges in neighbouring chunks. The Parent Menu must pause the whole ride; resuming continues smoothly. Verify it remains visible with regular traffic enabled.

The yellow crop-duster biplane first begins its flypast after about 5 seconds, flies diagonally across the road for 14 seconds, and returns from the other side after a 28–43 second break. Check both wings with red tips, the glazed cabin, wheels and spinning nose propeller. The entire plane must clear barns, silos, windmills and trees, and the crossing should be visible ahead at cruise or boosted speed. Opening the Parent Menu must freeze both flight and propeller; resuming must continue the flight.

Farm keeps its existing saved selection and dirt-road driving behavior. Check the warm sky, gold/olive harvested fields, orange/red trees, leaf piles and roadside pumpkin clusters. A pumpkin patch appears on the right around 40–80 m, with four rows of six pumpkins, vines, a pumpkin entry emblem, bunting, hay bales and a friendly scarecrow. A striped harvest stand appears on the left around 160–200 m, with pumpkins, apples and pears. Both repeat every 240 m. Cows, sheep, barns, silos, tractors and windmills still appear. Random props must stay out of the field and stand, the fence must leave their frontage visible, and the road must remain clear. Check the updated Farm thumbnail in both location pickers and on reload.
