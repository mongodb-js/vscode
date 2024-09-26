import * as vscode from 'vscode';
import type { Document } from 'bson';

import { getStringifiedSampleDocuments } from '../sampleDocuments';
import { codeBlockIdentifier } from '../constants';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

interface QueryPromptArgs extends PromptArgsBase {
  databaseName: string;
  collectionName: string;
  schema?: string;
  sampleDocuments?: Document[];
  connectionNames: string[];
}

export class QueryPrompt extends PromptBase<QueryPromptArgs> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Your task is to help the user craft MongoDB shell syntax code to perform their task.
Keep your response concise.
You must suggest code that is performant and correct.
Respond with markdown, write code in a Markdown code block that begins with ${codeBlockIdentifier.start} and ends with ${codeBlockIdentifier.end}.
Respond in MongoDB shell syntax using the ${codeBlockIdentifier.start} code block syntax.

Concisely explain the code snippet you have generated.

Example 1:
User: Documents in the orders db, sales collection, where the date is in 2014 and group the total sales for each product.
Response:
${codeBlockIdentifier.start}
use('orders');
db.getCollection('sales').aggregate([
  // Find all of the sales that occurred in 2014.
  { $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } },
  // Group the total sales for each product.
  { $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } }
]);
${codeBlockIdentifier.end}

Example 2:
User: How do I create an index on the name field in my users collection?.
Response:
${codeBlockIdentifier.start}
use('test');
db.getCollection('users').createIndex({ name: 1 });
${codeBlockIdentifier.end}

MongoDB command to specify database:
use('');

MongoDB command to specify collection:
db.getCollection('');\n`;
  }

  async getUserPrompt({
    databaseName = 'mongodbVSCodeCopilotDB',
    collectionName = 'test',
    request,
    schema,
    sampleDocuments,
  }: QueryPromptArgs): Promise<string> {
    let prompt = request.prompt;
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

    return prompt;
  }

  get emptyRequestResponse(): string {
    return vscode.l10n.t(
      'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".'
    );
  }
}
