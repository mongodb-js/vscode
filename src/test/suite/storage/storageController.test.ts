import assert from 'assert';
import { before } from 'mocha';
import { v4 as uuidv4 } from 'uuid';

import StorageController, {
  StorageVariables,
  StorageLocation,
} from '../../../storage/storageController';
import { ExtensionContextStub } from '../stubs';

suite('Storage Controller Test Suite', () => {
  test('getting a variable gets it from the global context store', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        collOne: { name: 'this_gonna_get_saved' },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    const testVal = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );
    assert(
      testVal.collOne.name === 'this_gonna_get_saved',
      `Expected ${testVal} from global state to equal 'this_gonna_get_saved'.`
    );
  });

  test('getting a variable from the workspace state gets it from the workspace context store', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        collTwo: { name: 'i_cant_believe_its_gonna_save_this' },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    const testVal = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    assert(
      testVal.collTwo.name === 'i_cant_believe_its_gonna_save_this',
      `Expected ${testVal} from workspace state to equal 'i_cant_believe_its_gonna_save_this'.`
    );
  });

  test('addNewConnectionToGlobalStore adds the connection to preexisting connections on the global storage', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1',
          storageLocation: StorageLocation.GLOBAL,
          connectionOptions: { connectionString: 'mongodb://localhost' },
        },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    void testStorageController.saveConnectionToStore({
      id: 'conn2',
      name: 'saved2',
      storageLocation: StorageLocation.GLOBAL,
      connectionOptions: { connectionString: 'mongodb://localhost' },
    });

    const updatedGlobalModels = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );
    assert(
      Object.keys(updatedGlobalModels).length === 2,
      `Expected 2 connections, found ${
        Object.keys(updatedGlobalModels).length
      }.`
    );
    assert(
      updatedGlobalModels.conn1.name === 'saved1',
      'Expected connection data to persist.'
    );
    assert(
      updatedGlobalModels.conn2.storageLocation === StorageLocation.GLOBAL,
      'Expected storage scope to be set.'
    );
    assert(testStorageController.hasSavedConnections());
  });

  test('addNewConnectionToWorkspaceStore adds the connection to preexisting connections on the workspace store', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1',
          storageLocation: StorageLocation.WORKSPACE,
          connectionOptions: { connectionString: 'mongodb://localhost' },
        },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    void testStorageController.saveConnectionToStore({
      id: 'conn2',
      name: 'saved2',
      storageLocation: StorageLocation.WORKSPACE,
      connectionOptions: { connectionString: 'mongodb://localhost:27018' },
    });

    const updatedWorkspaceModels = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    assert(
      Object.keys(updatedWorkspaceModels).length === 2,
      `Expected 2 connections, found ${
        Object.keys(updatedWorkspaceModels).length
      }.`
    );
    assert(
      updatedWorkspaceModels.conn1.id === 'conn1',
      'Expected connection id data to persist.'
    );
    assert(
      updatedWorkspaceModels.conn2.name === 'saved2',
      'Expected new connection data to exist.'
    );
    assert(
      updatedWorkspaceModels.conn2.storageLocation ===
        StorageLocation.WORKSPACE,
      'Expected storage scope to be set.'
    );
  });

  suite('for a new user that does not have anonymousId or userId', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {};
    const testStorageController = new StorageController(extensionContextStub);

    test('getUserIdentity adds anonymousId to the global storage and returns it to telemetry', () => {
      const userIdentity = testStorageController.getUserIdentity();
      const anonymousId = testStorageController.get(
        StorageVariables.GLOBAL_ANONYMOUS_ID
      );
      const userId = testStorageController.get(StorageVariables.GLOBAL_USER_ID);
      assert.deepStrictEqual(userIdentity, { anonymousId });
      assert(!userId);
    });
  });

  suite('for an old user that does not have anonymousId but has userId', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {};
    const testStorageController = new StorageController(extensionContextStub);
    const id = uuidv4();

    before(async () => {
      await testStorageController.update(
        StorageVariables.GLOBAL_USER_ID,
        id,
        StorageLocation.GLOBAL
      );
    });

    test('getUserIdentity returns userId from the global storage and returns it to telemetry', () => {
      const userIdentity = testStorageController.getUserIdentity();
      const anonymousId = testStorageController.get(
        StorageVariables.GLOBAL_ANONYMOUS_ID
      );
      const userId = testStorageController.get(StorageVariables.GLOBAL_USER_ID);
      assert(userId === id);
      assert.deepStrictEqual(userIdentity, { userId, anonymousId });
    });
  });

  test('when there are saved workspace connections, hasSavedConnections returns true', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1',
        },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    assert(testStorageController.hasSavedConnections());
  });

  test('when there are saved global connections, hasSavedConnections returns true', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1',
        },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    assert(testStorageController.hasSavedConnections());
  });

  test('when there are no saved connections, hasSavedConnections returns false', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {};
    const testStorageController = new StorageController(extensionContextStub);
    assert(!testStorageController.hasSavedConnections());
  });
});
