import WaitUtils from 'wdio-wait-for';
import type { browser as wdioBrowser } from '@wdio/globals';
import { openMongoDBOverviewPage } from './open-mongodb-overview-page';
import { setInputValue } from './set-input-value';

export async function connectWithConnectionStringUsingCommand(
  browser: typeof wdioBrowser,
  connectionString: string
) {
  const workbench = await browser.getWorkbench();

  // Connect with OIDC connection string
  const connectionStringInput = await workbench.executeCommand(
    'MongoDB: Connect with Connection String...'
  );
  await connectionStringInput.wait();
  await connectionStringInput.setText(connectionString);
  await connectionStringInput.confirm();
  await browser.waitUntil(WaitUtils.invisibilityOf(connectionStringInput.elem));
}

export async function connectWithConnectionString(
  browser: typeof wdioBrowser,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectionString: string
) {
  const workbench = await browser.getWorkbench();
  await workbench.executeCommand('MongoDB: Open Overview Page');
  const mongodbWebView = await workbench.getWebviewByTitle('MongoDB');
  await mongodbWebView.open();

  const elements = await browser.$(
    '[data-testid="connect-with-connection-string-btn"]'
  );
  await elements.click({ button: 0 });

  // Note: Active element here is the entire webview instead of the second prompt that
  // asks for connection string hence this can't be used to type in connection
  // string unfortunately.

  // Closing the webview also closes the connection string native popup for some reasons. :(
  // await mongodbWebView.close();

  // const activeElementHandle = await browser.getActiveElement();
  // const activeElement = await browser.$(activeElementHandle);
  // await activeElement.waitForDisplayed();

  // Note: Trying to get a hold of input using webdriver $ selector does not
  // work either because the view in focus is webview which does not have our
  // connection string prompt. Closing the webview, in the hope that it will
  // bring the focus to workbench, also does not work for some weird reason.

  // const editorElementFromBrowser = await
  // browser.$('div.monaco-inputbox input'); const editorElement = await
  // workbench.elem.$('div.monaco-inputbox input');
}

export async function connectWithConnectionStringUsingWebviewForm(
  browser: typeof wdioBrowser,
  connectionString: string
) {
  const webview = await openMongoDBOverviewPage(browser);
  const openConnectionFormBtn = await browser.$(
    '[data-testid="open-connection-form-btn"]'
  );
  await openConnectionFormBtn.waitForClickable();
  await openConnectionFormBtn.click({ button: 0 });

  const connectionStringInput = await browser.$(
    '[data-testid="connectionString"]'
  );
  await setInputValue(browser, connectionStringInput, connectionString);

  const connectBtn = await browser.$('[data-testid="connect-button"]');
  await connectBtn.waitForClickable();
  await connectBtn.click({ button: 0 });

  await browser.waitUntil(
    async () => {
      const connectionFormModal = await browser.$(
        '[data-testid="connection-form-modal"]'
      );
      const isDisplayed = await connectionFormModal.isDisplayed();
      return !isDisplayed;
    },
    {
      timeoutMsg: 'Connection Form modal still present',
    }
  );

  return webview;
}
