import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import type { SinonSpy, SinonStub } from 'sinon';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';
import { ObjectId, Int32 } from 'bson';

import ParticipantController from '../../../participant/participant';
import ConnectionController from '../../../connectionController';
import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import { ExtensionContextStub } from '../stubs';
import type {
  InternalPromptPurpose,
  ParticipantPromptProperties,
  ParticipantResponseProperties,
} from '../../../telemetry/telemetryService';
import TelemetryService, {
  TelemetryEventTypes,
} from '../../../telemetry/telemetryService';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import type { ChatResult } from '../../../participant/constants';
import { CHAT_PARTICIPANT_ID } from '../../../participant/constants';
import {
  SecretStorageLocation,
  StorageLocation,
} from '../../../storage/storageController';
import type { LoadedConnection } from '../../../storage/connectionStorage';
import { ChatMetadataStore } from '../../../participant/chatMetadata';
import { getFullRange } from '../suggestTestHelpers';
import { isPlayground } from '../../../utils/playground';
import { Prompts } from '../../../participant/prompts';
import { createMarkdownLink } from '../../../participant/markdown';
import EXTENSION_COMMANDS from '../../../commands';
import { getContentLength } from '../../../participant/prompts/promptBase';
import { ParticipantErrorTypes } from '../../../participant/participantErrorTypes';
import * as model from '../../../participant/model';
import {
  createChatRequestTurn,
  createChatResponseTurn,
} from './participantHelpers';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { CollectionTreeItem, DatabaseTreeItem } from '../../../explorer';
import type { SendMessageToParticipantOptions } from '../../../participant/participantTypes';
import { DocumentSource } from '../../../documentSource';

// The Copilot's model in not available in tests,
// therefore we need to mock its methods and returning values.
const MAX_TOTAL_PROMPT_LENGTH_MOCK = 16000;

const loadedConnection = {
  id: 'id',
  name: 'localhost',
  storageLocation: StorageLocation.NONE,
  secretStorageLocation: SecretStorageLocation.SecretStorage,
  connectionOptions: { connectionString: 'mongodb://localhost' },
};

const testChatId = 'test-chat-id';

const encodeStringify = (obj: Record<string, any>): string => {
  return encodeURIComponent(JSON.stringify(obj));
};

const getMessageContent = (
  message: vscode.LanguageModelChatMessage
): string => {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.reduce((agg: string, element) => {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string') {
        return agg + value;
      }

      return agg;
    }, '');
  }

  return '';
};

