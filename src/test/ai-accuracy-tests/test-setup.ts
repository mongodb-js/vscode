import Module from 'module';

const AssistantRole = 2;
const UserRole = 1;
const vscodeMock = {
  LanguageModelChatMessageRole: {
    Assistant: AssistantRole,
    User: UserRole,
  },
  LanguageModelChatMessage: {
    Assistant: (content, name?: string): unknown => ({
      name,
      content,
      role: AssistantRole,
    }),
    User: (content: string, name?: string): unknown => ({
      content,
      name,
      role: UserRole,
    }),
  },
  window: {
    createOutputChannel: (): void => {
      /* no-op */
    },
  },
  lm: {
    selectChatModels: (): unknown => [
      {
        countTokens: (input: string): number => {
          return input.length;
        },
        maxInputTokens: 10_000,
      },
    ],
  },
};

// Mock the 'vscode' module since we don't run the full vscode
// integration test setup for the ai-accuracy-tests as it's a bit slow.

// The extracted method is re-invoked with an explicit receiver via
// `originalRequire.call(this, id)` below, so unbound usage is intentional.
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string): any {
  if (id === 'vscode') {
    return vscodeMock;
  }
  return originalRequire.call(this, id);
};
