import * as vscode from 'vscode';

import { CHAT_PARTICIPANT_MODEL } from './constants';

let selectedModel: vscode.LanguageModelChat | undefined;

export async function getCopilotModel(): Promise<
  vscode.LanguageModelChat | undefined
> {
  if (!selectedModel) {
    try {
      const [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: CHAT_PARTICIPANT_MODEL,
      });
      selectedModel = model;
    } catch (err) {
      // Model is not ready yet. It is being initialised with the first user prompt.
    }
  }
  return selectedModel;
}
