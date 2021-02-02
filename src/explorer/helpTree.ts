import * as vscode from 'vscode';
import { openLink } from '../utils/linkHelper';
const path = require('path');

import { getImagesPath } from '../extensionConstants';
import { TelemetryService } from '../telemetry';

const HELP_LINK_CONTEXT_VALUE = 'HELP_LINK';

function getIconPath(iconName?: string):
  | string
  | { light: string; dark: string } {
  if (!iconName || iconName === '') {
    return '';
  }

  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'help', `${iconName}.svg`),
    dark: path.join(DARK, 'help', `${iconName}.svg`)
  };
}

export class HelpLinkTreeItem extends vscode.TreeItem {
  iconName?: string;
  contextValue = HELP_LINK_CONTEXT_VALUE;
  linkId: string;
  url: string;
  useRedirect: boolean;

  constructor(title: string, url: string, linkId: string, iconName?: string, useRedirect = false) {
    super(title, vscode.TreeItemCollapsibleState.None);

    this.linkId = linkId;
    this.iconName = iconName;
    this.url = url;
    this.useRedirect = useRedirect;
    this.iconPath = getIconPath(iconName);
  }
}

export default class HelpTree implements vscode.TreeDataProvider<vscode.TreeItem> {
  contextValue = 'helpTree';

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>,
    telemetryService: TelemetryService
  ): void => {
    treeView.onDidChangeSelection(async (event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        await this.onClickHelpItem(selectedItem, telemetryService);
      }
    });
  };

  async getChildren(element?: any): Promise<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      const whatsNew = new HelpLinkTreeItem(
        'What\'s New',
        'https://github.com/mongodb-js/vscode/blob/master/CHANGELOG.md',
        'whatsNew',
        'megaphone'
      );

      const extensionDocs = new HelpLinkTreeItem(
        'Extension Documentation',
        'https://docs.mongodb.com/mongodb-vscode/',
        'extensionDocumentation',
        'book'
      );

      const mdbDocs = new HelpLinkTreeItem(
        'MongoDB Documentation',
        'https://docs.mongodb.com/manual/',
        'mongoDBDocumentation',
        'leaf'
      );

      const feedback = new HelpLinkTreeItem(
        'Suggest a Feature',
        'https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/',
        'feedback',
        'lightbulb'
      );

      const reportBug = new HelpLinkTreeItem(
        'Report a Bug',
        'https://github.com/mongodb-js/vscode/issues',
        'reportABug',
        'report'
      );

      const atlas = new HelpLinkTreeItem(
        'Create Free Atlas Cluster',
        'http://mongodb.com/products/vs-code/vs-code-atlas-signup?utm_campaign=vs-code-extension&utm_source=visual-studio&utm_medium=product',
        'freeClusterCTA',
        'atlas',
        true
      );

      return Promise.resolve([
        whatsNew,
        extensionDocs,
        mdbDocs,
        feedback,
        reportBug,
        atlas
      ]);
    }

    return element.getChildren();
  }

  async onClickHelpItem(helpItem: HelpLinkTreeItem, telemetryService: TelemetryService): Promise<void> {
    if (helpItem.contextValue === HELP_LINK_CONTEXT_VALUE) {
      telemetryService.trackLinkClicked(
        'helpPanel',
        helpItem.linkId
      );

      if (helpItem.useRedirect) {
        try {
          await openLink(helpItem.url);
        } catch (err) {
          // If opening the link fails we default to regular link opening.
          await vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(helpItem.url)
          );
        }
      } else {
        await vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.parse(helpItem.url)
        );
      }
    }
  }
}
