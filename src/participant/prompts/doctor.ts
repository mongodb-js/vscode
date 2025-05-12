import * as vscode from 'vscode';
import type { Document } from 'bson';

import { getStringifiedSampleDocuments } from '../sampleDocuments';
import type { PromptArgsBase, UserPromptResponse } from './promptBase';
import { codeBlockIdentifier } from '../constants';
import { PromptBase } from './promptBase';

interface DoctorPromptArgs extends PromptArgsBase {
  databaseName: string;
  collectionName: string;
  schema?: string;
  sampleDocuments?: Document[];
  connectionNames?: string[];
}

export class DoctorPrompt extends PromptBase<DoctorPromptArgs> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Your task is to respond that this prompt has not been implemented yet.`;
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
      'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".',
    );
  }
}
