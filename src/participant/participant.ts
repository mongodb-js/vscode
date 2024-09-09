import * as vscode from 'vscode';
import { getSimplifiedSchema } from 'mongodb-schema';
import type { Document } from 'bson';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import type { LoadedConnection } from '../storage/connectionStorage';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';
import { GenericPrompt } from './prompts/generic';
import { CHAT_PARTICIPANT_ID } from './constants';
import { QueryPrompt } from './prompts/query';
import { COL_NAME_ID, DB_NAME_ID, NamespacePrompt } from './prompts/namespace';
import { SchemaFormatter } from './schema';
import { getSimplifiedSampleDocuments } from './sampleDocuments';
import { getCopilotModel } from './model';
import { createMarkdownLink } from './markdown';
import {
  collectionNameInCommandResponseKey,
  databaseNameInCommandResponseKey,
  getLatestDatabaseAndCollectionFromChatHistory,
} from './prompts/history';

const log = createLogger('participant');

const NUM_DOCUMENTS_TO_SAMPLE = 3;

interface NamespaceQuickPicks {
  label: string;
  data: string;
}

export type RunParticipantQueryCommandArgs = {
  runnableContent: string;
};

const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)`;
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)`;

const MAX_MARKDOWN_LIST_LENGTH = 10;

export function parseForDatabaseAndCollectionName(text: string): {
  databaseName?: string;
  collectionName?: string;
} {
  const databaseName = text.match(DB_NAME_REGEX)?.[1].trim();
  const collectionName = text.match(COL_NAME_REGEX)?.[1].trim();
  return { databaseName, collectionName };
}

export function getRunnableContentFromString(text: string): string {
  const matchedJSresponseContent = text.match(/```javascript((.|\n)*)```/);

  const code =
    matchedJSresponseContent && matchedJSresponseContent.length > 1
      ? matchedJSresponseContent[1]
      : '';
  return code.trim();
}

export default class ParticipantController {
  _participant?: vscode.ChatParticipant;
  _connectionController: ConnectionController;
  _storageController: StorageController;

  constructor({
    connectionController,
    storageController,
  }: {
    connectionController: ConnectionController;
    storageController: StorageController;
  }) {
    this._connectionController = connectionController;
    this._storageController = storageController;
  }

  createParticipant(context: vscode.ExtensionContext): vscode.ChatParticipant {
    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    this._participant = vscode.chat.createChatParticipant(
      CHAT_PARTICIPANT_ID,
      this.chatHandler.bind(this)
    );
    this._participant.iconPath = vscode.Uri.joinPath(
      vscode.Uri.parse(context.extensionPath),
      'images',
      'mongodb.png'
    );
    log.info('Chat Participant Created', {
      participantId: this._participant?.id,
    });
    return this._participant;
  }

  getParticipant(): vscode.ChatParticipant | undefined {
    return this._participant;
  }

