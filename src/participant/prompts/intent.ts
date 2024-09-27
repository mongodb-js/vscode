import type { InternalPromptPurpose } from '../../telemetry/telemetryService';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

export type PromptIntent = 'Query' | 'Schema' | 'Docs' | 'Default';

export class IntentPrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Your task is to help guide a conversation with a user to the correct handler.
You will be provided a conversation and your task is to determine the intent of the user.
The intent handlers are:
- Query
- Schema
- Docs
- Default
Rules:
1. Respond only with the intent handler.
2. Use the "Query" intent handler when the user is asking for code that relates to a specific collection.
3. Use the "Docs" intent handler when the user is asking a question that involves MongoDB documentation.
4. Use the "Schema" intent handler when the user is asking for the schema or shape of documents of a specific collection.
5. Use the "Default" intent handler when a user is asking for code that does NOT relate to a specific collection.
6. Use the "Default" intent handler for everything that may not be handled by another handler.
7. If you are uncertain of the intent, use the "Default" intent handler.

Example:
User: How do I create an index in my pineapples collection?
Response:
Query

Example:
User:
What is $vectorSearch?
Response:
Docs`;
  }

  getIntentFromModelResponse(response: string): PromptIntent {
    response = response.trim();
    switch (response) {
      case 'Query':
        return 'Query';
      case 'Schema':
        return 'Schema';
      case 'Docs':
        return 'Docs';
      default:
        return 'Default';
    }
  }

  protected get internalPurposeForTelemetry(): InternalPromptPurpose {
    return 'intent';
  }
}
