import type * as vscode from 'vscode';
import { ChatMetadataStore } from './chatMetadata';

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

export class NamespaceRequestChatResult implements vscode.ChatResult {
  readonly metadata: {
    chatId: string;
    intent: 'askForNamespace';
    databaseName?: string | undefined;
    collectionName?: string | undefined;
  };

  constructor({
    databaseName,
    collectionName,
    history,
  }: {
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
    databaseName: string | undefined;
    collectionName: string | undefined;
  }) {
    this.metadata = {
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
      intent: 'askForNamespace',
      databaseName,
      collectionName,
    };
  }
}

export class EmptyRequestChatResult implements vscode.ChatResult {
  readonly metadata: {
    chatId: string;
    intent: 'emptyRequest';
  };

  constructor(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ) {
    this.metadata = {
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
      intent: 'emptyRequest',
    };
  }
}

export class AskToConnectChatResult implements vscode.ChatResult {
  readonly metadata: {
    chatId: string;
    intent: 'askToConnect';
  };

  constructor(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ) {
    this.metadata = {
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
      intent: 'askToConnect',
    };
  }
}
