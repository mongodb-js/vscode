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
  this.timeout(300000);
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

    mcpController = new MCPController(extensionContext, connectionController);
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

  suite('when mcp server start is enabled from config', function () {
    test('it should start mcp server without any confirmation', async function () {
      await vscode.workspace
        .getConfiguration('mdb')
        .update('mcp.server', 'enabled');

      const showInformationSpy = sandbox.spy(
        vscode.window,
        'showInformationMessage',
      );
      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      // listen to connection events
      await mcpController.activate();
      // add a new connection to trigger connection change
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

      expect(showInformationSpy).to.not.be.called;
      expect(startServerSpy).to.be.calledOnce;
    });
  });

  suite('when mcp server start is disabled from config', function () {
    test('it should not start mcp server and ask for no confirmation', async function () {
      await vscode.workspace
        .getConfiguration('mdb')
        .update('mcp.server', 'disabled');

      const showInformationSpy = sandbox.spy(
        vscode.window,
        'showInformationMessage',
      );
      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      // listen to connection events
      await mcpController.activate();
      // add a new connection to trigger connection change
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

      expect(showInformationSpy).to.not.be.called;
      expect(startServerSpy).to.not.be.called;
    });
  });

  suite('when mcp server start is not configured', function () {
    test('it should ask before starting the mcp server, and update the configuration with the chosen value', async function () {
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

      const showInformationStub: SinonStub = sandbox.stub(
        vscode.window,
        'showInformationMessage',
      );
      showInformationStub.resolves('Yes');
      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      // listen to connection events
      await mcpController.activate();
      // add a new connection to trigger connection change
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });
      expect(showInformationStub).to.be.calledOnce;
      expect(updateStub).to.be.calledWith('mcp.server', 'enabled', true);
      expect(startServerSpy).to.be.called;
    });

    test('it should ask before starting the mcp server, and when denied, should not start the server', async function () {
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

      const showInformationStub: SinonStub = sandbox.stub(
        vscode.window,
        'showInformationMessage',
      );
      showInformationStub.resolves('No');
      const startServerSpy = sandbox.spy(mcpController, 'startServer');
      // listen to connection events
      await mcpController.activate();
      // add a new connection to trigger connection change
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });
      expect(showInformationStub).to.be.calledOnce;
      expect(updateStub).to.be.calledWith('mcp.server', 'disabled', true);
      expect(startServerSpy).to.not.be.called;
    });
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

      const connectionChangedSpy = sandbox.spy(
        mcpController as any,
        'onActiveConnectionChanged',
      );

      await connectionController.disconnect();
      expect(connectionChangedSpy).to.be.calledOnce;
    });
  });
});
