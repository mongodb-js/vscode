import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import type { SinonSpy } from 'sinon';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';
import { ObjectId, Int32 } from 'bson';

import ParticipantController from '../../../participant/participant';
import ConnectionController from '../../../connectionController';
import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import { ExtensionContextStub } from '../stubs';
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
import { Prompts } from '../../../participant/prompts';
import { createMarkdownLink } from '../../../participant/markdown';
import EXTENSION_COMMANDS from '../../../commands';

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

suite('Participant Controller Test Suite', function () {
  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  let testConnectionController: ConnectionController;
  let testStorageController: StorageController;
  let testStatusView: StatusView;
  let testTelemetryService: TelemetryService;
  let testParticipantController: ParticipantController;
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
    testParticipantController = new ParticipantController({
      connectionController: testConnectionController,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
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
    sendRequestStub = sinon.stub().resolves({
      text: [
        '```javascript\n' +
          "use('dbOne');\n" +
          "db.getCollection('collOne').find({ name: 'example' });\n" +
          '```',
      ],
    });
    sinon.replace(
      vscode.lm,
      'selectChatModels',
      sinon.fake.returns([
        {
          id: 'modelId',
          vendor: 'copilot',
          family: 'gpt-4o',
          version: 'gpt-4o-date',
          name: 'GPT 4o (date)',
          maxInputTokens: MAX_TOTAL_PROMPT_LENGTH_MOCK,
          countTokens: countTokensStub,
          sendRequest: sendRequestStub,
        },
      ])
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
    let sampleStub;

    beforeEach(function () {
      sampleStub = sinon.stub();
      sinon.replace(
        testParticipantController._connectionController,
        'getActiveDataService',
        () =>
          ({
            listDatabases: () =>
              Promise.resolve([
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
              ]),
            listCollections: () =>
              Promise.resolve([
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
              ]),
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

        sinon.assert.calledOnce(telemetryTrackStub);
        expect(telemetryTrackStub.lastCall.args[0]).to.equal(
          TelemetryEventTypes.PARTICIPANT_WELCOME_SHOWN
        );
        expect(telemetryTrackStub.lastCall.args[1]).to.be.undefined;
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
            const intentRequest = sendRequestStub.firstCall.args[0];
            expect(intentRequest).to.have.length(2);
            expect(intentRequest[0].content).to.include(
              'Your task is to help guide a conversation with a user to the correct handler.'
            );
            expect(intentRequest[1].content).to.equal(
              'what is the shape of the documents in the pineapple collection?'
            );
            const genericRequest = sendRequestStub.secondCall.args[0];
            expect(genericRequest).to.have.length(2);
            expect(genericRequest[0].content).to.include(
              'Parse all user messages to find a database name and a collection name.'
            );
            expect(genericRequest[1].content).to.equal(
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
          const intentRequest = sendRequestStub.firstCall.args[0];
          expect(intentRequest).to.have.length(2);
          expect(intentRequest[0].content).to.include(
            'Your task is to help guide a conversation with a user to the correct handler.'
          );
          expect(intentRequest[1].content).to.equal(
            'how to find documents in my collection?'
          );
          const genericRequest = sendRequestStub.secondCall.args[0];
          expect(genericRequest).to.have.length(2);
          expect(genericRequest[0].content).to.include(
            'Your task is to help the user with MongoDB related questions.'
          );
          expect(genericRequest[1].content).to.equal(
            'how to find documents in my collection?'
          );

          expect(res?.metadata.intent).to.equal('generic');
          expect(chatStreamStub?.button.getCall(0).args[0]).to.deep.equal({
            command: 'mdb.runParticipantQuery',
            title: '▶️ Run',
            arguments: [
              {
                runnableContent:
                  "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
              },
            ],
          });
        });
      });

      suite('query command', function () {
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
              command: 'mdb.runParticipantQuery',
              title: '▶️ Run',
              arguments: [
                {
                  runnableContent:
                    "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
                },
              ],
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
            const messages = sendRequestStub.secondCall.args[0];
            expect(messages[1].content).to.include(
              'Collection schema: _id: ObjectId\n' +
                'field.stringField: String\n' +
                'field.arrayField: Array<Int32>\n'
            );
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
              const messages = sendRequestStub.secondCall.args[0];
              expect(messages[1].content).to.include(
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
              const messages = sendRequestStub.secondCall.args[0];
              expect(messages[1].content).to.include(
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
              const messages = sendRequestStub.secondCall.args[0];
              expect(messages[1].content).to.include(
                'Sample document: {\n' +
                  "  _id: ObjectId('63ed1d522d8573fa5c203661'),\n" +
                  '  field: {\n' +
                  "    stringField: 'Text 1'\n" +
                  '  }\n' +
                  '}\n'
              );
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
              const messages = sendRequestStub.secondCall.args[0];
              expect(messages[1].content).to.not.include('Sample documents');
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
              const messages = sendRequestStub.secondCall.args[0];
              expect(messages[1].content).to.not.include('Sample documents');
            });
          });
        });

        suite('unknown namespace', function () {
          test('asks for a namespace and generates a query', async function () {
            const chatRequestMock = {
              prompt: 'find all docs by a name example',
              command: 'query',
              references: [],
            };
            const chatResult = await invokeChatHandler(chatRequestMock);
            const askForDBMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(askForDBMessage).to.include(
              'What is the name of the database you would like this query to run against?'
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
                {
                  prompt: 'find all docs by a name example',
                  command: 'query',
                  references: [],
                  participant: CHAT_PARTICIPANT_ID,
                } as vscode.ChatRequestTurn,
                Object.assign(
                  Object.create(vscode.ChatResponseTurn.prototype),
                  {
                    participant: CHAT_PARTICIPANT_ID,
                    response: [
                      {
                        value: {
                          value:
                            'What is the name of the database you would like this query to run against?',
                        } as vscode.MarkdownString,
                      },
                    ],
                    command: 'query',
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                        chatId: firstChatId,
                      },
                    },
                  } as vscode.ChatResponseTurn
                ),
              ],
            };

            const chatResult2 = await invokeChatHandler(chatRequestMock);

            const askForCollMessage =
              chatStreamStub.markdown.getCall(12).args[0];
            expect(askForCollMessage).to.include(
              'Which collection would you like to use within dbOne?'
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
                Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
                  prompt: 'find all docs by a name example',
                  command: 'query',
                  references: [],
                  participant: CHAT_PARTICIPANT_ID,
                }),
                Object.assign(
                  Object.create(vscode.ChatResponseTurn.prototype),
                  {
                    participant: CHAT_PARTICIPANT_ID,
                    response: [
                      {
                        value: {
                          value:
                            'Which database would you like to query within this database?',
                        } as vscode.MarkdownString,
                      },
                    ],
                    command: 'query',
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                      },
                    },
                  }
                ),
                Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
                  prompt: 'dbOne',
                  command: 'query',
                  references: [],
                  participant: CHAT_PARTICIPANT_ID,
                }),
                Object.assign(
                  Object.create(vscode.ChatResponseTurn.prototype),
                  {
                    participant: CHAT_PARTICIPANT_ID,
                    response: [
                      {
                        value: {
                          value:
                            'Which collection would you like to query within dbOne?',
                        } as vscode.MarkdownString,
                      },
                    ],
                    command: 'query',
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
              command: 'mdb.runParticipantQuery',
              title: '▶️ Run',
              arguments: [
                {
                  runnableContent:
                    "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
                },
              ],
            });
            expect(chatStreamStub?.button.getCall(1).args[0]).to.deep.equal({
              command: 'mdb.openParticipantQueryInPlayground',
              title: 'Open in playground',
              arguments: [
                {
                  runnableContent:
                    "use('dbOne');\ndb.getCollection('collOne').find({ name: 'example' });",
                },
              ],
            });
          });

          test('handles empty database name', async function () {
            const chatRequestMock = {
              prompt: '',
              command: 'query',
              references: [],
            };
            chatContextStub = {
              history: [
                {
                  prompt: 'find all docs by a name example',
                  command: 'query',
                  references: [],
                  participant: CHAT_PARTICIPANT_ID,
                } as vscode.ChatRequestTurn,
                Object.assign(
                  Object.create(vscode.ChatResponseTurn.prototype),
                  {
                    participant: CHAT_PARTICIPANT_ID,
                    response: [
                      {
                        value: {
                          value:
                            'What is the name of the database you would like this query to run against?',
                        } as vscode.MarkdownString,
                      },
                    ],
                    command: 'query',
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                        chatId: 'pineapple',
                      },
                    },
                  } as vscode.ChatResponseTurn
                ),
              ],
            };
            const chatResult = await invokeChatHandler(chatRequestMock);

            const emptyMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(emptyMessage).to.include(
              'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
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

          test('handles empty collection name', async function () {
            const chatRequestMock = {
              prompt: '',
              command: 'query',
              references: [],
            };
            chatContextStub = {
              history: [
                Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
                  prompt: 'find all docs by a name example',
                  command: 'query',
                  references: [],
                  participant: CHAT_PARTICIPANT_ID,
                }),
                Object.assign(
                  Object.create(vscode.ChatResponseTurn.prototype),
                  {
                    participant: CHAT_PARTICIPANT_ID,
                    response: [
                      {
                        value: {
                          value:
                            'Which database would you like to query within this database?',
                        } as vscode.MarkdownString,
                      },
                    ],
                    command: 'query',
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                      },
                    },
                  }
                ),
                Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
                  prompt: 'dbOne',
                  command: 'query',
                  references: [],
                  participant: CHAT_PARTICIPANT_ID,
                }),
                Object.assign(
                  Object.create(vscode.ChatResponseTurn.prototype),
                  {
                    participant: CHAT_PARTICIPANT_ID,
                    response: [
                      {
                        value: {
                          value:
                            'Which collection would you like to query within dbOne?',
                        } as vscode.MarkdownString,
                      },
                    ],
                    command: 'query',
                    result: {
                      metadata: {
                        intent: 'askForNamespace',
                        databaseName: 'dbOne',
                        collectionName: undefined,
                        chatId: 'pineapple',
                      },
                    },
                  }
                ),
              ],
            };
            const chatResult = await invokeChatHandler(chatRequestMock);

            const emptyMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(emptyMessage).to.include(
              'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.'
            );
            const listCollsMessage = chatStreamStub.markdown.getCall(1).args[0];
            expect(listCollsMessage.value).to.include(
              `- [collOne](command:mdb.selectCollectionWithParticipant?${encodeStringify(
                {
                  command: '/query',
                  chatId: 'pineapple',
                  databaseName: 'dbOne',
                  collectionName: 'collOne',
                }
              )})`
            );
            const showMoreCollsMessage =
              chatStreamStub.markdown.getCall(11).args[0];
            expect(showMoreCollsMessage.value).to.include(
              `- [Show more](command:mdb.selectCollectionWithParticipant?${encodeStringify(
                {
                  command: '/query',
                  chatId: 'pineapple',
                  databaseName: 'dbOne',
                }
              )})`
            );
            expect({
              ...chatResult?.metadata,
              chatId: undefined,
            }).to.deep.equal({
              intent: 'askForNamespace',
              collectionName: undefined,
              databaseName: 'dbOne',
              chatId: undefined,
            });
          });
        });
      });

      suite('schema command', function () {
        suite('known namespace from running namespace LLM', function () {
          beforeEach(function () {
            sendRequestStub.onCall(0).resolves({
              text: ['DATABASE_NAME: dbOne\n', 'COLLECTION_NAME: collOne\n`'],
            });
          });

          test('shows a button to view the json output', async function () {
            const chatRequestMock = {
              prompt: '',
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
              prompt: '',
              command: 'schema',
              references: [],
            };
            await invokeChatHandler(chatRequestMock);
            const messages = sendRequestStub.secondCall.args[0];
            expect(messages[0].content).to.include(
              'Amount of documents sampled: 2'
            );
            expect(messages[1].content).to.include(
              `Database name: dbOne
Collection name: collOne
Schema:
{
  "count": 2,
  "fields": [`
            );
            expect(messages[1].content).to.include(`"name": "arrayField",
              "path": [
                "field",
                "arrayField"
              ],`);
          });

          test('prints a message when no documents are found', async function () {
            sampleStub.resolves([]);
            const chatRequestMock = {
              prompt: '',
              command: 'schema',
              references: [],
            };
            await invokeChatHandler(chatRequestMock);
            expect(chatStreamStub?.markdown.getCall(0).args[0]).to.include(
              'Unable to generate a schema from the collection, no documents found.'
            );
          });
        });
      });

      suite('docs command', function () {
        const initialFetch = global.fetch;
        let fetchStub: sinon.SinonStub;

        beforeEach(function () {
          sendRequestStub.onCall(0).resolves({
            text: ['connection info'],
          });
        });

        afterEach(function () {
          global.fetch = initialFetch;
          sinon.restore();
        });

        test('uses docs chatbot result if available', async function () {
          fetchStub = sinon.stub().resolves({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                _id: '650b4b260f975ef031016c8a',
                messages: [],
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
          sinon.assert.calledOnce(telemetryTrackStub);
          expect(telemetryTrackStub.lastCall.args[0]).to.equal(
            TelemetryEventTypes.PARTICIPANT_RESPONSE_FAILED
          );

          const properties = telemetryTrackStub.lastCall.args[1];
          expect(properties.command).to.equal('docs');
          expect(properties.error_name).to.equal('Docs Chatbot API Issue');
        });
      });
    });
  });

  suite('prompt builders', function () {
    test('generic', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
      };
      const messages = await Prompts.generic.buildMessages({
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
    });

    test('query', async function () {
      const chatRequestMock = {
        prompt:
          'how do I find the number of people whose name starts with "P"?',
        command: 'query',
      };

      chatContextStub = {
        history: [
          Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
            prompt: 'give me the count of all people in the prod database',
            command: 'query',
            references: [],
            participant: CHAT_PARTICIPANT_ID,
          }),
        ],
      };
      const messages = await Prompts.query.buildMessages({
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
      expect(messages[1].content).to.equal(
        'give me the count of all people in the prod database'
      );

      // Actual user prompt
      expect(messages[2].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
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
      const messages = await Prompts.schema.buildMessages({
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
      expect(messages[0].content).to.include('Amount of documents sampled: 3');

      expect(messages[1].role).to.equal(
        vscode.LanguageModelChatMessageRole.User
      );
      expect(messages[1].content).to.include(databaseName);
      expect(messages[1].content).to.include(collectionName);
      expect(messages[1].content).to.include(schema);
    });

    test('namespace', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
      };
      const messages = await Prompts.namespace.buildMessages({
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
    });

    test('removes askForConnect messages from history', async function () {
      // The user is responding to an `askToConnect` message, so the prompt is just the
      // name of the connection
      const chatRequestMock = {
        prompt: 'localhost',
        command: 'query',
      };

      chatContextStub = {
        history: [
          Object.assign(Object.create(vscode.ChatRequestTurn.prototype), {
            prompt: 'give me the count of all people in the prod database',
            command: 'query',
            references: [],
            participant: CHAT_PARTICIPANT_ID,
          }),
          Object.assign(Object.create(vscode.ChatResponseTurn.prototype), {
            participant: CHAT_PARTICIPANT_ID,
            response: [
              {
                value: {
                  value: `Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.

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
                } as vscode.MarkdownString,
              },
            ],
            command: 'query',
            result: {
              metadata: {
                intent: 'askToConnect',
                chatId: 'abc',
              },
            },
          }),
        ],
      };

      const messages = await Prompts.query.buildMessages({
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
      expect(messages[1].content).to.contain(
        'give me the count of all people in the prod database'
      );
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
      expect(() => testParticipantController.handleError(err, 'query')).throws(
        'Filtered by Responsible AI Service'
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
      expect(() => testParticipantController.handleError(err, 'docs')).throws(
        'off_topic'
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
      expect(() => testParticipantController.handleError(err, 'schema')).throws(
        'Model not found'
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
