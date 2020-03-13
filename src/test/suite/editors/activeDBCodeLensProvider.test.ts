import * as assert from 'assert';
import * as vscode from 'vscode';

import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import ActiveDBCodeLensProvider from '../../../editors/activeDBCodeLensProvider';
import { TestExtensionContext, mockVSCodeTextDocument } from '../stubs';
import { StorageController } from '../../../storage';

suite('Active DB CodeLens Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  test('expected provideCodeLenses to return empty array when user is not connected', () => {
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    const testCodeLensProvider = new ActiveDBCodeLensProvider(testConnectionController);
    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 0);
  });

  test('expected provideCodeLenses to return a code lens with positions at the first line of the document', () => {
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    const testCodeLensProvider = new ActiveDBCodeLensProvider(testConnectionController);
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, ['Text message']);
      },
      client: {}
    };
    testConnectionController.setActiveConnection(mockActiveConnection);

    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 1);
    const range = codeLens[0].range;
    const expectedStartLine = 0;
    assert(range.start.line === expectedStartLine, `Expected a codeLens position to be at line ${expectedStartLine}, found ${range.start.line}`);
    const expectedEnd = 0;
    assert(range.end.line === expectedEnd, `Expected a codeLens position to be at line ${expectedEnd}, found ${range.end.line}`);
  });
});
