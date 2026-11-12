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
  createAndRunPlayground,
  createPlayground,
  getDataBrowserContent,
  getEditorText,
  copyExtensionLogs,
  updateUserSetting,
  TEST_DB_NAME,
} from './helpers';

let electronApp: ElectronApplication;
let page: Page;

async function screenshotOnFailure(testInfo: TestInfo): Promise<void> {
  if (testInfo.status !== testInfo.expectedStatus && page) {
    const screenshotPath = testInfo.outputPath('failure.png');
    await page.screenshot({ path: screenshotPath });
    console.log('screenshot saved to ', screenshotPath);
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
  // Close any leftover editor tabs from previous runs.
  await closeAllEditors(page);
});

test.afterEach(async function ({}, testInfo) {
  await screenshotOnFailure(testInfo);
});

test.afterAll(async function ({}, testInfo) {
  await screenshotOnFailure(testInfo);
  copyExtensionLogs();

  if (electronApp) {
    await electronApp.close();
  }
  await cleanupDatabase();
  await stopMongoDB();
});

test('playground aggregation results appear in data browsing view', async () => {
  // This aggregation groups sales by item, computes totals, filters items
  // with totalRevenue > 50, sorts by revenue descending, and adds a computed field.
  const playgroundCode = [
    `use('${TEST_DB_NAME}');`,
    '',
    'db.sales.aggregate([',
    '  {',
    '    $match: {',
    // match on date as a regression test to make sure that bson values are
    // serialised and deserialized correctly through all layers of IPC
    '      date: { $gte: new Date("2023-01-01") },',
    '    },',
    '  },',
    '  {',
    '    $group: {',
    '      _id: "$item",',
    '      totalQuantity: { $sum: "$quantity" },',
    '      totalRevenue: { $sum: { $multiply: ["$quantity", "$price"] } },',
    '      avgPrice: { $avg: "$price" },',
    '      regions: { $addToSet: "$region" },',
    '    },',
    '  },',
    '  {',
    '    $match: {',
    '      totalRevenue: { $gt: 50 },',
    '    },',
    '  },',
    '  {',
    '    $sort: { totalRevenue: -1 },',
    '  },',
    '  {',
    '    $project: {',
    '      item: "$_id",',
    '      totalQuantity: 1,',
    '      totalRevenue: 1,',
    '      avgPrice: { $round: ["$avgPrice", 2] },',
    '      regions: 1,',
    '      revenueCategory: {',
    '        $cond: {',
    '          if: { $gte: ["$totalRevenue", 200] },',
    '          then: "high",',
    '          else: "medium",',
    '        },',
    '      },',
    '    },',
    '  },',
    ']);',
  ].join('\n');

  await createAndRunPlayground(electronApp, page, playgroundCode);

  // Wait for the playground result tab to appear
  // The title pattern for playground results is "Playground Result: dbName.collectionName"
  await expect(async () => {
    const tabs = page.locator('.tab .label-name');
    const count = await tabs.count();
    const tabTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      tabTexts.push((await tabs.nth(i).textContent()) ?? '');
    }
    const hasPlaygroundResultTab = tabTexts.some(
      (text) => text.includes('Playground Result') || text.includes('sales'),
    );
    expect(hasPlaygroundResultTab).toBe(true);
  }).toPass({ timeout: 30_000 });

  // Access the data browser webview content
  const { frameLocator } = await getDataBrowserContent(page);

  // Wait for documents to load in the data browser
  // The MonacoViewer components render the aggregation results
  // Look for the pagination info showing the results count
  await expect(async () => {
    // The pagination shows "1-N" for cursor results (aggregation)
    const paginationText = await frameLocator
      .locator('text=/\\d+-\\d+/')
      .textContent({ timeout: 5_000 });
    expect(paginationText).toBeTruthy();
  }).toPass({ timeout: 30_000 });

  // Verify the aggregation produced results by checking for document content
  // The aggregation should produce results for items with totalRevenue > 50:
  // - thingamajig: (4*50 + 6*50) = 500
  // - gadget: (10*25 + 3*25) = 325
  // - widget: (2*10.5 + 5*10.5) = 73.5
  // - doohickey: (7*5 + 1*5) = 40 (filtered out, < 50)
  //
  // So we expect 3 results.

  // Verify the correct number of document cards are rendered
  const cards = frameLocator.locator('[data-testid="monaco-viewer-container"]');
  await expect(cards).toHaveCount(3, { timeout: 30_000 });

  // Verify each expected item appears in its own document card
  // and that the filtered-out item does not appear
  const normalize = (text: string): string => text.replace(/\s+/g, ' ');
  await expect(async () => {
    const cardTexts = await cards.evaluateAll((els) =>
      els.map((el) => el.textContent ?? ''),
    );
    const allText = normalize(cardTexts.join(' '));

    // The results should contain our aggregated item names
    expect(allText).toContain('thingamajig');
    expect(allText).toContain('gadget');
    expect(allText).toContain('widget');
    // doohickey should be filtered out (totalRevenue = 40, below threshold of 50)
    expect(allText).not.toContain('doohickey');

    // Verify computed fields are present in the document cards
    expect(allText).toContain('totalQuantity');
    expect(allText).toContain('totalRevenue');
    expect(allText).toContain('revenueCategory');
    // thingamajig has revenue 500 >= 200, so should be "high"
    expect(allText).toContain('high');
  }).toPass({ timeout: 30_000 });
});

