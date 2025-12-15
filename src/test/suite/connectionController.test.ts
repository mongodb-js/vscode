import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import util from 'util';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import * as mongodbDataService from 'mongodb-data-service';
import { expect } from 'chai';
import ConnectionString from 'mongodb-connection-string-url';

import ConnectionController, {
  ConnectionType,
  getNotifyDeviceFlowForConnectionAttempt,
} from '../../connectionController';
import formatError from '../../utils/formatError';
import {
  StorageController,
  StorageVariable,
  StorageLocation,
} from '../../storage';
import {
  DefaultSavingLocation,
  SecretStorageLocation,
} from '../../storage/storageController';
import { StatusView } from '../../views';
import { TelemetryService } from '../../telemetry';
import { ExtensionContextStub } from './stubs';
import {
  TEST_DATABASE_URI,
  TEST_DATABASE_URI_USER,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} from './dbTestHelper';
import type { LoadedConnection } from '../../storage/connectionStorage';
import getBuildInfo from 'mongodb-build-info';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json');

const testDatabaseConnectionName = 'localhost:27088';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

const sleep = (ms: number): Promise<void> => {
  return util.promisify(setTimeout)(ms);
};

suite('Connection Controller Test Suite', function () {
  this.timeout(10000);

  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub,
  );
  const testConnectionController = new ConnectionController({
    statusView: new StatusView(extensionContextStub),
    storageController: testStorageController,
    telemetryService: testTelemetryService,
  });
  let showErrorMessageStub: SinonStub;
  let showInformationMessageStub: SinonStub;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    showInformationMessageStub = sandbox.stub(
      vscode.window,
      'showInformationMessage',
    );
    sandbox.stub(testTelemetryService, 'trackNewConnection');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(async () => {
    // Reset our mock extension's state.
    extensionContextStub._workspaceState = {};
    extensionContextStub._globalState = {};

    testConnectionController.cancelConnectionAttempt();

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    sandbox.restore();
  });

  test('it connects to mongodb', async () => {
    const successfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });
    const connectionId = testConnectionController.getActiveConnectionId() || '';
    const name = testConnectionController._connections[connectionId].name;
    const dataService = testConnectionController.getActiveDataService();

    expect(successfullyConnected).to.be.true;
    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(1);
    expect(name).to.equal('localhost:27088');
    expect(testConnectionController.isCurrentlyConnected()).to.be.true;

    expect(dataService).to.not.be.null;
  });

  suite('with Atlas connections', function () {
    beforeEach(() => {
      // Simulate Atlas URI
      sandbox.stub(getBuildInfo, 'isAtlas').returns(true);
    });

    test('should append appName with connection and anonymous id', async () => {
      const successfullyConnected =
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
      const connectionId =
        testConnectionController.getActiveConnectionId() || '';
      const connection = testConnectionController._connections[connectionId];

      expect(successfullyConnected).to.be.true;
      expect(testConnectionController.getSavedConnections()).to.have.lengthOf(
        1,
      );
      expect(connection.name).to.equal('localhost:27088');
      expect(testConnectionController.isCurrentlyConnected()).to.be.true;

      // The stored connection string should not have the appName appended
      expect(connection.connectionOptions.connectionString).equals(
        `${TEST_DATABASE_URI}/`,
      );
      // But the active connection should
      expect(testConnectionController.getActiveConnectionString()).equals(
        `${TEST_DATABASE_URI}/?appName=mongodb-vscode+${version}`,
      );
    });

    test('should override legacy appended appName and persist it', async () => {
      // Simulate legacy behavior of appending vscode appName by manually creating one
      const successfullyConnected =
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: `${TEST_DATABASE_URI}/?appname=mongodb-vscode+9.9.9`,
        });

      const connectionId =
        testConnectionController.getActiveConnectionId() || '';
      let connection = testConnectionController._connections[connectionId];

      expect(successfullyConnected).to.be.true;

      await testConnectionController.disconnect();

      // Re-connect to the new connection and let it remove the appName
      await testConnectionController.connectWithConnectionId(connectionId);

      // Reload connection from storage
      await testConnectionController.loadSavedConnections();
      connection = testConnectionController._connections[connectionId];
      expect(connection.connectionOptions.connectionString).equals(
        `${TEST_DATABASE_URI}/`,
      );

      // The stored connection string should not have the appName appended
      expect(connection.connectionOptions.connectionString).equals(
        `${TEST_DATABASE_URI}/`,
      );
      // But the active connection should
      expect(testConnectionController.getActiveConnectionString()).equals(
        `${TEST_DATABASE_URI}/?appName=mongodb-vscode+${version}`,
      );
    });

    test('does not override other user-set appName', async () => {
      const successfullyConnected =
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: `${TEST_DATABASE_URI}/?appName=test-123+9.9.9`,
        });
      const connectionId =
        testConnectionController.getActiveConnectionId() || '';
      let connection = testConnectionController._connections[connectionId];

      expect(successfullyConnected).to.be.true;

      expect(connection.connectionOptions.connectionString).equals(
        `${TEST_DATABASE_URI}/?appName=test-123+9.9.9`,
      );
      expect(testConnectionController.getActiveConnectionString()).equals(
        `${TEST_DATABASE_URI}/?appName=test-123+9.9.9`,
      );

      // Reconnect
      await testConnectionController.disconnect();
      await testConnectionController.connectWithConnectionId(connectionId);

      // Reload connection from storage
      await testConnectionController.loadSavedConnections();
      connection = testConnectionController._connections[connectionId];

      expect(connection.connectionOptions.connectionString).equals(
        `${TEST_DATABASE_URI}/?appName=test-123+9.9.9`,
      );
      expect(testConnectionController.getActiveConnectionString()).equals(
        `${TEST_DATABASE_URI}/?appName=test-123+9.9.9`,
      );
    });

    test('getMongoClientConnectionOptions does not append anonymous and connection ID to non-atlas connections', async function () {
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

      const mongoClientConnectionOptions =
        testConnectionController.getMongoClientConnectionOptions();

      expect(mongoClientConnectionOptions).to.not.be.undefined;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      delete mongoClientConnectionOptions!.options.parentHandle;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      delete mongoClientConnectionOptions!.options.oidc?.openBrowser;

      expect(mongoClientConnectionOptions).to.deep.equal({
        url: `mongodb://localhost:27088/?appName=mongodb-vscode+${version}`,
        options: {
          autoEncryption: undefined,
          monitorCommands: true,
          applyProxyToOIDC: {},
          authMechanismProperties: {},
          oidc: {},
          productDocsLink:
            'https://docs.mongodb.com/mongodb-vscode/?utm_source=vscode&utm_medium=product',
          productName: 'mongodb-vscode',
        },
      });
    });
  });

  test('"disconnect()" disconnects from the active connection', async () => {
    const successfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

    expect(successfullyConnected).to.be.true;
    expect(testConnectionController.getConnectionStatus()).to.equal(
      'CONNECTED',
    );

    const successfullyDisconnected =
      await testConnectionController.disconnect();

    // Disconnecting should keep the connection contract, just disconnected.
    const connectionsCount =
      testConnectionController.getSavedConnections().length;
    const connectionId = testConnectionController.getActiveConnectionId();
    const dataService = testConnectionController.getActiveDataService();

    expect(testConnectionController.getConnectionStatus()).to.equal(
      'DISCONNECTED',
    );
    expect(successfullyDisconnected).to.be.true;
    expect(connectionsCount).to.equal(1);
    expect(connectionId).to.be.null;
    expect(testConnectionController.isCurrentlyConnected()).to.be.false;
    expect(dataService).to.be.null;
  });

  suite('onRemoveMongoDBConnection', () => {
    const addConnection = (
      id: string,
      name: string,
      connectionString = 'mongodb://localhost:12345',
      otherOptions: Partial<LoadedConnection> = {},
    ): void => {
      testConnectionController._connections[id] = {
        connectionOptions: { connectionString },
        storageLocation: StorageLocation.NONE,
        secretStorageLocation: SecretStorageLocation.SecretStorage,
        name,
        id,
        ...otherOptions,
      };
    };

    test('returns a reject promise when there is no active connection', async () => {
      const expectedMessage = 'No connections to remove.';
      const successfullyRemovedMongoDBConnection =
        await testConnectionController.onRemoveMongoDBConnection();

      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
      expect(successfullyRemovedMongoDBConnection).to.be.false;
    });

    test('hides preset connections', async () => {
      addConnection('1234', 'valid 1');
      addConnection('5678', 'valid 2', undefined, { source: 'user' });
      addConnection('3333', 'invalid 1', undefined, {
        source: 'workspaceSettings',
      });
      addConnection('4444', 'invalid 2', undefined, {
        source: 'globalSettings',
      });

      const showQuickPickStub = sinon
        .stub(vscode.window, 'showQuickPick')
        .resolves(undefined);
      const successfullyRemovedMongoDBConnection =
        await testConnectionController.onRemoveMongoDBConnection();

      expect(showErrorMessageStub).not.called;
      expect(showQuickPickStub.firstCall.firstArg).deep.equal([
        '1: valid 1',
        '2: valid 2',
      ]);
      expect(successfullyRemovedMongoDBConnection).to.be.false;
    });

    test('when connection does not exist, shows error', async () => {
      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          id: 'abc',
        });
      expect(didRemove).to.be.false;
      expect(showErrorMessageStub).to.be.calledOnceWith(
        'Connection does not exist.',
      );
    });

    test('when force: false, prompts user for confirmation', async () => {
      addConnection('1234', 'foo');
      showInformationMessageStub.resolves('No');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          id: '1234',
        });

      expect(didRemove).to.be.false;
      expect(showInformationMessageStub).to.be.calledOnceWith(
        'Are you sure to want to remove connection foo?',
        { modal: true },
        'Yes',
      );
    });

    test('when force: true, does not prompt user for confirmation', async () => {
      addConnection('1234', 'foo');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          id: '1234',
          force: true,
        });

      expect(didRemove).to.be.true;
      expect(testConnectionController._connections['1234']).to.be.undefined;
    });

    test('with connection name, removes connection', async () => {
      addConnection('1234', 'bar');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          name: 'bar',
          force: true,
        });

      expect(didRemove).to.be.true;
      expect(testConnectionController._connections['1234']).to.be.undefined;
    });

    test('with connection name, when not found, silently returns', async () => {
      addConnection('1234', 'bar');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          name: 'foo',
          force: true,
        });

      expect(didRemove).to.be.false;
      expect(showInformationMessageStub).to.not.have.been.called;
      expect(testConnectionController._connections['1234']).to.not.be.undefined;
    });

    test('with connection name, when multiple connections match, removes first one', async () => {
      addConnection('1234', 'bar');
      addConnection('5678', 'bar');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          name: 'bar',
          force: true,
        });

      expect(didRemove).to.be.true;
      expect(testConnectionController._connections['1234']).to.be.undefined;
      expect(testConnectionController._connections['5678']).to.not.be.undefined;
    });

    test('with connection string, removes connection', async () => {
      addConnection('1234', 'bar', 'mongodb://localhost:12345');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          connectionString: 'mongodb://localhost:12345',
          force: true,
        });

      expect(didRemove).to.be.true;
      expect(testConnectionController._connections['1234']).to.be.undefined;
    });

    test('with connection name, when not found, silently returns', async () => {
      addConnection('1234', 'bar', 'mongodb://localhost:12345');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          connectionString: 'mongodb://localhost:27017',
          force: true,
        });

      expect(didRemove).to.be.false;
      expect(showInformationMessageStub).to.not.have.been.called;
      expect(testConnectionController._connections['1234']).to.not.be.undefined;
    });

    test('with connection name, when multiple connections match, removes first one', async () => {
      addConnection('1234', 'foo', 'mongodb://localhost:12345');
      addConnection('5678', 'bar', 'mongodb://localhost:12345');

      const didRemove =
        await testConnectionController.onRemoveMongoDBConnection({
          connectionString: 'mongodb://localhost:12345',
          force: true,
        });

      expect(didRemove).to.be.true;
      expect(testConnectionController._connections['1234']).to.be.undefined;
      expect(testConnectionController._connections['5678']).to.not.be.undefined;
    });
  });

  test('when adding a new connection it disconnects from the current connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

    expect(succesfullyConnected).to.be.true;

    try {
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: testDatabaseURI2WithTimeout,
      });
    } catch (error) {
      const expectedError = 'Failed to connect';

      expect(formatError(error).message).includes(expectedError);
      expect(testConnectionController.getActiveDataService()).to.be.null;
      expect(testConnectionController.getActiveConnectionId()).to.be.null;
    }
  });

  test('when adding a new connection it sets the connection controller as connecting while it disconnects from the current connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

    expect(succesfullyConnected).to.be.true;

    let wasSetToConnectingWhenDisconnecting = false;
    sandbox.replace(testConnectionController, 'disconnect', () => {
      wasSetToConnectingWhenDisconnecting = true;

      return Promise.resolve(true);
    });

    const succesfullyConnected2 =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

    expect(succesfullyConnected2).to.be.true;
    expect(wasSetToConnectingWhenDisconnecting).to.be.true;
  });

  test('"connect()" should fire the connections did change event the expected number of types', async () => {
    // The number of times we expect to re-render connections on the sidebar:
    // - connection attempt started
    // - connection attempt finished
    const expectedTimesToFire = 2;
    let connectionsDidChangeEventFiredCount = 0;

    testConnectionController.addEventListener('CONNECTIONS_DID_CHANGE', () => {
      connectionsDidChangeEventFiredCount++;
    });

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    testConnectionController.removeEventListener(
      'CONNECTIONS_DID_CHANGE',
      () => {},
    );

    expect(connectionsDidChangeEventFiredCount).to.equal(expectedTimesToFire);
  });

  test('"connect()" then "disconnect()" should fire the connections did change event the expected number of types', async () => {
    // The number of times we expect to re-render connections on the sidebar:
    // - connection attempt started
    // - connection attempt finished
    // - disconnect from our call in the tests
    // - disconnect from on('close') listener on DataService that gets called as
    //   a result of our disconnect call
    const expectedTimesToFire = 4;
    let connectionsDidChangeEventFiredCount = 0;

    testConnectionController.addEventListener('CONNECTIONS_DID_CHANGE', () => {
      connectionsDidChangeEventFiredCount++;
    });

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.disconnect();

    testConnectionController.removeEventListener(
      'CONNECTIONS_DID_CHANGE',
      () => {},
    );

    expect(connectionsDidChangeEventFiredCount).to.equal(expectedTimesToFire);
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(0);
  });

  test('clears connections when loading saved connections', async () => {
    // This might happen if i.e. one defines a preset connection and then deletes it.
    // In that case we'd have defined this connection but there was never a follow up
    // delete event to clear it. So on reload we need to start from a clean slate.
    testConnectionController._connections['1234'] = {
      id: '1234',
      name: 'orphan',
      connectionOptions: {
        connectionString: 'localhost:3000',
      },
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    // Should persist as this is a saved connection.
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(1);
    expect(testConnectionController._connections['1234']).to.be.undefined;
  });

  test('the connection model loads both global and workspace stored connection models', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocation.GLOBAL);
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController._connections;

    expect(Object.keys(connections)).to.have.lengthOf(4);
    expect(connections[Object.keys(connections)[0]].name).to.equal(
      'localhost:27088',
    );
    expect(
      connections[Object.keys(connections)[2]].connectionOptions
        ?.connectionString,
    ).to.equal('mongodb://localhost:27088/');
  });

  test('when a connection is added it is saved to the global storage', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocation.GLOBAL);
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const globalStoreConnections = testStorageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );

    expect(Object.keys(globalStoreConnections)).to.have.lengthOf(1);

    const id = Object.keys(globalStoreConnections)[0];

    expect(globalStoreConnections[id].name).to.equal(
      testDatabaseConnectionName,
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
    );

    expect(workspaceStoreConnections).to.be.undefined;
  });

  test('when a connection is added it is saved to the workspace store', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(Object.keys(workspaceStoreConnections)).to.have.lengthOf(1);

    const id = Object.keys(workspaceStoreConnections)[0];

    expect(workspaceStoreConnections[id].name).to.equal(
      testDatabaseConnectionName,
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );

    expect(globalStoreConnections).to.be.undefined;
  });

  test('a connection can be connected to by id', async () => {
    testConnectionController._connections = {
      '25': {
        id: '25',
        name: 'tester',
        connectionOptions: { connectionString: TEST_DATABASE_URI },
        storageLocation: StorageLocation.NONE,
        secretStorageLocation: SecretStorageLocation.SecretStorage,
      },
    };

    const connectionResult =
      await testConnectionController.connectWithConnectionId('25');

    expect(connectionResult.successfullyConnected).to.be.true;
    expect(testConnectionController.getActiveConnectionId()).to.equal('25');
  });

  test('a saved connection can be loaded and connected to workspace store', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(Object.keys(workspaceStoreConnections)).to.have.lengthOf(1);

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(0);

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(1);

    const id = testConnectionController.getSavedConnections()[0].id;

    await testConnectionController.connectWithConnectionId(id);

    const activeId = testConnectionController.getActiveConnectionId();
    const name = testConnectionController._connections[activeId || ''].name;

    expect(activeId).to.equal(id);
    expect(name).to.equal('localhost:27088');
  });

  test('"copyConnectionStringByConnectionId" returns the driver uri of a connection', async () => {
    const expectedDriverUrl = 'mongodb://localhost:27088/';

    await testConnectionController.loadSavedConnections();
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const activeConnectionId = testConnectionController.getActiveConnectionId();

    expect(activeConnectionId).to.not.be.null;

    const testDriverUrl =
      testConnectionController.copyConnectionStringByConnectionId(
        activeConnectionId || '',
      );

    expect(testDriverUrl).to.equal(expectedDriverUrl);
  });

  test('when a connection is added and the user has set it to not save on default it is not saved', async () => {
    await testConnectionController.loadSavedConnections();

    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.SESSION_ONLY,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const objectString = JSON.stringify(undefined);
    const globalStoreConnections = testStorageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );

    expect(JSON.stringify(globalStoreConnections)).to.equal(objectString);

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(JSON.stringify(workspaceStoreConnections)).to.equal(objectString);
  });

  test('getNotifyDeviceFlowForConnectionAttempt returns a function that shows a message with the url when oidc is set', function () {
    const expectedUndefinedDeviceFlow = getNotifyDeviceFlowForConnectionAttempt(
      {
        connectionString: TEST_DATABASE_URI,
      },
    );

    expect(expectedUndefinedDeviceFlow).to.be.undefined;

    const oidcConnectionString = new ConnectionString(TEST_DATABASE_URI);
    oidcConnectionString.searchParams.set('authMechanism', 'MONGODB-OIDC');

    const expectedFunction = getNotifyDeviceFlowForConnectionAttempt({
      connectionString: oidcConnectionString.toString(),
    });
    expect(expectedFunction).to.not.be.undefined;
    expect(showInformationMessageStub.called).to.be.false;

    (
      expectedFunction as (deviceFlowInformation: {
        verificationUrl: string;
        userCode: string;
      }) => void
    )({
      verificationUrl: 'test123',
      userCode: 'testabc',
    });

    expect(showInformationMessageStub.called).to.be.true;
    expect(showInformationMessageStub.firstCall.args[0]).to.include('test123');
    expect(showInformationMessageStub.firstCall.args[0]).to.include('testabc');
  });

  test('when a connection is removed it is also removed from workspace store', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(Object.keys(workspaceStoreConnections)).to.have.lengthOf(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';

    await testConnectionController.disconnect();
    await testConnectionController.removeSavedConnection(connectionId);

    const postWorkspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(Object.keys(postWorkspaceStoreConnections)).to.have.lengthOf(0);
  });

  test('when a connection is removed it is also removed from global storage', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocation.GLOBAL);
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const globalStoreConnections = testStorageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );

    expect(Object.keys(globalStoreConnections)).to.have.lengthOf(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';
    await testConnectionController.removeSavedConnection(connectionId);

    const postGlobalStoreConnections = testStorageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );

    expect(Object.keys(postGlobalStoreConnections)).to.have.lengthOf(0);
  });

  test('when a connection is removed, the secrets for that connection are also removed', async () => {
    const secretStorageDeleteSpy = sandbox.spy(
      testStorageController,
      'deleteSecret',
    );

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI_USER,
    });

    const [connection] = testConnectionController.getSavedConnections();
    await testConnectionController.removeSavedConnection(connection.id);
    expect(secretStorageDeleteSpy.calledOnce).to.be.true;
  });

  test('a saved to workspace connection can be renamed and loaded', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(Object.keys(workspaceStoreConnections)).to.have.lengthOf(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'zz';

    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves('new connection name');
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    const renameSuccess =
      await testConnectionController.renameConnection(connectionId);

    expect(renameSuccess).to.be.true;

    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(0);

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(1);

    const id = testConnectionController.getSavedConnections()[0].id;
    const name = testConnectionController._connections[id || 'x'].name;

    expect(name, 'new connection name');
  });

  test('a saved to workspace connection can be updated and loaded', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const workspaceStoreConnections = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );

    expect(Object.keys(workspaceStoreConnections)).to.have.lengthOf(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'zz';

    const updatedConnectionString = new ConnectionString(TEST_DATABASE_URI);
    updatedConnectionString.searchParams.set('connectTimeoutMS', '5000');
    const updateSuccess =
      await testConnectionController.updateConnectionAndConnect({
        connectionId,
        connectionOptions: {
          connectionString: updatedConnectionString.toString(),
        },
      });

    expect(updateSuccess.successfullyConnected).to.be.true;

    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(0);

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections()).to.have.lengthOf(1);

    const id = testConnectionController.getSavedConnections()[0].id;
    const connectTimeoutMS = new ConnectionString(
      testConnectionController.getSavedConnections()[0].connectionOptions.connectionString,
    ).searchParams.get('connectTimeoutMS');
    const name = testConnectionController._connections[id || 'x'].name;

    expect(name).to.equal('localhost:27088');
    // Ensure it's updated.
    expect(connectTimeoutMS).to.equal('5000');
  });

  test('close connection string input calls to cancel the cancellation token', function (done) {
    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.callsFake(() => {
      try {
        const cancellationToken = inputBoxResolvesStub.firstCall.args[1];
        expect(cancellationToken.isCancellationRequested).to.be.false;

        testConnectionController.closeConnectionStringInput();

        expect(cancellationToken.isCancellationRequested).to.be.true;
      } catch (err) {
        done(err);
      }

      done();
    });
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    void testConnectionController.connectWithURI();
  });

  test('ConnectionQuickPicks workspace connections list is displayed in the alphanumerical case insensitive order', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.WORKSPACE,
      );
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController._connections;
    const connectionIds = Object.keys(connections);

    expect(connectionIds).to.have.lengthOf(2);
    expect(connections[connectionIds[0]].name).to.equal('localhost:27088');
    expect(connections[connectionIds[1]].name).to.equal('localhost:27088');

    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves('Lynx');
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionIds[0],
    );

    expect(renameSuccess).to.be.true;

    await testConnectionController.loadSavedConnections();

    expect(connectionIds).to.have.lengthOf(2);

    const connectionQuickPicks =
      testConnectionController.getConnectionQuickPicks();

    expect(connectionQuickPicks).to.have.lengthOf(3);
    expect(connectionQuickPicks[0].label).to.equal('Add new connection');
    expect(connectionQuickPicks[1].label).to.equal('localhost:27088');
    expect(connectionQuickPicks[2].label).to.equal('Lynx');
  });

  suite('connecting to a new connection when already connecting', () => {
    test('connects to the new connection', async () => {
      await Promise.all([
        testConnectionController.addNewConnectionStringAndConnect({
          connectionString: testDatabaseURI2WithTimeout,
        }),
        testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        }),
      ]);

      expect(testConnectionController.isConnecting()).to.be.false;

      expect(testConnectionController.isCurrentlyConnected()).to.be.true;
      expect(testConnectionController.getActiveConnectionName()).to.equal(
        'localhost:27088',
      );
    });

    test('it only connects to the most recent connection attempt', async () => {
      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        testConnectionController._connections[id] = {
          id,
          name: `test${i}`,
          connectionOptions: { connectionString: TEST_DATABASE_URI },
          storageLocation: StorageLocation.NONE,
          secretStorageLocation: SecretStorageLocation.SecretStorage,
        };
      }

      const connectPromises: Promise<unknown>[] = [];
      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        connectPromises.push(
          testConnectionController.connectWithConnectionId(id),
        );
      }

      // Ensure the connections complete.
      await Promise.all(connectPromises);

      expect(testConnectionController.isConnecting()).to.be.false;
      expect(testConnectionController.isCurrentlyConnected()).to.be.true;
      expect(testConnectionController.getActiveConnectionName()).to.equal(
        'test4',
      );
    });
  });

  suite('when connected', function () {
    beforeEach(async function () {
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });
    });

    test('two disconnects on one connection at once complete without erroring', (done) => {
      let disconnectsCompleted = 0;
      async function disconnect(): Promise<void> {
        try {
          await testConnectionController.disconnect();

          ++disconnectsCompleted;
          if (disconnectsCompleted === 2) {
            expect(testConnectionController.isCurrentlyConnected()).to.be.false;
            expect(testConnectionController.getActiveDataService()).to.equal(
              null,
            );

            done();
          }
        } catch (err) {
          return done(err);
        }
      }

      void disconnect();
      void disconnect();
    });
  });

  test('a connection which fails can be removed while it is being connected to', async () => {
    const connectionId = 'skateboard';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionOptions: { connectionString: testDatabaseURI2WithTimeout },
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    void testConnectionController.connectWithConnectionId(connectionId);

    expect(testConnectionController.isConnecting()).to.be.true;
    expect(testConnectionController.getConnectionStatus()).to.equal(
      'CONNECTING',
    );

    await testConnectionController.removeSavedConnection(connectionId);

    // Check that it's removed.
    expect(testConnectionController.isConnecting()).to.be.false;
    expect(testConnectionController._connections[connectionId]).to.be.undefined;
  });

  test('a successfully connecting connection can be removed while it is being connected to', async () => {
    const connectionId = 'skateboard2';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionOptions: { connectionString: TEST_DATABASE_URI },
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    sandbox.replace(
      mongodbDataService,
      'connect',
      async (connectionOptions) => {
        await sleep(50);

        expect(testConnectionController.isConnecting()).to.be.true;

        return mongodbDataService.connect({
          connectionOptions: connectionOptions.connectionOptions,
        });
      },
    );

    await Promise.all([
      testConnectionController.connectWithConnectionId(connectionId),

      testConnectionController.removeSavedConnection(connectionId),
    ]);

    expect(testConnectionController.isCurrentlyConnected()).to.be.false;
  });

  test('_getConnectionInfoWithSecrets returns the connection info with secrets', async () => {
    const connectionInfo = {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: StorageLocation.GLOBAL,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: {
        connectionString:
          'mongodb://lena:secrer@localhost:27017/?readPreference=primary&ssl=false',
      },
    };
    await testConnectionController._connectionStorage._saveConnectionToStore(
      connectionInfo,
    );
    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController.getSavedConnections();
    expect(connections).to.have.lengthOf(1);

    const newSavedConnectionInfoWithSecrets =
      await testConnectionController._connectionStorage._getConnectionInfoWithSecrets(
        connections[0],
      );
    expect(newSavedConnectionInfoWithSecrets).to.deep.equal(connectionInfo);
  });

  test('getMongoClientConnectionOptions returns url and options properties', async () => {
    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const mongoClientConnectionOptions =
      testConnectionController.getMongoClientConnectionOptions();

    expect(mongoClientConnectionOptions).to.not.be.undefined;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    delete mongoClientConnectionOptions!.options.parentHandle;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    delete mongoClientConnectionOptions!.options.oidc?.openBrowser;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expectedVersion = require('../../../package.json').version;
    expect(mongoClientConnectionOptions).to.deep.equal({
      url: `mongodb://localhost:27088/?appName=mongodb-vscode+${expectedVersion}`,
      options: {
        autoEncryption: undefined,
        monitorCommands: true,
        applyProxyToOIDC: {},
        authMechanismProperties: {},
        oidc: {},
        productDocsLink:
          'https://docs.mongodb.com/mongodb-vscode/?utm_source=vscode&utm_medium=product',
        productName: 'mongodb-vscode',
      },
    });
  });

  test('_getConnectionStringWithProxy returns string with proxy options', () => {
    const expectedConnectionStringWithProxy = `mongodb://localhost:27088/?appName=mongodb-vscode+${version}&proxyHost=localhost&proxyPassword=gwce7tr8733ujbr&proxyPort=3378&proxyUsername=test`;
    const connectionString =
      testConnectionController._getConnectionStringWithProxy({
        url: `mongodb://localhost:27088/?appName=mongodb-vscode+${version}`,
        options: {
          proxyHost: 'localhost',
          proxyPassword: 'gwce7tr8733ujbr',
          proxyPort: 3378,
          proxyUsername: 'test',
        },
      });
    expect(connectionString).to.equal(expectedConnectionStringWithProxy);
  });

  suite('loadSavedConnections', () => {
    const extensionSandbox = sinon.createSandbox();
    const testSandbox = sinon.createSandbox();

    beforeEach(() => {
      // To fake a successful auth connection
      testSandbox.replace(
        testConnectionController,
        '_connect',
        testSandbox.stub().resolves({ successfullyConnected: true }),
      );
    });

    afterEach(() => {
      testSandbox.restore();
      extensionSandbox.restore();
    });

    suite('when connection secrets are already in SecretStorage', () => {
      test('should be able to load connection with its secrets', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
        });

        // By default the connection secrets are already stored in SecretStorage
        const savedConnections = testConnectionController.getSavedConnections();
        expect(
          savedConnections.every(
            ({ secretStorageLocation }) =>
              secretStorageLocation === SecretStorageLocation.SecretStorage,
          ),
        ).to.be.true;

        await testConnectionController.disconnect();
        testConnectionController.clearAllConnections();

        await testConnectionController.loadSavedConnections();
        const savedConnectionsAfterFreshLoad =
          testConnectionController.getSavedConnections();
        expect(savedConnections).to.deep.equal(
          testConnectionController.getSavedConnections(),
        );

        // Additionally make sure that we are retrieving secrets properly
        expect(
          savedConnectionsAfterFreshLoad[1].connectionOptions?.connectionString,
        ).to.include(TEST_USER_PASSWORD);
      });
    });

    test('should fire a CONNECTIONS_DID_CHANGE event if connections are loaded successfully', async () => {
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI_USER,
      });

      await testConnectionController.disconnect();
      testConnectionController.clearAllConnections();

      let isConnectionChanged = false;
      testConnectionController.addEventListener(
        'CONNECTIONS_DID_CHANGE',
        () => {
          isConnectionChanged = true;
        },
      );

      await testConnectionController.loadSavedConnections();

      testConnectionController.removeEventListener(
        'CONNECTIONS_DID_CHANGE',
        () => {},
      );

      expect(isConnectionChanged).to.be.true;
    });

    test('should ignore older unsupported secrets', async () => {
      const loadedConnection = {
        id: 'random-connection-4',
        name: 'localhost:27089',
        storageLocation: 'GLOBAL',
        secretStorageLocation: SecretStorageLocation.SecretStorage,
        connectionOptions: {
          connectionString:
            'mongodb://localhost:27080/?readPreference=primary&ssl=false',
        },
      };
      testSandbox.replace(testStorageController, 'get', (key, storage) => {
        if (
          storage === StorageLocation.WORKSPACE ||
          key === StorageVariable.WORKSPACE_SAVED_CONNECTIONS
        ) {
          return {};
        }

        return {
          'random-connection-1': {
            id: 'random-connection-1',
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.Keytar,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-2': {
            id: 'random-connection-2',
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.KeytarSecondAttempt,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-3': {
            id: 'random-connection-3',
            name: 'localhost:27088',
            storageLocation: 'GLOBAL',
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27088/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-4': loadedConnection,
        } as any;
      });

      // Clear any connections and load so we get our stubbed connections from above.
      testConnectionController.clearAllConnections();
      await testConnectionController.loadSavedConnections();

      expect(
        Object.keys(testConnectionController._connections).length,
      ).to.equal(1);
      expect(Object.values(testConnectionController._connections)[0]).to.equal(
        loadedConnection,
      );
    });

    test.skip('should track SAVED_CONNECTIONS_LOADED event on load of saved connections', async () => {
      testSandbox.replace(testStorageController, 'get', (key, storage) => {
        if (
          storage === StorageLocation.WORKSPACE ||
          key === StorageVariable.WORKSPACE_SAVED_CONNECTIONS
        ) {
          return {};
        }

        return {
          'random-connection-1': {
            id: 'random-connection-1',
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.SecretStorage,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-2': {
            id: 'random-connection-2',
            name: 'localhost:27088',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.SecretStorage,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27088/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-3': {
            id: 'random-connection-3',
            name: 'localhost:27088',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.Keytar,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27088/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-4': {
            id: 'random-connection-4',
            name: 'localhost:27088',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.KeytarSecondAttempt,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27088/?readPreference=primary&ssl=false',
            },
          },
        } as any;
      });
      testSandbox.replace(
        testConnectionController._connectionStorage,
        '_getConnectionInfoWithSecrets',
        (connectionInfo) => Promise.resolve(connectionInfo as LoadedConnection),
      );
      const trackStub = testSandbox.stub(testTelemetryService, 'track');

      // Clear any connections and load so we get our stubbed connections from above.
      testConnectionController.clearAllConnections();
      await testConnectionController.loadSavedConnections();

      // Load connections tracked. Called once because in the current load of
      // migration there were no errors and hence the error tracking event won't
      // be called.
      expect(trackStub.calledOnce).to.be.true;
      expect(trackStub.lastCall.args).to.deep.equal([
        {
          connections_with_secrets_in_keytar: 2,
          connections_with_secrets_in_SecretStorage: 2,
          saved_connections: 4,
          loaded_connections: 4,
        },
      ]);
    });
  });

  suite('connectWithURI', () => {
    let showInputBoxStub: sinon.SinonStub;
    let addNewConnectionAndConnectStub: sinon.SinonStub;

    beforeEach(() => {
      showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
      addNewConnectionAndConnectStub = sandbox.stub(
        testConnectionController,
        'addNewConnectionStringAndConnect',
      );
    });

    test('without arguments, prompts for input', async () => {
      showInputBoxStub.returns(undefined);

      const result = await testConnectionController.connectWithURI();
      expect(result).to.be.false;
      expect(showInputBoxStub).to.have.been.calledOnce;
    });

    test('without arguments, uses input provided by user', async () => {
      showInputBoxStub.returns(TEST_DATABASE_URI);
      addNewConnectionAndConnectStub.returns(true);

      const result = await testConnectionController.connectWithURI();
      expect(result).to.be.true;
      expect(showInputBoxStub).to.have.been.calledOnce;
      expect(addNewConnectionAndConnectStub).to.have.been.calledOnceWithExactly(
        {
          connectionString: TEST_DATABASE_URI,
          reuseExisting: false,
          name: undefined,
        },
      );
    });

    test('with arguments, uses provided connection string', async () => {
      addNewConnectionAndConnectStub.returns(true);

      const result = await testConnectionController.connectWithURI({
        connectionString: 'mongodb://127.0.0.1:12345',
        reuseExisting: true,
        name: 'foo',
      });
      expect(result).to.be.true;
      expect(showInputBoxStub).to.not.have.been.called;
      expect(addNewConnectionAndConnectStub).to.have.been.calledOnceWithExactly(
        {
          connectionString: 'mongodb://127.0.0.1:12345',
          reuseExisting: true,
          name: 'foo',
        },
      );
    });
  });

  suite('addNewConnectionStringAndConnect', () => {
    let fakeConnect: sinon.SinonStub;

    beforeEach(() => {
      fakeConnect = sandbox
        .stub(testConnectionController, '_connect')
        .resolves({ successfullyConnected: true, connectionErrorMessage: '' });
    });

    test('saves connection without secrets to the global storage', async () => {
      await vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update(
          'defaultConnectionSavingLocation',
          DefaultSavingLocation.GLOBAL,
        );
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI_USER,
      });

      const workspaceStoreConnections = testStorageController.get(
        StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      );

      expect(workspaceStoreConnections).to.not.be.empty;
      const connections = Object.values(workspaceStoreConnections);

      expect(connections).to.have.lengthOf(1);
      expect(connections[0].connectionOptions?.connectionString).to.include(
        TEST_USER_USERNAME,
      );
      expect(connections[0].connectionOptions?.connectionString).to.not.include(
        TEST_USER_PASSWORD,
      );
      expect(
        testConnectionController._connections[connections[0].id]
          .connectionOptions?.connectionString,
      ).to.include(TEST_USER_PASSWORD);
      expect(
        testConnectionController._connections[connections[0].id].name,
      ).to.equal('localhost:27088');
    });

    suite('with reuseExisting: ', () => {
      test('false, adds a new connection', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
          name: 'foo',
          reuseExisting: false,
        });

        expect(testConnectionController.getSavedConnections()).to.have.lengthOf(
          1,
        );

        expect(fakeConnect).to.have.been.calledOnce;

        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
          name: 'foo',
          reuseExisting: false,
        });

        expect(testConnectionController.getSavedConnections()).to.have.lengthOf(
          2,
        );
        expect(fakeConnect).to.have.been.calledTwice;
        expect(showInformationMessageStub).to.not.have.been.called;
      });

      test('true, reuses existing connection', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
          name: 'foo',
          reuseExisting: true,
        });

        expect(testConnectionController.getSavedConnections()).to.have.lengthOf(
          1,
        );

        expect(fakeConnect).to.have.been.calledOnce;
        expect(showInformationMessageStub).to.not.have.been.called; // First time we're adding this connection

        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
          name: 'foo',
          reuseExisting: true,
        });

        expect(testConnectionController.getSavedConnections()).to.have.lengthOf(
          1,
        );
        expect(fakeConnect).to.have.been.calledTwice;

        // Adding a connection with the same connection string and name should not show a message
        expect(showInformationMessageStub).to.not.have.been.called;
      });

      test('true, does not override existing connection name', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
          name: 'foo',
          reuseExisting: true,
        });

        let connections = testConnectionController.getSavedConnections();
        expect(connections).to.have.lengthOf(1);
        expect(connections[0].name).to.equal('foo');
        expect(showInformationMessageStub).to.not.have.been.called; // First time we're adding this connection

        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI_USER,
          name: 'bar',
          reuseExisting: true,
        });

        connections = testConnectionController.getSavedConnections();
        expect(connections).to.have.lengthOf(1);
        expect(connections[0].name).to.equal('foo'); // not 'bar'

        // Connecting with a different name should show a message
        expect(showInformationMessageStub).to.have.been.calledOnceWith(
          "Connection with the same connection string already exists, under a different name: 'foo'. Connecting to the existing one...",
        );
      });

      test('true, matches connection regardless of trailing slash', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: 'mongodb://localhost:12345/',
          reuseExisting: true,
        });

        let connections = testConnectionController.getSavedConnections();
        expect(connections[0].connectionOptions?.connectionString).to.equal(
          'mongodb://localhost:12345/',
        );

        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: 'mongodb://localhost:12345/',
          reuseExisting: true,
        });
        expect(fakeConnect).to.have.been.calledWith(
          connections[0].id,
          ConnectionType.CONNECTION_ID,
        );
        connections = testConnectionController.getSavedConnections();
        expect(connections).to.have.lengthOf(1);

        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: 'mongodb://localhost:12345', // No-slash
          reuseExisting: true,
        });
        expect(fakeConnect).to.have.been.calledWith(connections[0].id);
        connections = testConnectionController.getSavedConnections();
        expect(connections).to.have.lengthOf(1);
      });
    });

    suite('with name: ', () => {
      test('supplied, uses provided name', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: 'mongodb://localhost:12345/',
          name: 'foo',
        });

        const connections = testConnectionController.getSavedConnections();
        expect(connections).to.have.lengthOf(1);
        expect(connections[0].name).to.equal('foo');
      });

      test('not supplied, generates one', async () => {
        await testConnectionController.addNewConnectionStringAndConnect({
          connectionString: 'mongodb://localhost:12345/',
        });

        const connections = testConnectionController.getSavedConnections();
        expect(connections).to.have.lengthOf(1);
        expect(connections[0].name).to.equal('localhost:12345');
      });
    });
  });
});
