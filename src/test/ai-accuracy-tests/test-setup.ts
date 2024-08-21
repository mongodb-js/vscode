import rewiremock from 'rewiremock';

const AssistantRole = 2;
const UserRole = 1;
const vscodeMock = {
  LanguageModelChatMessageRole: {
    Assistant: AssistantRole,
    User: UserRole,
  },
  LanguageModelChatMessage: {
    Assistant: (content, name?: string) => ({
      name,
      content,
      role: AssistantRole,
    }),
    User: (content: string, name?: string) => ({
      content,
      name,
      role: UserRole,
    }),
  },
  window: {
    createOutputChannel: () => {},
  },
};

// Mock the 'vscode' module since we don't run the full vscode
// integration test setup for the ai-accuracy-tests as it's a bit slow.
rewiremock('vscode').with(vscodeMock);
rewiremock.enable();
