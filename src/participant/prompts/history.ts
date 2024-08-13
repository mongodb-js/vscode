import * as vscode from 'vscode';

import { CHAT_PARTICIPANT_ID } from '../constants';

export function getHistoryMessages({
  context,
}: {
  context: vscode.ChatContext;
}): vscode.LanguageModelChatMessage[] {
  const messages: vscode.LanguageModelChatMessage[] = [];

  context.history.map((historyItem) => {
    if (
      historyItem.participant === CHAT_PARTICIPANT_ID &&
      historyItem instanceof vscode.ChatRequestTurn
    ) {
      // eslint-disable-next-line new-cap
      messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
    }

    if (
      historyItem.participant === CHAT_PARTICIPANT_ID &&
      historyItem instanceof vscode.ChatResponseTurn
    ) {
      let res = '';
      for (const fragment of historyItem.response) {
        res += fragment;
      }
      // eslint-disable-next-line new-cap
      messages.push(vscode.LanguageModelChatMessage.Assistant(res));
    }
  });

  return messages;
}
