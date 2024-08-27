import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export class QueryPrompt {
  static getAssistantPrompt({
    databaseName = 'mongodbVSCodeCopilotDB',
    collectionName = 'test',
    schema,
  }: {
    databaseName?: string;
    collectionName?: string;
    schema?: string;
  }): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.

Your task is to help the user craft MongoDB queries and aggregation pipelines that perform their task.
Keep your response concise.
You should suggest queries that are performant and correct.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
You can imagine the schema.
Respond in MongoDB shell syntax using the \`\`\`javascript code block syntax.
You can use only the following MongoDB Shell commands: use, aggregate, bulkWrite, countDocuments, findOneAndReplace,
findOneAndUpdate, insert, insertMany, insertOne, remove, replaceOne, update, updateMany, updateOne.

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

Database name: ${databaseName}
Collection name: ${collectionName}
${
  schema
    ? `Collection schema:
${schema}`
    : ''
}

MongoDB command to specify database:
use('');

MongoDB command to specify collection:
db.getCollection('')

Concisely explain the code snippet you have generated.`;

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
  }: {
    request: {
      prompt: string;
    };
    context: vscode.ChatContext;
    databaseName?: string;
    collectionName?: string;
    schema?: string;
  }): vscode.LanguageModelChatMessage[] {
    const messages = [
      QueryPrompt.getAssistantPrompt({ databaseName, collectionName, schema }),
      ...getHistoryMessages({ context }),
      QueryPrompt.getUserPrompt(request.prompt),
    ];

    return messages;
  }
}