test('playground find results appear in an editor when useWebViewDataBrowser is false', async () => {
  const previous = updateUserSetting('mdb.useWebViewDataBrowser', false);

  try {
    const playgroundCode = [
      `use('${TEST_DB_NAME}');`,
      '',
      'db.sales.find({ item: "thingamajig" });',
    ].join('\n');

    await createAndRunPlayground(electronApp, page, playgroundCode);

    await expect(async () => {
      const tabs = page.locator('.tab .label-name');
      const tabTexts = await tabs.allTextContents();
      expect(tabTexts).toContain('Playground Result');
      expect(
        tabTexts.some((text) => text.startsWith('Playground Result: ')),
      ).toBe(false);
    }).toPass({ timeout: 10_000 });

    let resultText = '';
    await expect(async () => {
      const resultEditorGroup = page.locator('.editor-group-container').filter({
        has: page.locator('.tab .label-name', {
          hasText: /^Playground Result$/,
        }),
      });
      resultText = await getEditorText(resultEditorGroup, electronApp);
      expect(resultText).toContain('thingamajig');
    }).toPass({ timeout: 10_000 });

    // _id is serialised as ObjectId('…24-hex-chars…'), not a plain string.
    expect(resultText).toMatch(/ObjectId\('[0-9a-f]{24}'\)/);

    // All document field names appear with indentation (not as a flat blob).
    for (const field of [
      '_id',
      'item',
      'quantity',
      'price',
      'date',
      'region',
      'tags',
    ]) {
      expect(resultText).toMatch(new RegExp(`^\\s+${field}:`, 'm'));
    }

    // Both thingamajig documents are present.
    expect(resultText).toMatch(/region: 'east'/);
    expect(resultText).toMatch(/region: 'west'/);

    expect(resultText).toMatch(/date: ISODate\('2024-01-25T/);
    expect(resultText).toMatch(/date: ISODate\('2024-02-20T/);

    expect(resultText).toMatch(/tags: \[\r?\n\s+'premium'/m);
    expect(resultText).toMatch(/'premium',\r?\n\s+'sale'/m);
  } finally {
    updateUserSetting('mdb.useWebViewDataBrowser', previous);
  }
});

test('playground aggregation errors are shown to the user', async () => {
  const playgroundCodeWithError = [
    `use('${TEST_DB_NAME}');`,
    '',
    // You can't skip on a findOne() cursor, so this errors.
    'db.sales.findOne().skip(2);',
    '',
  ].join('\n');

  await createAndRunPlayground(electronApp, page, playgroundCodeWithError);

  // Wait for the error result to show.
  await expect(async () => {
    const notification = page.locator('.notification-list-item');
    const count = await notification.count();
    const notificationTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      notificationTexts.push((await notification.nth(i).textContent()) ?? '');
    }
    const hasErrorNotification = notificationTexts.some((text) =>
      text.includes('db.sales.findOne().skip is not a function'),
    );
    expect(hasErrorNotification).toBe(true);
  }).toPass({ timeout: 30_000 });
});

// Manual-test matrix: "Completion works in playground" (also run on Windows
// CI, where it exercises the language server worker + connection hand-off).
test('playground autocompletes db, collection, field names and shell API', async () => {
  await createPlayground(electronApp, page, '');

  const editor = page.locator('.monaco-editor').first();
  const isMac = process.platform === 'darwin';
  const mod = isMac ? 'Meta' : 'Control';
  const suggestions = page.locator('.suggest-widget .monaco-list-row');

  // Replace the editor content with complete code (pasted, so the language
  // server can parse it; the cursor ends up at the end), move it `charsBack`
  // characters left
  // and wait until a suggestion containing `expected` shows.
  async function expectCompletion(
    code: string,
    charsBack: number,
    expected: string,
  ): Promise<void> {
    await editor.click();
    await electronApp.evaluate(
      ({ clipboard }, text) => clipboard.writeText(text),
      code,
    );
    await page.keyboard.press(`${mod}+KeyA`);
    await page.keyboard.press(`${mod}+KeyV`);
    // Wait for the paste to land: ArrowLeft on a still-selected editor would
    // jump to the start of the document. (Monaco renders spaces as nbsp.)
    await expect
      .poll(async () =>
        (await editor.locator('.view-lines').innerText()).replace(
          /\u00a0/g,
          ' ',
        ),
      )
      .toContain(code.split('\n').pop()!);
    for (let i = 0; i < charsBack; i++) {
      await page.keyboard.press('ArrowLeft');
    }
    // Collection/field names come from the connected server via the language
    // server, which can lag behind the first request: retry the trigger.
    await expect(async () => {
      await page.keyboard.press('Control+Space');
      await expect(
        suggestions.filter({ hasText: expected }).first(),
      ).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await page.keyboard.press('Escape');
  }

  const use = `use('${TEST_DB_NAME}');\n`;
  await expectCompletion("use('e2e');", 3, TEST_DB_NAME); // db names
  await expectCompletion(`${use}db.sa`, 0, 'sales'); // collection names
  await expectCompletion(`${use}db.sales.find({ ite});`, 3, 'item'); // fields
  await expectCompletion(`${use}db.sales.aggregat`, 0, 'aggregate'); // shell API
});
