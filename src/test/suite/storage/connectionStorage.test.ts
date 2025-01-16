import sinon from 'sinon';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import { expect } from 'chai';

import { StorageController, StorageVariables } from '../../../storage';
import {
  StorageLocation,
  DefaultSavingLocations,
  SecretStorageLocation,
} from '../../../storage/storageController';
import { ExtensionContextStub } from '../stubs';
import {
  TEST_DATABASE_URI,
  TEST_DATABASE_URI_USER,
  TEST_USER_PASSWORD,
} from '../dbTestHelper';
import type { LoadedConnection } from '../../../storage/connectionStorage';
import { ConnectionStorage } from '../../../storage/connectionStorage';

const testDatabaseConnectionName = 'localhost:27088';

const newTestConnection = (
  connectionStorage: ConnectionStorage,
  id: string
): LoadedConnection =>
  connectionStorage.createNewConnection({
    connectionId: id,
    connectionOptions: {
      connectionString: TEST_DATABASE_URI,
    },
  });

suite('Connection Storage Test Suite', function () {
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  let testConnectionStorage: ConnectionStorage;

  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    testConnectionStorage = new ConnectionStorage({
      storageController: testStorageController,
    });

    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(function () {
    // Reset our mock extension's state.
    extensionContextStub._workspaceState = {};
    extensionContextStub._globalState = {};

    sandbox.restore();
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    const connections = await testConnectionStorage.loadConnections();

    const connectionsCount = connections.length;

    expect(connectionsCount).to.equal(0);
  });

  test('it loads both global and workspace stored connections', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);

    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '1')
    );
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '2')
    );
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );

    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '3')
    );
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '4')
    );

    const connections = await testConnectionStorage.loadConnections();

    expect(Object.keys(connections).length).to.equal(4);
    expect(connections[Object.keys(connections)[0]].name).to.equal(
      'localhost:27088'
    );
    expect(
      connections[Object.keys(connections)[2]].connectionOptions
        ?.connectionString
    ).to.equal('mongodb://localhost:27088/');
    expect(connections[Object.keys(connections)[2]].id).to.equal('3');
  });

  test('when a connection is added it is saved to the global storage', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);

    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '1')
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
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '1')
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

  test('when a connection is added and the user has set it to not save on default it is not saved', async () => {
    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations['Session Only']
      );
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, '1')
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

  test('when a connection is removed it is also removed from workspace store', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    const connectionId = 'pie';
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, connectionId)
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    await testConnectionStorage.removeConnection(connectionId);

    const postWorkspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    expect(Object.keys(postWorkspaceStoreConnections).length).to.equal(0);
  });

  test('when a connection is removed it is also removed from global storage', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    const connectionId = 'pineapple';
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, connectionId)
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(globalStoreConnections).length).to.equal(1);

    await testConnectionStorage.removeConnection(connectionId);

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

    const connectionId = 'pie';
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, connectionId)
    );

    await testConnectionStorage.removeConnection(connectionId);
    expect(secretStorageDeleteSpy.calledOnce).to.equal(true);
  });

  test('_getConnectionInfoWithSecrets returns undefined for old connections', async () => {
    const oldSavedConnectionInfo = {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: StorageLocation.GLOBAL,
      connectionModel: {
        _id: '4',
        isFavorite: false,
        name: 'Local 4',
        isSrvRecord: false,
        hostname: 'localhost',
        port: 27017,
        hosts: [{ host: 'localhost', port: 27017 }],
        extraOptions: {},
        connectionType: 'NODE_DRIVER',
        authStrategy: 'NONE',
        readPreference: 'primary',
        kerberosCanonicalizeHostname: false,
        sslMethod: 'NONE',
        sshTunnel: 'NONE',
        sshTunnelPort: 22,
      },
    };

    const connectionInfo =
      await testConnectionStorage._getConnectionInfoWithSecrets(
        oldSavedConnectionInfo
      );

    expect(connectionInfo).to.equal(undefined);
  });

  test('_getConnectionInfoWithSecrets returns the connection info with secrets', async () => {
    const connectionInfo = {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: StorageLocation.GLOBAL,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: {
        connectionString:
          'mongodb://localhost:27017/?readPreference=primary&ssl=false',
      },
    };
    await testConnectionStorage._saveConnectionToStore(connectionInfo);
    const connections = await testConnectionStorage.loadConnections();

    expect(connections.length).to.equal(1);

    const newSavedConnectionInfoWithSecrets =
      await testConnectionStorage._getConnectionInfoWithSecrets(connections[0]);

    expect(newSavedConnectionInfoWithSecrets).to.deep.equal(connectionInfo);
  });

  suite('loadConnections', () => {
    const extensionSandbox = sinon.createSandbox();
    const testSandbox = sinon.createSandbox();

    afterEach(() => {
      testSandbox.restore();
      extensionSandbox.restore();
    });

    suite('when there are preset connections', () => {
      const presetConnections = [
        {
          name: 'Preset Connection 1',
          connectionString: 'mongodb://localhost:27017/',
        },
        {
          name: 'Preset Connection 2',
          connectionString: 'mongodb://localhost:27018/',
        },
      ];

      let getConfigurationStub: sinon.SinonStub<
        [
          section?: string | undefined,
          scope?: vscode.ConfigurationScope | null | undefined
        ],
        vscode.WorkspaceConfiguration
      >;
      let getPresetSavedConnectionsStub: sinon.SinonStub;

      beforeEach(() => {
        testSandbox.restore();
        getPresetSavedConnectionsStub = testSandbox.stub();
      });

      test('loads the preset connections', async () => {
        getConfigurationStub = testSandbox.stub(
          vscode.workspace,
          'getConfiguration'
        );
        getConfigurationStub.returns({
          get: getPresetSavedConnectionsStub,
        } as any);

        getPresetSavedConnectionsStub
          .withArgs('presetSavedConnections')
          .returns(presetConnections);

        const connections = await testConnectionStorage.loadConnections();

        expect(connections.length).to.equal(2);

        for (let i = 0; i < connections.length; i++) {
          const connection = connections[i];
          const presetConnection = presetConnections[i];
          expect(connection.name).equals(presetConnection.name);
          expect(connection.connectionOptions.connectionString).equals(
            presetConnection.connectionString
          );
          expect(connection.isMutable).equals(false);
        }
      });

      test('loads both preset and other saved connections', async () => {
        const savedConnection = newTestConnection(testConnectionStorage, '1');
        await testConnectionStorage.saveConnection(savedConnection);

        getConfigurationStub = testSandbox.stub(
          vscode.workspace,
          'getConfiguration'
        );
        getConfigurationStub.returns({
          get: getPresetSavedConnectionsStub,
        } as any);

        getPresetSavedConnectionsStub
          .withArgs('presetSavedConnections')
          .returns(presetConnections);

        const loadedConnections = await testConnectionStorage.loadConnections();

        expect(loadedConnections.length).equals(3);

        for (let i = 0; i < presetConnections.length; i++) {
          const connection = loadedConnections[i];
          const presetConnection = presetConnections[i];
          expect(connection.name).equals(presetConnection.name);
          expect(connection.connectionOptions.connectionString).equals(
            presetConnection.connectionString
          );
          expect(connection.isMutable).equals(false);
        }

        const savedLoadedConnection = loadedConnections[2];

        expect(savedLoadedConnection.name).equals(savedConnection.name);
        expect(
          savedLoadedConnection.connectionOptions.connectionString
        ).contains(savedConnection.connectionOptions.connectionString);
        expect(savedLoadedConnection.isMutable).equals(true);
      });
    });

    suite('when connection secrets are already in SecretStorage', () => {
      afterEach(() => {
        testSandbox.restore();
      });

      test('should be able to load connection with its secrets', async () => {
        await testConnectionStorage.saveConnection(
          newTestConnection(testConnectionStorage, '1')
        );
        await testConnectionStorage.saveConnection(
          testConnectionStorage.createNewConnection({
            connectionId: '2',
            connectionOptions: {
              connectionString: TEST_DATABASE_URI_USER,
            },
          })
        );

        // By default the connection secrets are already stored in SecretStorage
        const savedConnections = await testConnectionStorage.loadConnections();

        expect(savedConnections.length).equals(2);
        expect(
          savedConnections.every(
            ({ secretStorageLocation }) =>
              secretStorageLocation === SecretStorageLocation.SecretStorage
          )
        ).to.equal(true);

        // Additionally make sure that we are retrieving secrets properly.
        expect(
          savedConnections[1].connectionOptions?.connectionString
        ).to.include(TEST_USER_PASSWORD);
      });
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
      const connections = await testConnectionStorage.loadConnections();

      expect(Object.keys(connections).length).to.equal(1);
      expect(Object.values(connections)[0]).to.deep.equal(loadedConnection);
    });
  });

  test('when there are saved workspace connections, hasSavedConnections returns true', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );

    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, 'pineapple')
    );

    expect(testConnectionStorage.hasSavedConnections()).to.equal(true);
  });

  test('when there are saved global connections, hasSavedConnections returns true', async () => {
    await testConnectionStorage.saveConnection(
      newTestConnection(testConnectionStorage, 'pineapple')
    );

    expect(testConnectionStorage.hasSavedConnections()).to.equal(true);
  });

  test('when there are no saved connections, hasSavedConnections returns false', () => {
    expect(testConnectionStorage.hasSavedConnections()).to.equal(false);
  });
});
