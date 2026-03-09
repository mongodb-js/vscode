import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { MongoCluster } from 'mongodb-runner';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

export const TEST_DATABASE_PORT = '27088';
export const TEST_DATABASE_URI = `mongodb://localhost:${TEST_DATABASE_PORT}`;
export const TEST_DB_NAME = 'e2eTestDB';

let mongoCluster: MongoCluster | undefined;

export async function startMongoDB(): Promise<void> {
  console.log('Starting MongoDB server on port', TEST_DATABASE_PORT);
  mongoCluster = await MongoCluster.start({
    topology: 'standalone',
    tmpDir: path.join(os.tmpdir(), 'vscode-e2e-mongodb-runner'),
    args: ['--port', TEST_DATABASE_PORT],
  });
}

export async function stopMongoDB(): Promise<void> {
  if (mongoCluster) {
    console.log('Stopping MongoDB server');
    await mongoCluster.close();
    mongoCluster = undefined;
  }
}

export async function seedDatabase(): Promise<void> {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(TEST_DATABASE_URI);
  try {
    await client.connect();
    const db = client.db(TEST_DB_NAME);

    // Drop existing collection if present
    const collections = await db.listCollections({ name: 'sales' }).toArray();
    if (collections.length > 0) {
      await db.dropCollection('sales');
    }

    // Seed with sales data for aggregation testing
    const sales = [
      {
        item: 'widget',
        quantity: 2,
        price: 10.5,
        date: new Date('2024-01-15'),
        region: 'east',
        tags: ['electronics', 'sale'],
      },
      {
        item: 'widget',
        quantity: 5,
        price: 10.5,
        date: new Date('2024-01-20'),
        region: 'west',
        tags: ['electronics'],
      },
      {
        item: 'gadget',
        quantity: 10,
        price: 25.0,
        date: new Date('2024-02-01'),
        region: 'east',
        tags: ['electronics', 'premium'],
      },
      {
        item: 'gadget',
        quantity: 3,
        price: 25.0,
        date: new Date('2024-02-10'),
        region: 'west',
        tags: ['electronics', 'premium', 'sale'],
      },
      {
        item: 'doohickey',
        quantity: 7,
        price: 5.0,
        date: new Date('2024-03-05'),
        region: 'east',
        tags: ['accessories'],
      },
      {
        item: 'doohickey',
        quantity: 1,
        price: 5.0,
        date: new Date('2024-03-15'),
        region: 'west',
        tags: ['accessories', 'sale'],
      },
      {
        item: 'thingamajig',
        quantity: 4,
        price: 50.0,
        date: new Date('2024-01-25'),
        region: 'east',
        tags: ['premium'],
      },
      {
        item: 'thingamajig',
        quantity: 6,
        price: 50.0,
        date: new Date('2024-02-20'),
        region: 'west',
        tags: ['premium', 'sale'],
      },
    ];

    await db.collection('sales').insertMany(sales);
    console.log(`Seeded ${sales.length} documents into ${TEST_DB_NAME}.sales`);
  } finally {
    await client.close();
  }
}

export async function cleanupDatabase(): Promise<void> {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(TEST_DATABASE_URI);
  try {
    await client.connect();
    await client.db(TEST_DB_NAME).dropDatabase();
  } finally {
    await client.close();
  }
}

export async function launchVSCode(): Promise<ElectronApplication> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

  // Download/resolve VS Code Insiders (reuses cached version)
  const vscodeExecutablePath = await downloadAndUnzipVSCode('insiders');

  // Use isolated directories for e2e tests
  const e2eTmpDir = path.join(os.tmpdir(), 'vscode-e2e-test');
  const userDataDir = path.join(e2eTmpDir, 'user-data');
  const extensionsDir = path.join(e2eTmpDir, 'extensions');
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(extensionsDir, { recursive: true });

  // Disable welcome page, trust, and other UI distractions via settings
  const settingsDir = path.join(userDataDir, 'User');
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(
    path.join(settingsDir, 'settings.json'),
    JSON.stringify({
      'workbench.startupEditor': 'none',
      'security.workspace.trust.enabled': false,
      'security.workspace.trust.startupPrompt': 'never',
      'update.mode': 'none',
      'extensions.autoUpdate': false,
      'terminal.integrated.shell.linux': '/bin/bash',
      'workbench.tips.enabled': false,
      'workbench.welcomePage.walkthroughs.openOnInstall': false,
      'telemetry.telemetryLevel': 'off',
      'mdb.confirmRunAll': false,
      'mdb.showMCPAutoStartPrompt': false,
    }),
  );

  const electronApp = await electron.launch({
    executablePath: vscodeExecutablePath,
    args: [
      `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${extensionsDir}`,
      '--skip-release-notes',
      '--skip-welcome',
      '--disable-telemetry',
    ],
    env: {
      ...(process.env as Record<string, string>),
      // NOTE: Do NOT set MDB_IS_TEST here. When MDB_IS_TEST=true, the extension
      // skips activation entirely (VSCODE-700), which means no commands are registered.
      // E2e tests need the real activation flow.
    },
  });

  return electronApp;
}

