import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';

import ParticipantController, {
  parseForDatabaseAndCollectionName,
  getRunnableContentFromString,
  QUERY_GENERATION_STATE,
} from '../../../participant/participant';
import ConnectionController from '../../../connectionController';
import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import { ExtensionContextStub } from '../stubs';
import TelemetryService from '../../../telemetry/telemetryService';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { CHAT_PARTICIPANT_ID } from '../../../participant/constants';

suite('Participant Controller Test Suite', function () {
  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  let testConnectionController: ConnectionController;
  let testStorageController: StorageController;
  let testStatusView: StatusView;
  let testTelemetryService: TelemetryService;
  let testParticipantController: ParticipantController;
  let chatContextStub;
  let chatStreamStub;
  let chatTokenStub;

  beforeEach(function () {
    testStorageController = new StorageController(extensionContextStub);
    testStatusView = new StatusView(extensionContextStub);
    testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContextStub
    );
    testConnectionController = new ConnectionController({
      statusView: testStatusView,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
    testParticipantController = new ParticipantController({
      connectionController: testConnectionController,
      storageController: testStorageController,
    });
    chatContextStub = {
      history: [
        {
          participant: CHAT_PARTICIPANT_ID,
          prompt: 'hi',
          response: 'hello',
        },
      ],
    };
    chatStreamStub = {
      markdown: sinon.fake(),
      button: sinon.fake(),
    };
    chatTokenStub = {
      onCancellationRequested: () => {},
    };
    // The model returned by vscode.lm.selectChatModels is always undefined in tests.
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
          maxInputTokens: 16211,
          countTokens: () => {},
          sendRequest: () =>
            Promise.resolve({
              text: [
                '```javascript\n' +
                  "use('dbOne');\n" +
                  "db.getCollection('collOne').find({ name: 'example' });\n" +
                  '```',
              ],
            }),
        },
      ])
    );
  });

  afterEach(function () {
    sinon.restore();
  });

  test('parses a returned by ai text for database and collection name', function () {
    const text = 'DATABASE_NAME: my  \nCOLLECTION_NAME: cats';
    const { databaseName, collectionName } =
      parseForDatabaseAndCollectionName(text);
    expect(databaseName).to.be.equal('my');
    expect(collectionName).to.be.equal('cats');
  });

  test('parses a returned by ai text for code blocks', function () {
    const text =
      '```javascript\n' +
      "use('test');\n" +
      "db.getCollection('test').find({ name: 'Shika' });\n" +
      '```';
    const code = getRunnableContentFromString(text);
    expect(code).to.be.equal(
      "\nuse('test');\ndb.getCollection('test').find({ name: 'Shika' });\n"
    );
  });

  suite('when not connected', function () {
    let connectWithConnectionIdStub;
    let connectWithURIStub;

    beforeEach(function () {
      connectWithConnectionIdStub = sinon.stub(
        testParticipantController._connectionController,
        'connectWithConnectionId'
      );
      connectWithURIStub = sinon.stub(
        testParticipantController._connectionController,
        'connectWithURI'
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
      sinon
        .stub(testParticipantController._connectionController, '_connections')
        .value([
          {
            id: '123',
            name: 'localhost',
          },
        ]);
    });

    test('asks to connect', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
        references: [],
      };
      await testParticipantController.chatHandler(
        chatRequestMock,
        chatContextStub,
        chatStreamStub,
        chatTokenStub
      );
      const connectMessage = chatStreamStub.markdown.getCall(0).args[0];
      expect(connectMessage).to.include(
        "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against."
      );
      const addNewConnectionMessage =
        chatStreamStub.markdown.getCall(1).args[0];
      expect(addNewConnectionMessage.value).to.include(
        '- <a href="command:mdb.connectWithParticipant">Add new connection</a>'
      );
      const listConnectionsMessage = chatStreamStub.markdown.getCall(2).args[0];
      expect(listConnectionsMessage.value).to.include(
        '- <a href="command:mdb.connectWithParticipant?%5B%22123%22%5D">localhost</a>'
      );
      expect(
        testParticipantController._chatResult?.metadata.responseContent
      ).to.be.eql(undefined);
      expect(testParticipantController._queryGenerationState).to.be.eql(
        QUERY_GENERATION_STATE.ASK_TO_CONNECT
      );
    });

    test('handles empty connection name', async function () {
      const chatRequestMock = {
        prompt: 'find all docs by a name example',
        command: 'query',
        references: [],
      };
      await testParticipantController.chatHandler(
        chatRequestMock,
        chatContextStub,
        chatStreamStub,
        chatTokenStub
      );
      expect(testParticipantController._queryGenerationState).to.be.eql(
        QUERY_GENERATION_STATE.ASK_TO_CONNECT
      );

      chatRequestMock.prompt = '';
      await testParticipantController.chatHandler(
        chatRequestMock,
        chatContextStub,
        chatStreamStub,
        chatTokenStub
      );

      const emptyMessage = chatStreamStub.markdown.getCall(3).args[0];
      expect(emptyMessage).to.include(
        'Please select a cluster to connect by clicking on an item in the connections list.'
      );
      const addNewConnectionMessage =
        chatStreamStub.markdown.getCall(4).args[0];
      expect(addNewConnectionMessage.value).to.include(
        '- <a href="command:mdb.connectWithParticipant">Add new connection</a>'
      );
      const listConnectionsMessage = chatStreamStub.markdown.getCall(5).args[0];
      expect(listConnectionsMessage.value).to.include(
        '- <a href="command:mdb.connectWithParticipant?%5B%22123%22%5D">localhost</a>'
      );
      expect(
        testParticipantController._chatResult?.metadata.responseContent
      ).to.be.eql(undefined);
      expect(testParticipantController._queryGenerationState).to.be.eql(
        QUERY_GENERATION_STATE.ASK_TO_CONNECT
      );
    });

    test('calls connect by id for an existing connection', async function () {
      await testParticipantController.connectWithParticipant('123');
      expect(connectWithConnectionIdStub).to.have.been.calledWithExactly('123');
    });

    test('calls connect with uri for a new connection', async function () {
      await testParticipantController.connectWithParticipant();
      expect(connectWithURIStub).to.have.been.called;
    });
  });

  suite('when connected', function () {
    beforeEach(function () {
      sinon.replace(
        testParticipantController._connectionController,
        'getActiveDataService',
        () =>
          ({
            listDatabases: () => Promise.resolve([{ name: 'dbOne' }]),
            listCollections: () => Promise.resolve([{ name: 'collOne' }]),
            getMongoClientConnectionOptions: () => ({
              url: TEST_DATABASE_URI,
              options: {},
            }),
            once: sinon.stub(),
          } as unknown as DataService)
      );
      sinon
        .stub(testParticipantController, '_shouldAskToConnectIfNotConnected')
        .returns(false);
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
        await testParticipantController.chatHandler(
          chatRequestMock,
          chatContextStub,
          chatStreamStub,
          chatTokenStub
        );
        const welcomeMessage = chatStreamStub.markdown.firstCall.args[0];
        expect(welcomeMessage).to.include('Welcome to MongoDB Participant!');
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

      suite('generic command', function () {
        test('generates a query', async function () {
          const chatRequestMock = {
            prompt: 'how to find documents in my collection?',
            command: undefined,
            references: [],
          };
          expect(testParticipantController._queryGenerationState).to.be.equal(
            undefined
          );
          expect(testParticipantController._chatResult).to.be.equal(undefined);
          await testParticipantController.chatHandler(
            chatRequestMock,
            chatContextStub,
            chatStreamStub,
            chatTokenStub
          );
          expect(
            testParticipantController._chatResult?.metadata.responseContent
          ).to.include(
            "db.getCollection('collOne').find({ name: 'example' });"
          );
        });
      });

      suite('query command', function () {
        suite('known namespace', function () {
          beforeEach(function () {
            sinon
              .stub(testParticipantController, '_databaseName')
              .value('dbOne');
            sinon
              .stub(testParticipantController, '_collectionName')
              .value('collOne');
            sinon
              .stub(testParticipantController, '_shouldAskForNamespace')
              .resolves(false);
          });

          test('generates a query', async function () {
            const chatRequestMock = {
              prompt: 'find all docs by a name example',
              command: 'query',
              references: [],
            };
            expect(testParticipantController._queryGenerationState).to.be.equal(
              undefined
            );
            expect(testParticipantController._chatResult).to.be.equal(
              undefined
            );
            await testParticipantController.chatHandler(
              chatRequestMock,
              chatContextStub,
              chatStreamStub,
              chatTokenStub
            );
            expect(
              testParticipantController._chatResult?.metadata.responseContent
            ).to.include(
              "db.getCollection('collOne').find({ name: 'example' });"
            );
          });
        });

        suite('unknown namespace', function () {
          test('asks for a namespace and generates a query', async function () {
            const chatRequestMock = {
              prompt: 'find all docs by a name example',
              command: 'query',
              references: [],
            };
            expect(testParticipantController._queryGenerationState).to.be.equal(
              undefined
            );
            await testParticipantController.chatHandler(
              chatRequestMock,
              chatContextStub,
              chatStreamStub,
              chatTokenStub
            );
            const askForDBMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(askForDBMessage).to.include(
              'What is the name of the database you would like this query to run against?'
            );
            const listDBsMessage = chatStreamStub.markdown.getCall(1).args[0];
            expect(listDBsMessage.value).to.include(
              '- <a href="command:mdb.selectDatabaseWithParticipant?%5B%22dbOne%22%5D">dbOne</a>'
            );
            expect(
              testParticipantController._chatResult?.metadata.responseContent
            ).to.be.eql(undefined);
            expect(testParticipantController._queryGenerationState).to.be.eql(
              QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME
            );

            chatRequestMock.prompt = 'dbOne';
            await testParticipantController.chatHandler(
              chatRequestMock,
              chatContextStub,
              chatStreamStub,
              chatTokenStub
            );

            expect(testParticipantController._databaseName).to.be.equal(
              'dbOne'
            );
            const askForCollMessage =
              chatStreamStub.markdown.getCall(2).args[0];
            expect(askForCollMessage).to.include(
              'Which collection would you like to query within this database?'
            );
            const listCollsMessage = chatStreamStub.markdown.getCall(3).args[0];
            expect(listCollsMessage.value).to.include(
              '- <a href="command:mdb.selectCollectionWithParticipant?%5B%22collOne%22%5D">collOne</a>'
            );
            expect(
              testParticipantController._chatResult?.metadata.responseContent
            ).to.be.eql(undefined);
            expect(testParticipantController._queryGenerationState).to.be.eql(
              QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME
            );

            chatRequestMock.prompt = 'collOne';
            await testParticipantController.chatHandler(
              chatRequestMock,
              chatContextStub,
              chatStreamStub,
              chatTokenStub
            );

            expect(testParticipantController._collectionName).to.be.equal(
              'collOne'
            );
            expect(
              testParticipantController._chatResult?.metadata.responseContent
            ).to.include(
              "db.getCollection('collOne').find({ name: 'example' });"
            );
          });

          test('handles empty database name', async function () {
            sinon
              .stub(testParticipantController, '_queryGenerationState')
              .value(QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME);

            const chatRequestMock = {
              prompt: '',
              command: 'query',
              references: [],
            };
            await testParticipantController.chatHandler(
              chatRequestMock,
              chatContextStub,
              chatStreamStub,
              chatTokenStub
            );

            const emptyMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(emptyMessage).to.include(
              'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
            );
            const listDBsMessage = chatStreamStub.markdown.getCall(1).args[0];
            expect(listDBsMessage.value).to.include(
              '- <a href="command:mdb.selectDatabaseWithParticipant?%5B%22dbOne%22%5D">dbOne</a>'
            );
            expect(testParticipantController._queryGenerationState).to.be.eql(
              QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME
            );
          });

          test('handles empty collection name', async function () {
            sinon
              .stub(testParticipantController, '_queryGenerationState')
              .value(QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME);
            sinon
              .stub(testParticipantController, '_databaseName')
              .value('dbOne');

            const chatRequestMock = {
              prompt: '',
              command: 'query',
              references: [],
            };
            await testParticipantController.chatHandler(
              chatRequestMock,
              chatContextStub,
              chatStreamStub,
              chatTokenStub
            );

            const emptyMessage = chatStreamStub.markdown.getCall(0).args[0];
            expect(emptyMessage).to.include(
              'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.'
            );
            const listCollsMessage = chatStreamStub.markdown.getCall(1).args[0];
            expect(listCollsMessage.value).to.include(
              '- <a href="command:mdb.selectCollectionWithParticipant?%5B%22collOne%22%5D">collOne</a>'
            );
            expect(testParticipantController._queryGenerationState).to.be.eql(
              QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME
            );
          });
        });
      });
    });
  });
});
