import * as assert from 'assert';
import * as vscode from 'vscode';

import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';

suite('Collection Documents Operations Store Test Suite', () => {
  test('expected CollectionDocumentsOperationsStore createNewOperation to add an operation with a document limit and return an id', () => {
    const testOpsStore = new CollectionDocumentsOperationsStore();

    const opId = testOpsStore.createNewOperation();

    assert(!!testOpsStore.operations[opId], `Expected operation with id ${opId}`);
    assert(Object.keys(testOpsStore.operations).length === 1, `Expected an operation to be in the operations store, found ${testOpsStore.operations.length}`);
    const operation = testOpsStore.operations[opId];

    const expectedLimit = vscode.workspace.getConfiguration(
      'mdb'
    ).get('defaultLimit');

    assert(operation.currentLimit === expectedLimit, `Expected limit to be ${expectedLimit} found ${operation.currentLimit}`);
  });

  test('expected increaseOperationDocumentLimit createNewOperation to increase limit by config setting', () => {
    const testOpsStore = new CollectionDocumentsOperationsStore();

    const opId = testOpsStore.createNewOperation();
    const operation = testOpsStore.operations[opId];

    const expectedLimit = Number(vscode.workspace.getConfiguration(
      'mdb'
    ).get('defaultLimit'));

    assert(operation.currentLimit === expectedLimit, `Expected limit to be ${expectedLimit} found ${operation.currentLimit}`);

    testOpsStore.increaseOperationDocumentLimit(opId);

    assert(operation.currentLimit === expectedLimit * 2, `Expected limit to be ${expectedLimit} found ${operation.currentLimit}`);
  });
});
