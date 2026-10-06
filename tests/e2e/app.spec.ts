import { expect, test, type Page } from '@playwright/test';

interface LeoState {
  driving: boolean;
  paused: boolean;
  world: string;
  phase: 'idle' | 'running' | 'ending' | 'finished';
  traffic: number;
  progress: number;
  lateralOffset: number;
  speed: number;
  braking: boolean;
  steering: number;
  manualSteering: number;
  mode: 'manual' | 'autopilot';
  activeSprites: number;
}

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __leo: { state(): LeoState } }).__leo.state());

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function startDriving(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('start-screen')).toBeHidden();
}

async function openParentMenu(page: Page): Promise<void> {
  await page.keyboard.down('Escape');
  await page.waitForTimeout(2300);
  await page.keyboard.up('Escape');
  await expect(page.getByTestId('parent-menu')).toBeVisible();
}

/** A tiny generated "drawing" so the upload flow can run against the mock AI provider. */
async function drawingFile(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 300, 200);
    g.fillStyle = '#e33';
    g.fillRect(60, 80, 180, 70);
    return c.toDataURL('image/png');
  });
  return { name: 'car.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
}

test('page loads with the start screen', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByText('LEO RACER')).toBeVisible();
  await expect(page.getByTestId('start-button')).toHaveText('START DRIVING');
  await expect(page.locator('#game-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('parent world selection resumes driving while entrance selection keeps the start screen', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.goto('/');
  await Promise.all([page.waitForEvent('load'), page.getByTestId('world-farm').click({ noWaitAfter: true })]);
  await expect(page.getByTestId('start-button')).toBeVisible();
  await page.getByTestId('start-button').click();
  await openParentMenu(page);
  await Promise.all([page.waitForEvent('load'), page.getByTestId('world-nature').click({ noWaitAfter: true })]);
  await expect.poll(async () => (await state(page)).driving).toBe(true);
  expect((await state(page)).world).toBe('nature');
  await expect(page.getByTestId('start-screen')).toBeHidden();
  await openParentMenu(page);
  await page.reload();
  await expect(page.getByTestId('start-button')).toBeVisible();
  expect(errors).toEqual([]);
});

test('saved wheel can calibrate its brake pedal and brake after reload', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(() => {
    const axes = [0, 1, 1];
    Object.defineProperty(window, '__testWheelAxes', { value: axes });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [{
      id: 'Test Wheel', index: 0, connected: true, axes, buttons: [],
    }] });
    if (!localStorage.getItem('leo.settings')) {
      localStorage.setItem('leo.settings', JSON.stringify({
        calibration: { gamepadId: 'Test Wheel', steeringAxis: 0, invertAxis: false,
          min: -1, center: 0, max: 1, deadzone: 0.04 },
      }));
    }
  });
  const pedal = (value: number) => page.evaluate((pressed) => {
    (window as unknown as { __testWheelAxes: number[] }).__testWheelAxes[1] = pressed;
  }, value);
  const accelerator = (value: number) => page.evaluate((pressed) => {
    (window as unknown as { __testWheelAxes: number[] }).__testWheelAxes[2] = pressed;
  }, value);
  await startDriving(page);
  const cruise = (await state(page)).speed;
  await openParentMenu(page);
  await page.getByTestId('calibrate-button').click();
  await page.getByRole('button', { name: 'Calibrate brake pedal', exact: true }).click();
  await page.getByRole('button', { name: 'Pedals released' }).click();
  await pedal(-1);
  const save = page.getByRole('button', { name: 'Save brake pedal', exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Brake axis 1: 100%')).toBeVisible();
  await pedal(1);
  await page.getByRole('button', { name: 'Calibrate accelerator pedal', exact: true }).click();
  await page.getByRole('button', { name: 'Pedals released' }).click();
  await accelerator(-1);
  const saveAccelerator = page.getByRole('button', { name: 'Save accelerator pedal', exact: true });
  await expect(saveAccelerator).toBeEnabled();
  await saveAccelerator.click();
  await expect(page.getByText('Accelerator axis 2: 100%')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByTestId('resume-button').click();
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBeGreaterThan(cruise);
  await accelerator(1);
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBe(cruise);
  await pedal(-1);
  await expect.poll(async () => (await state(page)).braking).toBe(true);
  await pedal(1);
  await expect.poll(async () => (await state(page)).braking).toBe(false);
  await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(0);
  // The separately saved default must survive a reset of general settings.
  await page.evaluate(() => localStorage.removeItem('leo.settings'));
  await page.reload();
  await page.getByTestId('start-button').click();
  await accelerator(-1);
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBeGreaterThan(cruise);
  await pedal(-1);
  await expect.poll(async () => (await state(page)).braking).toBe(true);
});

test('wheel gear bindings persist and shift once per press', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(() => {
    const buttons = Array<boolean>(6).fill(false);
    Object.defineProperty(window, '__gearButtons', { value: buttons });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [{
      id: 'Gear Wheel', index: 0, connected: true, axes: [0],
      buttons: buttons.map((pressed) => ({ pressed, value: Number(pressed), touched: pressed })),
    }] });
    if (!localStorage.getItem('leo.settings')) localStorage.setItem('leo.settings', JSON.stringify({
      calibration: { gamepadId: 'Gear Wheel', steeringAxis: 0, min: -1, center: 0, max: 1, invertAxis: false, deadzone: 0.04 },
    }));
  });
  const press = (index: number) => page.evaluate((button) => {
    const buttons = (window as unknown as { __gearButtons: boolean[] }).__gearButtons;
    buttons.fill(false);
    if (button >= 0) buttons[button] = true;
  }, index);
  const gear = () => page.evaluate(() => (window as unknown as { __leo: { live(): { gear: string } } }).__leo.live().gear);
  await startDriving(page);
  const cruise = (await state(page)).speed;
  await openParentMenu(page);
  await page.getByTestId('calibrate-button').click();
  await page.getByRole('button', { name: 'Assign gear buttons', exact: true }).click();
  await press(2);
  await expect(page.getByText('Release it, then press the wheel button for GEAR DOWN.')).toBeVisible();
  await press(-1);
  await press(3);
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByTestId('resume-button').click();
  await expect.poll(gear).toMatch(/^3 \/ 5/);
  await press(-1);
  await page.waitForTimeout(200);
  await press(2);
  await expect.poll(gear).toMatch(/^4 \/ 5/);
  await page.waitForTimeout(300);
  await expect.poll(gear).toMatch(/^4 \/ 5/);
  await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(cruise);
  await page.reload();
  await page.getByTestId('start-button').click();
  await expect.poll(gear).toMatch(/^3 \/ 5/);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __leo: { live(): { gamepadId: string } } }).__leo.live().gamepadId,
  )).toBe('Gear Wheel');
  await press(2);
  await expect.poll(gear).toMatch(/^4 \/ 5/);
  await page.evaluate(() => (window as unknown as { __leo: { endSession(): void } }).__leo.endSession());
  await press(-1);
  await page.waitForTimeout(200);
  await press(3);
  await expect.poll(gear).toMatch(/^4 \/ 5/);
});

