import Module from 'module';

const AssistantRole = 2;
const UserRole = 1;

class LanguageModelTextPart {
  value: string;

  constructor(value: string) {
    this.value = value;
  }
}

// `vscode.LanguageModelChatMessage` stores content as an array of parts rather
// than a string, so the mock has to do the same for the tests to read it back.
const toParts = (content: unknown): LanguageModelTextPart[] =>
  Array.isArray(content) ? content : [new LanguageModelTextPart(`${content}`)];

const vscodeMock = {
  LanguageModelChatMessageRole: {
    Assistant: AssistantRole,
    User: UserRole,
  },
  LanguageModelTextPart,
  LanguageModelChatMessage: {
    Assistant: (content, name?: string): unknown => ({
      name,
      content: toParts(content),
      role: AssistantRole,
    }),
    User: (content: string, name?: string): unknown => ({
      content: toParts(content),
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
