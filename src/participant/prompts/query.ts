import * as vscode from 'vscode';
import type { Document } from 'bson';

import { getHistoryMessages } from './history';
import { getStringifiedSampleDocuments } from '../sampleDocuments';

export class QueryPrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Your task is to help the user craft MongoDB shell syntax code to perform their task.
Keep your response concise.
You must suggest code that is performant and correct.
Respond with markdown, write code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
Respond in MongoDB shell syntax using the \`\`\`javascript code block syntax.

Concisely explain the code snippet you have generated.

Example 1:
User: Documents in the orders db, sales collection, where the date is in 2014 and group the total sales for each product.
Response:
\`\`\`javascript
use('orders');
db.getCollection('sales').aggregate([
  // Find all of the sales that occurred in 2014.
  { $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } },
  // Group the total sales for each product.
  { $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } }
]);
\`\`\`

Example 2:
User: How do I create an index on the name field in my users collection?.
Response:
\`\`\`javascript
use('test');
db.getCollection('users').createIndex({ name: 1 });
\`\`\`

MongoDB command to specify database:
use('');

MongoDB command to specify collection:
db.getCollection('');\n`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static async getUserPrompt({
    databaseName = 'mongodbVSCodeCopilotDB',
    collectionName = 'test',
    prompt,
    schema,
    sampleDocuments,
  }: {
    databaseName: string;
    collectionName: string;
    prompt: string;
    schema?: string;
    sampleDocuments?: Document[];
  }): Promise<vscode.LanguageModelChatMessage> {
    prompt += `\nDatabase name: ${databaseName}\n`;
    prompt += `Collection name: ${collectionName}\n`;
    if (schema) {
      prompt += `Collection schema: ${schema}\n`;
    }
    if (sampleDocuments) {
      prompt += await getStringifiedSampleDocuments({
        sampleDocuments,
        prompt,
      });
    }

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(prompt);
  }

  static async buildMessages({
    context,
    request,
    databaseName,
    collectionName,
    schema,
    sampleDocuments,
    connectionNames,
  }: {
    request: {
      prompt: string;
    };
    context: vscode.ChatContext;
    databaseName: string;
    collectionName: string;
    schema?: string;
    sampleDocuments?: Document[];
    connectionNames: string[];
  }): Promise<vscode.LanguageModelChatMessage[]> {
    const messages = [
      QueryPrompt.getAssistantPrompt(),
      ...getHistoryMessages({ context, connectionNames }),
      await QueryPrompt.getUserPrompt({
        databaseName,
        collectionName,
        prompt: request.prompt,
        schema,
        sampleDocuments,
      }),
    ];

    return messages;
  }

  static getEmptyRequestResponse(): string {
    return vscode.l10n.t(
      'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".'
    );
  }
}
