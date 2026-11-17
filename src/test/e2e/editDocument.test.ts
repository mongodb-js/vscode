/* eslint-disable no-empty-pattern */
import type { TestInfo } from '@playwright/test';
import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { EJSON, type Document } from 'bson';
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
import { allBsonTypes } from '../fixture/all-bson-types';

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

const ALL_TYPES_COLLECTION = 'allTypes';

// Canonical EJSON keeps every BSON type distinct (e.g. Double(1) vs Int32(1)),
// so comparing it catches any type that is lost or coerced on the round trip.
const toCanonicalEJSON = (doc: Document): Document =>
  EJSON.serialize(doc, { relaxed: false });

test('a document with all BSON types survives an edit round trip', async () => {
  const isMac = process.platform === 'darwin';
  const STRING_FIELD = /string: 'pineapple'/;
  const tree = (text: string | RegExp): ReturnType<Page['locator']> =>
    page.locator('.monaco-list-row', { hasText: text });

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(TEST_DATABASE_URI);
  try {
    const collection = client.db(TEST_DB_NAME).collection(ALL_TYPES_COLLECTION);
    await collection.drop().catch(() => undefined);
    await collection.insertOne({ ...allBsonTypes });

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
    const collectionRow = tree(new RegExp(`^${ALL_TYPES_COLLECTION}`));
    const documentsRow = tree(/^Documents/);
    await expand(tree(`localhost:${TEST_DATABASE_PORT}`), tree(TEST_DB_NAME));
    await expand(tree(TEST_DB_NAME), collectionRow);
    await expand(collectionRow, documentsRow);

    // Open the collection in the data browser.
    await documentsRow.first().click({ button: 'right' });
    // "View Documents" is the first entry of the context menu.
    await expect(
      page.getByRole('menuitem', { name: 'View Documents' }),
    ).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Click the pencil icon on the document.
    const { frameLocator } = await getDataBrowserContent(page);
    const cards = frameLocator.locator(
      '[data-testid="monaco-viewer-container"]',
    );
    await expect(cards).toHaveCount(1);
    await cards.first().hover();
    await cards.first().getByRole('button', { name: 'Edit Document' }).click();

    // The document opens in a text editor. Change `string`, leaving every
    // other field as the extension serialised it.
    const editorGroup = page.locator('.editor-group-container').first();
    let text = '';
    await expect(async () => {
      text = await getEditorText(editorGroup, electronApp);
      expect(text).toMatch(STRING_FIELD);
    }).toPass();

    await electronApp.evaluate(
      ({ clipboard }, newText) => clipboard.writeText(newText),
      text.replace(STRING_FIELD, "string: 'mango'"),
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

    // Only the edited field changed; every BSON type round-tripped intact.
    const docs = await collection
      .find({}, { promoteValues: false, bsonRegExp: true })
      .toArray();
    expect(docs).toHaveLength(1);
    expect(toCanonicalEJSON(docs[0])).toEqual(
      toCanonicalEJSON({
        ...allBsonTypes,
        string: 'mango',
        // TODO: Remove once BSONSymbol round-trips. The shell-bson-parser
        // `toJSString` has no serializer for BSONSymbol, so the edit view
        // shows `{ value: 'symbol' }` and saving writes back a plain object,
        // losing the deprecated symbol type.
        symbol: { value: 'symbol' },
      }),
    );
  } finally {
    await client.close();
  }
});