test('holding forward boosts speed, releasing restores cruise and brake overrides gas', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 640, height: 360 });
  await startDriving(page);
  const cruise = (await state(page)).speed;
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBeGreaterThan(cruise);
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await state(page)).braking).toBe(true);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBe(cruise);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBeGreaterThan(cruise);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await state(page)).speed, { timeout: 15_000 }).toBe(cruise);
});

test('START works: bus drives on autopilot with no child-facing UI', async ({ page }) => {
  const errors = trackErrors(page);
  await startDriving(page);
  const a = await state(page);
  await page.waitForTimeout(1000);
  const b = await state(page);
  expect(b.driving).toBe(true);
  expect(b.progress).toBeGreaterThan(a.progress);
  expect(b.mode).toBe('autopilot');
  await expect(page.getByTestId('parent-menu')).toBeHidden();
  await expect(page.getByTestId('diagnostics')).toBeHidden();
  expect(errors).toEqual([]);
});

test('keyboard steers the vehicle and takes over from autopilot', async ({ page }) => {
  await startDriving(page);
  await page.waitForTimeout(300);
  const before = await state(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  const during = await state(page);
  await page.keyboard.up('ArrowRight');
  expect(during.mode).toBe('manual');
  expect(during.manualSteering).toBeGreaterThan(0.9);
  expect(during.lateralOffset).toBeGreaterThan(before.lateralOffset + 0.5);

  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1200);
  const left = await state(page);
  await page.keyboard.up('KeyA');
  expect(left.manualSteering).toBeLessThan(-0.9);
  expect(left.lateralOffset).toBeLessThan(during.lateralOffset);
});

test('arrow down brakes to a stop and releasing drives on', async ({ page }) => {
  await startDriving(page);
  await page.waitForTimeout(300);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2000);
  const stopped = await state(page);
  expect(stopped.braking).toBe(true);
  expect(stopped.speed).toBe(0);
  expect(stopped.mode).toBe('manual');
  await page.waitForTimeout(500);
  expect((await state(page)).progress).toBe(stopped.progress);

  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(1000);
  const moving = await state(page);
  expect(moving.braking).toBe(false);
  expect(moving.speed).toBeGreaterThan(0);
  expect(moving.progress).toBeGreaterThan(stopped.progress);
});

test('parent menu opens after holding ESC for ~2 seconds', async ({ page }) => {
  await startDriving(page);
  await page.keyboard.down('Escape');
  await page.waitForTimeout(800);
  await expect(page.getByTestId('parent-menu')).toBeHidden();
  await page.waitForTimeout(1500);
  await page.keyboard.up('Escape');
  await expect(page.getByTestId('parent-menu')).toBeVisible();
  expect((await state(page)).paused).toBe(true);

  await page.getByTestId('resume-button').click();
  await expect(page.getByTestId('parent-menu')).toBeHidden();
  expect((await state(page)).paused).toBe(false);
});

