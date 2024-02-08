import * as vscode from 'vscode';
import type { PlaygroundController } from '../editors';

interface QueryChatAgentResult extends vscode.ChatAgentResult2 {
  subCommand: string;
  databaseName: string;
  collectionName: string;
  queryContent: string;
  description?: string;
}

interface BasicChatAgentResult extends vscode.ChatAgentResult2 {
  subCommand: string;
}

type ChatAgentResult = BasicChatAgentResult | QueryChatAgentResult;

const OPEN_AI_CONTENT_IN_PLAYGROUND = 'mdb.open_ai_content_playground';
const SELECT_COLLECTION_FOR_AI_QUERY = 'mdb.select_collection_for_ai_query';

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
    'Hello, I am the MongoDB AI assistant, how can I help you?\nYou can ask me to write a query, answer a question about MongoDB with documentation, and much more.'
  );
  agent.fullName = vscode.l10n.t('MongoDB');
  agent.subCommandProvider = {
    provideSubCommands(/* token */) {
      return [
        {
          name: 'query',
          description:
            'I can write a query for you. Ask something that can written as a query.\nFor instance, you can ask "Show me all of the documents where the "address" has the word "street" in it."',
        },
        {
          name: 'docs',
          description:
            'Ask a question about MongoDB, and I will respond using our documentation.',
        },
        // { name: 'schema', description: 'Get the schema breakdown of a collection based on a sample of documents.' },
      ];
    },
  };

  agent.followupProvider = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    provideFollowups(result: ChatAgentResult, token: vscode.CancellationToken) {
      if (result.subCommand === 'query') {
        console.log('resultresult', result);
        return [
          {
            commandId: OPEN_AI_CONTENT_IN_PLAYGROUND,
            args: [
              {
                // databaseName: 'test',
                // text: 'db.test.find()'
                databaseName: (result as QueryChatAgentResult).databaseName,
                collectionName: (result as QueryChatAgentResult).collectionName,
                text: (result as QueryChatAgentResult).queryContent,
              },
            ],
            message: '@mongodb query',
            title: vscode.l10n.t('Open in playground'),
          },
        ];
      } else if (result.subCommand === 'docs') {
        return [
          {
            message: '@mongodb docs',
            title: vscode.l10n.t('Docs'),
          },
        ];
      } else if (result.subCommand === 'select-collection') {
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

function handleEmptyQueryRequest({
  request,
}: // context,
// progress,
// token,
{
  request: vscode.ChatAgentRequest;
  context: vscode.ChatAgentContext;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  token: vscode.CancellationToken;
}): ChatAgentResult {
  console.log('chat request agent id:', request.agentId);
  // if ()

  return {
    subCommand: '',
    errorDetails: {
      message:
        'Please specify a question when using this command.\n\nUsage: @MongoDB /query find documents where "name" contains "database".',
    },
  };

  // return {
  //   subCommand: 'query',
  //   databaseName: 'test',
  //   collectionName: 'test',
  //   queryContent: 'test'
  // };
}

// @mongodb /query find all documents where the "address" has the word Broadway in it
// @mongodb /query Which "STREET" has the highest average food inspection result "SCORE"?
// @mongodb /query Which "CUISINE DESCRIPTION" has the highest average food inspection result "SCORE"? Database NYC, Collection restaurant_inspection_results_2022
// @mongodb /query Which "CUISINE DESCRIPTION" has the highest average food inspection result "SCORE"? Database NYC, Collection restaurant_inspection_results_2022
async function handleQueryRequest({
  request,
  context,
  progress,
  token,
}: {
  request: vscode.ChatAgentRequest;
  context: vscode.ChatAgentContext;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  token: vscode.CancellationToken;
}) {
  if (!request.prompt || request.prompt.trim().length === 0) {
    return handleEmptyQueryRequest({
      request,
      context,
      progress,
      token,
    });
  }

  const access = await vscode.chat.requestChatAccess('copilot');
  const messages = [
    {
      role: vscode.ChatMessageRole.System,
      content:
        // eslint-disable-next-line quotes
        `You are a MongoDB expert! You create MongoDB queries and aggregation pipelines, and you are very good at it. The user will provide the basis for the query. Keep your response concise. Respond with markdown, javascript code snippets are possible with '''javascript. You can imagine the schema, collection, and database name. Respond in MongoDB shell syntax.', //  If you require information about the users schema first you can ask for a sample document.`,
    },
    {
      role: vscode.ChatMessageRole.User,
      content: request.prompt,
      // 'find a document with the "name" "turtle"',
    },
  ];
  const chatRequest = access.makeRequest(messages, {}, token);

  let responseContent = '';
  for await (const fragment of chatRequest.response) {
    responseContent += fragment;
    progress.report({ content: fragment });
  }

  // Because we use code responses for queries we can't track progress.
  // for await (const fragment of chatRequest.response) {
  //   progress.report({ content: fragment });
  // }

  const matchedQueryContent = responseContent.match(
    /```javascript((.|\n)*)```/
  );
  console.log('matchedQueryContent', matchedQueryContent);
  const queryContent =
    matchedQueryContent && matchedQueryContent.length > 1
      ? matchedQueryContent[1]
      : responseContent;
  console.log('queryContent', queryContent);

  // @mongodb /query find all documents where the "address" has the word Broadway in it

  // if (!queryContent || queryContent.length === 0) {
  //   queryContent = responseContent;
  // }

  // Follow up with asking about collection / database ?
  // Then get schema?
  return {
    subCommand: 'query',
    databaseName: 'test',
    collectionName: 'test',
    queryContent,
  };
}

// @mongodb /docs What is $vectorSearch?
async function handleDocsRequest({
  // request,
  // context,
  progress,
}: // token,
{
  request: vscode.ChatAgentRequest;
  context: vscode.ChatAgentContext;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  token: vscode.CancellationToken;
}) {
  // Currently we're hardcoding a response for the demo.
  // const access = await vscode.chat.requestChatAccess('copilot');
  // const messages = [
  //   {
  //     role: vscode.ChatMessageRole.System,
  //     content:
  //       'You are a MongoDB expert that wants to provide documentation! Reply in a helpful way for someone who wants to look up information about MongoDB and how to use it. Offer to give suggestions and examples of how to do things involved with data if they would like.',
  //   },
  //   {
  //     role: vscode.ChatMessageRole.User,
  //     content: request.prompt,
  //   },
  // ];
  // const chatRequest = access.makeRequest(messages, {}, token);
  // for await (const fragment of chatRequest.response) {
  //   progress.report({ content: fragment });
  // }

  const fragments = [
    "`$vectorSearch` is an aggregation pipeline stage in Atlas Vector Search that performs an ANN (Approximate Nearest Neighbor) search on a vector in the specified field. The field that you want to search must be indexed as Atlas Vector Search vector type inside a vectorSearch index type. Atlas Vector Search assigns a score, in a fixed range from `0` to `1` only, to every document that it returns. For `cosine` and `dotProduct` similarities, Atlas Vector Search normalizes the score using a specific algorithm. The score assigned to a returned document is part of the document's metadata. To include each returned document's score along with the result set, use a `$project` stage in your aggregation pipeline.\n",
    '\n**Related resources:**\n',
    '- https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/\n',
    '- https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-tutorial/',
  ];

  for (const fragment of fragments) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 300))
    );
    progress.report({ content: fragment });
  }

  return { subCommand: 'docs' };
}

