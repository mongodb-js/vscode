import { PromptBase, type PromptArgsBase } from './promptBase';
import type { UserPromptResponse } from './promptBase';

export interface ExportToLanguagePromptArgs extends PromptArgsBase {
  language: string;
  includeDriverSyntax: boolean;
}

export class ExportToLanguagePrompt extends PromptBase<ExportToLanguagePromptArgs> {
  protected getAssistantPrompt({
    language,
  }: ExportToLanguagePromptArgs): string {
    return `You are a MongoDB expert.
Your task is to convert a MongoDB playground script to the ${language} language.
Take a user prompt as an input string and translate it to the target language.
If the user specified to include driver syntax, add required MongoDB helpers and import statements to the transpiled code.
If the user specified to not include driver syntax, transpile only provided by the user prompt without adding any MongoDB helpers or import statements.
Keep your response concise.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`${language} and ends with \`\`\`.`;
  }

  getUserPrompt({
    request,
    includeDriverSyntax,
  }: ExportToLanguagePromptArgs): Promise<UserPromptResponse> {
    const prompt = request.prompt;
    return Promise.resolve({
      prompt: `${
        prompt ? `The user provided additional information: "${prompt}"\n` : ''
      }${includeDriverSyntax ? 'Include driver syntax.' : 'Do not include driver syntax.'}.`,
      hasSampleDocs: false,
    });
  }
}
