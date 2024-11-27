import * as vscode from 'vscode';
import EXTENSION_COMMANDS from '../commands';
import type { SendMessageToParticipantFromInputOptions } from '../participant/participantTypes';
import { isPlayground } from '../utils/playground';
import { COPILOT_EXTENSION_ID } from '../participant/constants';

export class QueryWithCopilotCodeLensProvider
  implements vscode.CodeLensProvider
{
  constructor() {}

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    vscode.extensions.onDidChange;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!isPlayground(document.uri)) {
      return [];
    }

    // We can only detect whether a user has the Copilot extension active
    // but not whether it has an active subscription.
    const hasCopilotChatActive =
      vscode.extensions.getExtension(COPILOT_EXTENSION_ID)?.isActive === true;

    if (!hasCopilotChatActive) {
      return [];
    }

    const options: SendMessageToParticipantFromInputOptions = {
      prompt: 'Describe the query you would like to generate.',
      placeHolder:
        'e.g. Find the document in sample_mflix.users with the name of Kayden Washington',
      messagePrefix: '/query',
      isNewChat: true,
      source: 'query with copilot codelens',
    };

    return [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: '✨ Generate query with MongoDB Copilot',
        command: EXTENSION_COMMANDS.SEND_MESSAGE_TO_PARTICIPANT_FROM_INPUT,
        arguments: [options],
      }),
    ];
  }
}
