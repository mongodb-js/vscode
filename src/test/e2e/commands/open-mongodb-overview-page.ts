import type { browser as wdioBrowser } from '@wdio/globals';

export const openMongoDBOverviewPage = async (browser: typeof wdioBrowser) => {
  const workbench = await browser.getWorkbench();
  // First we need to open the mongodb overview page to trigger the activation
  // of extension so it can open the overview page by default for first launch,
  // if applicable
  const mongodbView = await workbench
    .getActivityBar()
    .getViewControl('MongoDB');
  await mongodbView?.openView();

  const mongodbOverviewAlreadyOpened = await browser
    .waitUntil(
      async () => {
        return !!(await workbench.getWebviewByTitle('MongoDB'));
      },
      {
        timeout: 1000,
      }
    )
    .catch(() => {
      // If the page doesn't come up by now then it is not the first launch
      return false;
    });

  if (!mongodbOverviewAlreadyOpened) {
    await workbench.executeCommand('MongoDB: Open overview Page');
    await browser.waitUntil(
      async () => {
        return !!(await workbench.getWebviewByTitle('MongoDB'));
      },
      {
        timeout: 1500,
      }
    );
  }
  const webview = await workbench.getWebviewByTitle('MongoDB');
  await webview.open();
  const appRoot = await browser.$('#mdb-overview-root');
  await appRoot.waitForDisplayed();

  return webview;
};
