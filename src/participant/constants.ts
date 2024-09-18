import type * as vscode from 'vscode';
import { ChatMetadataStore } from './chatMetadata';

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

export type ParticipantResponseType =
  | 'query'
  | 'schema'
  | 'docs'
  | 'generic'
  | 'emptyRequest'
  | 'askToConnect'
  | 'askForNamespace';

interface Metadata {
  intent: Exclude<ParticipantResponseType, 'askForNamespace'>;
  chatId: string;
}

interface AskForNamespaceMetadata {
  intent: 'askForNamespace';
  chatId: string;
  databaseName?: string | undefined;
  collectionName?: string | undefined;
}

export interface ChatResult extends vscode.ChatResult {
  readonly metadata: Metadata | AskForNamespaceMetadata;
}

export function namespaceRequestChatResult({
  databaseName,
  collectionName,
  history,
}: {
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
  databaseName: string | undefined;
  collectionName: string | undefined;
}): ChatResult {
  return {
    metadata: {
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
      intent: 'askForNamespace',
      databaseName,
      collectionName,
    },
  };
}

function createChatResult(
  intent: ParticipantResponseType,
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return {
    metadata: {
      intent,
      chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(history),
    },
  };
}

export function emptyRequestChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('emptyRequest', history);
}

export function askToConnectChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('askToConnect', history);
}

export function genericRequestChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('generic', history);
}

export function queryRequestChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('query', history);
}

export function schemaRequestChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('schema', history);
}
