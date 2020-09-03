import * as vscode from 'vscode';
const path = require('path');

import { getImagesPath } from '../extensionConstants';
import { TelemetryController } from '../telemetry';

const HELP_LINK_CONTEXT_VALUE = 'HELP_LINK';

export class HelpLinkTreeItem extends vscode.TreeItem {
  iconName?: string;
  contextValue = HELP_LINK_CONTEXT_VALUE;
  linkId: string;
  url: string;

  constructor(title: string, url: string, linkId: string, iconName?: string) {
    super(title, vscode.TreeItemCollapsibleState.None);

    this.linkId = linkId;
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
    treeView: vscode.TreeView<vscode.TreeItem>,
    telemetryController: TelemetryController
  ): void => {
    treeView.onDidChangeSelection(async (event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        if (selectedItem.contextValue === HELP_LINK_CONTEXT_VALUE) {
          telemetryController.trackLinkClicked(
            'helpPanel',
            selectedItem.linkId
          );

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
      const atlas = new HelpLinkTreeItem(
        'Create Free Atlas Cluster',
        'https://www.mongodb.com/cloud/atlas/register?utm_source=vscode&utm_medium=product&utm_campaign=VS%20code%20extension',
        'freeClusterCTA'
      );

      const feedback = new HelpLinkTreeItem(
        'Feedback',
        'https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/',
        'feedback'
      );

      const reportBug = new HelpLinkTreeItem(
        'Report a Bug',
        'https://github.com/mongodb-js/vscode/issues',
        'reportABug'
      );

      const extensionDocs = new HelpLinkTreeItem(
        'Extension Documentation',
        'https://docs.mongodb.com/mongodb-vscode/',
        'extensionDocumentation'
      );

      const mdbDocs = new HelpLinkTreeItem(
        'MongoDB Documentation',
        'https://docs.mongodb.com/manual/',
        'mongoDBDocumentation'
      );

      return Promise.resolve([
        atlas,
        feedback,
        reportBug,
        extensionDocs,
        mdbDocs
      ]);
    }

    return element.getChildren();
  }
}
