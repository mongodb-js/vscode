import * as vscode from 'vscode';

interface ChatAgentResult extends vscode.ChatAgentResult2 {
  subCommand: string;
}

const QUERY_COMMAND_ID = 'mdb.query';

function createAgent(context: vscode.ExtensionContext) {
  // Agents appear as top-level options in the chat input
  // when you type `@`, and can contribute sub-commands in the chat input
  // that appear when you type `/`.
  const agent = vscode.chat.createChatAgent('mongodb', chatHandler);
  agent.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'images',
    'mongodb.png'
  );
  agent.description = vscode.l10n.t(
    'Hello, I am the MongoDB AI assistant, beep boop, what can I help you with?'
  );
  agent.fullName = vscode.l10n.t('MongoDB');
  agent.subCommandProvider = {
    provideSubCommands(/* token */) {
      return [
        {
          name: 'query',
          description: 'Ask something you would like written as a query',
        },
        { name: 'docs', description: 'MongoDB Documentation' },
      ];
    },
  };

  agent.followupProvider = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    provideFollowups(result: ChatAgentResult, token: vscode.CancellationToken) {
      if (result.subCommand === 'query') {
        return [
          {
            commandId: QUERY_COMMAND_ID,
            message: '@mongodb query',
            title: vscode.l10n.t('test'),
          },
        ];
      } else if (result.subCommand === 'docs') {
        return [
          {
            message: '@mongodb docs',
            title: vscode.l10n.t('Docs'),
          },
        ];
      }
    },
  };

  return agent;
}

const chatHandler: vscode.ChatAgentHandler = async (
  request: vscode.ChatAgentRequest,
  context: vscode.ChatAgentContext,
  progress: vscode.Progress<vscode.ChatAgentProgress>,
  token: vscode.CancellationToken
): Promise<ChatAgentResult> => {
  // To talk to an LLM in your subcommand handler implementation, your
  // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
  // The GitHub Copilot Chat extension implements this provider.
  if (request.subCommand === 'query') {
    const access = await vscode.chat.requestChatAccess('copilot');
    const messages = [
      {
        role: vscode.ChatMessageRole.System,
        content:
          'You are a MongoDB expert! Your job is to convert MongoDB queries.',
      },
      {
        role: vscode.ChatMessageRole.User,
        content: 'find a document with the "name" "turtle"',
      },
    ];
    const chatRequest = access.makeRequest(messages, {}, token);
    for await (const fragment of chatRequest.response) {
      progress.report({ content: fragment });
    }
    return { subCommand: 'query' };
  } else if (request.subCommand === 'docs') {
    const access = await vscode.chat.requestChatAccess('copilot');
    const messages = [
      {
        role: vscode.ChatMessageRole.System,
        content:
          'You are a MongoDB expert that wants to provide documentation! Reply in a helpful way for someone who wants to look up information about MongoDB and how to use it. Offer to give suggestions and examples of how to do things involved with data if they would like.',
      },
      {
        role: vscode.ChatMessageRole.User,
        content: request.prompt,
      },
    ];
    const chatRequest = access.makeRequest(messages, {}, token);
    for await (const fragment of chatRequest.response) {
      progress.report({ content: fragment });
    }
    return { subCommand: 'docs' };
  }
  const access = await vscode.chat.requestChatAccess('copilot');
  const messages = [
    {
      role: vscode.ChatMessageRole.System,
      content:
        'You are a MongoDB expert! Reply as someone who is knowledgeable about MongoDB, using database puns and analogies when appropriate. Keep communications brief and simple. You are here to help the person in not much text.',
    },
    {
      role: vscode.ChatMessageRole.User,
      content: request.prompt,
    },
  ];
  const chatRequest = access.makeRequest(messages, {}, token);
  for await (const fragment of chatRequest.response) {
    progress.report({ content: fragment });
  }

  return { subCommand: '' };
};

export function activateAgent(context: vscode.ExtensionContext) {
  const agent = createAgent(context);

  context.subscriptions.push(
    agent,
    // Register the command handler for the /mongodb followup
    vscode.commands.registerCommand(QUERY_COMMAND_ID, () => {
      void vscode.window.showInformationMessage('MongoDB!');
    })
  );
}
