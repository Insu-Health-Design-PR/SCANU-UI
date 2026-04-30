import { test, expect } from '@playwright/test';

const LAYOUT_OPTION_VISUAL_THERMAL = '[data-testid="layout-option-visual-thermal"]';
const LAYOUT_OPTION_CUSTOM = '[data-testid="layout-option-custom-combination"]';
const VIEW_LAYOUT_BUTTON = '[data-testid="view-layout-button"]';
const OPEN_PREVIEW_BUTTON = '[data-testid="open-layout-preview"]';
const CLOSE_LAYOUT_BUTTON = '[data-testid="close-layout-preview"]';

const PREFS_KEY = 'scanu-layer8-ui-prefs';

test('layout flow persists after refresh', async ({ page }) => {
  await page.goto('/');

  await page.click(VIEW_LAYOUT_BUTTON);
  await page.click(LAYOUT_OPTION_VISUAL_THERMAL);

  await expect(page.getByRole('heading', { name: 'Visual Detection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thermal Cam' })).toBeVisible();

  const beforeReload = await page.evaluate((key) => {
    return window.localStorage.getItem(key);
  }, PREFS_KEY);

  expect(beforeReload).toBeTruthy();
  expect(beforeReload ?? '').toContain('Visual + Thermal');

  await page.reload();

  const afterReload = await page.evaluate((key) => {
    return window.localStorage.getItem(key);
  }, PREFS_KEY);

  expect(afterReload).toBe(beforeReload);
});

test('layout preview modal stays usable in constrained viewports', async ({ page }) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 1280, height: 650 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await page.getByTestId('view-layout-button').click();
    await page.locator(LAYOUT_OPTION_CUSTOM).click();
    await page.locator(OPEN_PREVIEW_BUTTON).last().click();

    const dialog = page.getByRole('dialog', { name: /layout preview/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport();
    await expect(dialog.getByTestId('apply-layout')).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Back' })).toBeInViewport();
    await expect(dialog.locator(CLOSE_LAYOUT_BUTTON)).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close layout preview' })).toBeInViewport();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});
