import type { Reference, VerifiedAnswer } from 'mongodb-rag-core';
import formatError from '../utils/formatError';

const MONGODB_DOCS_CHATBOT_BASE_URI = 'https://knowledge.mongodb.com/';

const MONGODB_DOCS_CHATBOT_API_VERSION = 'v1';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

type Role = 'user' | 'assistant';

type ConversationData = {
  _id: string;
  createdAt: string;
  messages: MessageData[];
  conversationId: string;
};

type MessageData = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  rating?: boolean;
  references?: Reference[];
  suggestedPrompts?: string[];
  metadata?: AssistantMessageMetadata;
};

type AssistantMessageMetadata = {
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

export class DocsChatbotAIService {
  _serverBaseUri: string;

  constructor() {
    this._serverBaseUri =
      process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE ||
      MONGODB_DOCS_CHATBOT_BASE_URI;
  }

  private getUri(path: string): string {
    return `${this._serverBaseUri}api/${MONGODB_DOCS_CHATBOT_API_VERSION}${path}`;
  }

  _fetch({
    uri,
    method,
    body,
    signal,
    headers,
  }: {
    uri: string;
    method: string;
    signal?: AbortSignal;
    body?: string;
    headers?: { [key: string]: string };
  }): Promise<Response> {
    return fetch(uri, {
      headers: {
        'X-Request-Origin': `vscode-mongodb-copilot-v${version as string}/docs`,
        'User-Agent': `mongodb-vscode/${version as string}`,
        ...headers,
      },
      method,
      signal,
      ...(body && { body }),
    });
  }

  async createConversation({
    signal,
  }: {
    signal: AbortSignal;
  }): Promise<ConversationData> {
    const uri = this.getUri('/conversations');
    const res = await this._fetch({
      uri,
      method: 'POST',
      signal,
    });

    let data;
    try {
      data = await res.json();
    } catch (error) {
      throw new Error('[Docs chatbot] Internal server error');
    }

    if (res.status === 400) {
      throw new Error(`[Docs chatbot] Bad request: ${data?.error as string}`);
    }
    if (res.status === 429) {
      throw new Error(`[Docs chatbot] Rate limited: ${data?.error as string}`);
    }
    if (res.status >= 500) {
      throw new Error(
        `[Docs chatbot] Internal server error: ${
          data?.error
            ? (data.error as string)
            : `${res.status} - ${res.statusText}`
        }`,
      );
    }

    return {
      ...data,
      conversationId: data._id,
    };
  }

  async addMessage({
    conversationId,
    message,
    signal,
  }: {
    conversationId: string;
    message: string;
    signal: AbortSignal;
  }): Promise<MessageData> {
    const uri = this.getUri(`/conversations/${conversationId}/messages`);
    const res = await this._fetch({
      uri,
      method: 'POST',
      body: JSON.stringify({ message }),
      headers: { 'Content-Type': 'application/json' },
      signal,
    });

    let data;
    try {
      data = await res.json();
    } catch (error) {
      throw new Error('[Docs chatbot] Internal server error');
    }

    if (res.status === 400) {
      throw new Error(`[Docs chatbot] Bad request: ${data?.error as string}`);
    }
    if (res.status === 404) {
      throw new Error(
        `[Docs chatbot] Conversation not found: ${data?.error as string}`,
      );
    }
    if (res.status === 429) {
      throw new Error(`[Docs chatbot] Rate limited: ${data?.error as string}`);
    }
    if (res.status === 504) {
      throw new Error(`[Docs chatbot] Timeout: ${data?.error as string}`);
    }
    if (res.status >= 500) {
      throw new Error(
        `[Docs chatbot] Internal server error: ${
          data?.error
            ? (data?.error as string)
            : `${res.status} - ${res.statusText}`
        }`,
      );
    }

    return data;
  }

  async rateMessage({
    conversationId,
    messageId,
    rating,
  }: {
    conversationId: string;
    messageId: string;
    rating: boolean;
  }): Promise<boolean> {
    const uri = this.getUri(
      `/conversations/${conversationId}/messages/${messageId}/rating`,
    );
    const res = await this._fetch({
      uri,
      method: 'POST',
      body: JSON.stringify({ rating }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 204) {
      return rating;
    }

    let data;
    if (res.status >= 400) {
      try {
        data = await res.json();
      } catch (error) {
        throw new Error(
          `[Docs chatbot] Internal server error: ${formatError(error).message}`,
        );
      }
    }

    throw new Error(
      `[Docs chatbot] Internal server error: ${
        data?.error
          ? (data?.error as string)
          : `${res.status} - ${res.statusText}`
      }`,
    );
  }
}
