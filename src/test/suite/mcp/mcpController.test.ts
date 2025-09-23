/* eslint-disable no-loop-func */
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { afterEach, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import { ExtensionContextStub } from '../stubs';
import { MCPController } from '../../../mcp/mcpController';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TelemetryService } from '../../../telemetry';
import { TEST_DATABASE_URI } from '../dbTestHelper';

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function testConnectionManagerSwitch(
  mcpController: MCPController,
  connectionController: ConnectionController,
): Promise<void> {
  const mcpUpdateConnectionSpy = sandbox.spy(
    mcpController._test_mcpConnectionManager,
    'updateConnection',
  );
  await mcpController.activate();
  // first activate fires the switch on no connection
  expect(mcpUpdateConnectionSpy.firstCall).to.be.calledWithExactly(undefined);

  // this will fire activation changed forcing to switch to active connection
  await connectionController.addNewConnectionStringAndConnect({
    connectionString: `${TEST_DATABASE_URI}/?appname=mongodb-vscode+9.9.9`,
  });
  await timeout(10);
  expect(mcpUpdateConnectionSpy.secondCall).to.be.calledWithMatch({
    connectionString: `${TEST_DATABASE_URI}/?appname=mongodb-vscode+9.9.9`,
  });
}

const sandbox = sinon.createSandbox();
suite('MCPController test suite', function () {
  let connectionController: ConnectionController;
  let mcpController: MCPController;

  let mcpAutoStartValue: string | null | undefined;
  let getConfigurationStub: SinonStub;
  let updateConfigurationStub: SinonStub;

  let showInformationSelection: string | undefined;
  let showInformationMessageStub: SinonStub;
  let showInformationCalledNotification: Promise<void>;

  let startServerStub: SinonStub;
  let startServerCalledNotification: Promise<void>;

  beforeEach(() => {
    const extensionContext = new ExtensionContextStub();
    const testStorageController = new StorageController(extensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContext,
    );
    connectionController = new ConnectionController({
      statusView: new StatusView(extensionContext),
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });

    mcpController = new MCPController({
      context: extensionContext,
      connectionController: connectionController,
      getTelemetryAnonymousId: (): string => '1FOO',
    });

    // GetConfiguration Stubs
    mcpAutoStartValue = undefined;
    getConfigurationStub = sandbox.stub().callsFake(() => mcpAutoStartValue);
    updateConfigurationStub = sandbox.stub().callsFake((key, value) => {
      mcpAutoStartValue = value;
    });
    const fakeGetConfiguration = sandbox.fake.returns({
      get: getConfigurationStub,
      update: updateConfigurationStub,
    });
    sandbox.replace(vscode.workspace, 'getConfiguration', fakeGetConfiguration);

    // Show information message stubs
    showInformationSelection = undefined;
    let notifyInformationMessageVisible: (() => void) | undefined;
    showInformationCalledNotification = new Promise<void>((resolve) => {
      notifyInformationMessageVisible = resolve;
    });
    showInformationMessageStub = sandbox
      .stub(vscode.window, 'showInformationMessage')
      .callsFake(((): Promise<string | undefined> => {
        notifyInformationMessageVisible?.();
        return Promise.resolve(showInformationSelection);
      }) as unknown as any);

    // Other spies
    let notifyStartServerCalled: (() => void) | undefined;
    startServerCalledNotification = new Promise<void>((resolve) => {
      notifyStartServerCalled = resolve;
    });
    const originalStartServer = mcpController.startServer.bind(mcpController);
    startServerStub = sandbox
      .stub(mcpController, 'startServer')
      .callsFake((...args) => {
        notifyStartServerCalled?.();
        return originalStartServer(...args);
      });
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
    connectionController.clearAllConnections();
  });

  suite(
    'activation flow for first time extension installs or first time update to v1.14.x',
    function () {
      beforeEach(() => {
        mcpAutoStartValue = 'prompt';
      });

      test('should attempt switching the connection manager to active connection regardless of server started or not', () =>
        testConnectionManagerSwitch(mcpController, connectionController));

      test('should show MCP server auto start notification without starting the MCP server', async function () {
        await mcpController.activate();

        await showInformationCalledNotification;
        expect(showInformationMessageStub).to.be.calledWithExactly(
          'Would you like to automatically start the MongoDB MCP server? When started, the MongoDB MCP Server will automatically connect to your active MongoDB instance.',
          'Yes',
          'Not now',
        );

        // A small timeout to ensure the background tasks did happen
        await timeout(10);
        expect(startServerStub).to.not.be.called;
      });

      suite('when user selects "Yes" on the notification', function () {
        test('should start the MCP server and set the auto start to autoStartEnabled', async function () {
          showInformationSelection = 'Yes';
          await mcpController.activate();

          await showInformationCalledNotification;
          expect(showInformationMessageStub).to.be.calledWithExactly(
            'Would you like to automatically start the MongoDB MCP server? When started, the MongoDB MCP Server will automatically connect to your active MongoDB instance.',
            'Yes',
            'Not now',
          );

          await startServerCalledNotification;

          // Assert the server started
          expect(startServerStub).to.be.called;
          // A small timeout to ensure the background tasks did happen
          await timeout(10);
          expect(mcpController._test_isServerRunning).to.be.true;

          // Assert the selection is persisted
          expect(updateConfigurationStub).to.be.calledWithExactly(
            'mdb.mcp.server',
            'autoStartEnabled',
            true,
          );
          expect(mcpAutoStartValue).to.equal('autoStartEnabled');
        });
      });

      suite('when user selects "Not now" on the notification', function () {
        test('should start the MCP server and set the auto start to autoStartDisabled', async function () {
          showInformationSelection = 'Not now';
          await mcpController.activate();

          await showInformationCalledNotification;
          expect(showInformationMessageStub).to.be.calledWithExactly(
            'Would you like to automatically start the MongoDB MCP server? When started, the MongoDB MCP Server will automatically connect to your active MongoDB instance.',
            'Yes',
            'Not now',
          );

          // A small timeout to ensure the background tasks did happen
          await timeout(10);
          // Assert the server did not start
          expect(startServerStub).to.not.be.called;
          expect(mcpController._test_isServerRunning).to.be.false;

          // Assert the selection is persisted
          expect(updateConfigurationStub).to.be.calledWithExactly(
            'mdb.mcp.server',
            'autoStartDisabled',
            true,
          );
          expect(mcpAutoStartValue).to.equal('autoStartDisabled');
        });
      });
    },
  );

  suite(
    'activation flow for users who earlier opted to auto start MCP server',
    function () {
      test('should attempt switching the connection manager to active connection regardless of server started or not', () =>
        testConnectionManagerSwitch(mcpController, connectionController));

      test('should automatically start the MCP server, without any further notification', async function () {
        mcpAutoStartValue = 'autoStartEnabled';
        await mcpController.activate();

        // A small timeout to ensure the background tasks did happen
        await timeout(10);
        expect(showInformationMessageStub).to.not.be.called;

        expect(startServerStub).to.be.called;
        expect(mcpController._test_isServerRunning).to.be.true;
      });
    },
  );

  suite(
    'activation flow for users who earlier opted not to auto start MCP server',
    function () {
      test('should attempt switching the connection manager to active connection regardless of server started or not', () =>
        testConnectionManagerSwitch(mcpController, connectionController));

      test('should neither start the MCP server nor show any notification', async function () {
        mcpAutoStartValue = 'autoStartDisabled';
        await mcpController.activate();

        // A small timeout to ensure the background tasks did happen
        await timeout(10);
        expect(showInformationMessageStub).to.not.be.called;

        expect(startServerStub).to.not.be.called;
        expect(mcpController._test_isServerRunning).to.be.false;
      });
    },
  );

  suite('activation flow for users updating from v1.14.0', function () {
    for (const oldValue of ['ask', 'enabled']) {
      suite(`when old value of "mdb.mcp.server" is "${oldValue}"`, function () {
        test('should migrate the value to "prompt", save it and show the auto start notification without starting the MCP server', async function () {
          // Setting this to old value
          mcpAutoStartValue = oldValue;

          await mcpController.activate();

          await showInformationCalledNotification;
          expect(showInformationMessageStub).to.be.calledWithExactly(
            'Would you like to automatically start the MongoDB MCP server? When started, the MongoDB MCP Server will automatically connect to your active MongoDB instance.',
            'Yes',
            'Not now',
          );

          // A small timeout to ensure the background tasks did happen
          await timeout(10);
          expect(startServerStub).to.not.be.called;

          expect(updateConfigurationStub).to.be.calledWithExactly(
            'mdb.mcp.server',
            'prompt',
            true,
          );
          expect(mcpAutoStartValue).to.equal('prompt');
        });
      });
    }

    suite('when old value of "mdb.mcp.server" is "disabled"', function () {
      test('should migrate the value to "autoStartDisabled", save it and should neither show any auto start notification nor start the MCP server', async function () {
        // Setting this to old value
        mcpAutoStartValue = 'disabled';

        await mcpController.activate();

        // A small timeout to ensure the background tasks did happen
        await timeout(10);
        expect(showInformationMessageStub).to.not.be.called;
        expect(startServerStub).to.not.be.called;
        expect(updateConfigurationStub).to.be.calledWithExactly(
          'mdb.mcp.server',
          'autoStartDisabled',
          true,
        );
        expect(mcpAutoStartValue).to.equal('autoStartDisabled');
      });
    });

    for (const oldValue of [null, undefined, 'something-totally-odd']) {
      suite(
        `when old value of "mdb.mcp.server" is anything other than "ask", "enabled" or "disabled" ("${oldValue}")`,
        function () {
          test('should preserve the value and should neither show any auto start notification nor start the MCP server', async function () {
            // Setting this to old value
            mcpAutoStartValue = oldValue;

            await mcpController.activate();

            // A small timeout to ensure the background tasks did happen
            await timeout(10);
            expect(showInformationMessageStub).to.not.be.called;
            expect(startServerStub).to.not.be.called;
            expect(updateConfigurationStub).to.not.be.called;
            expect(mcpAutoStartValue).to.equal(oldValue);
          });
        },
      );
    }
  });

  suite(
    'when a connection is established in VSCode and MCP server auto start is set to "prompt"',
    function () {
      test('should show MCP server auto start notification without starting the MCP server', async function () {
        mcpAutoStartValue = 'prompt';
        await mcpController.activate();
        await showInformationCalledNotification;

        // Now connecting to a connection
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });

        // Small timeout to let background task workout
        await timeout(10);
        expect(showInformationMessageStub).to.be.calledTwice;
        expect(showInformationMessageStub.secondCall).to.be.calledWithExactly(
          'Would you like to automatically start the MongoDB MCP server? When started, the MongoDB MCP Server will automatically connect to your active MongoDB instance.',
          'Yes',
          'Not now',
        );
        expect(startServerStub).to.not.be.called;
      });
    },
  );

  suite(
    'when a connection is disconnected in VSCode and MCP server auto start is set to "prompt"',
    function () {
      test('should not show MCP server auto start notification', async function () {
        mcpAutoStartValue = 'prompt';
        await mcpController.activate();
        await showInformationCalledNotification;

        // Now connecting to a connection
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });

        await connectionController.disconnect();

        // Small timeout to let background task workout
        await timeout(10);
        expect(showInformationMessageStub).to.be.calledTwice;
        expect(startServerStub).to.not.be.called;
      });
    },
  );

  suite('#openServerConfig', function () {
    suite('when the server is not running', function () {
      test('should notify that server is not running', async function () {
        const showErrorMessageSpy = sandbox.spy(
          vscode.window,
          'showErrorMessage',
        );
        expect(await mcpController.openServerConfig()).to.equal(false);
        expect(showErrorMessageSpy).to.be.calledWith(
          'MongoDB MCP Server is not running. Start the server by running "MDB: Start MCP Server" in the command palette.',
        );
      });
    });

    suite('when the server is running', function () {
      test('should open the document with the server config', async function () {
        mcpAutoStartValue = 'autoStartEnabled';

        const showTextDocumentStub = sandbox.spy(
          vscode.window,
          'showTextDocument',
        );

        // Start the controller and listen to events
        await mcpController.activate();

        // Add a connection
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
        await startServerCalledNotification;
        expect(await mcpController.openServerConfig()).to.equal(true);
        expect(showTextDocumentStub).to.be.called;
      });
    });
  });
});
