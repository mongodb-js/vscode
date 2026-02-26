import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { ModelMessage } from 'ai';

const MONGODB_DOCS_CHATBOT_BASE_URI = 'https://knowledge.mongodb.com';
const MONGODB_DOCS_CHATBOT_API_VERSION = 'v1';
const MONGODB_DOCS_CHATBOT_MODEL = 'mongodb-chat-latest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

export type Reference = {
  url: string;
  title: string;
};

/** Minimal shape of a streaming response from the docs chatbot. */
export type DocsStreamResult = {
  textStream: AsyncIterable<string>;
  sources: PromiseLike<{ sourceType: string; url: string; title?: string }[]>;
};

export class DocsChatbotAIService {
  _serverBaseUri: string;

  constructor() {
    this._serverBaseUri =
      process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE ||
      MONGODB_DOCS_CHATBOT_BASE_URI;
  }

  private _createModel() {
    const openai = createOpenAI({
      baseURL: `${this._serverBaseUri}/api/${MONGODB_DOCS_CHATBOT_API_VERSION}`,
      apiKey: '',
      headers: {
        'User-Agent': `mongodb-vscode/${version as string}`,
      },
    });
    return openai.responses(MONGODB_DOCS_CHATBOT_MODEL);
  }

  streamMessage({
    messages,
    signal,
  }: {
    messages: ModelMessage[];
    signal: AbortSignal;
  }): DocsStreamResult {
    // streamText returns a StreamTextResult whose sources resolve to
    // LanguageModelV3Source[], a strict superset of DocsStreamResult['sources'].
    return streamText({
      model: this._createModel(),
      messages,
      abortSignal: signal,
      headers: {
        'X-Request-Origin': `vscode-mongodb-copilot-v${version as string}/docs`,
      },
      providerOptions: {
        openai: {
          store: false,
        },
      },
    }) as unknown as DocsStreamResult;
  }
}
