import { expect, test, type Page } from '@playwright/test';

interface LeoState {
  driving: boolean;
  paused: boolean;
  progress: number;
  lateralOffset: number;
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

async function startDriving(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('start-screen')).toBeHidden();
}

test('page loads with the start screen', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByText('LEO RACER')).toBeVisible();
  await expect(page.getByTestId('start-button')).toHaveText('START DRIVING');
  await expect(page.locator('#game-canvas')).toBeVisible();
  expect(errors).toEqual([]);
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
