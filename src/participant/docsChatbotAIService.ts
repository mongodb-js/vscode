import type { Reference, VerifiedAnswer } from 'mongodb-rag-core';

const MONGODB_DOCS_CHATBOT_BASE_URI = 'http://localhost:3000/';

const MONGODB_DOCS_CHATBOT_API_VERSION = 'v1';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

const DEFAULT_HEADERS = {
  origin: MONGODB_DOCS_CHATBOT_BASE_URI,
  'User-Agent': `mongodb-vscode/${version}`,
};

export type Role = 'user' | 'assistant';

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
  private getUrl(path: string): string {
    return `${MONGODB_DOCS_CHATBOT_BASE_URI}api/${MONGODB_DOCS_CHATBOT_API_VERSION}${path}`;
  }

  async createConversation(): Promise<any> {
    const path = '/conversations';
    const resp = await fetch(this.getUrl(path), {
      headers: DEFAULT_HEADERS,
      method: 'POST',
    });
    const conversation = await resp.json();
    if (resp.status === 400) {
      throw new Error(`Bad request: ${conversation.error}`);
    }
    if (resp.status === 429) {
      // TODO: Handle rate limiting
      throw new Error(`Rate limited: ${conversation.error}`);
    }
    if (resp.status >= 500) {
      throw new Error(`Server error: ${conversation.error}`);
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
    const path = `/conversations/${conversationId}/messages`;
    const resp = await fetch(this.getUrl(path), {
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    const data = await resp.json();
    if (resp.status === 400) {
      throw new Error(data.error);
    }
    if (resp.status === 404) {
      throw new Error(`Conversation not found: ${data.error}`);
    }
    if (resp.status === 429) {
      throw new Error(`Rate limited: ${data.error}`);
    }
    if (resp.status === 504) {
      throw new TimeoutError(data.error);
    }
    if (resp.status >= 500) {
      throw new Error(`Server error: ${data.error}`);
    }
    return data;
  }
}
