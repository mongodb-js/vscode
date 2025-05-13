import * as vscode from 'vscode';
import type { Document } from 'bson';

import { getStringifiedSampleDocuments } from '../sampleDocuments';
import type { PromptArgsBase, UserPromptResponse } from './promptBase';
import { PromptBase } from './promptBase';
import { codeBlockIdentifier } from '../constants';

interface DoctorPromptArgs extends PromptArgsBase {
  databaseName: string;
  collectionName: string;
  schema?: string;
  sampleDocuments?: Document[];
  connectionNames?: string[];
  schemaAdviceResponse?: Object;
  suggestedIndexesResponse?: Object;
}

export class DoctorPrompt extends PromptBase<DoctorPromptArgs> {
  protected getAssistantPrompt({
    schemaAdviceResponse,
    suggestedIndexesResponse,
  }: DoctorPromptArgs): string {
    return `You are a MongoDB expert.
Your task is to help the user understand why their MongoDB queries are running slowly, and to suggest one or more ways the user can improve the query's performance.

${
  schemaAdviceResponse || suggestedIndexesResponse
    ? `You have access to the following data returned from MongoDB performance advisor APIs:
    ${
      schemaAdviceResponse
        ? `

        API: /schemaAdvice
        Response: ${schemaAdviceResponse}
      `
        : ''
    }
    ${
      suggestedIndexesResponse
        ? `

        API: /suggestedIndexes
        Response: ${suggestedIndexesResponse}
      `
        : ''
    }

  `
    : ''
}

You must follow these rules:
Rule 1: If the user has specified which queries need attention, only provide advice about those queries.
Rule 2: If the user has not specified which queries need attention, provide advice about any query you can see.
Rule 3: Use ${schemaAdviceResponse || suggestedIndexesResponse ? 'the performance advisor data,' : ''} your expert knowledge of MongoDB best practices, and the user's code to synthesize your answer.
Rule 4: If you find one or more potential improvements to the user's data models or queries, respond with the following for each improvement:
  - a concise explanation of the problem
  - a reference to the code the user should rewrite in order to achieve the improvement
  - a code snippet that attempts to rewrite that code in order to achieve the improvement. The code must be performant and correct. You must write it in a Markdown code block that begins with ${codeBlockIdentifier.start} and ends with ${codeBlockIdentifier.end}.
  - a concise explanation of how the rewritten code addresses the problem
Rule 5: If you cannot find any way to improve the queries or data models that you are confident is good advice, do not imagine advice. Instead, tell the user that you can't find anything wrong with their models or queries.


___
Example 1:
User: Why are my queries slow?
Response:
It looks like you are frequently querying customers by \`city\` but your collection does not have an index on the \`city\` attribute.
${codeBlockIdentifier.start}
db.getCollection.createIndex({ name: 1 });
${codeBlockIdentifier.end}
If an index exists on this attribute, MongoDB can use the index instead of sorting the entire dataset manually.
`;
  }

  async getUserPrompt({
    databaseName = 'mongodbVSCodeCopilotDB',
    collectionName = 'test',
    request,
    schema,
    sampleDocuments,
  }: DoctorPromptArgs): Promise<UserPromptResponse> {
    let prompt = request.prompt;
    prompt += `\nDatabase name: ${databaseName}\n`;
    prompt += `Collection name: ${collectionName}\n`;
    if (schema) {
      prompt += `Collection schema: ${schema}\n`;
    }

    const sampleDocumentsPrompt = await getStringifiedSampleDocuments({
      sampleDocuments,
      prompt,
    });

    return {
      prompt: `${prompt}${sampleDocumentsPrompt}`,
      hasSampleDocs: !!sampleDocumentsPrompt,
    };
  }

  get emptyRequestResponse(): string {
    return vscode.l10n.t(
      'Please specify a question when using this command. Usage: @MongoDB /doctor help me understand why my queries for plant species by leaf shape are slow.',
    );
  }
}
