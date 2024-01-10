import { executeVsCodeCommand } from './execute-vscode-command';

export const copyTerminalOutput = async (browser: WebdriverIO.Browser) => {
  await executeVsCodeCommand(browser, 'Terminal: Select All');
  await executeVsCodeCommand(browser, 'Copy');
};
