import type * as vscode from 'vscode';
import { ChatMetadataStore } from './chatMetadata';
import type { ParticipantResponseType } from './participantTypes';

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';
export const COPILOT_EXTENSION_ID = 'GitHub.copilot';
export const COPILOT_CHAT_EXTENSION_ID = 'GitHub.copilot-chat';

export const codeBlockIdentifier = {
  start: '```javascript',
  end: '```',
};

interface Metadata {
  intent: Exclude<ParticipantResponseType, 'askForNamespace' | 'docs'>;
  chatId: string;
}

interface AskForNamespaceMetadata {
  intent: 'askForNamespace';
  chatId: string;
  databaseName?: string | undefined;
  collectionName?: string | undefined;
}

interface DocsRequestMetadata {
  intent: 'docs';
  chatId: string;
  docsChatbotMessageId?: string;
}

export interface ChatResult extends vscode.ChatResult {
  readonly metadata: Metadata | AskForNamespaceMetadata | DocsRequestMetadata;
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

export function createCancelledRequestChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('cancelledRequest', history);
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

export function docsRequestChatResult({
  chatId,
  docsChatbotMessageId,
}: {
  chatId: string;
  docsChatbotMessageId?: string;
}): ChatResult {
  return {
    metadata: {
      chatId,
      intent: 'docs',
      docsChatbotMessageId,
    },
  };
}

export function schemaRequestChatResult(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): ChatResult {
  return createChatResult('schema', history);
}
