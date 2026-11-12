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

// eslint-disable-next-line no-empty-pattern
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

test('connect to localhost via the connection form', async () => {
  const hostPort = `localhost:${TEST_DATABASE_PORT}`;

  // Overview page -> "Open connection form".
  await executeCommand(page, 'MongoDB: Open Overview Page');
  const frame = page
    .frameLocator('iframe.webview.ready')
    .frameLocator('#active-frame');
  await frame.getByLabel('Open connection form').click();
  await expect(frame.getByTestId('connection-form-modal')).toBeVisible();

  // The form opens in "Edit Connection String" mode; switch it off to get the
  // host/port inputs, which live under Advanced Connection Options > General.
  const editSwitch = frame.getByRole('switch', {
    name: 'Edit Connection String',
  });
  if ((await editSwitch.getAttribute('aria-checked')) === 'true') {
    await editSwitch.click();
  }
  await frame
    .getByRole('button', { name: 'Advanced Connection Options' })
    .click();
  await frame
    .getByRole('tablist', { name: 'Advanced Options Tabs' })
    .getByRole('tab', { name: 'General' })
    .click();
  await frame.getByTestId('connection-host-input').first().fill(hostPort);

  await frame.getByRole('button', { name: 'Save & Connect' }).click();

  // A tree row alone doesn't prove success (a failed connect can leave one):
  // the form must close and the row must be marked connected.
  const row = page.locator('.monaco-list-row', { hasText: hostPort }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await expect(frame.getByTestId('connection-form-modal')).toBeHidden({
    timeout: 60_000,
  });
  await expect(row).toContainText(/(?<!dis)connected/, { timeout: 60_000 });
});