  handleError(err: any, stream: vscode.ChatResponseStream): void {
    // Making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    if (err instanceof vscode.LanguageModelError) {
      log.error(err.message, err.code, err.cause);
      if (
        err.cause instanceof Error &&
        err.cause.message.includes('off_topic')
      ) {
        stream.markdown(
          vscode.l10n.t(
            "I'm sorry, I can only explain computer science concepts.\n\n"
          )
        );
      }
    } else {
      // Re-throw other errors so they show up in the UI.
      throw err;
    }
  }

  async getChatResponseContent({
    messages,
    stream,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<string> {
    console.log('send messages to chat model:', messages);

    const model = await getCopilotModel();
    let responseContent = '';
    if (model) {
      try {
        const chatResponse = await model.sendRequest(messages, {}, token);
        for await (const fragment of chatResponse.text) {
          responseContent += fragment;
        }
      } catch (err) {
        this.handleError(err, stream);
      }
    }
    console.log('model chat response content:', responseContent);

    return responseContent;
  }

  // @MongoDB what is mongodb?
  async handleGenericRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const messages = GenericPrompt.buildMessages({
      request,
      context,
    });

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });
    stream.markdown(responseContent);

    const runnableContent = getRunnableContentFromString(responseContent);
    if (runnableContent && runnableContent.trim().length) {
      const commandArgs: RunParticipantQueryCommandArgs = {
        runnableContent,
      };
      stream.button({
        command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
        title: vscode.l10n.t('▶️ Run'),
        arguments: [commandArgs],
      });
      stream.button({
        command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
        title: vscode.l10n.t('Open in playground'),
        arguments: [commandArgs],
      });

      return { metadata: { responseContent: runnableContent } };
    }

    return { metadata: {} };
  }

  async connectWithParticipant(id?: string): Promise<boolean> {
    // TODO: connecting... ?
    // Currently no visual feedback except the action bar at the bottom.

    if (!id) {
      const didChangeActiveConnection =
        await this._connectionController.changeActiveConnection();
      if (!didChangeActiveConnection) {
        // If they don't choose a connection then we can't proceed;
        return false;
      }
    } else {
      await this._connectionController.connectWithConnectionId(id);
    }

    const connectionName = this._connectionController.getActiveConnectionName();

    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${connectionName}`,
    });
  }

  getConnectionsTree(): vscode.MarkdownString[] {
    return [
      ...this._connectionController
        .getSavedConnections()
        .sort((a, b) => {
          const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, MAX_MARKDOWN_LIST_LENGTH)
        .map((conn: LoadedConnection) =>
          createMarkdownLink({
            commandId: 'mdb.connectWithParticipant',
            data: conn.id,
            name: conn.name,
          })
        ),
      createMarkdownLink({
        commandId: 'mdb.connectWithParticipant',
        name: 'Show more',
      }),
    ];
  }

  async getDatabaseQuickPicks(): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // TODO: Ask to connect when the user disconnected.
      return [];
    }

    try {
      const databases = await dataService.listDatabases();
      return databases.map((db) => ({
        label: db.name,
        data: db.name,
      }));
    } catch (error) {
      return [];
    }
  }

  async _selectDatabaseWithQuickPick(): Promise<string | undefined> {
    const databases = await this.getDatabaseQuickPicks();
    const selectedQuickPickItem = await vscode.window.showQuickPick(databases, {
      placeHolder: 'Select a database...',
    });
    return selectedQuickPickItem?.data;
  }

  async selectDatabaseWithParticipant({
    databaseName: _databaseName,
  }: {
    databaseName: string;
  }): Promise<boolean> {
    let databaseName: string | undefined = _databaseName;
    if (!databaseName) {
      databaseName = await this._selectDatabaseWithQuickPick();
      if (!databaseName) {
        return false;
      }
    }

    return vscode.commands.executeCommand('workbench.action.chat.open', {
      // TODO: We could use a separate handler like /query-database
      // TODO: We need a way to better pass metadata here.
      // A user could mistakenly write one of these which would mess up our parsing.
      // We could possible mistake the command for the database or collection name.
      // To fix this we either need to pass metadata with the command, which
      // is doesn't look like it possible, or we need to have a more complex
      // message key, like using a special symbol for this regex (although a user could
      // copy paste this themselves and get into another weird state).
      query: `@MongoDB /query ${databaseNameInCommandResponseKey}${databaseName}`,
    });
  }

  async getCollectionQuickPicks(
    databaseName: string
  ): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // TODO: Ask to connect if they disconnected.
      return [];
    }

    try {
      const collections = await dataService.listCollections(databaseName);
      return collections.map((db) => ({
        label: db.name,
        data: db.name,
      }));
    } catch (error) {
      return [];
    }
  }

  async _selectCollectionWithQuickPick(
    databaseName: string
  ): Promise<string | undefined> {
    const collections = await this.getCollectionQuickPicks(databaseName);
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      collections,
      {
        placeHolder: 'Select a collection...',
      }
    );
    return selectedQuickPickItem?.data;
  }

  // TODO: Pass in database name also.
  async selectCollectionWithParticipant({
    databaseName,
    collectionName: _collectionName,
  }: {
    databaseName: string;
    collectionName?: string;
  }): Promise<boolean> {
    let collectionName: string | undefined = _collectionName;
    if (!collectionName) {
      collectionName = await this._selectCollectionWithQuickPick(databaseName);
      if (!collectionName) {
        return false;
      }
    }

    return vscode.commands.executeCommand('workbench.action.chat.open', {
      // query: `@MongoDB /query ${collectionName}`,
      query: `@MongoDB /query ${collectionNameInCommandResponseKey}${collectionName}`,
    });
  }

  async getDatabasesTree(): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return [];
    }

    try {
      const databases = await dataService.listDatabases();
      return [
        ...databases.slice(0, MAX_MARKDOWN_LIST_LENGTH).map((db) =>
          createMarkdownLink({
            commandId: 'mdb.selectDatabaseWithParticipant',
            data: {
              // TODO: Connection id?
              databaseName: db.name,
            },
            name: db.name,
          })
        ),
        ...(databases.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              createMarkdownLink({
                commandId: 'mdb.selectDatabaseWithParticipant',
                name: 'Show more',
              }),
            ]
          : []),
      ];
    } catch (error) {
      // Users can always do this manually when asked to provide a database name.
      return [];
    }
  }

  async getCollectionTree(
    databaseName: string
  ): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return [];
    }

    try {
      const collections = await dataService.listCollections(databaseName);
      return [
        ...collections.slice(0, MAX_MARKDOWN_LIST_LENGTH).map((coll) =>
          createMarkdownLink({
            commandId: 'mdb.selectCollectionWithParticipant',
            data: {
              databaseName,
              collectionName: coll.name,
            },
            name: coll.name,
          })
        ),
        ...(collections.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              createMarkdownLink({
                commandId: 'mdb.selectCollectionWithParticipant',
                name: 'Show more',
              }),
            ]
          : []),
      ];
    } catch (error) {
      // Users can always do this manually when asked to provide a collection name.
      return [];
    }
  }

  async _getNamespaceFromChat({
    request,
    context,
    stream,
    token,
  }: {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<{
    databaseName: string | undefined;
    collectionName: string | undefined;
  }> {
    // Parse the context to see if we already have a database and collection name.
    const namespaceFromChatHistory =
      getLatestDatabaseAndCollectionFromChatHistory({
        context,
        request,
      });
    if (
      namespaceFromChatHistory.databaseName &&
      namespaceFromChatHistory.collectionName
    ) {
      return {
        databaseName: namespaceFromChatHistory.databaseName,
        collectionName: namespaceFromChatHistory.collectionName,
      };
    }

    const messagesWithNamespace = NamespacePrompt.buildMessages({
      context,
      request,
    });
    const responseContentWithNamespace = await this.getChatResponseContent({
      messages: messagesWithNamespace,
      stream,
      token,
    });
    const namespace = parseForDatabaseAndCollectionName(
      responseContentWithNamespace
    );

    return {
      databaseName: namespace.databaseName,
      collectionName: namespace.collectionName,
    };
  }

  async _askForNamespace({
    databaseName,
    collectionName,
    stream,
  }: {
    databaseName: string | undefined;
    collectionName: string | undefined;
    stream: vscode.ChatResponseStream;
  }): Promise<vscode.ChatResult> {
    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list.
    if (!databaseName) {
      const tree = await this.getDatabasesTree();
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    } else if (!collectionName) {
      const tree = await this.getCollectionTree(databaseName);
      stream.markdown(
        'Which collection would you like to query within this database?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    }

    return {
      metadata: {
        askForNamespace: true,
        databaseName,
        collectionName,
      },
    };
  }

  _askToConnect(stream: vscode.ChatResponseStream): vscode.ChatResult {
    const tree = this.getConnectionsTree();
    stream.markdown(
      "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
    );
    // TODO: I think Alena already confirmed, can we use the anchor method instead of the markdown?
    // It would make the streaming not show the html symbols.
    // const savedConnections = this._connectionController
    //   .getSavedConnections();
    // if (savedConnections.length > 0) {
    //   const commandURI = vscode.Uri.parse(`command:mdb.connectWithParticipant?${encodeURIComponent('["' + savedConnections[0].id + '"]')}`);
    //   stream.anchor(
    //     commandURI,
    //     'test anchor Connect to a cluster'
    //   );
    // }

    for (const item of tree) {
      stream.markdown(item);
    }
    return {
      metadata: {
        askToConnect: true,
      },
    };
  }

  // The sample documents returned from this are simplified (strings and arrays shortened).
  async _fetchCollectionSchemaAndSampleDocuments({
    abortSignal,
    databaseName,
    collectionName,
  }: {
    abortSignal;
    databaseName: string;
    collectionName: string;
  }): Promise<{
    schema?: string;
    sampleDocuments?: Document[];
  }> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return {};
    }

    try {
      const sampleDocuments =
        (await dataService?.sample?.(
          `${databaseName}.${collectionName}`,
          {
            query: {},
            size: NUM_DOCUMENTS_TO_SAMPLE,
          },
          { promoteValues: false },
          {
            abortSignal,
          }
        )) || [];

      const unformattedSchema = await getSimplifiedSchema(sampleDocuments);
      const schema = new SchemaFormatter().format(unformattedSchema);

      return {
        sampleDocuments: getSimplifiedSampleDocuments(sampleDocuments),
        schema,
      };
    } catch (err: any) {
      log.error('Unable to fetch schema and sample documents', err);
      return {};
    }
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    if (!request.prompt || request.prompt.trim().length === 0) {
      stream.markdown(QueryPrompt.getEmptyRequestResponse());
      return { metadata: {} };
    }

    if (!this._connectionController.getActiveDataService()) {
      return this._askToConnect(stream);
    }

    // We "prompt chain" to handle the query requests.
    // First we ask the model to parse for the database and collection name.
    // If they exist, we can then use them in our final completion.
    // When they don't exist we ask the user for them.
    const { databaseName, collectionName } = await this._getNamespaceFromChat({
      request,
      context,
      stream,
      token,
    });
    if (!databaseName || !collectionName) {
      return await this._askForNamespace({
        databaseName,
        collectionName,
        stream,
      });
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    const { schema, sampleDocuments } =
      await this._fetchCollectionSchemaAndSampleDocuments({
        abortSignal: abortController.signal,
        databaseName,
        collectionName,
      });

    const useSampleDocsInCopilot = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useSampleDocsInCopilot');
    const messages = await QueryPrompt.buildMessages({
      request,
      context,
      databaseName,
      collectionName,
      schema,
      ...(useSampleDocsInCopilot ? { sampleDocuments } : {}),
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });

    stream.markdown(responseContent);

    const runnableContent = getRunnableContentFromString(responseContent);
    if (runnableContent && runnableContent.trim().length) {
      const commandArgs: RunParticipantQueryCommandArgs = {
        runnableContent,
      };
      stream.button({
        command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
        title: vscode.l10n.t('▶️ Run'),
        arguments: [commandArgs],
      });
      stream.button({
        command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
        title: vscode.l10n.t('Open in playground'),
        arguments: [commandArgs],
      });
    }

    return { metadata: { responseContent: runnableContent } };
  }

  async chatHandler(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken
    ]
  ): Promise<vscode.ChatResult | undefined> {
    const [request, , stream] = args;

    if (
      !request.command &&
      (!request.prompt || request.prompt.trim().length === 0)
    ) {
      stream.markdown(GenericPrompt.getEmptyRequestResponse());
      return { metadata: {} };
    }

    const hasBeenShownWelcomeMessageAlready = !!this._storageController.get(
      StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE
    );
    if (!hasBeenShownWelcomeMessageAlready) {
      stream.markdown(
        vscode.l10n.t(`
  Welcome to MongoDB Participant!\n\n
  Interact with your MongoDB clusters and generate MongoDB-related code more efficiently with intelligent AI-powered feature, available today in the MongoDB extension.\n\n
  Please see our [FAQ](https://www.mongodb.com/docs/generative-ai-faq/) for more information.\n\n`)
      );
      void this._storageController.update(
        StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
        true
      );
    }

    if (request.command === 'query') {
      return await this.handleQueryRequest(...args);
    } else if (request.command === 'docs') {
      // TODO(VSCODE-570): Implement this.
    } else if (request.command === 'schema') {
      // TODO(VSCODE-571): Implement this.
    }
    return await this.handleGenericRequest(...args);
  }
}
