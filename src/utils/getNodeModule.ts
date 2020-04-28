import * as vscode from 'vscode';

declare const webpackRequire: typeof require;
declare const nonWebpackRequire: typeof require;
export function getNodeModule<T>(moduleName: string): T | undefined {
  const r = typeof webpackRequire === 'function' ? nonWebpackRequire : require;
  try {
    return r(`${vscode.env.appRoot}/node_modules.asar/${moduleName}`);
  } catch (err) {
    // Not in ASAR.
  }

  try {
    return r(`${vscode.env.appRoot}/node_modules/${moduleName}`);
  } catch (err) {
    // Not available.
  }

  return undefined;
}
