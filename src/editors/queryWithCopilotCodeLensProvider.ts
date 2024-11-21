import * as vscode from 'vscode';
import EXTENSION_COMMANDS from '../commands';

const COPILOT_CHAT_EXTENSION_ID = 'GitHub.copilot-chat';

export class QueryWithCopilotCodeLensProvider
  implements vscode.CodeLensProvider
{
  constructor() {}

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    vscode.extensions.onDidChange;

  provideCodeLenses(): vscode.CodeLens[] {
    // We can only detect whether a user has the Copilot extension active
    // but not whether it has an active subscription.
    const hasCopilotInstalled =
      vscode.extensions.getExtension(COPILOT_CHAT_EXTENSION_ID)?.isActive ===
      true;

    if (!hasCopilotInstalled) {
      return [];
    }

    return [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: '✨ Generate query with MongoDB Copilot',
        command: EXTENSION_COMMANDS.SEND_PARTICIPANT_MESSAGE,
        arguments: [
          {
            message: '/query ',
            isNewChat: true,
            isPartialQuery: true,
          },
        ],
      }),
    ];
  }
}
