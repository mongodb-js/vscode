import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';

import StorageController, {
  StorageVariables,
  StorageLocation
} from '../../../storage/storageController';
import { TestExtensionContext } from '../stubs';

suite('Storage Controller Test Suite', () => {
  test('getting a variable gets it from the global context store', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        'collOne': { name: 'this_gonna_get_saved' }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
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
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        'collTwo': { name: 'i_cant_believe_its_gonna_save_this' }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
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
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1',
          storageLocation: StorageLocation.GLOBAL,
          connectionOptions: { connectionString: 'mongodb://localhost' }
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    void testStorageController.saveConnectionToStore({
      id: 'conn2',
      name: 'saved2',
      storageLocation: StorageLocation.GLOBAL,
      connectionOptions: { connectionString: 'mongodb://localhost' }
    });

    const updatedGlobalModels = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );
    assert(
      Object.keys(updatedGlobalModels).length === 2,
      `Expected 2 connections, found ${Object.keys(updatedGlobalModels).length
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
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1',
          storageLocation: StorageLocation.WORKSPACE,
          connectionOptions: { connectionString: 'mongodb://localhost' }
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    void testStorageController.saveConnectionToStore({
      id: 'conn2',
      name: 'saved2',
      storageLocation: StorageLocation.WORKSPACE,
      connectionOptions: { connectionString: 'mongodb://localhost:27018' }
    });

    const updatedWorkspaceModels = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    assert(
      Object.keys(updatedWorkspaceModels).length === 2,
      `Expected 2 connections, found ${Object.keys(updatedWorkspaceModels).length
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

  test('getUserId returns user id from the global storage if it exists there', async () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    const newUserId = uuidv4();
    await testStorageController.update(
      StorageVariables.GLOBAL_USER_ID,
      newUserId,
      StorageLocation.GLOBAL
    );
    const existingUserId = testStorageController.get(StorageVariables.GLOBAL_USER_ID);
    assert(newUserId === existingUserId);
  });

  test('getUserId does not add user id to the global storage if it does not exist there', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    const userId = testStorageController.get(StorageVariables.GLOBAL_USER_ID);
    assert(!userId);
  });

  test('getAnonymousId adds anonymous id to the global storage if it does not exist there', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.getAnonymousId();
    const anonymousId = testStorageController.get(StorageVariables.GLOBAL_ANONYMOUS_ID);
    assert(anonymousId);
  });

  test('getAnonymousId does not update anonymous id in the global storage if it already exist there', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.getUserId();
    const anonymousId = testStorageController.get(StorageVariables.GLOBAL_ANONYMOUS_ID);
    testStorageController.getAnonymousId();
    const anonymousIdAfterSecondCall = testStorageController.get(
      StorageVariables.GLOBAL_USER_ID
    );
    assert(anonymousId === anonymousIdAfterSecondCall);
  });

  test('getUserIdentity returns identical user id and anonymous id if user id exists in the global storage', async () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    const userId = uuidv4();
    await testStorageController.update(
      StorageVariables.GLOBAL_USER_ID,
      userId,
      StorageLocation.GLOBAL
    );
    const userIdentify = testStorageController.getUserIdentity();
    assert.deepStrictEqual(userIdentify, { userId, anonymousId: userId });
  });

  test('when there are saved workspace connections, hasSavedConnections returns true', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1'
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    assert(testStorageController.hasSavedConnections());
  });

  test('when there are saved global connections, hasSavedConnections returns true', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        conn1: {
          id: 'conn1',
          name: 'saved1'
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    assert(testStorageController.hasSavedConnections());
  });

  test('when there are no saved connections, hasSavedConnections returns false', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    assert(!testStorageController.hasSavedConnections());
  });
});
