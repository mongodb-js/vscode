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

const log = createLogger('participant');

const NUM_DOCUMENTS_TO_SAMPLE = 3;

interface ChatResult extends vscode.ChatResult {
  metadata: {
    responseContent?: string;
    namespace?: {
      databaseName?: string;
      collectionName?: string;
    };
    sampleDocuments?: Document[];
  };
}

interface NamespaceQuickPicks {
  label: string;
  data: string;
}

const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)\n?`;
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)\n?`;

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
  _chatResult?: ChatResult;

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

  handleEmptyQueryRequest(): (string | vscode.MarkdownString)[] {
    const messages: (string | vscode.MarkdownString)[] = [];
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      messages.push(
        vscode.l10n.t(
          'Please select a cluster to connect by clicking on an item in the connections list.'
        )
      );
      messages.push(...this.getConnectionsTree());
    }
    /* if (!this._databaseName) {
      messages.push(
        vscode.l10n.t(
          'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      messages.push(...(await this.getDatabasesTree()));
    }
    if (!this._collectionName) {
      messages.push(
        vscode.l10n.t(
          'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      messages.push(...(await this.getCollectionTree()));
    } */
    messages.push(
      vscode.l10n.t(
        'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".'
      )
    );
    return messages;
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

    return responseContent;
  }

  // @MongoDB what is mongodb?
  async handleGenericRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
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
      stream.button({
        command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
        title: vscode.l10n.t('▶️ Run'),
      });

      stream.button({
        command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
        title: vscode.l10n.t('Open in playground'),
      });

      return { metadata: { responseContent: runnableContent } };
    }

    return { metadata: {} };
  }

  async connectWithParticipant(id?: string): Promise<boolean> {
    if (!id) {
      await this._connectionController.changeActiveConnection();
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

  async _selectDatabaseWithCommandPalette(): Promise<string | undefined> {
    const databases = await this.getDatabaseQuickPicks();
    const selectedQuickPickItem = await vscode.window.showQuickPick(databases, {
      placeHolder: 'Select a database...',
    });
    return selectedQuickPickItem?.data;
  }

  async selectDatabaseWithParticipant(name: string): Promise<boolean> {
    let selectedName: string | undefined = name;
    if (!selectedName) {
      selectedName = await this._selectDatabaseWithCommandPalette();
    }
    if (!selectedName) {
      return false;
    }
    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${selectedName || ''}`,
    });
  }

  async getCollectionQuickPicks(
    databaseName: string
  ): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
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

  async _selectCollectionWithCommandPalette(
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

  async selectCollectionWithParticipant(_data: string): Promise<boolean> {
    const data = JSON.parse(decodeURIComponent(_data));
    let selectedName: string | undefined = data.collectionName;
    if (!data.collectionName) {
      selectedName = await this._selectCollectionWithCommandPalette(
        data.databaseName
      );
    }
    if (!selectedName) {
      return false;
    }
    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${selectedName || ''}`,
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
            data: db.name,
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
    databaseName?: string
  ): Promise<vscode.MarkdownString[]> {
    if (!databaseName) {
      return [];
    }

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
              collectionName: coll.name,
              databaseName,
            },
            name: coll.name,
          })
        ),
        ...(collections.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              createMarkdownLink({
                commandId: 'mdb.selectCollectionWithParticipant',
                data: {
                  databaseName,
                },
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

  _ifNewChatResetQueryGenerationState(context: vscode.ChatContext): void {
    const isNewChat = !context.history.find(
      (historyItem) => historyItem.participant === CHAT_PARTICIPANT_ID
    );
    if (isNewChat) {
      this._chatResult = undefined;
    }
  }

  _findSampleDocuments(context: vscode.ChatContext): Document[] | undefined {
    const historyWithSampleDocuments = context.history
      .filter((historyItem) => {
        return (
          historyItem.participant === CHAT_PARTICIPANT_ID &&
          historyItem instanceof vscode.ChatResponseTurn &&
          historyItem.result.metadata?.sampleDocuments
        );
      })
      .pop();
    const sampleDocuments: Document[] | undefined = historyWithSampleDocuments
      ? (historyWithSampleDocuments as vscode.ChatResponseTurn).result.metadata
          ?.namespace
      : undefined;
    return sampleDocuments;
  }

  async _findNamespace(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<{
    databaseName?: string;
    collectionName?: string;
  }> {
    const historyWithNamespace = context.history
      .filter((historyItem) => {
        return (
          historyItem.participant === CHAT_PARTICIPANT_ID &&
          historyItem instanceof vscode.ChatResponseTurn &&
          historyItem.result.metadata?.namespace
        );
      })
      .pop();
    const namespace: {
      databaseName?: string;
      collectionName?: string;
    } = historyWithNamespace
      ? (historyWithNamespace as vscode.ChatResponseTurn).result.metadata
          ?.namespace
      : {
          databaseName: undefined,
          collectionName: undefined,
        };

    const dataService = this._connectionController.getActiveDataService();
    if (dataService) {
      try {
        const databases = await dataService.listDatabases();
        const newDatabaseName = databases.find(
          (db) => db.name === request.prompt
        )?.name;
        if (newDatabaseName) {
          namespace.databaseName = newDatabaseName;
        } else if (namespace.databaseName) {
          const collections = await dataService.listCollections(
            namespace.databaseName
          );
          const newCollectionName = collections.find(
            (db) => db.name === request.prompt
          )?.name;
          if (newCollectionName) {
            namespace.collectionName = newCollectionName;
          }
        }
      } catch (error) {
        // Do nothing.
      }
    }

    if (!namespace.databaseName || !namespace.collectionName) {
      const messagesWithNamespace = NamespacePrompt.buildMessages({
        context,
        request,
      });
      const responseContentWithNamespace = await this.getChatResponseContent({
        messages: messagesWithNamespace,
        stream,
        token,
      });
      const namespaceFromPrompt = parseForDatabaseAndCollectionName(
        responseContentWithNamespace
      );
      namespace.databaseName = namespaceFromPrompt.databaseName;
      namespace.collectionName = namespaceFromPrompt.collectionName;
    }

    return namespace;
  }

  async _askForNamespace(
    namespace: {
      databaseName?: string;
      collectionName?: string;
    },
    stream: vscode.ChatResponseStream
  ): Promise<void> {
    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list.
    if (!namespace.databaseName) {
      const tree = await this.getDatabasesTree();
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    } else if (!namespace.collectionName) {
      const tree = await this.getCollectionTree(namespace.databaseName);
      stream.markdown(
        'Which collection would you like to query within this database?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    }
  }

  _shouldAskToConnectIfNotConnected(
    stream: vscode.ChatResponseStream
  ): boolean {
    const dataService = this._connectionController.getActiveDataService();
    if (dataService) {
      return false;
    }

    const tree = this.getConnectionsTree();
    stream.markdown(
      "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
    );
    for (const item of tree) {
      stream.markdown(item);
    }
    return true;
  }

  async _fetchSampleDocuments(
    namespace: {
      databaseName?: string;
      collectionName?: string;
    },
    abortSignal?: AbortSignal
  ): Promise<Document[] | undefined> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService || !namespace.databaseName || !namespace.collectionName) {
      return;
    }

    try {
      return (
        (await dataService?.sample?.(
          `${namespace.databaseName}.${namespace.collectionName}`,
          {
            query: {},
            size: NUM_DOCUMENTS_TO_SAMPLE,
          },
          { promoteValues: false },
          {
            abortSignal,
          }
        )) || []
      );
    } catch (err: any) {
      return;
    }
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
    // TODO: Reset this._queryGenerationState to QUERY_GENERATION_STATE.DEFAULT
    // when a command other than /query is called, as it disrupts the flow.
    this._ifNewChatResetQueryGenerationState(context);

    if (this._shouldAskToConnectIfNotConnected(stream)) {
      return { metadata: {} };
    }

    const namespace = await this._findNamespace(
      request,
      context,
      stream,
      token
    );

    if (!namespace.databaseName || !namespace.collectionName) {
      await this._askForNamespace(namespace, stream);
      return { metadata: { namespace } };
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    let sampleDocuments = this._findSampleDocuments(context);
    if (!sampleDocuments) {
      sampleDocuments = await this._fetchSampleDocuments(
        namespace,
        abortController.signal
      );
    }

    const useSampleDocsInCopilot = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useSampleDocsInCopilot');

    const messages = await QueryPrompt.buildMessages({
      request,
      context,
      databaseName: namespace.databaseName,
      collectionName: namespace.collectionName,
      schema: sampleDocuments
        ? new SchemaFormatter().format(
            await getSimplifiedSchema(sampleDocuments)
          )
        : undefined,
      sampleDocuments:
        sampleDocuments && useSampleDocsInCopilot
          ? getSimplifiedSampleDocuments(sampleDocuments)
          : undefined,
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });

    stream.markdown(responseContent);

    const runnableContent = getRunnableContentFromString(responseContent);
    if (runnableContent && runnableContent.trim().length) {
      stream.button({
        command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
        title: vscode.l10n.t('▶️ Run'),
      });
      stream.button({
        command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
        title: vscode.l10n.t('Open in playground'),
      });
    }

    return {
      metadata: {
        responseContent: runnableContent,
        namespace,
        sampleDocuments,
      },
    };
  }

  async chatHandler(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken
    ]
  ): Promise<ChatResult | undefined> {
    const [request, , stream] = args;

    if (!request.prompt || request.prompt.trim().length === 0) {
      const messages = this.handleEmptyQueryRequest();
      for (const msg of messages) {
        stream.markdown(msg);
      }
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
      this._chatResult = await this.handleQueryRequest(...args);
    } else if (request.command === 'docs') {
      // TODO(VSCODE-570): Implement this.
    } else if (request.command === 'schema') {
      // TODO(VSCODE-571): Implement this.
    } else {
      this._chatResult = await this.handleGenericRequest(...args);
    }

    return this._chatResult;
  }
}