/**
 * Wait for VS Code to fully initialize and the MongoDB extension to be available.
 */
export async function waitForExtensionReady(page: Page): Promise<void> {
  // Wait for the workbench to be visible
  await page.waitForSelector('.monaco-workbench', { timeout: 30_000 });

  // Wait for the MongoDB extension to fully activate.
  // The "Add Connection" button appears in the sidebar welcome view after the
  // extension's activate() runs and sets up tree views.
  await page.getByRole('button', { name: 'Add Connection' }).first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });

  // Close all open editor tabs to start clean
  await closeAllEditors(page);

  // Dismiss any notification banners that might appear (MCP, disabled extensions, etc.)
  await page.waitForTimeout(2_000);
  const notifications = page.locator(
    '.notifications-toasts .notification-toast .codicon-notifications-clear',
  );
  const notifCount = await notifications.count();
  for (let i = 0; i < notifCount; i++) {
    await notifications
      .nth(0)
      .click()
      .catch(() => {});
    await page.waitForTimeout(200);
  }
}

/**
 * Close all open editor tabs.
 */
export async function closeAllEditors(page: Page): Promise<void> {
  await executeCommand(page, 'View: Close All Editors');
  await page.waitForTimeout(500);
}

/**
 * Open the VS Code Command Palette and execute a command.
 */
export async function executeCommand(
  page: Page,
  command: string,
): Promise<void> {
  const isMac = process.platform === 'darwin';

  // Open command palette
  if (isMac) {
    await page.keyboard.press('Meta+Shift+KeyP');
  } else {
    await page.keyboard.press('Control+Shift+KeyP');
  }

  // Wait for the command palette input to appear
  const quickInput = page.locator('.quick-input-widget input[type="text"]');
  await quickInput.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForTimeout(500);

  // Clear any existing text and type the command
  await quickInput.fill('>' + command);
  await page.waitForTimeout(1_500);

  // Select the first matching item
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1_000);
}

/**
 * Connect to MongoDB by executing the connectWithURI command.
 */
export async function connectToMongoDB(page: Page): Promise<void> {
  const isMac = process.platform === 'darwin';

  // Step 1: Open command palette
  if (isMac) {
    await page.keyboard.press('Meta+Shift+KeyP');
  } else {
    await page.keyboard.press('Control+Shift+KeyP');
  }

  let quickInput = page.locator('.quick-input-widget input[type="text"]');
  await quickInput.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForTimeout(300);

  // Step 2: Type the connect command and execute it
  await quickInput.fill('>MongoDB: Connect with Connection String');
  await page.waitForTimeout(1_000);
  await page.keyboard.press('Enter');

  // Step 3: Wait for the connection string input box to appear.
  // VS Code reuses the quick-input widget. After the command palette closes,
  // showInputBox opens a new one. Wait a bit for the transition.
  await page.waitForTimeout(2_000);

  // The input box should now be visible with the connection string placeholder
  quickInput = page.locator('.quick-input-widget input[type="text"]');
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(300);

  // Step 4: Type the connection string and submit
  await quickInput.fill(TEST_DATABASE_URI);
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');

  // Step 5: Wait for connection to establish
  await page.waitForTimeout(5_000);
}

/**
 * Create a new playground file with the given content, run it, and return the page.
 */
export async function createAndRunPlayground(
  electronApp: ElectronApplication,
  page: Page,
  playgroundContent: string,
): Promise<void> {
  // Create a new playground
  await executeCommand(page, 'MongoDB: Create MongoDB Playground');
  await page.waitForTimeout(3_000);

  // Select all existing content and replace with our playground
  const isMac = process.platform === 'darwin';
  if (isMac) {
    await page.keyboard.press('Meta+A');
  } else {
    await page.keyboard.press('Control+A');
  }
  await page.waitForTimeout(300);

  // Write to clipboard via Electron's main process API, then paste
  await electronApp.evaluate(async ({ clipboard }, text) => {
    clipboard.writeText(text);
  }, playgroundContent);
  if (isMac) {
    await page.keyboard.press('Meta+V');
  } else {
    await page.keyboard.press('Control+V');
  }
  await page.waitForTimeout(1_000);

  // Run the playground (confirmRunAll is disabled in settings)
  await executeCommand(page, 'MongoDB: Run All From Playground');

  // If a modal confirmation dialog appears despite settings, accept it
  const confirmButton = page.getByRole('button', { name: 'Yes' });
  if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirmButton.click();
  }
}

/**
 * Get the visible text content of the data browsing webview.
 */
export async function getDataBrowserContent(
  page: Page,
): Promise<{ frameLocator: ReturnType<Page['frameLocator']> }> {
  // The data browser opens in a webview panel; we need to find the iframe
  // VS Code renders webviews inside nested iframes
  const webviewFrame = page.frameLocator('iframe.webview.ready');
  const innerFrame = webviewFrame.frameLocator('#active-frame');
  return { frameLocator: innerFrame };
}
