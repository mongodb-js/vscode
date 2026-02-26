import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export type ChatMetadata = {
  databaseName?: string;
  collectionName?: string;
};

export class ChatMetadataStore {
  _chats: { [chatId: string]: ChatMetadata } = {};

  setChatMetadata(chatId: string, metadata: ChatMetadata): void {
    this._chats[chatId] = metadata;
  }

  getChatMetadata(chatId: string): ChatMetadata | undefined {
    return this._chats[chatId];
  }

  patchChatMetadata(
    context: vscode.ChatContext,
    patchedMetadata: Partial<ChatMetadata>,
  ): void {
    const chatId = ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
      context.history,
    );

    this.setChatMetadata(chatId, {
      ...this.getChatMetadata(chatId),
      ...patchedMetadata,
    });
  }

  // Exposed for stubbing in tests.
  static createNewChatId(): string {
    return uuidv4();
  }

  static getChatIdFromHistoryOrNewChatId(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  ): string {
    for (const historyItem of history) {
      if (
        historyItem instanceof vscode.ChatResponseTurn &&
        historyItem.result?.metadata?.chatId
      ) {
        return historyItem.result.metadata.chatId;
      }
    }

    return ChatMetadataStore.createNewChatId();
  }
}
