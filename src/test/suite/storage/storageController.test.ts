import * as assert from 'assert';

import StorageController, { StorageVariables, StorageScope, SavedConnection } from '../../../storage/storageController';

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
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: 'i_cant_believe_its_gonna_save_this'
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
        'conn_1': {
          driverUrl: 'so_saved',
          id: 'conn_1',
          name: 'so_saved'
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.addNewConnectionToGlobalStore({
      driverUrl: 'another_url_that_is_so_saved',
      id: 'new_conn',
      name: 'saved2',
      storageLocation: StorageScope.NONE
    });

    const updatedGlobalModels = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(Object.keys(updatedGlobalModels).length === 2, `Expected 2 connections, found ${Object.keys(updatedGlobalModels).length}.`);
    assert(updatedGlobalModels.conn_1.name === 'so_saved', 'Expected connection data to persist.');
    assert(updatedGlobalModels.new_conn.driverUrl === 'another_url_that_is_so_saved', 'Expected new connection data to exist.');
  });

  test('addNewConnectionToWorkspaceStore adds the connection to preexisting connections on the workspace store', () => {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: {
        'conn_1': {
          driverUrl: 'very_saved_connection_url',
          id: 'conn_1',
          name: 'saved1'
        }
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.addNewConnectionToWorkspaceStore({
      driverUrl: 'this_has_been_saved',
      id: 'new_conn',
      name: 'saved2',
      storageLocation: StorageScope.NONE
    });

    const updatedWorkspaceModels = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageScope.WORKSPACE
    );
    assert(Object.keys(updatedWorkspaceModels).length === 2, `Expected 2 connections, found ${Object.keys(updatedWorkspaceModels).length}.`);
    assert(updatedWorkspaceModels.conn_1.id === 'conn_1', 'Expected connection id data to persist.');
    assert(updatedWorkspaceModels.conn_1.driverUrl === 'very_saved_connection_url', 'Expected connection string data to persist.');
    assert(updatedWorkspaceModels.new_conn.driverUrl === 'this_has_been_saved', 'Expected new connection data to exist.');
  });
});
