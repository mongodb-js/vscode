import fs from 'fs';
import os from 'os';
import path from 'path';
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
  updateUserSetting,
  TEST_DATABASE_PORT,
} from './helpers';

let electronApp: ElectronApplication;
let page: Page;
let fakeBinDir: string;
let outFile: string;

/** Put a fake `mongosh` first on PATH (picked up by VS Code's terminals). */
function installFakeMongosh(): void {
  fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-mongosh-'));
  outFile = path.join(fakeBinDir, 'argv.txt');
  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(fakeBinDir, 'mongosh.cmd'),
      '@echo off\r\necho %*>"%MDB_FAKE_MONGOSH_OUT%"\r\n',
    );
  } else {
    const bin = path.join(fakeBinDir, 'mongosh');
    fs.writeFileSync(
      bin,
      '#!/bin/sh\nprintf \'%s\' "$1" > "$MDB_FAKE_MONGOSH_OUT"\n',
    );
    fs.chmodSync(bin, 0o755);
  }

  const key = {
    win32: 'windows',
    darwin: 'osx',
    linux: 'linux',
  }[process.platform as 'win32' | 'darwin' | 'linux'];
  if (process.platform !== 'win32') {
    updateUserSetting(`terminal.integrated.profiles.${key}`, {
      'e2e-sh': { path: '/bin/sh' },
    });
    updateUserSetting(`terminal.integrated.defaultProfile.${key}`, 'e2e-sh');
  }
  updateUserSetting(`terminal.integrated.env.${key}`, {
    PATH: `${fakeBinDir}${path.delimiter}\${env:PATH}`,
    MDB_FAKE_MONGOSH_OUT: outFile,
  });
}

test.beforeAll(async function () {
  await startMongoDB();
  electronApp = await launchVSCode();
  installFakeMongosh(); // after launch: launchVSCode rewrites settings.json
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
  fs.rmSync(fakeBinDir, { recursive: true, force: true });
});

test('launch shell passes the active connection string to mongosh', async () => {
  await connectToMongoDB(page);
  await expect(
    page
      .locator('.monaco-list-row', {
        hasText: `localhost:${TEST_DATABASE_PORT}`,
      })
      .first(),
  ).toContainText(/(?<!dis)connected/, { timeout: 30_000 });

  await executeCommand(page, 'MongoDB: Launch MongoDB Shell', {
    waitForClose: false,
  });

  // The extension asks to confirm the connection before launching.
  await page.getByRole('button', { name: 'Launch Shell' }).click();

  // A terminal named "MongoDB Shell" is opened...
  await expect(
    page.getByRole('textbox', { name: /Terminal \d+, MongoDB Shell/ }),
  ).toBeVisible({ timeout: 30_000 });

  // ...and mongosh was started with the complete expanded connection string
  // (anchored; the Windows recorder's quotes and trailing newline are trimmed).
  await expect
    .poll(
      () =>
        fs.existsSync(outFile)
          ? fs.readFileSync(outFile, 'utf-8').replace(/"/g, '').trim()
          : '',
      { timeout: 30_000, message: 'fake mongosh was never invoked' },
    )
    .toMatch(
      new RegExp(
        `^mongodb://localhost:${TEST_DATABASE_PORT}/\\?appName=mongodb-vscode\\S*$`,
      ),
    );
});