test('a short ESC tap does not open the menu', async ({ page }) => {
  await startDriving(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('parent-menu')).toBeHidden();
});

test('drawing dialog opens from the parent menu', async ({ page }) => {
  await startDriving(page);
  await page.keyboard.down('Escape');
  await page.waitForTimeout(2300);
  await page.keyboard.up('Escape');
  await page.getByTestId('add-drawing-button').click();
  await expect(page.getByRole('heading', { name: 'Add Drawing' })).toBeVisible();
  await expect(page.getByTestId('drawing-file-input')).toBeAttached();
});

test('reload does not crash', async ({ page }) => {
  const errors = trackErrors(page);
  await startDriving(page);
  await page.reload();
  await expect(page.getByTestId('start-button')).toBeVisible();
  await page.getByTestId('start-button').click();
  await page.waitForTimeout(500);
  expect((await state(page)).driving).toBe(true);
  expect(errors).toEqual([]);
});

test('touch brake: pressing the bottom of the screen brakes', async ({ page }) => {
  await startDriving(page);
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.93);
  await page.mouse.down();
  await expect(page.getByTestId('touch-brake')).toBeVisible();
  await page.waitForTimeout(1800);
  expect((await state(page)).speed).toBe(0);
  await page.mouse.up();
  await expect(page.getByTestId('touch-brake')).toBeHidden();
  await page.waitForTimeout(800);
  expect((await state(page)).speed).toBeGreaterThan(0);

  // The top of the screen does not brake.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.waitForTimeout(300);
  expect((await state(page)).braking).toBe(false);
  await page.mouse.up();
});

test('world selection persists after reload', async ({ page }) => {
  await startDriving(page);
  expect((await state(page)).world).toBe('construction');
  await openParentMenu(page);
  // Selecting a world reloads the page.
  await Promise.all([page.waitForEvent('load'), page.getByTestId('world-nature').click({ noWaitAfter: true })]);
  await page.getByTestId('start-button').click();
  expect((await state(page)).world).toBe('nature');
  await page.reload();
  await page.getByTestId('start-button').click();
  expect((await state(page)).world).toBe('nature');
});

test('play-time and traffic settings persist after reload', async ({ page }) => {
  await startDriving(page);
  await openParentMenu(page);
  await page.getByTestId('play-time-select').selectOption('10');
  await page.getByTestId('traffic-select').selectOption('busy');
  await page.reload();
  await page.getByTestId('start-button').click();
  await openParentMenu(page);
  await expect(page.getByTestId('play-time-select')).toHaveValue('10');
  await expect(page.getByTestId('traffic-select')).toHaveValue('busy');
});

test('finished session: gentle stop, ALL DONE, child cannot restart, parent can', async ({ page }) => {
  await startDriving(page, '/?endingMs=4000');
  await page.evaluate(() => (window as unknown as { __leo: { endSession(): void } }).__leo.endSession());
  await page.waitForTimeout(400);
  expect((await state(page)).phase).toBe('ending');

  // Child input is ignored during the ending.
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(300);
  expect((await state(page)).braking).toBe(false);
  await page.keyboard.up('ArrowDown');

  await expect(page.getByTestId('end-screen')).toBeVisible({ timeout: 8000 });
  const done = await state(page);
  expect(done.phase).toBe('finished');
  expect(done.speed).toBe(0);
  await expect(page.getByText('ALL DONE!')).toBeVisible();

  // Mashing keys and clicking does not restart.
  for (const key of ['ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'ArrowDown']) await page.keyboard.press(key);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(500);
  expect((await state(page)).phase).toBe('finished');
  await expect(page.getByTestId('end-screen')).toBeVisible();

  // Parent: hold Esc → Start another session.
  await openParentMenu(page);
  await page.getByTestId('restart-session-button').click();
  await expect(page.getByTestId('end-screen')).toBeHidden();
  await page.waitForTimeout(1500);
  const again = await state(page);
  expect(again.phase).toBe('running');
  expect(again.speed).toBeGreaterThan(0);
});

test('MOVES/STAYS override and frequency persist after reload', async ({ page }) => {
  await startDriving(page);
  await openParentMenu(page);
  await page.getByTestId('add-drawing-button').click();
  await page.getByTestId('drawing-file-input').setInputFiles(await drawingFile(page));
  await expect(page.getByText('Added to the world!')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('stays-button').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('manage-drawings-button').click();
  await page.getByTestId('frequency-often').click();
  await page.waitForTimeout(300);

  await page.reload();
  await page.getByTestId('start-button').click();
  await openParentMenu(page);
  await page.getByTestId('manage-drawings-button').click();
  await expect(page.getByTestId('stays-button')).toHaveClass(/active/);
  await expect(page.getByTestId('moves-button')).not.toHaveClass(/active/);
  await expect(page.getByTestId('frequency-often')).toHaveClass(/active/);
});

test('traffic appears with the default setting', async ({ page }) => {
  await startDriving(page);
  await expect.poll(async () => (await state(page)).traffic, { timeout: 20_000 }).toBeGreaterThan(0);
});
