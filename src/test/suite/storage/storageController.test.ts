import * as assert from 'assert';
import * as vscode from 'vscode';

import StorageController, { StorageVariables, StorageScope } from '../../../storage/storageController';

import { TestExtensionContext } from '../stubs';

suite('Storage Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('getting a variable gets it from the global context store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_CONNECTION_STRINGS]: 'this_gonna_get_saved'
    };
    const testStorageController = new StorageController(testExtensionContext);
    const testVal = testStorageController.get(
      StorageVariables.GLOBAL_CONNECTION_STRINGS
    );
    assert(
      testVal === 'this_gonna_get_saved',
      `Expected ${testVal} from global state to equal 'this_gonna_get_saved'.`
    );
  });

  test('getting a variable from the workspace state gets it from the workspace context store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_CONNECTION_STRINGS]: 'i_cant_believe_its_gonna_save_this'
    };
    const testStorageController = new StorageController(testExtensionContext);
    const testVal = testStorageController.get(
      StorageVariables.WORKSPACE_CONNECTION_STRINGS,
      StorageScope.WORKSPACE
    );
    assert(
      testVal === 'i_cant_believe_its_gonna_save_this',
      `Expected ${testVal} from workspace state to equal 'i_cant_believe_its_gonna_save_this'.`
    );
  });

  test('addNewConnectionToGlobalStore adds the connection to preexisting connections on the global store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_CONNECTION_STRINGS]: {
        'conn_1': 'url_that_is_very_saved'
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.addNewConnectionToGlobalStore(
      'another_url_that_is_so_saved',
      'new_conn'
    );

    const updatedGlobalModels = testStorageController.get(
      StorageVariables.GLOBAL_CONNECTION_STRINGS
    );
    assert(Object.keys(updatedGlobalModels).length === 2, `Expected 2 connections, found ${Object.keys(updatedGlobalModels).length}.`);
    assert(updatedGlobalModels.conn_1 === 'url_that_is_very_saved', 'Expected connection data to persist.');
    assert(updatedGlobalModels.new_conn === 'another_url_that_is_so_saved', 'Expected new connection data to exist.');
  });

  test('addNewConnectionToWorkspaceStore adds the connection to preexisting connections on the workspace store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_CONNECTION_STRINGS]: {
        'conn_1': 'very_saved_connection_url'
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.addNewConnectionToWorkspaceStore(
      'this_has_been_saved',
      'new_conn'
    );

    const updatedWorkspaceModels = testStorageController.get(
      StorageVariables.WORKSPACE_CONNECTION_STRINGS,
      StorageScope.WORKSPACE
    );
    assert(Object.keys(updatedWorkspaceModels).length === 2, `Expected 2 connections, found ${Object.keys(updatedWorkspaceModels).length}.`);
    assert(updatedWorkspaceModels.conn_1 === 'very_saved_connection_url', 'Expected connection data to persist.');
    assert(updatedWorkspaceModels.new_conn === 'this_has_been_saved', 'Expected new connection data to exist.');
  });
});
