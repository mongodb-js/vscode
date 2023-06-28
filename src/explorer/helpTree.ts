import * as vscode from 'vscode';
import path from 'path';
import { getImagesPath } from '../extensionConstants';
import { TelemetryService } from '../telemetry';
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

  constructor(
    title: string,
    url: string,
    linkId: string,
    iconName?: string,
    useRedirect = false
  ) {
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
      const whatsNew = new HelpLinkTreeItem(
        "What's New",
        LINKS.changelog,
        'whatsNew',
        'megaphone'
      );

      const extensionDocs = new HelpLinkTreeItem(
        'Extension Documentation',
        LINKS.extensionDocs(),
        'extensionDocumentation',
        'book'
      );

      const mdbDocs = new HelpLinkTreeItem(
        'MongoDB Documentation',
        LINKS.mongodbDocs,
        'mongoDBDocumentation',
        'leaf'
      );

      const feedback = new HelpLinkTreeItem(
        'Suggest a Feature',
        LINKS.feedback,
        'feedback',
        'lightbulb'
      );

      const reportBug = new HelpLinkTreeItem(
        'Report a Bug',
        LINKS.reportBug,
        'reportABug',
        'report'
      );

      const telemetryUserIdentity =
        this._telemetryService?.getTelemetryUserIdentity();

      const atlas = new HelpLinkTreeItem(
        'Create Free Atlas Cluster',
        LINKS.createAtlasCluster(
          telemetryUserIdentity?.userId ??
            telemetryUserIdentity?.anonymousId ??
            ''
        ),
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