async function handleSchemaRequest({}: // request,
// // context,
// progress,
// token,
{
  request: vscode.ChatAgentRequest;
  context: vscode.ChatAgentContext;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  token: vscode.CancellationToken;
}) {
  // const access = await vscode.chat.requestChatAccess('copilot');
  // const messages = [
  //   {
  //     role: vscode.ChatMessageRole.System,
  //     content:
  //       'You are a MongoDB expert! Reply as someone who is knowledgeable about MongoDB, sneak in a small database pun if possible. Keep communications concise, brief, and simple.',
  //   },
  //   {
  //     role: vscode.ChatMessageRole.User,
  //     content: request.prompt,
  //   },
  // ];
  // const chatRequest = access.makeRequest(messages, {}, token);
  // for await (const fragment of chatRequest.response) {
  //   progress.report({ content: fragment });
  // }

  await new Promise((resolve) => setTimeout(resolve, 5));

  return { subCommand: 'select-collection' };
}

async function handleGenericRequest({
  request,
  // context,
  progress,
  token,
}: {
  request: vscode.ChatAgentRequest;
  context: vscode.ChatAgentContext;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  token: vscode.CancellationToken;
}) {
  const access = await vscode.chat.requestChatAccess('copilot');
  const messages = [
    {
      role: vscode.ChatMessageRole.System,
      content:
        'You are a MongoDB expert! Reply as someone who is knowledgeable about MongoDB, sneak in a small database pun if possible. Keep communications concise, brief, and simple.',
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
    return await handleQueryRequest({
      request,
      context,
      progress,
      token,
    });
  } else if (request.subCommand === 'docs') {
    return await handleDocsRequest({
      request,
      context,
      progress,
      token,
    });
  } else if (request.subCommand === 'schema') {
    return await handleSchemaRequest({
      request,
      context,
      progress,
      token,
    });
  }

  return await handleGenericRequest({
    request,
    context,
    progress,
    token,
  });
};

export class AgentController {
  agent: vscode.ChatAgent2<vscode.ChatAgentResult2>;

  constructor({
    context,
    playgroundController,
  }: {
    context: vscode.ExtensionContext;
    playgroundController: PlaygroundController;
  }) {
    const agent = createAgent(context);

    context.subscriptions.push(
      agent,
      // Register the command handler for the button follow up.
      // TODO: We should move these to top level in mdbExtensionController.
      vscode.commands.registerCommand(
        OPEN_AI_CONTENT_IN_PLAYGROUND,
        ({
          collectionName,
          databaseName,
          text,
        }: {
          collectionName?: string;
          databaseName?: string;
          text: string;
        }) => {
          void playgroundController.createPlaygroundWithText({
            collectionName: collectionName ?? 'COLLECTION_NAME',
            databaseName: databaseName ?? 'DATABASE_NAME',
            text,
          });
          // void vscode.window.showInformationMessage('MongoDB!');
        }
      )
    );

    context.subscriptions.push(
      agent,
      // Register the command handler for the button follow up.
      // TODO: We should move these to top level in mdbExtensionController.
      vscode.commands.registerCommand(
        SELECT_COLLECTION_FOR_AI_QUERY,
        ({}: // request,
        // context,
        // progress,
        // token,
        {
          request: vscode.ChatAgentRequest;
          context: vscode.ChatAgentContext;
          progress: vscode.Progress<vscode.ChatAgentProgress>;
          token: vscode.CancellationToken;
        }) => {
          // void playgroundController.createPlaygroundWithText({
          //   collectionName: collectionName ?? 'COLLECTION_NAME',
          //   databaseName: databaseName ?? 'DATABASE_NAME',
          //   text
          // });
          // void vscode.window.showInformationMessage('MongoDB!');
          console.log('test');
        }
      )
    );

    this.agent = agent;
  }
}
