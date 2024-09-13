import type * as vscode from 'vscode';

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

export class NamespaceRequestChatResult implements vscode.ChatResult {
  readonly metadata: {
    askForNamespace: true;
    databaseName?: string | undefined;
    collectionName?: string | undefined;
  };

  constructor({
    databaseName,
    collectionName,
  }: {
    databaseName: string | undefined;
    collectionName: string | undefined;
  }) {
    this.metadata = {
      askForNamespace: true,
      databaseName,
      collectionName,
    };
  }
}

export class EmptyRequestChatResult implements vscode.ChatResult {
  readonly metadata: {
    isEmptyResponse: true;
  };

  constructor() {
    this.metadata = {
      isEmptyResponse: true,
    };
  }
}

export class AskToConnectChatResult implements vscode.ChatResult {
  readonly metadata: {
    askToConnect: true;
  };

  constructor() {
    this.metadata = {
      askToConnect: true,
    };
  }
}
