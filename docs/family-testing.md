# Family testing guide

The goal of the alpha is to learn whether the core loop works for real children. Asking "Did they like it?" is not enough.
Use one copy of the sheet below per session. **Do not write children's names anywhere you share.** Use "Child A", "Child B" and so on.

## Before the session

1. Open Leo Racer on the device the family will actually use (laptop, TV + wheel, or tablet).
2. Optional: Parent Menu (hold `Esc` 2 s, or long-press the top-left corner) → **Play time**, e.g. 10 min.
3. Optional: Parent Menu → **Calibrate Wheel** (wheel) or check that tilt is **On** (tablet).
4. Press **START DRIVING** and step back. Don't explain the controls at first.

## Observation sheet

| Field | Notes |
|---|---|
| Child (anonymous) | Child A |
| Child age | e.g. 3 y |
| Device | laptop / desktop + TV / tablet / phone |
| Input used | keyboard / wheel / tilt / touch brake |
| Wheel model (if any) | e.g. Logitech MOMO |
| World | Construction / Nature / Farm / City |
| Session duration | minutes |
| Did the child start interacting **without instruction**? | yes / no, after how long |
| Did the child understand steering without explanation? | |
| Did the child use the brake **intentionally**? | |
| How long before the child got distracted? | |
| Did the child notice their own drawing? | |
| Did the child recognise it as **their** drawing? | |
| Did the child ask to add another drawing? | |
| Did a different world change engagement? | |
| How did the child react to the session ending ("ALL DONE!")? | calm / asked for more / upset |
| What caused frustration? | |
| What did the parent need help setting up? | |
| Did the child return to it later (same day / next days)? | |

## Diagnostics

At the end: Parent Menu → **Export diagnostics** (or **Copy**). The JSON contains only:
- session and driving times;
- counters: brake presses, horn presses, manual/autopilot takeovers;
- whether tilt or the touch brake was used;
- input sources, world, play-time setting, why the session finished;
- the number of drawings and how often they were shown;
- FPS, screen size, browser and gamepad id.

It contains no names, photos, drawings or location. Nothing is sent automatically. Attach the file to your notes.

## What decides the next features

Positive signals before expanding to more content:

- children return voluntarily;
- children understand the controls without instruction;
- parents set up input without developer help;
- uploaded drawings are recognised by the child;
- children ask to add more drawings;
- parents accept the session-ending UX;
- the tablet works without special hardware.

If these are weak, improve the core loop before adding Color Your Vehicle or Phone → TV.
