import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export const DOCUMENTS_TO_SAMPLE_FOR_SCHEMA_PROMPT = 100;

export type OpenSchemaCommandArgs = {
  schema: string;
};

export class SchemaPrompt {
  static getAssistantPrompt({
    amountOfDocumentsSampled,
  }: {
    amountOfDocumentsSampled: number;
  }): vscode.LanguageModelChatMessage {
    const prompt = `You are a senior engineer who describes the schema of documents in a MongoDB database.
The schema is generated from a sample of documents in the user's collection.
You must follows these rules.
Rule 1: Try to be as concise as possible.
Rule 2: Pay attention to the JSON schema.
Rule 3: Mention the amount of documents sampled in your response.
Amount of documents sampled: ${amountOfDocumentsSampled}.`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt({
    databaseName,
    collectionName,
    prompt,
    schema,
  }: {
    databaseName: string;
    collectionName: string;
    prompt: string;
    schema: string;
  }): vscode.LanguageModelChatMessage {
    const userInput = `${
      prompt ? `The user provided additional information: "${prompt}"\n` : ''
    }Database name: ${databaseName}
Collection name: ${collectionName}
Schema:
${schema}`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(userInput);
  }

  static buildMessages({
    context,
    databaseName,
    collectionName,
    schema,
    amountOfDocumentsSampled,
    request,
    connectionNames,
  }: {
    request: {
      prompt: string;
    };
    databaseName: string;
    collectionName: string;
    schema: string;
    amountOfDocumentsSampled: number;
    context: vscode.ChatContext;
    connectionNames: string[];
  }): vscode.LanguageModelChatMessage[] {
    const messages = [
      SchemaPrompt.getAssistantPrompt({
        amountOfDocumentsSampled,
      }),
      ...getHistoryMessages({ context, connectionNames }),
      SchemaPrompt.getUserPrompt({
        prompt: request.prompt,
        databaseName,
        collectionName,
        schema,
      }),
    ];

    return messages;
  }
}
