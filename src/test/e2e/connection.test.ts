/* eslint-disable no-empty-pattern */
// Manual-test matrix: "Connect on Windows" (saved connection). Runs on every
// OS in CI, so it also covers Windows: a connection made once is saved,
// survives a window reload, and can be connected to again from the tree.
import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import {
  startMongoDB,
  stopMongoDB,
  launchVSCode,
  waitForExtensionReady,
  connectToMongoDB,
  executeCommand,
  copyExtensionLogs,
  TEST_DATABASE_PORT,
} from './helpers';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async function () {
  await startMongoDB();
  electronApp = await launchVSCode();
  page = await electronApp.firstWindow();
  await waitForExtensionReady(page);
});

test.afterEach(async function ({}, testInfo) {
  if (testInfo.status !== testInfo.expectedStatus && page) {
    await page.screenshot({ path: testInfo.outputPath('failure.png') });
  }
});

test.afterAll(async function () {
  copyExtensionLogs();
  await electronApp?.close();
  await stopMongoDB();
});

test('saved connection persists across a reload and can be reconnected', async () => {
  const row = (): ReturnType<Page['locator']> =>
    page
      .locator('.monaco-list-row', {
        hasText: `localhost:${TEST_DATABASE_PORT}`,
      })
      .first();
  // The tree row's accessible text ends with "connected" when connected;
  // "(?<!dis)" so a disconnected row doesn't match.
  const connected = /(?<!dis)connected/;

  // 1. Connect (this saves the connection).
  await connectToMongoDB(page);
  await expect(row()).toContainText(connected, { timeout: 30_000 });

  // 2. Disconnect: the connection stays in the tree, no longer connected.
  await executeCommand(page, 'MongoDB: Disconnect');
  await expect(row()).toBeVisible();
  await expect(row()).not.toContainText(connected, { timeout: 30_000 });

  // 3. Reload the window: the saved connection must still be listed.
  await executeCommand(page, 'Developer: Reload Window', {
    waitForClose: false,
  });
  await page.waitForSelector('.monaco-workbench', { timeout: 60_000 });
  await page
    .getByRole('tab', { name: 'MongoDB' })
    .first()
    .click({ timeout: 60_000 });
  await expect(row()).toBeVisible({ timeout: 60_000 });
  await expect(row()).not.toContainText(connected);

  // 4. Connect again from the saved connection by expanding it.
  await row().click();
  await page.keyboard.press('ArrowRight');
  await expect(row()).toContainText(connected, { timeout: 60_000 });
});
