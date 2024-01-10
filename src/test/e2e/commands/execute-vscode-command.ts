import { Key } from 'webdriverio';
import { selectVsCodeQuickPick } from './select-vscode-quick-pick';

// The service helper workbench.executeCommand does not work reliably and will
// fail from time to time on second invocation hence here we have our own
// command helper to perform the same action. Note that this is to execute the
// root commands and not to select the follow up options from quick pick, for
// that please consider using selectVsCodeQuickPick command helper.
export const executeVsCodeCommand = async (
  browser: WebdriverIO.Browser,
  quickPickText: string,
  waitUntilGone = true
) => {
  await browser.keys([Key.Command, Key.Shift, 'P']);
  const element = await browser.$(
    '[title="Type the name of a command to run."]'
  );
  await element.addValue(quickPickText);

  await selectVsCodeQuickPick(browser, quickPickText, waitUntilGone);
};
