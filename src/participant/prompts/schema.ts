import type { UserPromptResponse } from './promptBase';
import { PromptBase, type PromptArgsBase } from './promptBase';
import * as vscode from 'vscode';

export const DOCUMENTS_TO_SAMPLE_FOR_SCHEMA_PROMPT = 100;

export type OpenSchemaCommandArgs = {
  schema: string;
};

export interface SchemaPromptArgs extends PromptArgsBase {
  databaseName: string;
  collectionName: string;
  schema: string;
  amountOfDocumentsSampled: number;
}

export class SchemaPrompt extends PromptBase<SchemaPromptArgs> {
  protected getAssistantPrompt({
    amountOfDocumentsSampled,
  }: SchemaPromptArgs): string {
    return `You are a senior engineer who describes the schema of documents in a MongoDB database.
The schema is generated from a sample of documents in the user's collection.
You must follow these rules.
Rule 1: Your answer should always describe the schema of documents in the collection.
Rule 2: Try to be as concise as possible.
Rule 3: Pay attention to the JSON schema.
Rule 4: Mention the amount of documents sampled in your response.
Amount of documents sampled: ${amountOfDocumentsSampled}.`;
  }

  getUserPrompt({
    databaseName,
    collectionName,
    request,
    schema,
  }: SchemaPromptArgs): Promise<UserPromptResponse> {
    const prompt = request.prompt;
    return Promise.resolve({
      prompt: `${
        prompt ? `The user provided additional information: "${prompt}"\n` : ''
      }Database name: ${databaseName}
Collection name: ${collectionName}
Schema:
${schema}`,
      hasSampleDocs: false,
    });
  }

  get emptyRequestResponse(): string {
    return vscode.l10n.t(
      'Please specify a question when using this command. Usage: @MongoDB /schema what is the schema for the sample_mflix.users collection?'
    );
  }
}
