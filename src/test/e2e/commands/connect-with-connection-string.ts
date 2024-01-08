import WaitUtils from 'wdio-wait-for';
import type { browser as wdioBrowser } from '@wdio/globals';

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
