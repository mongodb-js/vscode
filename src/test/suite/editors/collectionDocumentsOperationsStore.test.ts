import * as vscode from 'vscode';
import { expect } from 'chai';

import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';

suite('Collection Documents Operations Store Test Suite', function () {
  test('expected CollectionDocumentsOperationsStore createNewOperation to add an operation with a document limit and return an id', function () {
    const testOpsStore = new CollectionDocumentsOperationsStore();
    const opId = testOpsStore.createNewOperation();
    expect(testOpsStore.operations[opId]).to.exist;
    expect(Object.keys(testOpsStore.operations).length).to.equal(1);

    const operation = testOpsStore.operations[opId];
    const expectedLimit = vscode.workspace
      .getConfiguration('mdb')
      .get('defaultLimit');
    expect(operation.currentLimit).to.equal(expectedLimit);
  });

  test('expected increaseOperationDocumentLimit createNewOperation to increase limit by config setting', function () {
    const testOpsStore = new CollectionDocumentsOperationsStore();
    const opId = testOpsStore.createNewOperation();
    const operation = testOpsStore.operations[opId];
    const expectedLimit = Number(
      vscode.workspace.getConfiguration('mdb').get('defaultLimit'),
    );
    expect(operation.currentLimit).to.equal(expectedLimit);

    testOpsStore.increaseOperationDocumentLimit(opId);
    expect(operation.currentLimit).to.equal(expectedLimit * 2);
  });
});
