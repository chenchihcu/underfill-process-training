import { expect, test } from '@playwright/test';

const moduleIds = ['underfill','spi','fpca','reflow','bga','flow','pattern','void','warpage'];

async function openInspection(page) {
  await page.goto('/index.html');
  await page.locator('[data-section="inspection"]').click();
}

async function fillRequiredTrace(page) {
  for (const name of ['needleGauge','edgeDistanceMm','dispenseDelaySec','dispensedWeightMg','flowRateMgSec','stagingMinutes','plasmaRecipe']) {
    await page.locator(`[name="${name}"]`).fill('1');
  }
}

async function openSimulatorControls(page) {
  const toggle = page.locator('#controlsToggle');
  if (await toggle.isVisible()) await toggle.click();
}

test('preview, navigation, sliders, and language changes never create quality records', async ({ page }) => {
  await openInspection(page);
  await page.locator('[name="filletHeightPercent"]').fill('55');
  await page.locator('#languageSelect').selectOption('en');
  await page.locator('[name="voidAreaPercent"]').fill('30');
  await page.locator('[data-section="overview"]').click();
  await page.locator('[data-section="inspection"]').click();
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

test('the canonical training journey contains ten deep bilingual themes', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-section="learning"]').click();
  await expect(page.locator('.lesson-card')).toHaveCount(10);
  await expect(page.locator('#topicWorkspace .principle-card')).toHaveCount(1);
  await expect(page.locator('#topicWorkspace .content-card')).toHaveCount(3);
  await expect(page.locator('#topicWorkspace .case-card')).toHaveCount(1);
  await expect(page.locator('#topicWorkspace .quiz-card')).toHaveCount(1);
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.locator('#learningTitle')).toHaveText('Underfill process training path');
  await expect(page.locator('.lesson-card').first()).toContainText('Reliability purpose and package strategy');
});

test('global search opens a matching topic without creating progress', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#experienceSearch').fill('Void');
  await expect(page.locator('#searchResults .search-result')).not.toHaveCount(0);
  await page.locator('#searchResults .search-result').first().click();
  await expect(page.locator('#learning')).toBeVisible();
  await expect(page.locator('#recordBadge')).toHaveText('0');
});

test('specification search and authority filters retain traceable sources', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-section="specifications"]').click();
  await page.locator('#specSearch').fill('Fillet');
  await page.locator('#specAuthority').selectOption('controlled');
  await expect(page.locator('#specCards .spec-item')).not.toHaveCount(0);
  await expect(page.locator('#specCards .source-button').first()).toBeVisible();
});

test('the initial training route does not load the Three.js simulator engine', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/index.html');
  await expect(page.locator('#overview')).toBeVisible();
  expect(requests.some((url) => url.includes('simulator-engine'))).toBe(false);
});

test('all nine simulator modules render with authority, phases, scenarios, and overlays', async ({ page }) => {
  test.slow();
  await page.goto('/simulation.html');
  await openSimulatorControls(page);
  let underfillObjectCount = null;
  for (const id of moduleIds) {
    await page.locator('#moduleSelect').selectOption(id, { force: true });
    await expect(page.locator('#moduleSelect')).toHaveAttribute('data-ready', id);
    const evidence = await page.evaluate(() => ({
      error: document.querySelector('#moduleSelect')?.dataset.error || null,
      status: document.querySelector('#renderStatus')?.textContent || '',
      phases: document.querySelectorAll('#phaseTrack .phase-node').length,
      scenarios: document.querySelectorAll('#scenarioSelect option').length,
      overlays: document.querySelectorAll('#overlaySelect option').length,
      objects: Number(document.querySelector('#objectCount')?.textContent || 0)
    }));
    expect(evidence).toEqual(expect.objectContaining({ error:null, phases:4, scenarios:3, overlays:3 }));
    expect(evidence.status).toContain('UF-TWIN-TRAINING-1.0');
    expect(evidence.status).toContain('UF-ENG-2026.04-v1');
    if (id === 'underfill') underfillObjectCount = evidence.objects;
  }
  await page.locator('#moduleSelect').selectOption('underfill', { force:true });
  await expect(page.locator('#moduleSelect')).toHaveAttribute('data-ready', 'underfill');
  expect(Number(await page.locator('#objectCount').textContent())).toBe(underfillObjectCount);
  await expect(page.locator('#viewport canvas:visible, #fallback svg:visible')).toHaveCount(1);
  await page.locator('[data-view="cross"]').click();
  await expect(page.locator('[data-view="cross"]')).toHaveClass(/active/);
});

