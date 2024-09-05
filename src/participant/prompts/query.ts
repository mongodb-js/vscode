import * as vscode from 'vscode';
import type { Document } from 'bson';
import { toJSString } from 'mongodb-query-parser';

import { getHistoryMessages } from './history';

export const MAX_TOTAL_PROMPT_LENGTH = 10000;

export class QueryPrompt {
  static getAssistantPrompt({
    databaseName = 'mongodbVSCodeCopilotDB',
    collectionName = 'test',
    schema,
    sampleDocuments,
    maxInputTokens = MAX_TOTAL_PROMPT_LENGTH,
  }: {
    databaseName?: string;
    collectionName?: string;
    schema?: string;
    sampleDocuments?: Document[];
    maxInputTokens?: number;
  }): vscode.LanguageModelChatMessage {
    let prompt = `You are a MongoDB expert.

Your task is to help the user craft MongoDB queries and aggregation pipelines that perform their task.
Keep your response concise.
You should suggest queries that are performant and correct.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
You can imagine the schema.
Respond in MongoDB shell syntax using the \`\`\`javascript code block syntax.
You can use only the following MongoDB Shell commands: use, aggregate, bulkWrite, countDocuments, findOneAndReplace,
findOneAndUpdate, insert, insertMany, insertOne, remove, replaceOne, update, updateMany, updateOne.

Concisely explain the code snippet you have generated.

Example 1:
use('');
db.getCollection('').aggregate([
  // Find all of the sales that occurred in 2014.
  { $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } },
  // Group the total sales for each product.
  { $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } }
]);

Example 2:
use('');
db.getCollection('').find({
  date: { $gte: new Date('2014-04-04'), $lt: new Date('2014-04-05') }
}).count();

MongoDB command to specify database:
use('');

MongoDB command to specify collection:
db.getCollection('');\n\n`;
    if (databaseName) {
      prompt += `Database name: ${databaseName}\n`;
    }
    if (collectionName) {
      prompt += `Collection name: ${collectionName}\n`;
    }
    if (schema) {
      prompt += `Collection schema: ${schema}\n`;
    }
    if (sampleDocuments) {
      let docs = toJSString(sampleDocuments);
      // First check the length of all stringified sample documents.
      // If the resulting prompt is too large, proceed with only 1 sample document.
      if (prompt.length + docs.length > maxInputTokens) {
        docs = toJSString([sampleDocuments[0]]);
      }
      // Add sample documents to the prompt only when it fits in the context window.
      if (prompt.length + docs.length <= maxInputTokens) {
        prompt += `Sample documents: ${docs}\n`;
      }
    }

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(prompt: string): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(prompt);
  }

  static buildMessages({
    context,
    request,
    databaseName,
    collectionName,
    schema,
    sampleDocuments,
    maxInputTokens,
  }: {
    request: {
      prompt: string;
    };
    context: vscode.ChatContext;
    databaseName?: string;
    collectionName?: string;
    schema?: string;
    sampleDocuments?: Document[];
    maxInputTokens?: number;
  }): vscode.LanguageModelChatMessage[] {
    const messages = [
      QueryPrompt.getAssistantPrompt({
        databaseName,
        collectionName,
        schema,
        sampleDocuments,
        maxInputTokens,
      }),
      ...getHistoryMessages({ context }),
      QueryPrompt.getUserPrompt(request.prompt),
    ];

    return messages;
  }
}
