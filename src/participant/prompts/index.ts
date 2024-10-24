import * as vscode from 'vscode';

import { GenericPrompt } from './generic';
import { IntentPrompt } from './intent';
import { NamespacePrompt } from './namespace';
import { QueryPrompt } from './query';
import { SchemaPrompt } from './schema';
import { ExportToPlaygroundPrompt } from './exportToPlayground';
import { isContentEmpty } from './promptBase';

export { getContentLength } from './promptBase';

export class Prompts {
  public static generic = new GenericPrompt();
  public static intent = new IntentPrompt();
  public static namespace = new NamespacePrompt();
  public static query = new QueryPrompt();
  public static schema = new SchemaPrompt();
  public static exportToPlayground = new ExportToPlaygroundPrompt();

  public static isPromptEmpty(request: vscode.ChatRequest): boolean {
    return !request.prompt || request.prompt.trim().length === 0;
  }

  // Check if any of the messages contain user input.
  // This is useful since when there's no user input in any
  // messages, we can skip some additional processing.
  public static doMessagesContainUserInput(
    messages: vscode.LanguageModelChatMessage[]
  ): boolean {
    for (const message of messages) {
      if (
        message.role === vscode.LanguageModelChatMessageRole.User &&
        !isContentEmpty(message)
      ) {
        return true;
      }
    }

    return false;
  }
}
