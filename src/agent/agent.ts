import * as vscode from 'vscode';
import { getSimplifiedSchema } from 'mongodb-schema';

import type { PlaygroundController } from '../editors';
import type ConnectionController from '../connectionController';
import { createUserPromptWithContext } from './prompts';
import playgroundBasicTextTemplate from '../templates/playgroundBasicTextTemplate';
import playgroundBasicTextTemplateNoDB from '../templates/playgroundBasicTextTemplateNoDB';

interface QueryChatAgentResult extends vscode.ChatAgentResult2 {
  subCommand: string;
  databaseName: string;
  collectionName: string;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  queryContent: string;
  description?: string;
}

interface BasicChatAgentResult extends vscode.ChatAgentResult2 {
  subCommand: string;
}

type ChatAgentResult = BasicChatAgentResult | QueryChatAgentResult;

const USE_HISTORY = true;

const OPEN_AI_CONTENT_IN_PLAYGROUND = 'mdb.open_ai_content_playground';
const SELECT_COLLECTION_FOR_AI_QUERY = 'mdb.select_collection_for_ai_query';
const RUN_AI_GENERATED_CONTENT = 'mdb.run_ai_content';
const RUN_AI_GENERATED_CONTENT_ON_DB = 'mdb.run_ai_content_on_db';

const NUM_DOCUMENTS_TO_SAMPLE = 4;

function handleEmptyQueryRequest({
  request,
}: {
  request: vscode.ChatAgentRequest;
  context: vscode.ChatAgentContext;
  progress: vscode.Progress<vscode.ChatAgentProgress>;
  token: vscode.CancellationToken;
}): ChatAgentResult {
  console.log('chat request agent id:', request.agentId);

  return {
    subCommand: '',
    errorDetails: {
      message:
        'Please specify a question when using this command.\n\nUsage: @MongoDB /query find documents where "name" contains "database".',
    },
  };
}

function getRunnableContentFromString(responseContent: string) {
  const matchedJSQueryContent = responseContent.match(
    /```javascript((.|\n)*)```/
  );
  console.log('matchedJSQueryContent', matchedJSQueryContent);
  let queryContent =
    matchedJSQueryContent && matchedJSQueryContent.length > 1
      ? matchedJSQueryContent[1]
      : '';

  if (!queryContent || queryContent.length === 0) {
    const matchedQueryContent = responseContent.match(
      /```javascript((.|\n)*)```/
    );
    if (matchedQueryContent && matchedQueryContent.length > 1) {
      queryContent = matchedQueryContent[1];
    }
    console.log('matchedQueryContent2', matchedQueryContent);
  }

  console.log('queryContent', queryContent);
  return queryContent;
}

const DB_NAME_ID = 'DATABASE_NAME';
const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)\n`;

const COL_NAME_ID = 'COLLECTION_NAME';
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)`;

function parseForDatabaseAndCollectionName({ text }: { text: string }): {
  databaseName: string;
  collectionName: string;
} {
  const databaseName = text.match(DB_NAME_REGEX)?.[1];
  const collectionName = text.match(COL_NAME_REGEX)?.[1];

  return {
    databaseName: databaseName ?? 'test',
    collectionName: collectionName ?? 'test',
  };
}

export class AgentController {
  agent: vscode.ChatAgent2<vscode.ChatAgentResult2>;
  _connectionController: ConnectionController;
  _playgroundController: PlaygroundController;

