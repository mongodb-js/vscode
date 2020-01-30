/**
 * Top-level global state for our extension.
 *
 * Singleton pattern set from `./src/extension.ts`
 */
import * as vscode from 'vscode';

export namespace mdb {
  /**
   * Set on extension.activate()
   */
  export let context: vscode.ExtensionContext;

  /**
   * https://github.com/microsoft/vscode-extension-samples/tree/master/tree-view-sample
   */
  export let treeDataProvider: any;
  export let treeView: vscode.TreeView<any>;

  /**
   * Like collection-model list in compass
   */
  export let connections: any;

  // remember namespaces can be nested :)
  export namespace settings {
    export const verbose: boolean = true;
  }
}
