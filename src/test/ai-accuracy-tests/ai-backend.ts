import OpenAI from 'openai';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources';

import { CHAT_PARTICIPANT_MODEL } from '../../participant/participant';

let anthropic: Anthropic;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

function getAnthropicClient() {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  return anthropic;
}

let openai: OpenAI;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openai;
}

export type AIService = 'openai' | 'anthropic';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
type ChatMessages = ChatMessage[];

type ChatCompletion = {
  content: string;
  usageStats: {
    promptTokens: number;
    completionTokens: number;
  };
};

async function createAnthropicChatCompletion({
  messages,
  model = 'claude-3-opus-20240229',
}: {
  messages: ChatMessages;
  model?: ChatCompletionCreateParamsBase['model'];
}): Promise<ChatCompletion> {
  const anthropic = getAnthropicClient();
  const completion: Anthropic.Messages.Message =
    await anthropic.messages.create({
      model,
      max_tokens: 1000,
      temperature: 0,
      messages,
    });

  return {
    content: (completion.content[0] as TextBlock).text,
    usageStats: {
      promptTokens: completion.usage.input_tokens,
      completionTokens: completion.usage.output_tokens,
    },
  };
}

async function createOpenAIChatCompletion({
  messages,
  model = CHAT_PARTICIPANT_MODEL,
}: {
  messages: ChatMessages;
  model?: ChatCompletionCreateParamsBase['model'];
}): Promise<ChatCompletion> {
  const openai = getOpenAIClient();

  // TODO: Currently we aren't supplying a system message, that may
  // create a discrepancy in responses. We should investigate passing a system
  // message, even if it's minimal.
  const completion: OpenAI.Chat.Completions.ChatCompletion =
    await openai.chat.completions.create({
      messages,
      model,
    });

  return {
    content: completion.choices[0].message.content || '',
    usageStats: {
      promptTokens: completion.usage?.prompt_tokens ?? NaN,
      completionTokens: completion.usage?.completion_tokens ?? NaN,
    },
  };
}

export type UsageStats = { promptTokens: number; completionTokens: number };

export type GenerationResponse = {
  content: string;
  query?: {
    filter?: string;
    project?: string;
    sort?: string;
    limit?: string;
    skip?: string;
  };
  aggregation?: string;
  usageStats?: UsageStats;
};

export function createAIChatCompletion({
  messages,
  backend,
}: {
  messages: ChatMessages;
  backend: AIService;
}): Promise<ChatCompletion> {
  if (backend === 'openai') {
    return createOpenAIChatCompletion({ messages });
  }

  // Defaults to Anthropic for now.
  return createAnthropicChatCompletion({ messages });
}

export class AIBackend {
  aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async runAIChatCompletionGeneration({
    messages,
  }: {
    messages: ChatMessages;
  }): Promise<ChatCompletion> {
    const completion = await createAIChatCompletion({
      messages,
      backend: this.aiService,
    });
    return completion;
  }
}