  constructor({
    context,
    connectionController,
    playgroundController,
  }: {
    context: vscode.ExtensionContext;
    connectionController: ConnectionController;
    playgroundController: PlaygroundController;
  }) {
    const agent = this.createAgent(context);

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
        }
      )
    );

    context.subscriptions.push(
      agent,
      vscode.commands.registerCommand(
        RUN_AI_GENERATED_CONTENT,
        async ({ text }: { text: string }) => {
          let dataService = this._connectionController.getActiveDataService();

          if (!dataService) {
            // TODO: We should handle this in follow up commands, button to connect / choose cluster or no cluster.
            const successfullyConnected =
              await this._connectionController.changeActiveConnection();
            dataService = this._connectionController.getActiveDataService();

            if (!dataService || !successfullyConnected) {
              return;
            }
          }

          const confirmationResult = await vscode.window.showInformationMessage(
            `Are you sure you wish to execute this code on "${this._connectionController.getActiveConnectionName()}"?`,
            {
              modal: true,
            },
            'Yes'
          );

          if (confirmationResult !== 'Yes') {
            return false;
          }

          const content = playgroundBasicTextTemplateNoDB.replace(
            'PLAYGROUND_CONTENT',
            text
          );

          console.log('evaluate:', content);

          // TODO: This is hacky and private + coupled functions, we
          // should refactor if we do this legit.
          this._playgroundController._codeToEvaluate = content;
          const evaluateResponse =
            await this._playgroundController._evaluateWithCancelModal();

          // const evaluateResponse = await this._playgroundController._evaluate(content);
          if (!evaluateResponse || !evaluateResponse.result) {
            return;
          }

          this._playgroundController._playgroundResult =
            evaluateResponse.result;
          await this._playgroundController._openPlaygroundResult();
        }
      )
    );

    context.subscriptions.push(
      agent,
      vscode.commands.registerCommand(
        RUN_AI_GENERATED_CONTENT_ON_DB,
        async ({
          // collectionName,
          progress,
          databaseName,
          text,
        }: {
          collectionName?: string;
          databaseName?: string;
          progress: vscode.Progress<vscode.ChatAgentProgress>;
          text: string;
        }) => {
          const confirmationResult = await vscode.window.showInformationMessage(
            `Are you sure you wish to execute this code on "${this._connectionController.getActiveConnectionName()}"${
              databaseName ? `with database "${databaseName}"` : ''
            }?`,
            {
              modal: true,
            },
            'Yes'
          );

          if (confirmationResult !== 'Yes') {
            return false;
          }

          const content = playgroundBasicTextTemplate
            .replace('CURRENT_DATABASE', databaseName ?? 'test')
            .replace('PLAYGROUND_CONTENT', text);

          console.log('evaluate:', content);

          // TODO: This is hacky and private + coupled functions, we should refactor
          // if we do this legit.
          this._playgroundController._codeToEvaluate = content;
          const evaluateResponse =
            await this._playgroundController._evaluateWithCancelModal();

          // const evaluateResponse = await this._playgroundController._evaluate(content);
          if (!evaluateResponse || !evaluateResponse.result) {
            progress.report({
              content: '\nNo response returned.\n',
            });

            return;
          }

          this._playgroundController._playgroundResult =
            evaluateResponse.result;
          await this._playgroundController._openPlaygroundResult();

          progress.report({
            content: '\nDone!\n',
          });
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

          // _evaluate
        }
      )
    );

    this.agent = agent;
    this._connectionController = connectionController;
    this._playgroundController = playgroundController;
  }

  createAgent(context: vscode.ExtensionContext) {
    // Agents appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const agent = vscode.chat.createChatAgent(
      'mongodb',
      this.chatHandler.bind(this)
    );
    agent.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'images',
      'mongodb.png'
    );
    agent.description = vscode.l10n.t(
      'Ask anything about MongoDB.\nAsk how to write a query, ask a question about your cluster, ask a question.'
    );
    agent.fullName = vscode.l10n.t('MongoDB');
    agent.subCommandProvider = {
      provideSubCommands(/* token */) {
        return [
          {
            name: 'query',
            description:
              'Ask something that can written as a MongoDB query or pipeline.\nFor instance, you can ask "Show me all of the documents where the "address" has the word "street" in it."',
          },
          {
            name: 'docs',
            description: 'Ask anything about MongoDB.',
          },
          // { name: 'schema', description: 'Get the schema breakdown of a collection based on a sample of documents.' },
        ];
      },
    };

    agent.followupProvider = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      provideFollowups(
        result: ChatAgentResult
        // token: vscode.CancellationToken
      ) {
        if (result.subCommand === 'runnable_content') {
          console.log('resultresult', result);
          return [
            {
              commandId: RUN_AI_GENERATED_CONTENT_ON_DB,
              args: [
                {
                  progress: (result as QueryChatAgentResult).progress,
                  databaseName: (result as QueryChatAgentResult).databaseName,
                  collectionName: (result as QueryChatAgentResult)
                    .collectionName,
                  text: (result as QueryChatAgentResult).queryContent,
                },
              ],
              message: '@mongodb query',
              title: vscode.l10n.t('▶️ Run'),
            },

            {
              commandId: OPEN_AI_CONTENT_IN_PLAYGROUND,
              args: [
                {
                  progress: (result as QueryChatAgentResult).progress,
                  databaseName: (result as QueryChatAgentResult).databaseName,
                  collectionName: (result as QueryChatAgentResult)
                    .collectionName,
                  text: (result as QueryChatAgentResult).queryContent,
                },
              ],
              message: '@mongodb query',
              title: vscode.l10n.t('Open in playground'),
            },
          ];
        } else if (result.subCommand === 'generic_runnable_content') {
          console.log('generic_runnable_content resultresult', result);
          return [
            {
              commandId: RUN_AI_GENERATED_CONTENT,
              args: [
                {
                  progress: (result as QueryChatAgentResult).progress,
                  text: (result as QueryChatAgentResult).queryContent,
                },
              ],
              message: '@mongodb query',
              title: vscode.l10n.t('▶️ Run'),
            },
            {
              commandId: OPEN_AI_CONTENT_IN_PLAYGROUND,
              args: [
                {
                  progress: (result as QueryChatAgentResult).progress,
                  databaseName: (result as QueryChatAgentResult).databaseName,
                  collectionName: (result as QueryChatAgentResult)
                    .collectionName,
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

  async handleAutoAgent({
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
    const access = await vscode.chat.requestChatAccess('copilot');

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    // const isConnected = this._connectionController.isCurrentlyConnected();

    const systemMessage = {
      role: vscode.ChatMessageRole.System,
      content:
        // eslint-disable-next-line quotes
        // `You are a MongoDB expert! You create MongoDB queries and aggregation pipelines, and you are very good at it. Your response will be parsed by a machine. Parse the user's prompt for a database name and collection name. Respond in the format \nDATABASE_NAME: X\nCOLLECTION_NAME: Y\n where X and Y are the names. This is a first phase before we create the code, only respond with the collection name and database name.`,
        [
          'You are a MongoDB expert.',
          'You will be asked a question or given a task from a nice user.',
          'Keep communications concise, brief, and comprehensive.',
          'You are connected to a MongoDB database, and have the ability to run commands if needed.',
          'The commands you can run are:',
          '- Any mongosh (MongoDB Shell) command.',
          '- Fetch sample documents and the schema of a collection.',
          'The user may ask a question or give a task which requires more information from the user, or information resulting from running a database command. In these instances, return the question or the command to run to the user.',
          // eslint-disable-next-line quotes
          `Write MongoDB shell commands wrapped in a '''javascript block. If the user asks a question or something that translates into a MongoDB shell command then provide it as a '''javascript code snippet. Respond with markdown, code snippets are possible with '''javascript.`,
          // eslint-disable-next-line quotes
          `Instead of use X for database, write it as use('X')`,
          // TODO: remove vvv
          'If there is something that the user could provide to complete the generated code, then ask them for it so it can be provided in a follow up. Do not suggest for them to replace some content when they can provide it.',
          'For instance if the user asks for the size of a collection, without providing the collection name, ask them which collection.',
        ].join('\n'), // TODO: Better without \n?
    };

    const messages = [systemMessage];

    await Promise.all(
      context.history.map(async (historyItem) => {
        let res = '';
        for await (const fragment of historyItem.response) {
          res += fragment;
        }

        messages.push({
          role: vscode.ChatMessageRole.User,
          content: historyItem.request.prompt,
        });
        messages.push({
          role: vscode.ChatMessageRole.Assistant,
          content: res,
        });
      })
    );

    messages.push({
      role: vscode.ChatMessageRole.User,
      content: request.prompt,
    });

    const chatModelRequest = access.makeRequest(messages, {}, token);

    let responseContent = '';
    for await (const fragment of chatModelRequest.response) {
      responseContent += fragment;
      progress.report({ content: fragment });
    }

    console.log('responseContent', responseContent);

    const queryContent = getRunnableContentFromString(responseContent);

    if (!queryContent || queryContent.trim().length === 0) {
      return {
        subCommand: '',
      }; // No commands to run.
    }

    return {
      subCommand: 'generic_runnable_content',
      progress,
      queryContent,
    };
  }

  // @mongodb /query find all documents where the "address" has the word Broadway in it
  // @mongodb /query Which "STREET" has the highest average food inspection result "SCORE"?
  // @mongodb /query Which "CUISINE DESCRIPTION" has the highest average food inspection result "SCORE"? Collection restaurant_inspection_results_2022
  // @mongodb /query Which "CUISINE DESCRIPTION" has the highest average food inspection result "SCORE"? Database NYC, Collection restaurant_inspection_results_2022
  // @mongodb /query Which cuisine has the highest average food inspection result score? Database NYC, Collection restaurant_inspection_results_2022
  // @mongodb /query What's the height of the tallest roof from the database NYC, collection buildings?
  // @mongodb /query find all documents where the "address" has the word Broadway in it
  // eslint-disable-next-line complexity
  async handleQueryRequest({
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

    const abortController = new AbortController();

    token.onCancellationRequested(() => {
      abortController.abort();
    });

    // TODO: First parse for a database . collection name.
    // If not provided then give general response.
    // If provided, then get schema and attach schema and sample doc in question.

    const messages = [
      // {
      //   role: vscode.ChatMessageRole.System,
      //   content:
      //     // eslint-disable-next-line quotes
      //     `You are a MongoDB expert! You create MongoDB queries and aggregation pipelines, and you are very good at it. The user will provide the basis for the query. Keep your response concise. Respond with markdown, code snippets are possible with '''javascript. You can imagine the schema, collection, and database name. Respond in MongoDB shell syntax using the '''javascript code style.', //  If you require information about the users schema first you can ask for a sample document.`,
      // },
      {
        role: vscode.ChatMessageRole.System,
        content:
          // eslint-disable-next-line quotes
          `You are a MongoDB expert! You create MongoDB queries and aggregation pipelines, and you are very good at it. Your response will be parsed by a machine. Parse the user's prompt for a database name and collection name. Respond in the format \nDATABASE_NAME: X\nCOLLECTION_NAME: Y\n where X and Y are the names. This is a first phase before we create the code, only respond with the collection name and database name.`,
      },
      {
        role: vscode.ChatMessageRole.User,
        content: request.prompt,
      },
    ];
    const parseForDatabaseAndCollectionNameRequest = access.makeRequest(
      messages,
      {},
      token
    );

    let dbColParseResponseContent = '';
    for await (const fragment of parseForDatabaseAndCollectionNameRequest.response) {
      dbColParseResponseContent += fragment;
      // progress.report({ content: fragment });
    }

    const { databaseName, collectionName } = parseForDatabaseAndCollectionName({
      text: dbColParseResponseContent,
    });

    console.log(
      'parsed database name:',
      databaseName,
      'collection name:',
      collectionName
    );
    console.log('from ai response: ', dbColParseResponseContent);

    let dataService = this._connectionController.getActiveDataService();

    if (!dataService) {
      progress.report({
        content:
          "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n",
      });
      // We add a delay so the user can read the message.
      // TODO: We should handle this in follow up commands, button to connect / choose cluster or no cluster.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const successfullyConnected =
        await this._connectionController.changeActiveConnection();
      dataService = this._connectionController.getActiveDataService();

      if (!dataService || !successfullyConnected) {
        progress.report({
          content:
            'No connection for command provided. Please use a valid connection for running commands.\n\n',
        });
        return { subCommand: '' };
      }
    }

    progress.report({
      content: `Fetching sample documents from ${databaseName}.${collectionName} to reference for building the query...\n\n`,
    });

    // Fetch the schema of the collection:
    const sampleDocuments = await dataService.sample(
      `${databaseName}.${collectionName}`,
      {
        query: {},
        size: NUM_DOCUMENTS_TO_SAMPLE,
      },
      {
        maxTimeMS: 10_000,
        promoteValues: false,
      },
      {
        abortSignal: abortController.signal,
      }
    );
    progress.report({
      content:
        sampleDocuments && sampleDocuments.length > 0
          ? 'Parsing the documents for their schema...\n\n'
          : 'No documents found, the query will be generated without referencing a collection.\n\n',
    });
    const schema = await getSimplifiedSchema(sampleDocuments);
    const userPrompt = createUserPromptWithContext({
      schema,
      collectionName,
      databaseName,
      sampleDocuments,
    });
    userPrompt.push(
      `Write a query that does the following: "${request.prompt}"`
    );
    const userPromptString = userPrompt.join('\n');

    console.log('userPrompt', userPrompt);

    const chatRequest = access.makeRequest(
      [
        {
          role: vscode.ChatMessageRole.System,
          content:
            // eslint-disable-next-line quotes
            `You are a MongoDB expert! You create MongoDB queries and aggregation pipelines, and you are very good at it. The user will provide the basis for the query. Keep your response concise. Respond with markdown, javascript code snippets are possible with '''javascript. Respond in MongoDB shell syntax.`,
        },
        {
          role: vscode.ChatMessageRole.User,
          content: userPromptString,
        },
      ],
      {},
      token
    );

    let responseContent = '';
    for await (const fragment of chatRequest.response) {
      responseContent += fragment;
      progress.report({ content: fragment });
    }

    const queryContent = getRunnableContentFromString(responseContent);

    if (!queryContent || queryContent.trim().length === 0) {
      return {
        subCommand: '',
      }; // No commands to run.
    }

    return {
      subCommand: 'runnable_content',
      databaseName,
      collectionName,
      progress,
      queryContent,
    };
  }

  // TODO: Talk to the docs chatbot.
  // @mongodb /docs What is $vectorSearch?
  async handleDocsRequest({
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

  async handleSchemaRequest({}: // request,
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

  // @mongodb what's the size of the "test" database?
  async handleGenericRequest({
    request,
    // context,
    progress,
    token,
  }: {
    request: vscode.ChatAgentRequest;
    context: vscode.ChatAgentContext; // TODO: Context supply....
    progress: vscode.Progress<vscode.ChatAgentProgress>;
    token: vscode.CancellationToken;
  }) {
    const access = await vscode.chat.requestChatAccess('copilot');
    const messages = [
      {
        role: vscode.ChatMessageRole.System,
        content:
          // eslint-disable-next-line quotes
          `You are a MongoDB expert! Reply as someone who is knowledgeable about MongoDB. Keep communications concise, brief, and simple. Write MongoDB shell commands wrapped in a '''javascript block. If the user asks a question or something that translates into a MongoDB shell command then provide it as a '''javascript code snippet. Respond with markdown, code snippets are possible with '''javascript. Instead of use X for database, write it as use('X').`,
      },
      {
        role: vscode.ChatMessageRole.User,
        content: request.prompt,
      },
    ];
    const chatRequest = access.makeRequest(messages, {}, token);
    let responseContent = '';
    for await (const fragment of chatRequest.response) {
      responseContent += fragment;
      progress.report({ content: fragment });
    }

    const queryContent = getRunnableContentFromString(responseContent);

    if (!queryContent || queryContent.trim().length === 0) {
      return {
        subCommand: '',
      }; // No commands to run.
    }

    return {
      subCommand: 'generic_runnable_content',
      progress,
      queryContent,
    };
  }

  async chatHandler(
    request: vscode.ChatAgentRequest,
    context: vscode.ChatAgentContext,
    progress: vscode.Progress<vscode.ChatAgentProgress>,
    token: vscode.CancellationToken
  ): Promise<ChatAgentResult> {
    // To talk to an LLM in your subcommand handler implementation, your
    // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
    // The GitHub Copilot Chat extension implements this provider.
    if (request.subCommand === 'query') {
      return await this.handleQueryRequest({
        request,
        context,
        progress,
        token,
      });
    } else if (request.subCommand === 'docs') {
      return await this.handleDocsRequest({
        request,
        context,
        progress,
        token,
      });
    } else if (request.subCommand === 'schema') {
      return await this.handleSchemaRequest({
        request,
        context,
        progress,
        token,
      });
    }

    if (USE_HISTORY) {
      return await this.handleAutoAgent({
        request,
        context,
        progress,
        token,
      });
    }

    return await this.handleGenericRequest({
      request,
      context,
      progress,
      token,
    });
  }
}
