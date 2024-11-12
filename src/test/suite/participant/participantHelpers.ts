import { CHAT_PARTICIPANT_ID } from '../../../participant/constants';
import * as vscode from 'vscode';
import type { ParticipantCommand } from '../../../participant/participant';

export function createChatRequestTurn(
  command: ParticipantCommand | undefined,
  prompt: vscode.ChatRequestTurn['prompt'] = 'some prompt',
  options: {
    participant?: vscode.ChatRequestTurn['participant'];
    references?: vscode.ChatRequestTurn['references'];
  } = {
    participant: CHAT_PARTICIPANT_ID,
    references: [],
  }
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
  options: {
    response?: vscode.ChatResponseTurn['response'];
    result?: vscode.ChatResponseTurn['result'];
    participant?: string;
  } = {
    response: [],
    result: {},
    participant: CHAT_PARTICIPANT_ID,
  }
): vscode.ChatRequestTurn {
  const {
    response = [],
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
