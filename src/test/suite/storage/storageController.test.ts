import * as assert from 'assert';

import StorageController, {
  StorageVariables,
  StorageScope,
  SavedConnection
} from '../../../storage/storageController';

import { TestExtensionContext } from '../stubs';

suite('Storage Controller Test Suite', () => {
  test('getting a variable gets it from the global context store', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: 'this_gonna_get_saved'
    };
    const testStorageController = new StorageController(testExtensionContext);
    const testVal = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      testVal === 'this_gonna_get_saved',
      `Expected ${testVal} from global state to equal 'this_gonna_get_saved'.`
    );
  });

  test('getting a variable from the workspace state gets it from the workspace context store', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]:
        'i_cant_believe_its_gonna_save_this'
    };
    const testStorageController = new StorageController(testExtensionContext);
    const testVal = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageScope.WORKSPACE
    );
    assert(
      testVal === 'i_cant_believe_its_gonna_save_this',
      `Expected ${testVal} from workspace state to equal 'i_cant_believe_its_gonna_save_this'.`
    );
  });

  test('addNewConnectionToGlobalStore adds the connection to preexisting connections on the global store', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: {
        conn1: {
          driverUrl: 'so_saved',
          id: 'conn1',
          name: 'so_saved'
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.saveConnectionToGlobalStore({
      driverUrl: 'another_url_that_is_so_saved',
      id: 'new_conn',
      name: 'saved2',
      storageLocation: StorageScope.NONE
    });

    const updatedGlobalModels = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      Object.keys(updatedGlobalModels).length === 2,
      `Expected 2 connections, found ${Object.keys(updatedGlobalModels).length}.`
    );
    assert(
      updatedGlobalModels.conn1.name === 'so_saved',
      'Expected connection data to persist.'
    );
    assert(
      updatedGlobalModels.new_conn.driverUrl === 'another_url_that_is_so_saved',
      'Expected new connection data to exist.'
    );
    assert(
      updatedGlobalModels.new_conn.storageLocation === StorageScope.GLOBAL,
      'Expected storage scope to be set.'
    );
  });

  test('addNewConnectionToWorkspaceStore adds the connection to preexisting connections on the workspace store', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        conn1: {
          driverUrl: 'very_saved_connection_url',
          id: 'conn1',
          name: 'saved1'
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.saveConnectionToWorkspaceStore({
      driverUrl: 'this_has_been_saved',
      id: 'new_conn',
      name: 'saved2',
      storageLocation: StorageScope.NONE
    });

    const updatedWorkspaceModels = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageScope.WORKSPACE
    );
    assert(
      Object.keys(updatedWorkspaceModels).length === 2,
      `Expected 2 connections, found ${Object.keys(updatedWorkspaceModels).length}.`
    );
    assert(
      updatedWorkspaceModels.conn1.id === 'conn1',
      'Expected connection id data to persist.'
    );
    assert(
      updatedWorkspaceModels.conn1.driverUrl === 'very_saved_connection_url',
      'Expected connection string data to persist.'
    );
    assert(
      updatedWorkspaceModels.new_conn.driverUrl === 'this_has_been_saved',
      'Expected new connection data to exist.'
    );
    assert(
      updatedWorkspaceModels.new_conn.name === 'saved2',
      'Expected new connection data to exist.'
    );
    assert(
      updatedWorkspaceModels.new_conn.storageLocation === StorageScope.WORKSPACE,
      'Expected storage scope to be set.'
    );
  });

  test('getUserID adds user uuid to the global store if it does not exist there', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.getUserID();
    const userId = testStorageController.get(
      StorageVariables.GLOBAL_USER_ID
    );
    assert(userId);
  });

  test('getUserID does not update the user id in the global store if it already exist there', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {};
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.getUserID();
    const userId = testStorageController.get(
      StorageVariables.GLOBAL_USER_ID
    );
    testStorageController.getUserID();
    const userIdAfterSecondCall = testStorageController.get(
      StorageVariables.GLOBAL_USER_ID
    );
    assert(userId === userIdAfterSecondCall);
  });
});
