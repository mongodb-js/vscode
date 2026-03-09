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
  getDataBrowserContent,
  TEST_DB_NAME,
} from './helpers';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  await startMongoDB();
  await seedDatabase();

  electronApp = await launchVSCode();
  page = await electronApp.firstWindow();
  await waitForExtensionReady(page);
  await connectToMongoDB(page);
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
  await cleanupDatabase();
  await stopMongoDB();
});

test('playground aggregation results appear in data browsing view', async () => {
  // Close any leftover editor tabs from previous runs
  await closeAllEditors(page);

  // This aggregation groups sales by item, computes totals, filters items
  // with totalRevenue > 50, sorts by revenue descending, and adds a computed field.
  const playgroundCode = [
    `use('${TEST_DB_NAME}');`,
    '',
    'db.sales.aggregate([',
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
    const title = await page.title();
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
    // The pagination shows "1-N of N/A" for cursor results (aggregation)
    const paginationText = await frameLocator
      .locator('text=/\\d+-\\d+ of/')
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

  // Check that at least some document content is visible in the webview.
  // Monaco viewer word-wraps long text, so we collapse whitespace before comparing.
  const normalize = (text: string) => text.replace(/\s+/g, ' ');

  await expect(async () => {
    const bodyText = normalize(
      (await frameLocator.locator('body').textContent({ timeout: 5_000 })) ??
        '',
    );
    // The results should contain our aggregated item names
    expect(bodyText).toContain('thingamajig');
    expect(bodyText).toContain('gadget');
    expect(bodyText).toContain('widget');
    // doohickey should be filtered out (totalRevenue = 40, below threshold of 50)
    expect(bodyText).not.toContain('doohickey');
  }).toPass({ timeout: 30_000 });

  // Verify computed fields are present
  await expect(async () => {
    const bodyText = normalize(
      (await frameLocator.locator('body').textContent({ timeout: 5_000 })) ??
        '',
    );
    // Check for the aggregation computed fields
    expect(bodyText).toContain('totalQuantity');
    expect(bodyText).toContain('totalRevenue');
    expect(bodyText).toContain('revenueCategory');
    // thingamajig has revenue 500 >= 200, so should be "high"
    expect(bodyText).toContain('high');
  }).toPass({ timeout: 30_000 });
});
