import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export type ChatMetadata = {
  databaseName?: string;
  collectionName?: string;
  docsChatbotConversationId?: string;
};

export class ChatMetadataStore {
  _chats: { [chatId: string]: ChatMetadata } = {};

  constructor() {}

  setChatMetadata(chatId: string, metadata: ChatMetadata): void {
    this._chats[chatId] = metadata;
  }

  getChatMetadata(chatId: string): ChatMetadata | undefined {
    return this._chats[chatId];
  }

  static getChatIdFromHistoryOrNewChatId(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ): string {
    for (const historyItem of history) {
      if (
        historyItem instanceof vscode.ChatResponseTurn &&
        historyItem.result?.metadata?.chatId
      ) {
        return historyItem.result.metadata.chatId;
      }
    }

    return uuidv4();
  }
}
