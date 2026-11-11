/* eslint-disable no-empty-pattern */
import type { TestInfo } from '@playwright/test';
import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import {
  startMongoDB,
  stopMongoDB,
  seedDatabase,
  cleanupDatabase,
  launchVSCode,
  waitForExtensionReady,
  closeAllEditors,
  connectToMongoDB,
  getDataBrowserContent,
  getEditorText,
  copyExtensionLogs,
  TEST_DATABASE_URI,
  TEST_DATABASE_PORT,
  TEST_DB_NAME,
} from './helpers';

let electronApp: ElectronApplication;
let page: Page;

async function screenshotOnFailure(testInfo: TestInfo): Promise<void> {
  if (testInfo.status !== testInfo.expectedStatus && page) {
    const screenshotPath = testInfo.outputPath('failure.png');
    await page.screenshot({ path: screenshotPath });
    testInfo.attachments.push({
      name: 'failure-screenshot',
      path: screenshotPath,
      contentType: 'image/png',
    });
  }
}

test.beforeAll(async function () {
  await startMongoDB();
  await seedDatabase();

  electronApp = await launchVSCode();
  page = await electronApp.firstWindow();
  await waitForExtensionReady(page);
  await connectToMongoDB(page);
});

test.beforeEach(async function () {
  await closeAllEditors(page);
});

test.afterEach(async function ({}, testInfo) {
  await screenshotOnFailure(testInfo);
});

test.afterAll(async function () {
  copyExtensionLogs();

  if (electronApp) {
    await electronApp.close();
  }
  await cleanupDatabase();
  await stopMongoDB();
});

test('a document edited from the data browser can be saved', async () => {
  const isMac = process.platform === 'darwin';
  // Shell format serialises ints as `quantity: NumberInt('2')`.
  const QUANTITY = /quantity: NumberInt\('\d+'\)/;
  const tree = (text: string | RegExp): ReturnType<Page['locator']> =>
    page.locator('.monaco-list-row', { hasText: text });

  // Expand connection -> database -> collection to reveal "Documents".
  const expand = async (
    row: ReturnType<typeof tree>,
    child: ReturnType<typeof tree>,
  ): Promise<void> => {
    await row.first().waitFor({ state: 'visible' });
    if (!(await child.first().isVisible())) {
      await row.first().click();
    }
    await child.first().waitFor({ state: 'visible' });
  };
  const documentsRow = tree(/^Documents/);
  await expand(tree(`localhost:${TEST_DATABASE_PORT}`), tree(TEST_DB_NAME));
  await expand(tree(TEST_DB_NAME), tree(/^sales/));
  await expand(tree(/^sales/), documentsRow);

  // Open the collection in the data browser.
  await documentsRow.first().click({ button: 'right' });
  // "View Documents" is the first entry of the context menu.
  await expect(
    page.getByRole('menuitem', { name: 'View Documents' }),
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // Click the pencil icon on the first document.
  const { frameLocator } = await getDataBrowserContent(page);
  const cards = frameLocator.locator('[data-testid="monaco-viewer-container"]');
  await expect(cards).toHaveCount(8);
  await cards.first().hover();
  await cards.first().getByRole('button', { name: 'Edit Document' }).click();

  // The document opens in a text editor. Change `quantity`.
  const editorGroup = page.locator('.editor-group-container').first();
  let text = '';
  await expect(async () => {
    text = await getEditorText(editorGroup, electronApp);
    expect(text).toMatch(QUANTITY);
  }).toPass();
  const item = /item: '([^']+)'/.exec(text)?.[1];
  const region = /region: '([^']+)'/.exec(text)?.[1];
  expect(item).toBeTruthy();

  await electronApp.evaluate(
    ({ clipboard }, newText) => clipboard.writeText(newText),
    text.replace(QUANTITY, "quantity: NumberInt('999')"),
  );
  await page.keyboard.press(isMac ? 'Meta+KeyA' : 'Control+KeyA');
  await page.keyboard.press(isMac ? 'Meta+KeyV' : 'Control+KeyV');

  await page.keyboard.press(isMac ? 'Meta+KeyS' : 'Control+KeyS');
  // Wait for either outcome so a failure reports the actual error message.
  const notification = page
    .locator('.notification-list-item')
    .filter({ hasText: /saved successfully|cannot|error|fail|invalid/i })
    .first();
  await notification.waitFor();
  await expect(notification).toContainText(
    'The document was saved successfully',
  );

  // The change is persisted in the database.
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(TEST_DATABASE_URI);
  try {
    const docs = await client
      .db(TEST_DB_NAME)
      .collection('sales')
      .find({ quantity: 999 })
      .toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].item).toBe(item);
    expect(docs[0].region).toBe(region);
  } finally {
    await client.close();
  }
});
