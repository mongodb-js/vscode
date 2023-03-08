import { MESSAGE_TYPES } from '../extension-app-message-constants';
import type {
  AskQuestionMessage,
  QuestionResponseMessage,
  LoadCodebaseMessage,
  CodebaseLoadedMessage,
  LoadSuggestionsMessage,
  SuggestionsLoadedMessage,
  MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
} from '../extension-app-message-constants';
import { vscode } from '../store/store';

// TODO: Use a real js Event interface or something.
const messageListeners: {
  [listenerId: string]: {
    listener: (
      message:
        | CodebaseLoadedMessage
        | SuggestionsLoadedMessage
        | QuestionResponseMessage
    ) => void;
  };
} = {};

export function handleMessageFromExtension(event) {
  // TODO: Global event handler/listener activation.
  const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;

  switch (message.command) {
    case MESSAGE_TYPES.SUGGESTIONS_LOADED:
    case MESSAGE_TYPES.CODEBASE_LOADED:
    case MESSAGE_TYPES.QUESTION_RESPONSE:
      messageListeners[message.id]?.listener(message);

      return;
    default:
      // No-op.
      return;
  }
}

export function sendMessageToExtensionAndWaitForResponse<T>(
  message: LoadCodebaseMessage | LoadSuggestionsMessage | AskQuestionMessage
): Promise<T> {
  const messageId = message.id;

  return new Promise((resolve, reject) => {
    messageListeners[messageId] = {
      listener: (response) => {
        // Cleanup?
        delete messageListeners[messageId];

        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response as T);
      },
    };

    vscode.postMessage(message);
  });
}
