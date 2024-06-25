import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import util from 'util';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import * as mongodbDataService from 'mongodb-data-service';
import { expect } from 'chai';
import ConnectionString from 'mongodb-connection-string-url';

import ConnectionController, {
  DataServiceEventTypes,
  getNotifyDeviceFlowForConnectionAttempt,
} from '../../connectionController';
import formatError from '../../utils/formatError';
import { StorageController, StorageVariables } from '../../storage';
import {
  StorageLocation,
  DefaultSavingLocations,
  SecretStorageLocation,
} from '../../storage/storageController';
import { StatusView } from '../../views';
import TelemetryService from '../../telemetry/telemetryService';
import { ExtensionContextStub } from './stubs';
import {
  TEST_DATABASE_URI,
  TEST_DATABASE_URI_USER,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} from './dbTestHelper';
import type { LoadedConnection } from '../../storage/connectionStorage';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json');

const testDatabaseConnectionName = 'localhost:27088';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

const sleep = (ms: number): Promise<void> => {
  return util.promisify(setTimeout)(ms);
};

suite('Connection Controller Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
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
      'showInformationMessage'
    );
    sandbox.stub(testTelemetryService, 'trackNewConnection');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(async () => {
    // Reset our mock extension's state.
    extensionContextStub._workspaceState = {};
    extensionContextStub._globalState = {};

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    sandbox.restore();
  });

  test('it connects to mongodb', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );
    const connnectionId =
      testConnectionController.getActiveConnectionId() || '';
    const name = testConnectionController._connections[connnectionId].name;
    const dataService = testConnectionController.getActiveDataService();

    expect(succesfullyConnected).to.be.true;
    expect(testConnectionController.getSavedConnections().length).to.equal(1);
    expect(name).to.equal('localhost:27088');
    expect(testConnectionController.isCurrentlyConnected()).to.be.true;

    expect(dataService).to.not.equal(null);
  });

  test('"disconnect()" disconnects from the active connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    expect(succesfullyConnected).to.be.true;
    expect(testConnectionController.getConnectionStatus()).to.equal(
      'CONNECTED'
    );

    const successfullyDisconnected =
      await testConnectionController.disconnect();

    // Disconnecting should keep the connection contract, just disconnected.
    const connectionsCount =
      testConnectionController.getSavedConnections().length;
    const connnectionId = testConnectionController.getActiveConnectionId();
    const dataService = testConnectionController.getActiveDataService();

    expect(testConnectionController.getConnectionStatus()).to.equal(
      'DISCONNECTED'
    );
    expect(successfullyDisconnected).to.be.true;
    expect(connectionsCount).to.equal(1);
    expect(connnectionId).to.equal(null);
    expect(testConnectionController.isCurrentlyConnected()).to.be.false;
    expect(dataService).to.equal(null);
  });

  test('"removeMongoDBConnection()" returns a reject promise when there is no active connection', async () => {
    const expectedMessage = 'No connections to remove.';
    const successfullyRemovedMongoDBConnection =
      await testConnectionController.onRemoveMongoDBConnection();

    expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
    expect(successfullyRemovedMongoDBConnection).to.be.false;
  });

  test('when adding a new connection it disconnects from the current connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    expect(succesfullyConnected).to.be.true;

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI2WithTimeout
      );
    } catch (error) {
      const expectedError = 'Failed to connect';

      expect(formatError(error).message.includes(expectedError)).to.be.true;
      expect(testConnectionController.getActiveDataService()).to.equal(null);
      expect(testConnectionController.getActiveConnectionId()).to.equal(null);
    }
  });

  test('when adding a new connection it sets the connection controller as connecting while it disconnects from the current connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    expect(succesfullyConnected).to.be.true;

    let wasSetToConnectingWhenDisconnecting = false;
    sandbox.replace(testConnectionController, 'disconnect', () => {
      wasSetToConnectingWhenDisconnecting = true;

      return Promise.resolve(true);
    });

    const succesfullyConnected2 =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    expect(succesfullyConnected2).to.be.true;
    expect(wasSetToConnectingWhenDisconnecting).to.be.true;
  });

  test('"connect()" should fire the connections did change event the expected number of types', async () => {
    // The number of times we expect to re-render connections on the sidebar:
    // - connection attempt started
    // - connection attempt finished
    const expectedTimesToFire = 2;
    let connectionsDidChangeEventFiredCount = 0;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        connectionsDidChangeEventFiredCount++;
      }
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    testConnectionController.removeEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {}
    );

    expect(connectionsDidChangeEventFiredCount).to.equal(expectedTimesToFire);
  });

  test('"connect()" then "disconnect()" should fire the connections did change event the expected number of types', async () => {
    // The number of times we expect to re-render connections on the sidebar:
    // - connection attempt started
    // - connection attempt finished
    // - disconnect
    const expectedTimesToFire = 3;
    let connectionsDidChangeEventFiredCount = 0;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        connectionsDidChangeEventFiredCount++;
      }
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.disconnect();

    testConnectionController.removeEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {}
    );

    expect(connectionsDidChangeEventFiredCount).to.equal(expectedTimesToFire);
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections().length).to.equal(0);
  });

  test('the connection model loads both global and workspace stored connection models', async () => {
    const expectedDriverUrl = `mongodb://localhost:27088/?appname=mongodb-vscode+${version}`;

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController._connections;

    expect(Object.keys(connections).length).to.equal(4);
    expect(connections[Object.keys(connections)[0]].name).to.equal(
      'localhost:27088'
    );
    expect(
      connections[Object.keys(connections)[2]].connectionOptions
        ?.connectionString
    ).to.equal(expectedDriverUrl);
  });

  test('when a connection is added it is saved to the global storage', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(globalStoreConnections).length).to.equal(1);

    const id = Object.keys(globalStoreConnections)[0];

    expect(globalStoreConnections[id].name).to.equal(
      testDatabaseConnectionName
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS
    );

    expect(workspaceStoreConnections).to.equal(undefined);
  });

  test('when a connection is added it is saved to the workspace store', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    const id = Object.keys(workspaceStoreConnections)[0];

    expect(workspaceStoreConnections[id].name).to.equal(
      testDatabaseConnectionName
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(globalStoreConnections).to.equal(undefined);
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
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    expect(testConnectionController.getSavedConnections().length).to.equal(0);

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections().length).to.equal(1);

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
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const activeConnectionId = testConnectionController.getActiveConnectionId();

    expect(activeConnectionId).to.not.equal(null);

    const testDriverUrl =
      testConnectionController.copyConnectionStringByConnectionId(
        activeConnectionId || ''
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
        DefaultSavingLocations['Session Only']
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const objectString = JSON.stringify(undefined);
    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(JSON.stringify(globalStoreConnections)).to.equal(objectString);

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(JSON.stringify(workspaceStoreConnections)).to.equal(objectString);
  });

  test('getNotifyDeviceFlowForConnectionAttempt returns a function that shows a message with the url when oidc is set', function () {
    const expectedUndefinedDeviceFlow = getNotifyDeviceFlowForConnectionAttempt(
      {
        connectionString: TEST_DATABASE_URI,
      }
    );

    expect(expectedUndefinedDeviceFlow).to.equal(undefined);

    const oidcConnectionString = new ConnectionString(TEST_DATABASE_URI);
    oidcConnectionString.searchParams.set('authMechanism', 'MONGODB-OIDC');

    const expectedFunction = getNotifyDeviceFlowForConnectionAttempt({
      connectionString: oidcConnectionString.toString(),
    });
    expect(expectedFunction).to.not.equal(undefined);
    expect(showInformationMessageStub.called).to.equal(false);

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
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';

    await testConnectionController.disconnect();
    await testConnectionController.removeSavedConnection(connectionId);

    const postWorkspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(postWorkspaceStoreConnections).length).to.equal(0);
  });

  test('when a connection is removed it is also removed from global storage', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(globalStoreConnections).length).to.equal(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';
    await testConnectionController.removeSavedConnection(connectionId);

    const postGlobalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(postGlobalStoreConnections).length).to.equal(0);
  });

  test('when a connection is removed, the secrets for that connection are also removed', async () => {
    const secretStorageDeleteSpy = sandbox.spy(
      testStorageController,
      'deleteSecret'
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI_USER
    );

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
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'zz';

    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves('new connection name');
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionId
    );

    expect(renameSuccess).to.be.true;

    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    expect(testConnectionController.getSavedConnections().length).to.equal(0);

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections().length).to.equal(1);

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
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

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

    expect(testConnectionController.getSavedConnections().length).to.equal(0);

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    expect(testConnectionController.getSavedConnections().length).to.equal(1);

    const id = testConnectionController.getSavedConnections()[0].id;
    const connectTimeoutMS = new ConnectionString(
      testConnectionController.getSavedConnections()[0].connectionOptions.connectionString
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
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController._connections;
    const connectionIds = Object.keys(connections);

    expect(connectionIds.length).to.equal(2);
    expect(connections[connectionIds[0]].name).to.equal('localhost:27088');
    expect(connections[connectionIds[1]].name).to.equal('localhost:27088');

    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves('Lynx');
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionIds[0]
    );

    expect(renameSuccess).to.be.true;

    await testConnectionController.loadSavedConnections();

    expect(connectionIds.length).to.equal(2);

    const connectionQuickPicks =
      testConnectionController.getConnectionQuickPicks();

    expect(connectionQuickPicks.length).to.equal(3);
    expect(connectionQuickPicks[0].label).to.equal('Add new connection');
    expect(connectionQuickPicks[1].label).to.equal('localhost:27088');
    expect(connectionQuickPicks[2].label).to.equal('Lynx');
  });

  suite('connecting to a new connection when already connecting', () => {
    test('connects to the new connection', async () => {
      await Promise.all([
        testConnectionController.addNewConnectionStringAndConnect(
          testDatabaseURI2WithTimeout
        ),
        testConnectionController.addNewConnectionStringAndConnect(
          TEST_DATABASE_URI
        ),
      ]);

      expect(testConnectionController.isConnecting()).to.be.false;

      expect(testConnectionController.isCurrentlyConnected()).to.be.true;
      expect(testConnectionController.getActiveConnectionName()).to.equal(
        'localhost:27088'
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
          testConnectionController.connectWithConnectionId(id)
        );
      }

      // Ensure the connections complete.
      await Promise.all(connectPromises);

      expect(testConnectionController.isConnecting()).to.be.false;
      expect(testConnectionController.isCurrentlyConnected()).to.be.true;
      expect(testConnectionController.getActiveConnectionName()).to.equal(
        'test4'
      );
    });
  });

  suite('when connected', function () {
    beforeEach(async function () {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );
    });

    test('two disconnects on one connection at once complete without erroring', (done) => {
      let disconnectsCompleted = 0;
      async function disconnect() {
        try {
          await testConnectionController.disconnect();

          ++disconnectsCompleted;
          if (disconnectsCompleted === 2) {
            expect(testConnectionController.isCurrentlyConnected()).to.be.false;
            expect(testConnectionController.getActiveDataService()).to.equal(
              null
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
      'CONNECTING'
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
      }
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
      connectionInfo
    );
    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController.getSavedConnections();
    expect(connections.length).to.equal(1);

    const newSavedConnectionInfoWithSecrets =
      await testConnectionController._connectionStorage._getConnectionInfoWithSecrets(
        connections[0]
      );
    expect(newSavedConnectionInfoWithSecrets).to.deep.equal(connectionInfo);
  });

  test('addNewConnectionStringAndConnect saves connection without secrets to the global storage', async () => {
    const fakeConnect = sandbox.fake.resolves({
      successfullyConnected: true,
    });
    sandbox.replace(testConnectionController, '_connect', fakeConnect);

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI_USER
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );

    expect(workspaceStoreConnections).to.not.be.empty;
    const connections = Object.values(workspaceStoreConnections);

    expect(connections.length).to.equal(1);
    expect(connections[0].connectionOptions?.connectionString).to.include(
      TEST_USER_USERNAME
    );
    expect(connections[0].connectionOptions?.connectionString).to.not.include(
      TEST_USER_PASSWORD
    );
    expect(connections[0].connectionOptions?.connectionString).to.include(
      `appname=mongodb-vscode+${version}`
    );
    expect(
      testConnectionController._connections[connections[0].id].connectionOptions
        ?.connectionString
    ).to.include(TEST_USER_PASSWORD);
    expect(
      testConnectionController._connections[connections[0].id].name
    ).to.equal('localhost:27088');
  });

  test('getMongoClientConnectionOptions returns url and options properties', async () => {
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const mongoClientConnectionOptions =
      testConnectionController.getMongoClientConnectionOptions();

    expect(mongoClientConnectionOptions).to.not.equal(undefined);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    delete mongoClientConnectionOptions!.options.parentHandle;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    delete mongoClientConnectionOptions!.options.oidc?.openBrowser;

    expect(mongoClientConnectionOptions).to.deep.equal({
      url: `mongodb://localhost:27088/?appname=mongodb-vscode+${version}`,
      options: {
        autoEncryption: undefined,
        monitorCommands: true,
        useSystemCA: undefined,
        authMechanismProperties: {},
        oidc: {},
        productDocsLink:
          'https://docs.mongodb.com/mongodb-vscode/?utm_source=vscode&utm_medium=product',
        productName: 'mongodb-vscode',
      },
    });
  });

  test('_getConnectionStringWithProxy returns string with proxy options', () => {
    const expectedConnectionStringWithProxy = `mongodb://localhost:27088/?appname=mongodb-vscode+${version}&proxyHost=localhost&proxyPassword=gwce7tr8733ujbr&proxyPort=3378&proxyUsername=test`;
    const connectionString =
      testConnectionController._getConnectionStringWithProxy({
        url: `mongodb://localhost:27088/?appname=mongodb-vscode+${version}`,
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
        testSandbox.stub().resolves({ successfullyConnected: true })
      );
    });

    afterEach(() => {
      testSandbox.restore();
      extensionSandbox.restore();
    });

    suite('when connection secrets are already in SecretStorage', () => {
      afterEach(() => {
        testSandbox.restore();
      });

      test('should be able to load connection with its secrets', async () => {
        await testConnectionController.addNewConnectionStringAndConnect(
          TEST_DATABASE_URI
        );
        await testConnectionController.addNewConnectionStringAndConnect(
          TEST_DATABASE_URI_USER
        );

        // By default the connection secrets are already stored in SecretStorage
        const savedConnections = testConnectionController.getSavedConnections();
        expect(
          savedConnections.every(
            ({ secretStorageLocation }) =>
              secretStorageLocation === SecretStorageLocation.SecretStorage
          )
        ).to.be.true;

        await testConnectionController.disconnect();
        testConnectionController.clearAllConnections();

        await testConnectionController.loadSavedConnections();
        const savedConnectionsAfterFreshLoad =
          testConnectionController.getSavedConnections();
        expect(savedConnections).to.deep.equal(
          testConnectionController.getSavedConnections()
        );

        // Additionally make sure that we are retrieving secrets properly
        expect(
          savedConnectionsAfterFreshLoad[1].connectionOptions?.connectionString
        ).to.include(TEST_USER_PASSWORD);
      });
    });

    test('should fire a CONNECTIONS_DID_CHANGE event if connections are loaded successfully', async () => {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI_USER
      );

      await testConnectionController.disconnect();
      testConnectionController.clearAllConnections();

      let isConnectionChanged = false;
      testConnectionController.addEventListener(
        DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
        () => {
          isConnectionChanged = true;
        }
      );

      await testConnectionController.loadSavedConnections();

      testConnectionController.removeEventListener(
        DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
        () => {}
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
          key === StorageVariables.WORKSPACE_SAVED_CONNECTIONS
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
        Object.keys(testConnectionController._connections).length
      ).to.equal(1);
      expect(Object.values(testConnectionController._connections)[0]).to.equal(
        loadedConnection
      );
    });

    test.skip('should track SAVED_CONNECTIONS_LOADED event on load of saved connections', async () => {
      testSandbox.replace(testStorageController, 'get', (key, storage) => {
        if (
          storage === StorageLocation.WORKSPACE ||
          key === StorageVariables.WORKSPACE_SAVED_CONNECTIONS
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
        (connectionInfo) => Promise.resolve(connectionInfo as LoadedConnection)
      );
      const trackStub = testSandbox.stub(
        testTelemetryService,
        'trackSavedConnectionsLoaded'
      );

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
          connections_with_secrets_in_secret_storage: 2,
          saved_connections: 4,
          loaded_connections: 4,
        },
      ]);
    });
  });
});
