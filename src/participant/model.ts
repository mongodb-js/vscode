import * as vscode from 'vscode';

import { CHAT_PARTICIPANT_MODEL } from './constants';

let model: vscode.LanguageModelChat;

export async function getCopilotModel(): Promise<
  vscode.LanguageModelChat | undefined
> {
  if (!model) {
    try {
      const [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: CHAT_PARTICIPANT_MODEL,
      });
      return model;
    } catch (err) {
      // Model is not ready yet. It is being initialised with the first user prompt.
    }
  }

  return;
}
