import type { Reference, VerifiedAnswer } from 'mongodb-rag-core';

const MONGODB_DOCS_CHATBOT_API_VERSION = 'v1';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

export type Role = 'user' | 'assistant';

export type ConversationData = {
  _id: string;
  createdAt: string;
  messages: MessageData[];
  conversationId: string;
};

export type MessageData = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  rating?: boolean;
  references?: Reference[];
  suggestedPrompts?: string[];
  metadata?: AssistantMessageMetadata;
};

export type AssistantMessageMetadata = {
  [k: string]: unknown;

  /**
    If the message came from the verified answers collection, contains the
    metadata about the verified answer.
  */
  verifiedAnswer?: {
    _id: VerifiedAnswer['_id'];
    created: string;
    updated: string | undefined;
  };
};

export class TimeoutError<Data extends object = object> extends Error {
  data?: Data;

  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
    this.message = message;
  }
}

export class DocsChatbotAIService {
  _serverBaseUri?: string;

  constructor(serverBaseUri?: string) {
    this._serverBaseUri = serverBaseUri;
  }

  private getServerBaseUri(): string {
    if (!this._serverBaseUri) {
      throw new Error(
        'You must define a serverBaseUri for the DocsChatbotAIService'
      );
    }
    return this._serverBaseUri;
  }

  private getUri(path: string): string {
    const serverBaseUri = this.getServerBaseUri();
    return `${serverBaseUri}api/${MONGODB_DOCS_CHATBOT_API_VERSION}${path}`;
  }

  async createConversation(): Promise<ConversationData> {
    const uri = this.getUri('/conversation');
    return this._fetch({
      uri,
      method: 'POST',
    });
  }

  async _fetch<T = unknown>({
    uri,
    method,
    body,
    headers,
  }: {
    uri: string;
    method: string;
    body?: string;
    headers?: { [key: string]: string };
  }): Promise<T> {
    const resp = await fetch(uri, {
      headers: {
        origin: this.getServerBaseUri(),
        'User-Agent': `mongodb-vscode/${version}`,
        ...headers,
      },
      method,
      ...(body && { body }),
    });

    let conversation;
    try {
      conversation = await resp.json();
    } catch (error) {
      throw new Error('Internal server error');
    }

    if (resp.status === 400) {
      throw new Error(`Bad request: ${conversation.error}`);
    }
    if (resp.status === 429) {
      throw new Error(`Rate limited: ${conversation.error}`);
    }
    if (resp.status >= 500) {
      throw new Error(`Internal server error: ${conversation.error}`);
    }
    return {
      ...conversation,
      conversationId: conversation._id,
    };
  }

  async addMessage({
    conversationId,
    message,
  }: {
    conversationId: string;
    message: string;
  }): Promise<MessageData> {
    const uri = this.getUri(`/conversations/${conversationId}/messages`);
    return await this._fetch({
      uri,
      method: 'POST',
      body: JSON.stringify({ message }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
