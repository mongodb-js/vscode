import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export type ChatMetadata = {
  databaseName?: string;
  collectionName?: string;
};

export class ChatMetadataStore {
  _chats: { [chatId: string]: ChatMetadata } = {};

  constructor() {}

  // TODO: On each message with chat, we ensure there's a chat id.
  // If there's not, we create a new chat metadata object and store it.
  // If there is a chat id, then we check if there's a metadata object
  // for it. We'll update or create one depending.

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
