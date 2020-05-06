import * as vscode from 'vscode';

export function getNodeModule<T>(moduleName: string): T | undefined {
  try {
    return require(`${vscode.env.appRoot}/node_modules.asar/${moduleName}`);
  } catch (err) {
    // Not in ASAR.
  }

  try {
    return require(`${vscode.env.appRoot}/node_modules/${moduleName}`);
  } catch (err) {
    // Not available.
  }

  return undefined;
}
