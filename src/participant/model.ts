import * as vscode from 'vscode';
import { CHAT_PARTICIPANT_PREFERRED_MODEL } from './constants';

let selectedModel: vscode.LanguageModelChat | undefined;

export async function getCopilotModel(): Promise<
  vscode.LanguageModelChat | undefined
> {
  if (!selectedModel) {
    try {
      // We select the model by vendor only, because not every family is
      // available at all times. A missing family would leave the user with no
      // model and fail their request. We still prefer the model our prompts are
      // tuned for, but fall back to whichever one Copilot lists first.
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      selectedModel =
        models.find((m) => CHAT_PARTICIPANT_PREFERRED_MODEL === m.family) ??
        models[0];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      // Model is not ready yet. It is being initialised with the first user prompt.
    }
  }
  return selectedModel;
}
