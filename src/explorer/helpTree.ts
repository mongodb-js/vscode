import * as vscode from 'vscode';
const path = require('path');

import { getImagesPath } from '../extensionConstants';

const HELP_LINK_CONTEXT_VALUE = 'HELP_LINK';

export class HelpLinkTreeItem extends vscode.TreeItem {
  iconName?: string;
  contextValue = HELP_LINK_CONTEXT_VALUE;
  url: string;

  constructor(title: string, url: string, iconName?: string) {
    super(title, vscode.TreeItemCollapsibleState.None);

    this.iconName = iconName;
    this.url = url;
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    if (!this.iconName || this.iconName === '') {
      return '';
    }

    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'index', `${this.iconName}.svg`),
      dark: path.join(DARK, 'index', `${this.iconName}.svg`)
    };
  }
}

export default class HelpTree
implements vscode.TreeDataProvider<vscode.TreeItem> {
  contextValue = 'helpTree';

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>
  ): void => {
    treeView.onDidChangeSelection(async (event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        if (selectedItem.contextValue === HELP_LINK_CONTEXT_VALUE) {
          await vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(selectedItem.url)
          );
        }
      }
    });
  };

  public async getChildren(element?: any): Promise<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      const extensionDocs = new HelpLinkTreeItem(
        'Extension Documentation',
        'https://docs.mongodb.com/mongodb-vscode/',
        ''
      );

      const feedback = new HelpLinkTreeItem(
        'Feedback',
        'https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/',
        ''
      );

      const submitABug = new HelpLinkTreeItem(
        'Submit a Bug',
        'https://github.com/mongodb-js/vscode/issues',
        ''
      );

      // https://www.mongodb.com/cloud/atlas/register?utm_source=vscode&utm_medium=product&utm_campaign=VS%20code%20extension
      const atlas = new HelpLinkTreeItem(
        'MongoDB Atlas',
        'https://www.mongodb.com/cloud/atlas',
        ''
      );

      const mdbDocs = new HelpLinkTreeItem(
        'MongoDB Documentation',
        'https://docs.mongodb.com/manual/',
        ''
      );

      return Promise.resolve([
        extensionDocs,
        feedback,
        submitABug,
        atlas,
        mdbDocs
      ]);
    }

    return element.getChildren();
  }
}
