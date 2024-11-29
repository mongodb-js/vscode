import { CHAT_PARTICIPANT_ID } from '../../../participant/constants';
import * as vscode from 'vscode';
import type { ParticipantCommand } from '../../../participant/participantTypes';

export function createChatRequestTurn(
  command: ParticipantCommand | undefined,
  prompt: vscode.ChatRequestTurn['prompt'] = 'some prompt',
  options: {
    participant?: vscode.ChatRequestTurn['participant'];
    references?: vscode.ChatRequestTurn['references'];
  } = {}
): vscode.ChatRequestTurn {
  const { participant = CHAT_PARTICIPANT_ID, references = [] } = options;

  return Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
    prompt,
    command: command?.substring(1),
    references,
    participant,
  });
}

export function createChatResponseTurn(
  command: ParticipantCommand,
  /** Helper shortcut for response text, use options.response for a more manual setup */
  responseText?: string,
  options: {
    response?: vscode.ChatResponseTurn['response'] | undefined;
    result?: vscode.ChatResponseTurn['result'];
    participant?: string;
  } = {}
): vscode.ChatRequestTurn {
  const {
    response = responseText
      ? [
          Object.assign(
            Object.create(vscode.ChatResponseMarkdownPart.prototype),
            {
              value: {
                value: responseText,
              },
            }
          ),
        ]
      : [],
    result = {},
    participant = CHAT_PARTICIPANT_ID,
  } = options;

  return Object.assign(Object.create(vscode.ChatResponseTurn.prototype), {
    participant,
    response,
    command: command.substring(1),
    result,
  });
}
