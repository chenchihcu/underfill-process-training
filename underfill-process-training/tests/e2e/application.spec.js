import { expect, test } from '@playwright/test';

async function openInspection(page) { await page.goto('/index.html'); await page.locator('[data-section="inspection"]').click(); }
async function fillRequiredTrace(page) {
  for (const name of ['needleGauge','edgeDistanceMm','dispenseDelaySec','dispensedWeightMg','flowRateMgSec','stagingMinutes','plasmaRecipe']) await page.locator(`[name="${name}"]`).fill('1');
}

test('preview and language changes never create quality records', async ({ page }) => {
  await openInspection(page);
  await page.locator('[name="filletHeightPercent"]').fill('55');
  await page.locator('#languageSelect').selectOption('en');
  await page.locator('[name="voidAreaPercent"]').fill('30');
  await expect(page.locator('#recordBadge')).toHaveText('0');
  await expect(page.locator('#inspectionPreview')).toContainText('Reject');
});

test('one explicit submission creates one safe, traceable record', async ({ page }) => {
  await openInspection(page);
  await page.locator('[name="sampleId"]').fill('S-001');
  await page.locator('[name="batchId"]').fill('<img src=x onerror=alert(1)>');
  await page.locator('[name="materialLot"]').fill('LOT-001');
  await fillRequiredTrace(page);
  await page.locator('#recordInspectionButton').click();
  await expect(page.locator('#recordBadge')).toHaveText('1');
  await page.locator('[data-section="records"]').click();
  await expect(page.locator('#recordRows')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#recordRows img')).toHaveCount(0);
  await expect(page.locator('#totalCount')).toHaveText('1');
});

test('recommendations fail closed until required evidence is complete', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-section="recommendation"]').click();
  await page.locator('[name="packageType"]').selectOption('BGA');
  await page.locator('#recommendationForm button[type="submit"]').click();
  await expect(page.locator('#recommendationResult')).toContainText(/資料不足|Insufficient/);
});

test('the canonical training journey retains eight bilingual process modules', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-section="learning"]').click();
  await expect(page.locator('.lesson-card')).toHaveCount(8);
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.locator('#learningTitle')).toHaveText('Underfill process training path');
  await expect(page.locator('.lesson-card').first()).toContainText('Purpose and package strategy');
});

test('all nine simulator modules render with authority and dimensions', async ({ page }) => {
  await page.goto('/simulation.html');
  for (const option of ['underfill','spi','fpca','reflow','bga','flow','pattern','void','warpage']) {
    await page.locator('#moduleSelect').selectOption(option);
    await expect(page.locator('#renderStatus')).toContainText('12 mm');
  }
  await expect(page.locator('#viewport canvas:visible, #fallback svg:visible')).toHaveCount(1);
  await page.locator('[data-view="cross"]').click();
  await expect(page.locator('[data-view="cross"]')).toHaveClass(/active/);
});

test('WebGL failure activates the useful 2D fallback', async ({ page }) => {
  await page.goto('/simulation.html?fallback=1');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#fallback svg')).toBeVisible();
  await page.locator('#progress').fill('80');
  await expect(page.locator('#fallbackUnderfill')).toHaveAttribute('d', /558/);
});

test('@visual navigation states have distinct accessible color roles', async ({ page }) => {
  await page.goto('/index.html');
  const active = page.locator('.nav-item.active');
  const simulator = page.locator('.nav-item-primary');
  const activeBackground = await active.evaluate((node) => getComputedStyle(node).backgroundColor);
  const simulatorBackground = await simulator.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(activeBackground).not.toBe(simulatorBackground);
  await active.focus();
  await expect(active).toBeFocused();
});

test('desktop and mobile layouts avoid document overflow', async ({ page }) => {
  await page.goto('/index.html');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('installed application reloads offline', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One offline installation check is sufficient.');
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h1')).toBeVisible();
  await context.setOffline(false);
});
