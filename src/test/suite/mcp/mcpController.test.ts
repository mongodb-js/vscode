import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { afterEach, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import * as MCPServer from 'mongodb-mcp-server';
import { ExtensionContextStub } from '../stubs';
import type { MCPServerInfo } from '../../../mcp/mcpController';
import { MCPController } from '../../../mcp/mcpController';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TelemetryService } from '../../../telemetry';
import { TEST_DATABASE_URI } from '../dbTestHelper';

const sandbox = sinon.createSandbox();
suite('MCPController test suite', function () {
  let extensionContext: ExtensionContext;
  let connectionController: ConnectionController;
  let mcpController: MCPController;

  beforeEach(() => {
    extensionContext = new ExtensionContextStub();
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
  });

  afterEach(async () => {
    sandbox.restore();
    sandbox.reset();
    connectionController.clearAllConnections();
    await vscode.workspace.getConfiguration('mdb').update('mcp.server', null);
  });

  test('should register mcp server definition provider', function () {
    // At-least one from our mcp controller
    expect(extensionContext.subscriptions.length).to.be.greaterThanOrEqual(1);
  });

  suite('#activate', function () {
    test('should subscribe to ACTIVE_CONNECTION_CHANGED event', async function () {
      const addEventListenerSpy = sandbox.spy(
        connectionController,
        'addEventListener',
      );
      await mcpController.activate();
      expect(addEventListenerSpy).to.be.called;
      expect(addEventListenerSpy.args[0]).to.contain(
        'ACTIVE_CONNECTION_CHANGED',
      );
    });
  });

  suite('#startServer', function () {
    test('should initialize HTTP transport and start it', async function () {
      await mcpController.startServer();
      const serverInfo = (mcpController as any).server as
        | MCPServerInfo
        | undefined;
      expect(serverInfo).to.not.be.undefined;
      expect(serverInfo?.runner).to.be.instanceOf(
        MCPServer.StreamableHttpRunner,
      );
      expect(serverInfo?.headers?.authorization).to.not.be.undefined;
    });
  });

  suite('when mcp server auto start is enabled in the config', function () {
    test('it should start mcp server without any notification', async function () {
      await vscode.workspace
        .getConfiguration('mdb')
        .update('mcp.server', 'enabled');

      const showInformationSpy = sandbox.spy(
        vscode.window,
        'showInformationMessage',
      );
      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      await mcpController.activate();

      expect(showInformationSpy).to.not.be.called;
      expect(startServerSpy).to.be.calledOnce;
    });
  });

  suite('when mcp server auto start is disabled from config', function () {
    test('it should not start mcp server and show no notification', async function () {
      await vscode.workspace
        .getConfiguration('mdb')
        .update('mcp.server', 'disabled');

      const showInformationSpy = sandbox.spy(
        vscode.window,
        'showInformationMessage',
      );
      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      await mcpController.activate();

      expect(showInformationSpy).to.not.be.called;
      expect(startServerSpy).to.not.be.called;
    });
  });

  suite('when mcp server auto start is not configured', function () {
    let showInformationStub: SinonStub;
    let informationStubCalledNotification: Promise<void>;
    let informationStubResolvedValue: any;
    beforeEach(() => {
      informationStubResolvedValue = undefined;
      let notifyInformationStubCalled: () => void;
      informationStubCalledNotification = new Promise<void>((resolve) => {
        notifyInformationStubCalled = resolve;
      });
      showInformationStub = sandbox
        .stub(vscode.window, 'showInformationMessage')
        .callsFake(() => {
          notifyInformationStubCalled();
          return Promise.resolve(informationStubResolvedValue);
        });
    });
    test('it start the mcp server, set auto start to enabled and, notify the user with an information message', async function () {
      const updateStub = sandbox.stub();
      const fakeGetConfiguration = sandbox.fake.returns({
        get: () => null,
        update: updateStub,
      });
      sandbox.replace(
        vscode.workspace,
        'getConfiguration',
        fakeGetConfiguration,
      );

      // Equivalent to dismissing the popup
      informationStubResolvedValue = undefined;

      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      await mcpController.activate();

      await informationStubCalledNotification;
      expect(showInformationStub).to.be.calledOnce;
      expect(updateStub).to.be.calledWith('mcp.server', 'enabled', true);
      expect(startServerSpy).to.be.called;
    });

    suite(
      'on the notification popup, if user selects to keep auto starting',
      function () {
        test('it should keep the config set to auto start and continue running the MCP server', async function () {
          const updateStub = sandbox.stub();
          const fakeGetConfiguration = sandbox.fake.returns({
            get: () => null,
            update: updateStub,
          });
          sandbox.replace(
            vscode.workspace,
            'getConfiguration',
            fakeGetConfiguration,
          );

          informationStubResolvedValue = 'Keep';
          const startServerSpy = sandbox.spy(mcpController, 'startServer');
          await mcpController.activate();

          await informationStubCalledNotification;
          expect(showInformationStub).to.be.calledOnce;
          expect(updateStub).to.be.calledWith('mcp.server', 'enabled', true);
          expect(startServerSpy).to.be.called;
        });
      },
    );

    suite(
      'on the notification popup, if user selects to disable auto starting',
      function () {
        test('it should set the config to disable auto start and stop the MCP server', async function () {
          let notifyUpdateCalled: () => void;
          const updateCalledNotification = new Promise<void>((resolve) => {
            notifyUpdateCalled = resolve;
          });

          // There will be two calls to update, one which we do by default and
          // second to update the config to disabled.
          let callCount = 0;
          const updateStub = sandbox.stub().callsFake(() => {
            if (++callCount === 2) {
              notifyUpdateCalled();
            }
          });
          const fakeGetConfiguration = sandbox.fake.returns({
            get: () => null,
            update: updateStub,
          });
          sandbox.replace(
            vscode.workspace,
            'getConfiguration',
            fakeGetConfiguration,
          );

          informationStubResolvedValue = 'Disable';
          const startServerSpy = sandbox.spy(mcpController, 'startServer');
          const stopServerSpy = sandbox.spy(mcpController, 'stopServer');
          await mcpController.activate();

          await informationStubCalledNotification;
          expect(showInformationStub).to.be.calledOnce;

          await updateCalledNotification;
          expect(updateStub.lastCall).to.be.calledWith(
            'mcp.server',
            'disabled',
            true,
          );
          expect(startServerSpy).to.be.called;
          expect(stopServerSpy).to.be.called;
        });
      },
    );
  });

  suite('when an MCP server is already running', function () {
    test('it should notify the connection manager of the connection changed event', async function () {
      // We want to connect as soon as connection changes
      await vscode.workspace
        .getConfiguration('mdb')
        .update('mcp.server', 'enabled');

      // Start the controller and list to events
      await mcpController.activate();

      // Add a connection
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

      const switchConnectionManagerSpy = sandbox.spy(
        mcpController as any,
        'switchConnectionManagerToCurrentConnection',
      );

      await connectionController.disconnect();
      expect(switchConnectionManagerSpy).to.be.calledOnce;
    });
  });

  suite('when an MCP server is not running', function () {
    test('it should not notify the connection manager of the connection changed event', async function () {
      // Disable connecting
      await vscode.workspace
        .getConfiguration('mdb')
        .update('mcp.server', 'disabled');

      // Start the controller and list to events
      await mcpController.activate();

      // Add a connection
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

      const switchConnectionManagerSpy = sandbox.spy(
        mcpController as any,
        'switchConnectionManagerToCurrentConnection',
      );

      await connectionController.disconnect();
      expect(switchConnectionManagerSpy).not.to.be.called;
    });
  });

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
        const startServer = mcpController.startServer.bind(mcpController);
        let notifyStartServerCalled: () => void = () => {};
        const startServerCalled: Promise<void> = new Promise<void>(
          (resolve) => {
            notifyStartServerCalled = resolve;
          },
        );
        sandbox.replace(mcpController, 'startServer', async () => {
          await startServer();
          notifyStartServerCalled();
        });

        const showTextDocumentStub = sandbox.spy(
          vscode.window,
          'showTextDocument',
        );

        // We want to connect as soon as connection changes
        await vscode.workspace
          .getConfiguration('mdb')
          .update('mcp.server', 'enabled');

        // Start the controller and listen to events
        await mcpController.activate();

        // Add a connection
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
        await startServerCalled;
        expect(await mcpController.openServerConfig()).to.equal(true);
        expect(showTextDocumentStub).to.be.called;
      });
    });
  });
});
