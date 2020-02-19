import * as assert from 'assert';
import * as vscode from 'vscode';

import StorageController, { StorageVariables, StorageScope } from '../../../storage/storageController';

import { TestExtensionContext } from '../stubs';

suite('Storage Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('getting a variable gets it from the global context store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_CONNECTION_MODELS]: 'expectedValue'
    };
    const testStorageController = new StorageController(testExtensionContext);
    const testVal = testStorageController.get(
      StorageVariables.GLOBAL_CONNECTION_MODELS
    );
    assert(
      testVal === 'expectedValue',
      `Expected ${testVal} from global state to equal 'expectedValue'.`
    );
  });

  test('getting a variable from the workspace state gets it from the workspace context store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_CONNECTION_MODELS]: 'expectedValue'
    };
    const testStorageController = new StorageController(testExtensionContext);
    const testVal = testStorageController.get(
      StorageVariables.WORKSPACE_CONNECTION_MODELS,
      StorageScope.WORKSPACE
    );
    assert(
      testVal === 'expectedValue',
      `Expected ${testVal} from workspace state to equal 'expectedValue'.`
    );
  });

  test('addNewConnectionToGlobalStore adds the connection to preexisting connections on the global store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._globalState = {
      [StorageVariables.GLOBAL_CONNECTION_MODELS]: {
        'conn_1': 'someData'
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.addNewConnectionToGlobalStore('someMoreData', 'new_conn');

    const updatedGlobalModels = testStorageController.get(
      StorageVariables.GLOBAL_CONNECTION_MODELS
    );
    assert(Object.keys(updatedGlobalModels).length === 2, `Expected 2 connections, found ${Object.keys(updatedGlobalModels).length}.`);
    assert(updatedGlobalModels.conn_1 === 'someData', 'Expected connection data to persist.');
    assert(updatedGlobalModels.new_conn === 'someMoreData', 'Expected new connection data to exist.');
  });

  test('addNewConnectionToWorkspaceStore adds the connection to preexisting connections on the workspace store', function () {
    const testExtensionContext = new TestExtensionContext();
    testExtensionContext._workspaceState = {
      [StorageVariables.WORKSPACE_CONNECTION_MODELS]: {
        'conn_1': 'someData'
      }
    };
    const testStorageController = new StorageController(testExtensionContext);
    testStorageController.addNewConnectionToWorkspaceStore('someMoreData', 'new_conn');

    const updatedWorkspaceModels = testStorageController.get(
      StorageVariables.WORKSPACE_CONNECTION_MODELS,
      StorageScope.WORKSPACE
    );
    assert(Object.keys(updatedWorkspaceModels).length === 2, `Expected 2 connections, found ${Object.keys(updatedWorkspaceModels).length}.`);
    assert(updatedWorkspaceModels.conn_1 === 'someData', 'Expected connection data to persist.');
    assert(updatedWorkspaceModels.new_conn === 'someMoreData', 'Expected new connection data to exist.');
  });
});
