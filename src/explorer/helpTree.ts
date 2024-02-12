import * as vscode from 'vscode';
import path from 'path';
import { getImagesPath } from '../extensionConstants';
import type { TelemetryService } from '../telemetry';
import { openLink } from '../utils/linkHelper';
import LINKS from '../utils/links';

const HELP_LINK_CONTEXT_VALUE = 'HELP_LINK';

function getIconPath(
  iconName?: string
): string | { light: string; dark: string } {
  if (!iconName || iconName === '') {
    return '';
  }

  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'help', `${iconName}.svg`),
    dark: path.join(DARK, 'help', `${iconName}.svg`),
  };
}

export class HelpLinkTreeItem extends vscode.TreeItem {
  iconName?: string;
  contextValue = HELP_LINK_CONTEXT_VALUE;
  linkId: string;
  url: string;
  useRedirect: boolean;

  constructor({
    title,
    url,
    linkId,
    iconName,
    useRedirect = false,
  }: {
    title: string;
    url: string;
    linkId: string;
    iconName?: string;
    useRedirect?: boolean;
  }) {
    super(title, vscode.TreeItemCollapsibleState.None);

    this.linkId = linkId;
    this.iconName = iconName;
    this.url = url;
    this.useRedirect = useRedirect;
    this.iconPath = getIconPath(iconName);
  }
}

export default class HelpTree
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  contextValue = 'helpTree' as const;
  _telemetryService?: TelemetryService;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>,
    telemetryService: TelemetryService
  ): void => {
    this._telemetryService = telemetryService;
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
      const whatsNew = new HelpLinkTreeItem({
        title: "What's New",
        url: LINKS.changelog,
        linkId: 'whatsNew',
        iconName: 'megaphone',
      });

      const extensionDocs = new HelpLinkTreeItem({
        title: 'Extension Documentation',
        url: LINKS.extensionDocs(),
        linkId: 'extensionDocumentation',
        iconName: 'book',
      });

      const mdbDocs = new HelpLinkTreeItem({
        title: 'MongoDB Documentation',
        url: LINKS.mongodbDocs,
        linkId: 'mongoDBDocumentation',
        iconName: 'leaf',
      });

      const feedback = new HelpLinkTreeItem({
        title: 'Suggest a Feature',
        url: LINKS.feedback,
        linkId: 'feedback',
        iconName: 'lightbulb',
      });

      const reportBug = new HelpLinkTreeItem({
        title: 'Report a Bug',
        url: LINKS.reportBug,
        linkId: 'reportABug',
        iconName: 'report',
      });

      const telemetryUserIdentity =
        this._telemetryService?.getTelemetryUserIdentity();

      const atlas = new HelpLinkTreeItem({
        title: 'Create Free Atlas Cluster',
        url: LINKS.createAtlasCluster(telemetryUserIdentity?.anonymousId ?? ''),
        linkId: 'freeClusterCTA',
        iconName: 'atlas',
        useRedirect: true,
      });

      return Promise.resolve([
        whatsNew,
        extensionDocs,
        mdbDocs,
        feedback,
        reportBug,
        atlas,
      ]);
    }

    return element.getChildren();
  }

  async onClickHelpItem(
    helpItem: HelpLinkTreeItem,
    telemetryService: TelemetryService
  ): Promise<void> {
    if (helpItem.contextValue === HELP_LINK_CONTEXT_VALUE) {
      telemetryService.trackLinkClicked('helpPanel', helpItem.linkId);

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