suite('Participant Controller Test Suite', function () {
  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  let testConnectionController: ConnectionController;
  let testStorageController: StorageController;
  let testStatusView: StatusView;
  let testTelemetryService: TelemetryService;
  let testParticipantController: ParticipantController;
  let testEditDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  let testPlaygroundResultProvider: PlaygroundResultProvider;
  let chatContextStub: vscode.ChatContext;
  let chatStreamStub: {
    push: sinon.SinonSpy;
    markdown: sinon.SinonSpy;
    button: sinon.SinonSpy;
  };
  let chatTokenStub;
  let countTokensStub;
  let sendRequestStub: sinon.SinonStub;
  let telemetryTrackStub: SinonSpy;

  const invokeChatHandler = async (
    request: vscode.ChatRequest
  ): Promise<ChatResult | undefined> =>
    testParticipantController.chatHandler(
      request,
      chatContextStub,
      chatStreamStub as unknown as vscode.ChatResponseStream,
      chatTokenStub
    );

  const assertCommandTelemetry = (
    command: string,
    chatRequest: vscode.ChatRequest,
    {
      expectSampleDocs = false,
      callIndex = 0,
      expectedInternalPurpose = undefined,
    }: {
      expectSampleDocs?: boolean;
      callIndex: number;
      expectedInternalPurpose?: InternalPromptPurpose;
    }
  ): void => {
    expect(telemetryTrackStub.callCount).to.be.greaterThan(callIndex);

    const call = telemetryTrackStub.getCalls()[callIndex];
    expect(call.args[0]).to.equal('Participant Prompt Submitted');

    const properties = call.args[1] as ParticipantPromptProperties;

    expect(properties.command).to.equal(command);
    expect(properties.has_sample_documents).to.equal(expectSampleDocs);
    expect(properties.history_size).to.equal(chatContextStub.history.length);

    // Total message length includes participant as well as user prompt
    expect(properties.total_message_length).to.be.greaterThan(
      properties.user_input_length
    );

    // User prompt length should be at least equal to the supplied user prompt, but my occasionally
    // be greater - e.g. when we enhance the context.
    expect(properties.user_input_length).to.be.greaterThanOrEqual(
      chatRequest.prompt.length
    );
    expect(properties.internal_purpose).to.equal(expectedInternalPurpose);
  };

  const assertResponseTelemetry = (
    command: string,
    {
      callIndex = 0,
      hasCTA = false,
      hasRunnableContent = false,
      foundNamespace = false,
    }: {
      callIndex: number;
      hasCTA?: boolean;
      hasRunnableContent?: boolean;
      foundNamespace?: boolean;
    }
  ): void => {
    expect(telemetryTrackStub.callCount).to.be.greaterThan(callIndex);
    const call = telemetryTrackStub.getCalls()[callIndex];
    expect(call.args[0]).to.equal('Participant Response Generated');

    const properties = call.args[1] as ParticipantResponseProperties;

    expect(properties.command).to.equal(command);
    expect(properties.found_namespace).to.equal(foundNamespace);
    expect(properties.has_cta).to.equal(hasCTA);
    expect(properties.has_runnable_content).to.equal(hasRunnableContent);
    expect(properties.output_length).to.be.greaterThan(0);
  };

  beforeEach(function () {
    testStorageController = new StorageController(extensionContextStub);
    testStatusView = new StatusView(extensionContextStub);

    telemetryTrackStub = sinon.stub();

    testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContextStub
    );
    testConnectionController = new ConnectionController({
      statusView: testStatusView,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
    sinon.replace(ChatMetadataStore, 'createNewChatId', () => testChatId);
    testEditDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testParticipantController = new ParticipantController({
      connectionController: testConnectionController,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
      playgroundResultProvider: testPlaygroundResultProvider,
    });
    chatContextStub = {
      history: [
        {
          participant: CHAT_PARTICIPANT_ID,
          prompt: 'hi',
          response: [new vscode.ChatResponseMarkdownPart('hello')],
          result: {},
        },
      ],
    };
    chatStreamStub = {
      push: sinon.fake(),
      markdown: sinon.fake(),
      button: sinon.fake(),
    };
    chatTokenStub = {
      onCancellationRequested: sinon.fake(),
    };
    countTokensStub = sinon.stub();
    // The model returned by vscode.lm.selectChatModels is always undefined in tests.
    sendRequestStub = sinon.stub();
    sinon.replace(model, 'getCopilotModel', () =>
      Promise.resolve({
        id: 'modelId',
        vendor: 'copilot',
        family: 'gpt-4o',
        version: 'gpt-4o-date',
        name: 'GPT 4o (date)',
        maxInputTokens: MAX_TOTAL_PROMPT_LENGTH_MOCK,
        countTokens: countTokensStub,
        sendRequest: sendRequestStub,
      })
    );

    sinon.replace(testTelemetryService, 'track', telemetryTrackStub);
  });

  afterEach(function () {
    sinon.restore();
  });

  test('parses a returned by ai text for database and collection name', function () {
    const text = 'DATABASE_NAME: my  \nCOLLECTION_NAME: cats';
    const { databaseName, collectionName } =
      Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(text);
    expect(databaseName).to.be.equal('my');
    expect(collectionName).to.be.equal('cats');
  });

  suite('when not connected', function () {
    let connectWithConnectionIdStub;
    let changeActiveConnectionStub;
    let getSavedConnectionsStub;

    beforeEach(function () {
      connectWithConnectionIdStub = sinon.stub(
        testParticipantController._connectionController,
        'connectWithConnectionId'
      );
      changeActiveConnectionStub = sinon.stub(
        testParticipantController._connectionController,
        'changeActiveConnection'
      );
      sinon.replace(
        testParticipantController._connectionController,
        'getActiveDataService',
        () => null
      );
      sinon.replace(
        testParticipantController._storageController,
        'get',
        sinon.fake.returns(true)
      );
      getSavedConnectionsStub = sinon.stub();
      sinon.replace(
        testParticipantController._connectionController,
        'getSavedConnections',
        getSavedConnectionsStub
      );
    });

    test('asks to connect', async function () {
      getSavedConnectionsStub.returns([loadedConnection]);
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
        references: [],
      };
      const chatResult = await invokeChatHandler(chatRequestMock);
      const connectMessage = chatStreamStub.markdown.getCall(0).args[0];
      expect(connectMessage).to.include(
        "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against."
      );
      const listConnectionsMessage = chatStreamStub.markdown.getCall(1).args[0];
      const expectedContent = encodeStringify({ id: 'id', command: '/query' });
      expect(listConnectionsMessage.value).to.include(
        `- [localhost](command:mdb.connectWithParticipant?${expectedContent})`
      );
      const showMoreMessage = chatStreamStub.markdown.getCall(2).args[0];
      expect(showMoreMessage.value).to.include(
        `- [Show more](command:mdb.connectWithParticipant?${encodeStringify({
          command: '/query',
        })})`
      );
      expect(chatResult?.metadata?.chatId.length).to.equal(testChatId.length);
      expect({
        ...chatResult?.metadata,
        chatId: undefined,
      }).to.deep.equal({
        intent: 'askToConnect',
        chatId: undefined,
      });
    });

    test('shows only 10 connections with the show more option', async function () {
      const connections: LoadedConnection[] = [];
      for (let i = 0; i < 11; i++) {
        connections.push({
          ...loadedConnection,
          id: `${loadedConnection.id}${i}`,
          name: `${loadedConnection.name}${i}`,
        });
      }
      getSavedConnectionsStub.returns(connections);
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
        references: [],
      };
      const chatResult = await invokeChatHandler(chatRequestMock);
      const connectMessage = chatStreamStub.markdown.getCall(0).args[0];
      expect(connectMessage).to.include(
        "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against."
      );
      const listConnectionsMessage = chatStreamStub.markdown.getCall(1).args[0];
      const expectedContent = encodeStringify({ id: 'id0', command: '/query' });
      expect(listConnectionsMessage.value).to.include(
        `- [localhost0](command:mdb.connectWithParticipant?${expectedContent})`
      );
      const showMoreMessage = chatStreamStub.markdown.getCall(11).args[0];
      expect(showMoreMessage.value).to.include(
        `- [Show more](command:mdb.connectWithParticipant?${encodeStringify({
          command: '/query',
        })})`
      );
      expect(chatStreamStub.markdown.callCount).to.be.eql(12);
      expect(chatResult?.metadata?.chatId.length).to.equal(testChatId.length);
      expect({
        ...chatResult?.metadata,
        chatId: undefined,
      }).to.deep.equal({
        intent: 'askToConnect',
        chatId: undefined,
      });
    });

    test('handles empty connection name', async function () {
      getSavedConnectionsStub.returns([loadedConnection]);
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
        references: [],
      };
      const chatResult = await invokeChatHandler(chatRequestMock);

      chatRequestMock.prompt = '';
      await invokeChatHandler(chatRequestMock);

      const emptyMessage = chatStreamStub.markdown.getCall(3).args[0];
      expect(emptyMessage).to.include(
        "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against"
      );
      const listConnectionsMessage = chatStreamStub.markdown.getCall(4).args[0];
      const expectedContent = encodeStringify({ id: 'id', command: '/query' });
      expect(listConnectionsMessage.value).to.include(
        `- [localhost](command:mdb.connectWithParticipant?${expectedContent})`
      );
      const showMoreMessage = chatStreamStub.markdown.getCall(5).args[0];
      expect(showMoreMessage.value).to.include(
        `- [Show more](command:mdb.connectWithParticipant?${encodeStringify({
          command: '/query',
        })})`
      );
      expect(chatResult?.metadata?.chatId.length).to.equal(testChatId.length);
      expect({
        ...chatResult?.metadata,
        chatId: undefined,
      }).to.deep.equal({
        intent: 'askToConnect',
        chatId: undefined,
      });
    });

    test('calls connect by id for an existing connection', async function () {
      await testParticipantController.connectWithParticipant({
        id: '123',
      });
      expect(connectWithConnectionIdStub).to.have.been.calledWithExactly('123');
    });

    test('calls connect with uri for a new connection', async function () {
      await testParticipantController.connectWithParticipant({});
      expect(changeActiveConnectionStub).to.have.been.called;
    });
  });

  suite('when connected', function () {
    let sampleStub: SinonStub;
    let listCollectionsStub: SinonStub;
    let listDatabasesStub: SinonStub;

    beforeEach(function () {
      sampleStub = sinon.stub();
      listDatabasesStub = sinon
        .stub()
        .resolves([
          { name: 'dbOne' },
          { name: 'customer' },
          { name: 'inventory' },
          { name: 'sales' },
          { name: 'employee' },
          { name: 'financialReports' },
          { name: 'productCatalog' },
          { name: 'projectTracker' },
          { name: 'user' },
          { name: 'analytics' },
          { name: '123' },
        ]);
      listCollectionsStub = sinon
        .stub()
        .resolves([
          { name: 'collOne' },
          { name: 'notifications' },
          { name: 'products' },
          { name: 'orders' },
          { name: 'categories' },
          { name: 'invoices' },
          { name: 'transactions' },
          { name: 'logs' },
          { name: 'messages' },
          { name: 'sessions' },
          { name: 'feedback' },
        ]);

      sinon.replace(
        testParticipantController._connectionController,
        'getActiveDataService',
        () =>
          ({
            listDatabases: listDatabasesStub,
            listCollections: listCollectionsStub,
            getMongoClientConnectionOptions: () => ({
              url: TEST_DATABASE_URI,
              options: {},
            }),
            sample: sampleStub,
            once: sinon.stub(),
          } as unknown as DataService)
      );
    });

    suite('when has not been shown a welcome message yet', function () {
      beforeEach(function () {
        sinon.replace(
          testParticipantController._storageController,
          'get',
          sinon.fake.returns(false)
        );
        sendRequestStub.resolves({
          text: [
            '```javascript\n' +
              "use('dbOne');\n" +
              "db.getCollection('collOne').find({ name: 'example' });\n" +
              '```',
          ],
        });
      });

      test('prints a welcome message to chat', async function () {
        const chatRequestMock = {
          prompt: 'find all docs by a name example',
          command: 'query',
          references: [],
        };
        await invokeChatHandler(chatRequestMock);
        const welcomeMessage = chatStreamStub.markdown.firstCall.args[0];
        expect(welcomeMessage).to.include('Welcome to MongoDB Participant!');

        // Once to report welcome screen shown, second time to track the user prompt
        expect(telemetryTrackStub).to.have.been.calledTwice;
        expect(telemetryTrackStub.firstCall.args[0]).to.equal(
          TelemetryEventTypes.PARTICIPANT_WELCOME_SHOWN
        );
        expect(telemetryTrackStub.firstCall.args[1]).to.be.undefined;
        assertCommandTelemetry('query', chatRequestMock, {
          callIndex: 1,
          expectedInternalPurpose: 'namespace',
        });
      });
    });

    suite('when has been shown a welcome message already', function () {
      beforeEach(function () {
        sinon.replace(
          testParticipantController._storageController,
          'get',
          sinon.fake.returns(true)
        );
      });

      afterEach(function () {
        // Ensure welcome message is not shown again
        const welcomeMessages = chatStreamStub.markdown
          .getCalls()
          .map((call) => call.args[0])
          .filter(
            (message) =>
              typeof message === 'string' &&
              message.includes('Welcome to MongoDB Participant!')
          );
        expect(welcomeMessages).to.be.empty;

        // Ensure we haven't reported the welcome screen to telemetry
        const telemetryEvents = telemetryTrackStub
          .getCalls()
          .map((call) => call.args[0])
          .filter(
            (arg) => arg === TelemetryEventTypes.PARTICIPANT_WELCOME_SHOWN
          );

        expect(telemetryEvents).to.be.empty;
      });

      suite('generic command', function () {
        beforeEach(function () {
          sendRequestStub.resolves({
            text: [
              '```javascript\n' +
                "use('dbOne');\n" +
                "db.getCollection('collOne').find({ name: 'example' });\n" +
                '```',
            ],
          });
        });

        suite('when the intent is recognized', function () {
          beforeEach(function () {
            sendRequestStub.onCall(0).resolves({
              text: ['Schema'],
            });
          });

          test('routes to the appropriate handler', async function () {
            const chatRequestMock = {
              prompt:
                'what is the shape of the documents in the pineapple collection?',
              command: undefined,
              references: [],
            };
            const res = await invokeChatHandler(chatRequestMock);

            expect(sendRequestStub).to.have.been.calledTwice;
            const intentRequest = sendRequestStub.firstCall
              .args[0] as vscode.LanguageModelChatMessage[];
            expect(intentRequest).to.have.length(2);
            expect(getMessageContent(intentRequest[0])).to.include(
              'Your task is to help guide a conversation with a user to the correct handler.'
            );
            expect(getMessageContent(intentRequest[1])).to.equal(
              'what is the shape of the documents in the pineapple collection?'
            );
            const genericRequest = sendRequestStub.secondCall
              .args[0] as vscode.LanguageModelChatMessage[];
            expect(genericRequest).to.have.length(2);
            expect(getMessageContent(genericRequest[0])).to.include(
              'Parse all user messages to find a database name and a collection name.'
            );
            expect(getMessageContent(genericRequest[1])).to.equal(
              'what is the shape of the documents in the pineapple collection?'
            );

            expect(res?.metadata.intent).to.equal('askForNamespace');
          });
        });

        test('default handler asks for intent and shows code run actions', async function () {
          const chatRequestMock = {
            prompt: 'how to find documents in my collection?',
            command: undefined,
            references: [],
          };
          const res = await invokeChatHandler(chatRequestMock);

          expect(sendRequestStub).to.have.been.calledTwice;
          const intentRequest = sendRequestStub.firstCall
            .args[0] as vscode.LanguageModelChatMessage[];
          expect(intentRequest).to.have.length(2);
          expect(getMessageContent(intentRequest[0])).to.include(
            'Your task is to help guide a conversation with a user to the correct handler.'
          );
          expect(getMessageContent(intentRequest[1])).to.equal(
            'how to find documents in my collection?'
          );
          const genericRequest = sendRequestStub.secondCall
            .args[0] as vscode.LanguageModelChatMessage[];
          expect(genericRequest).to.have.length(2);
          expect(getMessageContent(genericRequest[0])).to.include(
            'Your task is to help the user with MongoDB related questions.'
          );
          expect(getMessageContent(genericRequest[1])).to.equal(
            'how to find documents in my collection?'
          );

          expect(res?.metadata.intent).to.equal('generic');
          expect(chatStreamStub?.button.getCall(0).args[0]).to.deep.equal({
            command: 'mdb.runParticipantCode',
            title: '▶️ Run',
            arguments: [
              {
                runnableContent:
                  "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
              },
            ],
          });

          assertCommandTelemetry('generic', chatRequestMock, {
            callIndex: 0,
            expectedInternalPurpose: 'intent',
          });

          assertCommandTelemetry('generic', chatRequestMock, {
            callIndex: 1,
          });

          assertResponseTelemetry('generic', {
            callIndex: 2,
            hasRunnableContent: true,
          });
        });
      });

      suite('query command', function () {
        beforeEach(function () {
          sendRequestStub.resolves({
            text: [
              '```javascript\n' +
                "use('dbOne');\n" +
                "db.getCollection('collOne').find({ name: 'example' });\n" +
                '```',
            ],
          });
        });

        suite('known namespace from running namespace LLM', function () {
          beforeEach(function () {
            sendRequestStub.onCall(0).resolves({
              text: ['DATABASE_NAME: dbOne\n', 'COLLECTION_NAME: collOne\n`'],
            });
          });

          test('generates a query', async function () {
            const chatRequestMock = {
              prompt: 'find all docs by a name example',
              command: 'query',
              references: [],
            };
            await invokeChatHandler(chatRequestMock);
            expect(chatStreamStub?.button.getCall(0).args[0]).to.deep.equal({
              command: 'mdb.runParticipantCode',
              title: '▶️ Run',
              arguments: [
                {
                  runnableContent:
                    "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
                },
              ],
            });

            assertCommandTelemetry('query', chatRequestMock, {
              callIndex: 0,
              expectedInternalPurpose: 'namespace',
            });

            assertCommandTelemetry('query', chatRequestMock, {
              callIndex: 1,
            });

            assertResponseTelemetry('query', {
              callIndex: 2,
              hasRunnableContent: true,
              foundNamespace: true,
            });
          });

          test('includes a collection schema', async function () {
            sampleStub.resolves([
              {
                _id: new ObjectId('63ed1d522d8573fa5c203660'),
                field: {
                  stringField:
                    'There was a house cat who finally got the chance to do what it had always wanted to do.',
                  arrayField: [new Int32('1')],
                },
              },
            ]);
            const chatRequestMock = {
              prompt: 'find all docs by a name example',
              command: 'query',
              references: [],
            };
            await invokeChatHandler(chatRequestMock);
            const messages = sendRequestStub.secondCall
              .args[0] as vscode.LanguageModelChatMessage[];
            expect(getMessageContent(messages[1])).to.include(
              'Collection schema: _id: ObjectId\n' +
                'field.stringField: String\n' +
                'field.arrayField: Array<Int32>\n'
            );

            assertCommandTelemetry('query', chatRequestMock, {
              callIndex: 0,
              expectedInternalPurpose: 'namespace',
            });

            assertCommandTelemetry('query', chatRequestMock, {
              callIndex: 1,
            });

            assertResponseTelemetry('query', {
              callIndex: 2,
              hasRunnableContent: true,
              foundNamespace: true,
            });
          });

          suite('useSampleDocsInCopilot setting is true', function () {
            beforeEach(async () => {
              await vscode.workspace
                .getConfiguration('mdb')
                .update('useSampleDocsInCopilot', true);
            });

            afterEach(async () => {
              await vscode.workspace
                .getConfiguration('mdb')
                .update('useSampleDocsInCopilot', false);
            });

            test('includes 3 sample documents as an array', async function () {
              countTokensStub.resolves(MAX_TOTAL_PROMPT_LENGTH_MOCK);
              sampleStub.resolves([
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203661'),
                  field: {
                    stringField: 'Text 1',
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203662'),
                  field: {
                    stringField: 'Text 2',
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203663'),
                  field: {
                    stringField: 'Text 3',
                  },
                },
              ]);
              const chatRequestMock = {
                prompt: 'find all docs by a name example',
                command: 'query',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              const messages = sendRequestStub.secondCall
                .args[0] as vscode.LanguageModelChatMessage[];
              expect(getMessageContent(messages[1])).to.include(
                'Sample documents: [\n' +
                  '  {\n' +
                  "    _id: ObjectId('63ed1d522d8573fa5c203661'),\n" +
                  '    field: {\n' +
                  "      stringField: 'Text 1'\n" +
                  '    }\n' +
                  '  },\n' +
                  '  {\n' +
                  "    _id: ObjectId('63ed1d522d8573fa5c203662'),\n" +
                  '    field: {\n' +
                  "      stringField: 'Text 2'\n" +
                  '    }\n' +
                  '  },\n' +
                  '  {\n' +
                  "    _id: ObjectId('63ed1d522d8573fa5c203663'),\n" +
                  '    field: {\n' +
                  "      stringField: 'Text 3'\n" +
                  '    }\n' +
                  '  }\n' +
                  ']\n'
              );

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('query', chatRequestMock, {
                expectSampleDocs: true,
                callIndex: 1,
              });

              assertResponseTelemetry('query', {
                callIndex: 2,
                hasRunnableContent: true,
                foundNamespace: true,
              });
            });

            test('includes 1 sample document as an object', async function () {
              countTokensStub.resolves(MAX_TOTAL_PROMPT_LENGTH_MOCK);
              sampleStub.resolves([
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203660'),
                  field: {
                    stringField:
                      'There was a house cat who finally got the chance to do what it had always wanted to do.',
                    arrayField: [
                      new Int32('1'),
                      new Int32('2'),
                      new Int32('3'),
                      new Int32('4'),
                      new Int32('5'),
                      new Int32('6'),
                      new Int32('7'),
                      new Int32('8'),
                      new Int32('9'),
                    ],
                  },
                },
              ]);
              const chatRequestMock = {
                prompt: 'find all docs by a name example',
                command: 'query',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              const messages = sendRequestStub.secondCall
                .args[0] as vscode.LanguageModelChatMessage[];
              expect(getMessageContent(messages[1])).to.include(
                'Sample document: {\n' +
                  "  _id: ObjectId('63ed1d522d8573fa5c203660'),\n" +
                  '  field: {\n' +
                  "    stringField: 'There was a house ca',\n" +
                  '    arrayField: [\n' +
                  "      NumberInt('1'),\n" +
                  "      NumberInt('2'),\n" +
                  "      NumberInt('3')\n" +
                  '    ]\n' +
                  '  }\n' +
                  '}\n'
              );

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('query', chatRequestMock, {
                expectSampleDocs: true,
                callIndex: 1,
              });

              assertResponseTelemetry('query', {
                callIndex: 2,
                hasRunnableContent: true,
                foundNamespace: true,
              });
            });

            test('includes 1 sample documents when 3 make prompt too long', async function () {
              countTokensStub
                .onCall(0)
                .resolves(MAX_TOTAL_PROMPT_LENGTH_MOCK + 1);
              countTokensStub.onCall(1).resolves(MAX_TOTAL_PROMPT_LENGTH_MOCK);
              sampleStub.resolves([
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203661'),
                  field: {
                    stringField: 'Text 1',
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203662'),
                  field: {
                    stringField: 'Text 2',
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203663'),
                  field: {
                    stringField: 'Text 3',
                  },
                },
              ]);
              const chatRequestMock = {
                prompt: 'find all docs by a name example',
                command: 'query',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              const messages = sendRequestStub.secondCall
                .args[0] as vscode.LanguageModelChatMessage[];
              expect(getMessageContent(messages[1])).to.include(
                'Sample document: {\n' +
                  "  _id: ObjectId('63ed1d522d8573fa5c203661'),\n" +
                  '  field: {\n' +
                  "    stringField: 'Text 1'\n" +
                  '  }\n' +
                  '}\n'
              );

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('query', chatRequestMock, {
                expectSampleDocs: true,
                callIndex: 1,
              });

              assertResponseTelemetry('query', {
                callIndex: 2,
                hasRunnableContent: true,
                foundNamespace: true,
              });
            });

            test('does not include sample documents when even 1 makes prompt too long', async function () {
              countTokensStub
                .onCall(0)
                .resolves(MAX_TOTAL_PROMPT_LENGTH_MOCK + 1);
              countTokensStub
                .onCall(1)
                .resolves(MAX_TOTAL_PROMPT_LENGTH_MOCK + 1);
              sampleStub.resolves([
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203661'),
                  field: {
                    stringField: 'Text 1',
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203662'),
                  field: {
                    stringField: 'Text 2',
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203663'),
                  field: {
                    stringField: 'Text 3',
                  },
                },
              ]);
              const chatRequestMock = {
                prompt: 'find all docs by a name example',
                command: 'query',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              const messages = sendRequestStub.secondCall
                .args[0] as vscode.LanguageModelChatMessage[];
              expect(getMessageContent(messages[1])).to.not.include(
                'Sample documents'
              );

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 1,
              });

              assertResponseTelemetry('query', {
                callIndex: 2,
                hasRunnableContent: true,
                foundNamespace: true,
              });
            });
          });

          suite('useSampleDocsInCopilot setting is false', function () {
            test('does not include sample documents', async function () {
              const chatRequestMock = {
                prompt: 'find all docs by a name example',
                command: 'query',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              const messages = sendRequestStub.secondCall
                .args[0] as vscode.LanguageModelChatMessage[];
              expect(getMessageContent(messages[1])).to.not.include(
                'Sample documents'
              );

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('query', chatRequestMock, {
                callIndex: 1,
              });

              assertResponseTelemetry('query', {
                callIndex: 2,
                hasRunnableContent: true,
                foundNamespace: true,
              });
            });
          });
        });

        suite('no namespace provided', function () {
          test('asks for a namespace and generates a query', async function () {
            const chatRequestMock = {
              prompt: 'find all docs by a name example',
              command: 'query',
              references: [],
            };
            const chatResult = await invokeChatHandler(chatRequestMock);
            const askForDBMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(askForDBMessage).to.include(
              'Which database would you like this query to run against? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n'
            );
            const listDBsMessage = chatStreamStub.markdown.getCall(1).args[0];
            const expectedContent = encodeStringify({
              command: '/query',
              chatId: testChatId,
              databaseName: 'dbOne',
            });
            expect(listDBsMessage.value).to.include(
              `- [dbOne](command:mdb.selectDatabaseWithParticipant?${expectedContent})`
            );
            const showMoreDBsMessage =
              chatStreamStub.markdown.getCall(11).args[0];
            expect(showMoreDBsMessage.value).to.include(
              `- [Show more](command:mdb.selectDatabaseWithParticipant?${encodeStringify(
                { command: '/query', chatId: testChatId }
              )})`
            );
            expect(chatStreamStub.markdown.callCount).to.be.eql(12);
            const firstChatId = chatResult?.metadata?.chatId;
            expect(chatResult?.metadata?.chatId.length).to.equal(
              testChatId.length
            );
            expect({
              ...chatResult?.metadata,
              chatId: undefined,
            }).to.deep.equal({
              intent: 'askForNamespace',
              collectionName: undefined,
              databaseName: undefined,
              chatId: undefined,
            });

            chatRequestMock.prompt = 'dbOne';
            sendRequestStub.onCall(1).resolves({
              text: ['DATABASE_NAME: dbOne\n'],
            });

            chatContextStub = {
              history: [
                createChatRequestTurn(
                  '/query',
                  'find all docs by a name example'
                ),
                createChatResponseTurn(
                  '/query',
                  'Which database would you like this query to run against? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n',
                  {
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                        chatId: firstChatId,
                      },
                    },
                  }
                ),
              ],
            };

            const chatResult2 = await invokeChatHandler(chatRequestMock);

            const askForCollMessage =
              chatStreamStub.markdown.getCall(12).args[0];
            expect(askForCollMessage).to.include(
              'Which collection would you like to use within dbOne? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n'
            );
            const listCollsMessage =
              chatStreamStub.markdown.getCall(13).args[0];
            const expectedCollsContent = encodeStringify({
              command: '/query',
              chatId: testChatId,
              databaseName: 'dbOne',
              collectionName: 'collOne',
            });
            expect(listCollsMessage.value).to.include(
              `- [collOne](command:mdb.selectCollectionWithParticipant?${expectedCollsContent})`
            );
            const showMoreCollsMessage =
              chatStreamStub.markdown.getCall(23).args[0];
            expect(showMoreCollsMessage.value).to.include(
              `- [Show more](command:mdb.selectCollectionWithParticipant?${encodeStringify(
                {
                  command: '/query',
                  chatId: testChatId,
                  databaseName: 'dbOne',
                }
              )})`
            );
            expect(chatStreamStub.markdown.callCount).to.be.eql(24);
            expect(chatResult2?.metadata?.chatId).to.equal(firstChatId);
            expect({
              ...chatResult?.metadata,
              chatId: undefined,
            }).to.deep.equal({
              intent: 'askForNamespace',
              collectionName: undefined,
              databaseName: undefined,
              chatId: undefined,
            });

            chatRequestMock.prompt = 'collOne';
            sendRequestStub.onCall(2).resolves({
              text: ['DATABASE_NAME: dbOne\n', 'COLLECTION_NAME: collOne\n`'],
            });
            chatContextStub = {
              history: [
                createChatRequestTurn(
                  '/query',
                  'find all docs by a name example'
                ),
                createChatResponseTurn(
                  '/query',
                  'Which database would you like to this query to run against? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n',
                  {
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                      },
                    },
                  }
                ),
                createChatRequestTurn('/query', 'dbOne'),
                createChatResponseTurn(
                  '/query',
                  'Which collection would you like to query within dbOne? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n',
                  {
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                        databaseName: 'dbOne',
                        collectionName: 'collOne',
                        chatId: firstChatId,
                      },
                    },
                  }
                ),
              ],
            };
            await invokeChatHandler(chatRequestMock);

            expect(chatStreamStub?.button.callCount).to.equal(2);
            expect(chatStreamStub?.button.getCall(0).args[0]).to.deep.equal({
              command: 'mdb.runParticipantCode',
              title: '▶️ Run',
              arguments: [
                {
                  runnableContent:
                    "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
                },
              ],
            });
            expect(chatStreamStub?.button.getCall(1).args[0]).to.deep.equal({
              command: 'mdb.openParticipantCodeInPlayground',
              title: 'Open in playground',
              arguments: [
                {
                  runnableContent:
                    "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
                },
              ],
            });
          });

          test('asks for the empty database name again if the last prompt was doing so', async function () {
            const chatRequestMock = {
              prompt: '',
              command: 'query',
              references: [],
            };
            chatContextStub = {
              history: [
                createChatRequestTurn(
                  '/query',
                  'find all docs by a name example'
                ),
                createChatResponseTurn(
                  '/query',
                  'Which database would you like this query to run against? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n',
                  {
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                        chatId: 'pineapple',
                      },
                    },
                  }
                ),
              ],
            };
            const chatResult = await invokeChatHandler(chatRequestMock);

            const emptyMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(emptyMessage).to.equal(
              'Which database would you like this query to run against? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n'
            );
            const listDBsMessage = chatStreamStub.markdown.getCall(1).args[0];
            expect(listDBsMessage.value).to.include(
              `- [dbOne](command:mdb.selectDatabaseWithParticipant?${encodeStringify(
                {
                  command: '/query',
                  chatId: 'pineapple',
                  databaseName: 'dbOne',
                }
              )})`
            );
            const showMoreDBsMessage =
              chatStreamStub.markdown.getCall(11).args[0];
            expect(showMoreDBsMessage.value).to.include(
              `- [Show more](command:mdb.selectDatabaseWithParticipant?${encodeStringify(
                {
                  command: '/query',
                  chatId: 'pineapple',
                }
              )})`
            );
            expect({
              ...chatResult?.metadata,
              chatId: undefined,
            }).to.deep.equal({
              intent: 'askForNamespace',
              collectionName: undefined,
              databaseName: undefined,
              chatId: undefined,
            });
          });
        });
      });

      suite('schema command', function () {
        beforeEach(function () {
          sendRequestStub.resolves({
            text: [
              '```javascript\n' +
                "use('dbOne');\n" +
                "db.getCollection('collOne').find({ name: 'example' });\n" +
                '```',
            ],
          });
        });

        suite('no namespace provided', function () {
          beforeEach(function () {
            sendRequestStub.onCall(0).resolves({
              text: ['none'],
            });
          });

          test('without a prompt it asks for the database name without pinging ai', async function () {
            const chatRequestMock = {
              prompt: '',
              command: 'schema',
              references: [],
            };
            await invokeChatHandler(chatRequestMock);

            expect(sendRequestStub.called).to.be.false;
            const askForDBMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(askForDBMessage).to.include(
              'Which database would you like to use? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n'
            );
          });

          test('with a prompt it asks the ai for the namespace', async function () {
            const chatRequestMock = {
              prompt: 'pineapple',
              command: 'schema',
              references: [],
            };
            await invokeChatHandler(chatRequestMock);

            expect(sendRequestStub.calledOnce).to.be.true;
            const messages = sendRequestStub.firstCall
              .args[0] as vscode.LanguageModelChatMessage[];
            expect(getMessageContent(messages[0])).to.include(
              'Parse all user messages to find a database name and a collection name.'
            );

            const askForDBMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(askForDBMessage).to.equals(
              'Which database would you like to use? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n'
            );
          });

          test('with history, and a blank prompt, it sets a message so it does not cause model error (VSCODE-626)', async function () {
            const chatRequestMock = {
              prompt: '',
              command: 'schema',
              references: [],
            };
            chatContextStub = {
              history: [
                createChatRequestTurn(
                  '/query',
                  'how do I make a find request vs favorite_fruits.pineapple?'
                ),
                createChatResponseTurn('/query', 'some code', {
                  result: {
                    metadata: {
                      intent: 'query',
                      chatId: 'abc',
                    },
                  },
                }),
              ],
            };
            await invokeChatHandler(chatRequestMock);

            expect(sendRequestStub.calledOnce).to.be.true;

            const messages = sendRequestStub.firstCall
              .args[0] as vscode.LanguageModelChatMessage[];
            expect(getMessageContent(messages[0])).to.include(
              'Parse all user messages to find a database name and a collection name.'
            );
            expect(getMessageContent(messages[3])).to.include(
              'see previous messages'
            );
          });
        });

        suite(
          'with a prompt and a known namespace from running namespace LLM',
          function () {
            beforeEach(function () {
              sendRequestStub.onCall(0).resolves({
                text: ['DATABASE_NAME: dbOne\n', 'COLLECTION_NAME: collOne\n`'],
              });
            });

            test('shows a button to view the json output', async function () {
              const chatRequestMock = {
                prompt: 'what is my schema',
                command: 'schema',
                references: [],
              };
              sampleStub.resolves([
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203660'),
                },
              ]);
              await invokeChatHandler(chatRequestMock);
              const expectedSchema = `{
  "count": 1,
  "fields": [
    {
      "name": "_id",
      "path": [
        "_id"
      ],
      "count": 1,
      "type": "ObjectId",
      "probability": 1,
      "hasDuplicates": false,
      "types": [
        {
          "name": "ObjectId",
          "path": [
            "_id"
          ],
          "count": 1,
          "probability": 1,
          "bsonType": "ObjectId"
        }
      ]
    }
  ]
}`;
              expect(chatStreamStub?.button.getCall(0).args[0]).to.deep.equal({
                command: 'mdb.participantViewRawSchemaOutput',
                title: 'Open JSON Output',
                arguments: [
                  {
                    schema: expectedSchema,
                  },
                ],
              });

              assertCommandTelemetry('schema', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('schema', chatRequestMock, {
                callIndex: 1,
              });

              assertResponseTelemetry('schema', {
                callIndex: 2,
                hasCTA: true,
                foundNamespace: true,
              });
            });

            test("includes the collection's schema in the request", async function () {
              sampleStub.resolves([
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203660'),
                  field: {
                    stringField:
                      'There was a house cat who finally got the chance to do what it had always wanted to do.',
                    arrayField: [new Int32('1')],
                  },
                },
                {
                  _id: new ObjectId('63ed1d522d8573fa5c203660'),
                  field: {
                    stringField: 'Pineapple.',
                    arrayField: [new Int32('166')],
                  },
                },
              ]);
              const chatRequestMock = {
                prompt: 'what is my schema',
                command: 'schema',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              const messages = sendRequestStub.secondCall
                .args[0] as vscode.LanguageModelChatMessage[];
              expect(getMessageContent(messages[0])).to.include(
                'Amount of documents sampled: 2'
              );
              expect(getMessageContent(messages[1])).to.include(
                `Database name: dbOne
Collection name: collOne
Schema:
{
  "count": 2,
  "fields": [`
              );
              expect(getMessageContent(messages[1])).to
                .include(`"name": "arrayField",
              "path": [
                "field",
                "arrayField"
              ],`);

              assertCommandTelemetry('schema', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });

              assertCommandTelemetry('schema', chatRequestMock, {
                callIndex: 1,
              });

              assertResponseTelemetry('schema', {
                callIndex: 2,
                hasCTA: true,
                foundNamespace: true,
              });
            });

            test('prints a message when no documents are found', async function () {
              sampleStub.resolves([]);
              const chatRequestMock = {
                prompt: 'what is my schema',
                command: 'schema',
                references: [],
              };
              await invokeChatHandler(chatRequestMock);
              expect(chatStreamStub?.markdown.getCall(0).args[0]).to.include(
                'Unable to generate a schema from the collection, no documents found.'
              );

              assertCommandTelemetry('schema', chatRequestMock, {
                callIndex: 0,
                expectedInternalPurpose: 'namespace',
              });
            });
          }
        );
      });

      suite('docs command', function () {
        const initialFetch = global.fetch;
        let fetchStub: sinon.SinonStub;

        beforeEach(function () {
          sendRequestStub.resolves({
            text: ['connection info'],
          });
        });

        afterEach(function () {
          global.fetch = initialFetch;
        });

        suite('includes the history of previous requests', function () {
          let addMessageStub: sinon.SinonStub;
          beforeEach(function () {
            addMessageStub = sinon.stub(
              testParticipantController._docsChatbotAIService,
              'addMessage'
            );
          });

          test('since the beginning', async function () {
            chatContextStub = {
              history: [
                createChatRequestTurn('/query', 'query request'),
                createChatResponseTurn('/query', 'query response'),
                createChatRequestTurn('/query', 'query request 2'),
                createChatResponseTurn('/query', 'query response 2'),
                createChatRequestTurn('/schema', 'schema request'),
                createChatResponseTurn('/schema', 'schema response'),
              ],
            };

            const chatRequestMock = {
              prompt: 'docs request',
              command: 'docs',
              references: [],
            };

            await invokeChatHandler(chatRequestMock);

            expect(addMessageStub.calledOnce).is.true;
            expect(addMessageStub.getCall(0).firstArg.message).equal(
              [
                'query request 2',
                'query response 2',
                'schema request',
                'schema response',
                'docs request',
              ].join('\n\n')
            );
          });

          test('since the last docs request or response', async function () {
            chatContextStub = {
              history: [
                createChatRequestTurn('/query', 'query request'),
                createChatResponseTurn('/query', 'query response'),
                createChatRequestTurn('/docs', 'first docs request'),
                createChatResponseTurn('/docs', 'first docs response'),
                createChatRequestTurn('/schema', 'schema request'),
                createChatResponseTurn('/schema', 'schema response'),
              ],
            };

            const chatRequestMock = {
              prompt: 'docs request',
              command: 'docs',
              references: [],
            };

            await invokeChatHandler(chatRequestMock);

            expect(addMessageStub.calledOnce).is.true;
            expect(addMessageStub.getCall(0).firstArg.message).equals(
              ['schema request', 'schema response', 'docs request'].join('\n\n')
            );

            chatContextStub = {
              history: [
                createChatRequestTurn('/query', 'query request'),
                createChatResponseTurn('/query', 'query response'),
                createChatRequestTurn('/docs', 'first docs request'),
              ],
            };

            await invokeChatHandler(chatRequestMock);

            expect(addMessageStub.getCall(1).firstArg.message).equals(
              'docs request'
            );
          });
        });

        test('shows a message and docs link on empty prompt', async function () {
          fetchStub = sinon.stub().resolves();
          global.fetch = fetchStub;
          const chatRequestMock = {
            prompt: '',
            command: 'docs',
            references: [],
          };
          const res = await invokeChatHandler(chatRequestMock);
          expect(fetchStub).to.not.have.been.called;
          expect(sendRequestStub).to.have.not.been.called;
          expect(res?.metadata.intent).to.equal('emptyRequest');
          const defaultEmptyMsg = chatStreamStub.markdown.getCall(0).args[0];
          expect(defaultEmptyMsg).to.include(
            'Ask anything about MongoDB, from writing queries to questions a'
          );
          const referenceMsg = chatStreamStub.markdown.getCall(1).args[0];
          expect(referenceMsg.value).to.include('View MongoDB documentation');
        });

        test('uses docs chatbot result if available', async function () {
          fetchStub = sinon.stub().resolves({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                _id: '650b4b260f975ef031016c8a',
                content:
                  'To connect to MongoDB using mongosh, you can follow these steps',
              }),
          });
          global.fetch = fetchStub;
          const chatRequestMock = {
            prompt: 'how to connect to mongodb',
            command: 'docs',
            references: [],
          };
          await invokeChatHandler(chatRequestMock);
          expect(fetchStub).to.have.been.called;
          expect(sendRequestStub).to.have.not.been.called;

          assertResponseTelemetry('docs/chatbot', {
            callIndex: 0,
          });
        });

        test('falls back to the copilot model when docs chatbot result is not available', async function () {
          fetchStub = sinon.stub().resolves({
            status: 500,
            ok: false,
            statusText: 'Internal Server Error',
            json: () => Promise.reject(new Error('invalid json')),
          });
          global.fetch = fetchStub;
          const chatRequestMock = {
            prompt: 'how to connect to mongodb',
            command: 'docs',
            references: [],
          };
          await invokeChatHandler(chatRequestMock);
          expect(sendRequestStub).to.have.been.called;

          // Expect the error to be reported through the telemetry service
          expect(
            telemetryTrackStub.getCalls()
          ).to.have.length.greaterThanOrEqual(2);
          expect(telemetryTrackStub.firstCall.args[0]).to.equal(
            TelemetryEventTypes.PARTICIPANT_RESPONSE_FAILED
          );

          const properties = telemetryTrackStub.firstCall.args[1];
          expect(properties.command).to.equal('docs');
          expect(properties.error_name).to.equal('Docs Chatbot API Issue');

          assertResponseTelemetry('docs/copilot', {
            callIndex: 2,
            hasCTA: true,
          });
        });
      });

      suite('export to playground', function () {
        this.timeout(5000);

        beforeEach(async function () {
          await vscode.commands.executeCommand(
            'workbench.action.files.newUntitledFile'
          );
        });

        afterEach(async function () {
          await vscode.commands.executeCommand(
            'workbench.action.closeActiveEditor'
          );
        });

        test('exports all code to a playground', async function () {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            throw new Error('Window active text editor is undefined');
          }

          const testDocumentUri = editor.document.uri;
          const edit = new vscode.WorkspaceEdit();
          const code = `
  InsertOneResult result = collection.insertOne(new Document()
    .append("_id", new ObjectId())
    .append("title", "Ski Bloopers")
    .append("genres", Arrays.asList("Documentary", "Comedy")));
  System.out.println("Success! Documents were inserted");
`;
          edit.replace(testDocumentUri, getFullRange(editor.document), code);
          await vscode.workspace.applyEdit(edit);
          sendRequestStub.resolves({
            text: [
              '```javascript\n' +
                'db.collection.insertOne({\n' +
                '_id: new ObjectId(),\n' +
                'title: "Ski Bloopers",\n' +
                'genres: ["Documentary", "Comedy"]\n' +
                '});\n' +
                'print("Success! Documents were inserted");\n' +
                '```',
            ],
          });
          await testParticipantController.exportCodeToPlayground();
          const messages = sendRequestStub.firstCall.args[0];
          expect(getMessageContent(messages[1])).to.include(
            'System.out.println'
          );
          expect(
            isPlayground(vscode.window.activeTextEditor?.document.uri)
          ).to.be.eql(true);
          expect(vscode.window.activeTextEditor?.document.getText()).to.include(
            'Success! Documents were inserted'
          );
        });

        test('exports selected lines of code to a playground', async function () {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            throw new Error('Window active text editor is undefined');
          }

          const testDocumentUri = editor.document.uri;
          const edit = new vscode.WorkspaceEdit();
          const code = `
  InsertOneResult result = collection.insertOne(new Document()
    .append("_id", new ObjectId())
    .append("title", "Ski Bloopers")
    .append("genres", Arrays.asList("Documentary", "Comedy")));
  System.out.println("Success! Documents were inserted");
`;
          edit.replace(testDocumentUri, getFullRange(editor.document), code);
          await vscode.workspace.applyEdit(edit);
          const position = editor.selection.active;
          const startPosition = position.with(0, 0);
          const endPosition = position.with(3, 63);
          const newSelection = new vscode.Selection(startPosition, endPosition);
          editor.selection = newSelection;
          sendRequestStub.resolves({
            text: [
              'Text before code.\n' +
                '```javascript\n' +
                'db.collection.insertOne({\n' +
                '_id: new ObjectId(),\n' +
                'title: "Ski Bloopers",\n' +
                'genres: ["Documentary", "Comedy"]\n' +
                '});\n' +
                '```\n' +
                'Text after code.',
            ],
          });
          await testParticipantController.exportCodeToPlayground();
          const messages = sendRequestStub.firstCall.args[0];
          expect(messages[1].content).to.not.include('System.out.println');
          expect(
            isPlayground(vscode.window.activeTextEditor?.document.uri)
          ).to.be.eql(true);
          expect(
            vscode.window.activeTextEditor?.document.getText()
          ).to.not.include('"Success! Documents were inserted"');
        });
      });
    });

    suite('opened from tree view', function () {
      let sendMessageToParticipantStub: SinonStub<
        [options: SendMessageToParticipantOptions],
        Promise<unknown>
      >;

      beforeEach(function () {
        sendMessageToParticipantStub = sinon.stub(
          testParticipantController,
          'sendMessageToParticipant'
        );
      });

      suite('with a database item', function () {
        const mockDatabaseItem = Object.assign(
          Object.create(DatabaseTreeItem.prototype),
          {
            databaseName: 'testDb',
          } as DatabaseTreeItem
        );

        test('opens the chat and sends a message to set database context', async function () {
          expect(sendMessageToParticipantStub).not.called;

          await testParticipantController.askCopilotFromTreeItem(
            mockDatabaseItem
          );

          expect(sendMessageToParticipantStub).has.callCount(2);

          expect(sendMessageToParticipantStub.getCall(0).args).deep.equals([
            {
              message: `I want to ask questions about the \`${mockDatabaseItem.databaseName}\` database.`,
              isNewChat: true,
            },
          ]);

          expect(sendMessageToParticipantStub.getCall(1).args).deep.equals([
            {
              message: '',
              isPartialQuery: true,
              telemetry: {
                source: DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
                sourceDetails: 'copilot button on database tree item',
              },
            },
          ]);
        });
      });

      suite('with a collection item', function () {
        const mockCollectionItem = Object.assign(
          Object.create(CollectionTreeItem.prototype),
          {
            databaseName: 'testDb',
            collectionName: 'testColl',
          } as CollectionTreeItem
        );

        test('opens the chat and sends a message to set database and collection context', async function () {
          expect(sendMessageToParticipantStub).not.called;

          await testParticipantController.askCopilotFromTreeItem(
            mockCollectionItem
          );

          expect(sendMessageToParticipantStub).has.callCount(2);

          expect(sendMessageToParticipantStub.getCall(0).args).deep.equals([
            {
              message: `I want to ask questions about the \`${mockCollectionItem.databaseName}\` database's \`${mockCollectionItem.collectionName}\` collection.`,
              isNewChat: true,
              telemetry: {
                source: DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
                sourceDetails: 'copilot button on collection tree item',
              },
            },
          ]);

          expect(sendMessageToParticipantStub.getCall(1).args).deep.equals([
            {
              message: '',
              isPartialQuery: true,
            },
          ]);
        });
      });
    });

    suite('determining the namespace', function () {
      ['query', 'schema'].forEach(function (command) {
        suite(`${command} command`, function () {
          beforeEach(function () {
            sendRequestStub.resolves({
              text: ['determining the namespace'],
            });
          });

          suite('with an empty database name', function () {
            beforeEach(function () {
              sinon.replace(
                testParticipantController._chatMetadataStore,
                'getChatMetadata',
                () => ({
                  databaseName: undefined,
                  collectionName: undefined,
                })
              );
            });

            afterEach(function () {
              sinon.restore();
            });

            test('shows an error if something goes wrong with getting databases', async function () {
              listDatabasesStub.rejects(new Error('Something went wrong'));

              let caughtError: Error | undefined;
              try {
                await invokeChatHandler({
                  prompt: 'find all docs by a name example',
                  command,
                  references: [],
                });
              } catch (error) {
                caughtError = error as Error;
              }

              expect(caughtError?.message).equals(
                'Unable to fetch database names: Something went wrong.'
              );
            });

            test('shows an error if there are no databases found', async function () {
              // No databases
              listDatabasesStub.resolves([]);

              let caughtError: Error | undefined;
              try {
                await invokeChatHandler({
                  prompt: 'find all docs by a name example',
                  command,
                  references: [],
                });
              } catch (error) {
                caughtError = error as Error;
              }

              expect(caughtError?.message).equals('No databases were found.');
            });

            test('database name gets picked automatically if there is only 1', async function () {
              listDatabasesStub.resolves([{ name: 'onlyOneDb' }]);

              const renderDatabasesTreeSpy = sinon.spy(
                testParticipantController,
                'renderDatabasesTree'
              );
              const renderCollectionsTreeSpy = sinon.spy(
                testParticipantController,
                'renderCollectionsTree'
              );

              const chatResult = await invokeChatHandler({
                prompt: 'what is this',
                command,
                references: [],
              });

              expect(renderDatabasesTreeSpy.called).to.be.false;
              expect(renderCollectionsTreeSpy.calledOnce).to.be.true;

              expect(chatResult?.metadata).deep.equals({
                chatId: testChatId,
                intent: 'askForNamespace',
                databaseName: 'onlyOneDb',
                collectionName: undefined,
              });
            });

            test('prompts for database name if there are multiple available', async function () {
              const renderCollectionsTreeSpy = sinon.spy(
                testParticipantController,
                'renderCollectionsTree'
              );
              const renderDatabasesTreeSpy = sinon.spy(
                testParticipantController,
                'renderDatabasesTree'
              );

              const chatResult = await invokeChatHandler({
                prompt: 'dbOne',
                command,
                references: [],
              });

              expect(renderDatabasesTreeSpy.calledOnce).to.be.true;
              expect(renderCollectionsTreeSpy.called).to.be.false;

              expect(chatResult?.metadata).deep.equals({
                intent: 'askForNamespace',
                chatId: testChatId,
                databaseName: undefined,
                collectionName: undefined,
              });
            });
          });

          suite('with an empty collection name', function () {
            beforeEach(function () {
              sinon.replace(
                testParticipantController._chatMetadataStore,
                'getChatMetadata',
                () => ({
                  databaseName: 'dbOne',
                  collectionName: undefined,
                })
              );
            });

            test('shows an error if something goes wrong with getting collections', async function () {
              listCollectionsStub.rejects(new Error('Something went wrong'));

              let caughtError: Error | undefined;
              try {
                await invokeChatHandler({
                  prompt: 'find all docs by a name example',
                  command,
                  references: [],
                });
              } catch (error) {
                caughtError = error as Error;
              }

              expect(caughtError?.message).equals(
                'Unable to fetch collection names from dbOne: Something went wrong.'
              );
            });

            test('shows an error if there are no collections found', async function () {
              listCollectionsStub.resolves([]);
              let caughtError: Error | undefined;
              try {
                await invokeChatHandler({
                  prompt: 'find all docs by a name example',
                  command,
                  references: [],
                });
              } catch (error) {
                caughtError = error as Error;
              }

              expect(caughtError?.message).equals(
                'No collections were found in the database dbOne.'
              );
            });

            test('collection name gets picked automatically if there is only 1', async function () {
              listCollectionsStub.resolves([{ name: 'onlyOneColl' }]);
              const renderCollectionsTreeSpy = sinon.spy(
                testParticipantController,
                'renderCollectionsTree'
              );
              const fetchCollectionSchemaAndSampleDocumentsSpy = sinon.spy(
                testParticipantController,
                '_fetchCollectionSchemaAndSampleDocuments'
              );

              const chatResult = await invokeChatHandler({
                prompt: 'dbOne',
                command,
                references: [],
              });

              expect(renderCollectionsTreeSpy.called).to.be.false;

              expect(
                fetchCollectionSchemaAndSampleDocumentsSpy.firstCall.args[0]
              ).to.include({
                collectionName: 'onlyOneColl',
              });

              expect(chatResult?.metadata).deep.equals({
                chatId: testChatId,
                intent: command,
              });
            });

            test('prompts for collection name if there are multiple available', async function () {
              const renderCollectionsTreeSpy = sinon.spy(
                testParticipantController,
                'renderCollectionsTree'
              );
              const fetchCollectionSchemaAndSampleDocumentsSpy = sinon.spy(
                testParticipantController,
                '_fetchCollectionSchemaAndSampleDocuments'
              );

              const chatResult = await invokeChatHandler({
                prompt: 'dbOne',
                command,
                references: [],
              });

              expect(renderCollectionsTreeSpy.calledOnce).to.be.true;
              expect(
                fetchCollectionSchemaAndSampleDocumentsSpy.called
              ).to.be.false;

              expect(chatResult?.metadata).deep.equals({
                intent: 'askForNamespace',
                chatId: testChatId,
                databaseName: 'dbOne',
                collectionName: undefined,
              });
            });
          });
        });
      });
    });
  });

  suite('prompt builders', function () {
    test('generic', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
      };
      const { messages, stats } = await Prompts.generic.buildMessages({
        context: chatContextStub,
        request: chatRequestMock,
        connectionNames: [],
      });

      expect(messages).to.have.lengthOf(2);
      expect(messages[0].role).to.equal(
        vscode.LanguageModelChatMessageRole.Assistant
      );
      expect(messages[1].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );

      expect(stats.command).to.equal('generic');
      expect(stats.has_sample_documents).to.be.false;
      expect(stats.user_input_length).to.equal(chatRequestMock.prompt.length);
      expect(stats.total_message_length).to.equal(
        getContentLength(messages[0]) + getContentLength(messages[1])
      );
    });

    test('query', async function () {
      const chatRequestMock = {
        prompt:
          'how do I find the number of people whose name starts with "P"?',
        command: 'query',
      };

      chatContextStub = {
        history: [
          createChatRequestTurn(
            '/query',
            'give me the count of all people in the prod database'
          ),
        ],
      };
      const { messages, stats } = await Prompts.query.buildMessages({
        context: chatContextStub,
        request: chatRequestMock,
        collectionName: 'people',
        connectionNames: ['localhost', 'atlas'],
        databaseName: 'prod',
        sampleDocuments: [
          {
            _id: new ObjectId(),
            name: 'Peter',
          },
          {
            _id: new ObjectId(),
            name: 'John',
          },
        ],
        schema: `
          {
            _id: ObjectId,
            name: String
          }
        `,
      });

      expect(messages).to.have.lengthOf(3);

      // Assistant prompt
      expect(messages[0].role).to.equal(
        vscode.LanguageModelChatMessageRole.Assistant
      );

      // History
      expect(messages[1].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );
      expect(getMessageContent(messages[1])).to.equal(
        'give me the count of all people in the prod database'
      );

      // Actual user prompt
      expect(messages[2].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );

      expect(stats.command).to.equal('query');
      expect(stats.has_sample_documents).to.be.true;
      expect(stats.user_input_length).to.equal(chatRequestMock.prompt.length);
      expect(stats.total_message_length).to.equal(
        getContentLength(messages[0]) +
          getContentLength(messages[1]) +
          getContentLength(messages[2])
      );

      // The length of the user prompt length should be taken from the prompt supplied
      // by the user, even if we enhance it with sample docs and schema.
      expect(stats.user_input_length).to.be.lessThan(
        getContentLength(messages[2])
      );
    });

    test('schema', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'schema',
      };

      const databaseName = 'dbOne';
      const collectionName = 'collOne';
      const schema = `
          {
            _id: ObjectId,
            name: String
          }
        `;
      const { messages, stats } = await Prompts.schema.buildMessages({
        context: chatContextStub,
        request: chatRequestMock,
        amountOfDocumentsSampled: 3,
        collectionName,
        databaseName,
        schema,
        connectionNames: [],
      });

      expect(messages).to.have.lengthOf(2);
      expect(messages[0].role).to.equal(
        vscode.LanguageModelChatMessageRole.Assistant
      );
      expect(getMessageContent(messages[0])).to.include(
        'Amount of documents sampled: 3'
      );

      expect(messages[1].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );
      expect(getMessageContent(messages[1])).to.include(databaseName);
      expect(getMessageContent(messages[1])).to.include(collectionName);
      expect(getMessageContent(messages[1])).to.include(schema);

      expect(stats.command).to.equal('schema');
      expect(stats.has_sample_documents).to.be.false;
      expect(stats.user_input_length).to.equal(chatRequestMock.prompt.length);
      expect(stats.total_message_length).to.equal(
        getContentLength(messages[0]) + getContentLength(messages[1])
      );
    });

    test('namespace', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
      };
      const { messages, stats } = await Prompts.namespace.buildMessages({
        context: chatContextStub,
        request: chatRequestMock,
        connectionNames: [],
      });

      expect(messages).to.have.lengthOf(2);
      expect(messages[0].role).to.equal(
        vscode.LanguageModelChatMessageRole.Assistant
      );
      expect(messages[1].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );

      expect(stats.command).to.equal('query');
      expect(stats.has_sample_documents).to.be.false;
      expect(stats.user_input_length).to.equal(chatRequestMock.prompt.length);
      expect(stats.total_message_length).to.equal(
        getContentLength(messages[0]) + getContentLength(messages[1])
      );
    });

    suite('with askForNameSpace', function () {
      const userMessages = [
        'find all docs by a name example',
        'what other queries can be used as an example',
      ];

      const chatRequestMock = {
        prompt: 'localhost',
        command: 'query',
      };

      beforeEach(function () {
        chatContextStub = {
          history: [
            createChatRequestTurn('/query', userMessages[0]),
            createChatResponseTurn(
              '/query',
              'Which database would you like to query within this database?',
              {
                result: {
                  metadata: {
                    intent: 'askForNamespace',
                  },
                },
              }
            ),
            createChatRequestTurn('/query', 'dbOne'),
            createChatResponseTurn(
              '/query',
              'Which collection would you like to query within dbOne?',
              {
                result: {
                  metadata: {
                    intent: 'askForNamespace',
                    databaseName: 'dbOne',
                    collectionName: undefined,
                    chatId: testChatId,
                  },
                },
              }
            ),
            createChatRequestTurn('/query', 'collectionOne'),
            createChatRequestTurn('/query', userMessages[1]),
          ],
        };
      });

      test('does not include askForNameSpace messages in history if the metadata exists', async function () {
        const { messages, stats } = await Prompts.query.buildMessages({
          context: chatContextStub,
          request: chatRequestMock,
          collectionName: 'people',
          connectionNames: ['localhost', 'atlas'],
          databaseName: 'prod',
          sampleDocuments: [],
        });

        expect(messages.length).to.equal(4);
        expect(messages[0].role).to.equal(
          vscode.LanguageModelChatMessageRole.Assistant
        );

        // We don't expect history because we're removing the askForConnect message as well
        // as the user response to it. Therefore the actual user prompt should be the first
        // message that we supplied in the history.
        expect(messages[1].role).to.equal(
          vscode.LanguageModelChatMessageRole.User
        );

        expect(
          messages.slice(1, 3).map((message) => getMessageContent(message))
        ).to.deep.equal(userMessages);

        expect(stats.command).to.equal('query');
      });

      test('includes askForNameSpace messages in history if there is no metadata', async function () {
        const { messages, stats } = await Prompts.query.buildMessages({
          context: chatContextStub,
          request: chatRequestMock,
          connectionNames: ['localhost', 'atlas'],
          sampleDocuments: [],
          // @ts-expect-error Forcing undefined for the purpose of test
          databaseName: undefined,
          // @ts-expect-error Forcing undefined for the purpose of test
          collectionName: undefined,
        });

        expect(messages.length).to.equal(8);
        expect(messages[0].role).to.equal(
          vscode.LanguageModelChatMessageRole.Assistant
        );

        // We don't expect history because we're removing the askForConnect message as well
        // as the user response to it. Therefore the actual user prompt should be the first
        // message that we supplied in the history.
        expect(messages[1].role).to.equal(
          vscode.LanguageModelChatMessageRole.User
        );

        expect(stats.command).to.equal('query');
      });
    });

    test('removes askForConnect messages from history', async function () {
      // The user is responding to an `askToConnect` message, so the prompt is just the
      // name of the connection
      const chatRequestMock = {
        prompt: 'localhost',
        command: 'query',
      };

      // This is the prompt of the user prior to us asking them to connect
      const expectedPrompt =
        'give me the count of all people in the prod database';

      chatContextStub = {
        history: [
          createChatRequestTurn('/query', expectedPrompt),
          createChatResponseTurn(
            '/query',
            `Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.

                    ${createMarkdownLink({
                      commandId: EXTENSION_COMMANDS.CONNECT_WITH_PARTICIPANT,
                      name: 'localhost',
                      data: {},
                    })}
                    ${createMarkdownLink({
                      commandId: EXTENSION_COMMANDS.CONNECT_WITH_PARTICIPANT,
                      name: 'atlas',
                      data: {},
                    })}`,
            {
              result: {
                metadata: {
                  intent: 'askToConnect',
                  chatId: 'abc',
                },
              },
            }
          ),
        ],
      };

      const { messages, stats } = await Prompts.query.buildMessages({
        context: chatContextStub,
        request: chatRequestMock,
        collectionName: 'people',
        connectionNames: ['localhost', 'atlas'],
        databaseName: 'prod',
        sampleDocuments: [],
      });

      expect(messages.length).to.equal(2);
      expect(messages[0].role).to.equal(
        vscode.LanguageModelChatMessageRole.Assistant
      );

      // We don't expect history because we're removing the askForConnect message as well
      // as the user response to it. Therefore the actual user prompt should be the first
      // message that we supplied in the history.
      expect(messages[1].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );
      expect(getMessageContent(messages[1])).to.contain(expectedPrompt);

      expect(stats.command).to.equal('query');
      expect(stats.has_sample_documents).to.be.false;
      expect(stats.user_input_length).to.equal(expectedPrompt.length);
      expect(stats.total_message_length).to.equal(
        getContentLength(messages[0]) + getContentLength(messages[1])
      );

      // The prompt builder may add extra info, but we're only reporting the actual user input
      expect(stats.user_input_length).to.be.lessThan(
        getContentLength(messages[1])
      );
    });

    suite('with invalid messages', function () {
      test('filters disallowed messages', async function () {
        const chatRequestMock = {
          prompt: 'find all docs by a name example',
        };

        chatContextStub = {
          history: [
            createChatRequestTurn(
              '/query',
              'give me the count of all people in the prod database'
            ),
            createChatRequestTurn('/query', 'some disallowed message'),
            createChatResponseTurn('/query', undefined, {
              result: {
                errorDetails: {
                  message: ParticipantErrorTypes.FILTERED,
                },
                metadata: {},
              },
            }),
            createChatRequestTurn(undefined, 'ok message'),
          ],
        };
        const { messages } = await Prompts.generic.buildMessages({
          context: chatContextStub,
          request: chatRequestMock,
          connectionNames: [],
        });

        expect(messages).to.have.lengthOf(4);

        const messageContents = messages.map((message) => {
          // There may be different types for the messages' content
          const content = Array.isArray(message.content)
            ? message.content.map((sub) => sub.value).join('')
            : message.content;

          return content;
        });

        // Skip the preset prompt and check that the rest are correct.
        expect(messageContents.slice(1)).deep.equal([
          'give me the count of all people in the prod database',
          'ok message',
          'find all docs by a name example',
        ]);
      });
    });
  });

  suite('telemetry', function () {
    test('reports positive user feedback', async function () {
      await testParticipantController.handleUserFeedback({
        kind: vscode.ChatResultFeedbackKind.Helpful,
        result: {
          metadata: {
            intent: 'askToConnect',
            responseContent: '```creditCardNumber: 1234-5678-9012-3456```',
          },
        },
      });

      sinon.assert.calledOnce(telemetryTrackStub);
      expect(telemetryTrackStub.lastCall.args[0]).to.be.equal(
        'Participant Feedback'
      );

      const properties = telemetryTrackStub.lastCall.args[1];
      expect(properties.feedback).to.be.equal('positive');
      expect(properties.reason).to.be.undefined;
      expect(properties.response_type).to.be.equal('askToConnect');

      // Ensure we're not leaking the response content into the telemetry payload
      expect(JSON.stringify(properties))
        .to.not.include('creditCardNumber')
        .and.not.include('1234-5678-9012-3456');
    });

    test('reports negative user feedback', async function () {
      await testParticipantController.handleUserFeedback({
        kind: vscode.ChatResultFeedbackKind.Unhelpful,
        result: {
          metadata: {
            intent: 'query',
            responseContent: 'SSN: 123456789',
          },
        },
        unhelpfulReason: 'incompleteCode',
      } as vscode.ChatResultFeedback);

      sinon.assert.calledOnce(telemetryTrackStub);
      expect(telemetryTrackStub.lastCall.args[0]).to.be.equal(
        'Participant Feedback'
      );

      const properties = telemetryTrackStub.lastCall.args[1];
      expect(properties.feedback).to.be.equal('negative');
      expect(properties.reason).to.be.equal('incompleteCode');
      expect(properties.response_type).to.be.equal('query');

      // Ensure we're not leaking the response content into the telemetry payload
      expect(JSON.stringify(properties))
        .to.not.include('SSN')
        .and.not.include('123456789');
    });

    test('reports error', function () {
      const err = Error('Filtered by Responsible AI Service');
      testParticipantController._telemetryService.trackParticipantError(
        err,
        'query'
      );
      sinon.assert.calledOnce(telemetryTrackStub);

      expect(telemetryTrackStub.lastCall.args[0]).to.be.equal(
        'Participant Response Failed'
      );

      const properties = telemetryTrackStub.lastCall.args[1];
      expect(properties.command).to.be.equal('query');
      expect(properties.error_code).to.be.undefined;
      expect(properties.error_name).to.be.equal(
        'Filtered by Responsible AI Service'
      );
    });

    test('reports nested error', function () {
      const err = new Error('Parent error');
      err.cause = Error('This message is flagged as off topic: off_topic.');
      testParticipantController._telemetryService.trackParticipantError(
        err,
        'docs'
      );
      sinon.assert.calledOnce(telemetryTrackStub);

      expect(telemetryTrackStub.lastCall.args[0]).to.be.equal(
        'Participant Response Failed'
      );

      const properties = telemetryTrackStub.lastCall.args[1];
      expect(properties.command).to.be.equal('docs');
      expect(properties.error_code).to.be.undefined;
      expect(properties.error_name).to.be.equal('Chat Model Off Topic');
    });

    test('Reports error code when available', function () {
      // eslint-disable-next-line new-cap
      const err = vscode.LanguageModelError.NotFound('Model not found');
      testParticipantController._telemetryService.trackParticipantError(
        err,
        'schema'
      );
      sinon.assert.calledOnce(telemetryTrackStub);

      expect(telemetryTrackStub.lastCall.args[0]).to.be.equal(
        'Participant Response Failed'
      );

      const properties = telemetryTrackStub.lastCall.args[1];
      expect(properties.command).to.be.equal('schema');
      expect(properties.error_code).to.be.equal('NotFound');
      expect(properties.error_name).to.be.equal('Other');
    });
  });
});
