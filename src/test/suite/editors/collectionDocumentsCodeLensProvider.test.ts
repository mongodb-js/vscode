import assert from 'assert';
import * as vscode from 'vscode';

import CollectionDocumentsCodeLensProvider from '../../../editors/collectionDocumentsCodeLensProvider';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';
import { mockVSCodeTextDocument } from '../stubs';

suite('Collection Documents Provider Test Suite', () => {
  test('expected provideCodeLenses to return a code lens with positions at the end of the document', () => {
    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new CollectionDocumentsCodeLensProvider(
      testQueryStore
    );
    const operationId = testQueryStore.createNewOperation();
    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?&operationId=${operationId}`
    );
    const mockDocument = {
      ...mockVSCodeTextDocument,
      uri,
      lineCount: 50,
    };

    const codeLens = testCodeLensProvider.provideCodeLenses(mockDocument);
    assert(!!codeLens);
    assert(codeLens.length === 1);
    const range = codeLens[0].range;
    const expectedStartLine = 49;
    assert(
      range.start.line === expectedStartLine,
      `Expected a codeLens position to be at line ${expectedStartLine}, found ${range.start.line}`
    );
    const expectedEnd = 50;
    assert(
      range.end.line === expectedEnd,
      `Expected a codeLens position to be at line ${expectedEnd}, found ${range.end.line}`
    );
  });

  test('expected provideCodeLenses to not return a code lens when there are no more documents to show', () => {
    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new CollectionDocumentsCodeLensProvider(
      testQueryStore
    );
    const operationId = testQueryStore.createNewOperation();
    testQueryStore.operations[operationId].hasMoreDocumentsToShow = false;
    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?operationId=${operationId}`
    );
    const mockDocument = {
      ...mockVSCodeTextDocument,
      uri,
    };
    const codeLens = testCodeLensProvider.provideCodeLenses(mockDocument);
    assert(codeLens.length === 0);
  });
});
