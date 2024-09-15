import type * as vscode from 'vscode';
import { ChatMetadataStore } from './chatMetadata';

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

export class NamespaceRequestChatResult implements vscode.ChatResult {
  readonly metadata: {
    chatId: string;
    askForNamespace: true;
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
      askForNamespace: true,
      databaseName,
      collectionName,
    };
  }
}

export class EmptyRequestChatResult implements vscode.ChatResult {
  readonly metadata: {
    chatId: string;
    isEmptyResponse: true;
  };

  constructor(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ) {
    this.metadata = {
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
      isEmptyResponse: true,
    };
  }
}

export class AskToConnectChatResult implements vscode.ChatResult {
  readonly metadata: {
    chatId: string;
    askToConnect: true;
  };

  constructor(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ) {
    this.metadata = {
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
      askToConnect: true,
    };
  }
}
