import { selectVsCodeQuickPick } from './select-vscode-quick-pick';
import { executeVsCodeCommand } from './execute-vscode-command';

export const readFromClipboard = async (browser: WebdriverIO.Browser) => {
  // const workBench = await browser.getWorkbench();
  await executeVsCodeCommand(browser, 'Create: New File...', false);
  await selectVsCodeQuickPick(browser, 'Text File');
  await executeVsCodeCommand(browser, 'Paste');

  const text = await browser.executeWorkbench((vscode) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return 'no editor';
    }

    return editor.document.getText() as string;
  });

  await executeVsCodeCommand(browser, 'View: Revert and Close Editor');
  return text;
};
