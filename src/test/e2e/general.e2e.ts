import { browser, expect } from '@wdio/globals';
import { suite, test } from 'mocha';

suite('E2E setup', function () {
  test('it should be able to load MongoDB extension', async function () {
    const workbench = await browser.getWorkbench();
    const mongodbView = await workbench
      .getActivityBar()
      .getViewControl('MongoDB');
    expect(mongodbView).not.toBeNull;
    await mongodbView?.openView();
    // Loads the webview on first load
    const webview = await workbench.getWebviewByTitle('MongoDB');
    expect(webview).not.toBeNull;
  });
});
