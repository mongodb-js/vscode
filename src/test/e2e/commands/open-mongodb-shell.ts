import { copyTerminalOutput } from './copy-terminal-output';
import { executeVsCodeCommand } from './execute-vscode-command';
import { readFromClipboard } from './read-from-clipboard';

export const openMongoDbShell = async (browser: WebdriverIO.Browser) => {
  await executeVsCodeCommand(browser, 'MongoDB: Launch MongoDB Shell');
  await browser.waitUntil(
    async () => {
      await copyTerminalOutput(browser);
      const text = await readFromClipboard(browser);
      return text.includes('Using MongoDB');
    },
    {
      timeoutMsg: '"Using MongoDB" did not appear in terminal text',
    }
  );
};
