import OpenAI from 'openai';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';

import { CHAT_PARTICIPANT_MODEL } from '../../participant/constants';

let openai: OpenAI;
function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openai;
}

export type AIService = 'openai';

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
}: {
  messages: ChatMessages;
  backend?: AIService;
}): Promise<ChatCompletion> {
  // Defaults to open ai for now
  return createOpenAIChatCompletion({ messages });
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
