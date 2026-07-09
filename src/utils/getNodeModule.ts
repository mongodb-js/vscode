import * as vscode from 'vscode';

export function getNodeModule<T>(moduleName: string): T | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`${vscode.env.appRoot}/node_modules.asar/${moduleName}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    // Not in ASAR.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`${vscode.env.appRoot}/node_modules/${moduleName}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    // Not available.
  }

  return undefined;
}
