import * as vscode from 'vscode';

import type { ChatResult } from '../constants';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

const DB_NAME_ID = 'DATABASE_NAME';
const COL_NAME_ID = 'COLLECTION_NAME';

const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)`;
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)`;

interface NamespacePromptArgs extends PromptArgsBase {
  connectionNames: string[];
}

export class NamespacePrompt extends PromptBase<NamespacePromptArgs> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Parse all user messages to find a database name and a collection name.
Respond in the format:
${DB_NAME_ID}: X
${COL_NAME_ID}: Y
where X and Y are the respective names.
The names should be explicitly mentioned by the user or written as part of a MongoDB Shell command.
If you cannot find the names do not imagine names.
If only one of the names is found, respond only with the found name.
Your response must be concise and correct.

When no names are found, respond with:
No names found.

___
Example 1:
User: How many documents are in the sightings collection in the ufo database?
Response:
${DB_NAME_ID}: ufo
${COL_NAME_ID}: sightings
___
Example 2:
User: How do I create an index in my pineapples collection?
Response:
${COL_NAME_ID}: pineapples
___
Example 3:
User: Where is the best hummus in Berlin?
Response:
No names found.
`;
  }

  protected getUserPrompt({ request }: NamespacePromptArgs): Promise<string> {
    return Promise.resolve(request.prompt);
  }

  async buildMessages({
    connectionNames,
    context,
    request,
  }: NamespacePromptArgs): Promise<vscode.LanguageModelChatMessage[]> {
    let historyMessages = this.getHistoryMessages({ connectionNames, context });
    // If the current user's prompt is a connection name, and the last
    // message was to connect. We want to use the last
    // message they sent before the connection name as their prompt.
    if (connectionNames.includes(request.prompt)) {
      const previousResponse = context.history[
        context.history.length - 1
      ] as vscode.ChatResponseTurn;
      const intent = (previousResponse?.result as ChatResult)?.metadata.intent;
      if (intent === 'askToConnect') {
        // Go through the history in reverse order to find the last user message.
        for (let i = historyMessages.length - 1; i >= 0; i--) {
          if (
            historyMessages[i].role === vscode.LanguageModelChatMessageRole.User
          ) {
            request.prompt = historyMessages[i].content;
            // Remove the item from the history messages array.
            historyMessages = historyMessages.slice(0, i);
            break;
          }
        }
      }
    }

    return [
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.Assistant(this.getAssistantPrompt()),
      ...historyMessages,
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.User(
        await this.getUserPrompt({ connectionNames, context, request })
      ),
    ];
  }

  extractDatabaseAndCollectionNameFromResponse(text: string): {
    databaseName?: string;
    collectionName?: string;
  } {
    const databaseName = text.match(DB_NAME_REGEX)?.[1].trim();
    const collectionName = text.match(COL_NAME_REGEX)?.[1].trim();
    return { databaseName, collectionName };
  }
}