test('shared timeline supports step, fault injection, overlay, pause, and reset', async ({ page }) => {
  await page.goto('/simulation.html?module=reflow');
  await openSimulatorControls(page);
  await page.locator('#scenarioSelect').selectOption('fast-ramp');
  await page.locator('#overlaySelect').selectOption('profile');
  await page.locator('#stepTimeline').click();
  expect(Number(await page.locator('#progressValue').textContent())).toBeGreaterThan(0);
  await page.locator('#playTimeline').click();
  await expect(page.locator('#timelineStatus')).toHaveText('RUNNING');
  await page.locator('#pauseTimeline').click();
  await expect(page.locator('#timelineStatus')).toHaveText('PAUSED');
  await page.locator('#resetTimeline').click();
  await expect(page.locator('#progressValue')).toHaveText('0');
});

test('training-only and experimental modules expose authority but no production result control', async ({ page }) => {
  await page.goto('/simulation.html?module=spi');
  await openSimulatorControls(page);
  for (const id of ['spi','fpca','reflow','flow','warpage']) {
    await page.locator('#moduleSelect').selectOption(id, { force: true });
    await expect(page.locator('#moduleSelect')).toHaveAttribute('data-ready', id);
    await expect(page.locator('#renderStatus')).toContainText(/TRAINING-ONLY|EXPERIMENTAL/);
    await expect(page.locator('[data-production-result]')).toHaveCount(0);
  }
});

test('WebGL failure activates the useful 2D fallback', async ({ page }) => {
  await page.goto('/simulation.html?fallback=1');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#fallback svg')).toBeVisible();
  await openSimulatorControls(page);
  await page.locator('#progress').fill('80');
  await expect(page.locator('#fallbackUnderfill')).toHaveAttribute('d', /558/);
});

test('@visual navigation and engineering actions have distinct accessible color roles', async ({ page }) => {
  await page.goto('/index.html');
  const active = page.locator('.nav-item.active');
  const simulator = page.locator('.nav-item-primary');
  const primary = page.locator('.hero-panel .button-primary');
  const secondary = page.locator('.hero-panel .button-ghost');
  const colors = await Promise.all([active, simulator, primary, secondary].map((locator) => locator.evaluate((node) => getComputedStyle(node).backgroundColor)));
  expect(new Set(colors).size).toBeGreaterThanOrEqual(3);
  await active.focus();
  await expect(active).toBeFocused();
});

test('desktop and mobile layouts keep models visible and avoid overflow', async ({ page }, testInfo) => {
  await page.goto('/index.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.goto('/simulation.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#viewport:visible, #fallback:visible')).toBeInViewport();
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#simControls')).not.toHaveClass(/open/);
    await page.locator('#controlsToggle').click();
    await expect(page.locator('#simControls')).toHaveClass(/open/);
  }
});

test('keyboard shortcut focuses content search', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#experienceSearch')).toBeFocused();
});

test('installed application loads the training shell and all nine simulator modules offline', async ({ page, context }, testInfo) => {
  test.slow();
  test.skip(testInfo.project.name !== 'desktop', 'One complete offline installation check is sufficient.');
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.goto('/simulation.html');
  await expect(page.locator('#moduleSelect')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  for (const id of moduleIds) {
    await page.locator('#moduleSelect').selectOption(id, { force: true });
    await expect(page.locator('#moduleSelect')).toHaveAttribute('data-ready', id);
    await expect(page.locator('#renderStatus')).toContainText('UF-TWIN-TRAINING-1.0');
  }
  await context.setOffline(false);
});
