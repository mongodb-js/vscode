import * as vscode from 'vscode';
import assert from 'assert';
import { afterEach } from 'mocha';
import { ObjectId } from 'bson';
import sinon from 'sinon';
import * as util from 'util';

import ConnectionController from '../../../connectionController';
import { DocumentSource } from '../../../documentSource';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import { mockTextEditor } from '../stubs';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { ExtensionContextStub } from '../stubs';

suite('Edit Document Code Lens Provider Test Suite', () => {
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testStatusView = new StatusView(extensionContextStub);
  const testConnectionController = new ConnectionController(
    testStatusView,
    testStorageController,
    testTelemetryService
  );
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('provideCodeLenses returns an empty array if codeLensesInfo is empty', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 0);
  });

  test('the _updateCodeLensesForCursor function deserialize document id', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const ejsinId = { $oid: '5d973ae744376d2aae72a160' };
    const playgroundResult = {
      content: [
        {
          _id: ejsinId,
          name: 'test name',
        },
      ],
      namespace: 'db.coll',
      source: DocumentSource.DOCUMENT_SOURCE_PLAYGROUND,
    };

    const fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testCodeLensProvider._connectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );
    const result =
      testCodeLensProvider._updateCodeLensesForCursor(playgroundResult);

    assert(!!result);

    const codeLensesInfo = result[0];
    assert(!!codeLensesInfo);
    assert(!!codeLensesInfo.documentId);

    const bsonId = new ObjectId('5d973ae744376d2aae72a160');
    assert(util.inspect(codeLensesInfo.documentId) !== util.inspect(ejsinId));
    assert(util.inspect(codeLensesInfo.documentId) === util.inspect(bsonId));
  });

  test('the _updateCodeLensesForDocument function deserialize document id', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const ejsinId = { $oid: '5d973ae744376d2aae72a160' };
    const playgroundResult = {
      content: {
        _id: ejsinId,
        name: 'test name',
      },
      namespace: 'db.coll',
      source: DocumentSource.DOCUMENT_SOURCE_PLAYGROUND,
    };

    const fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testCodeLensProvider._connectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );
    const result =
      testCodeLensProvider._updateCodeLensesForDocument(playgroundResult);
    assert(!!result);

    const codeLensesInfo = result[0];
    assert(!!codeLensesInfo);
    assert(!!codeLensesInfo.documentId);

    const bsonId = new ObjectId('5d973ae744376d2aae72a160');
    assert(util.inspect(codeLensesInfo.documentId) !== util.inspect(ejsinId));
    assert(util.inspect(codeLensesInfo.documentId) === util.inspect(bsonId));
  });

  suite('after updateCodeLensesForPlayground', () => {
    test('provideCodeLenses returns one code lens when result is a single document', () => {
      const testCodeLensProvider = new EditDocumentCodeLensProvider(
        testConnectionController
      );
      const activeTextEditor = mockTextEditor;
      mockTextEditor.document.uri = vscode.Uri.parse(
        'PLAYGROUND_RESULT_SCHEME:/Playground Result'
      );
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () => activeTextEditor
      );
      testCodeLensProvider.updateCodeLensesForPlayground({
        namespace: 'db.coll',
        type: 'Document',
        content: { _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a' },
        language: 'json',
      });

      const codeLens = testCodeLensProvider.provideCodeLenses();
      assert(!!codeLens);
      assert(codeLens.length === 1);

      const range = codeLens[0].range;
      const expectedStartLine = 1;
      assert(
        range.start.line === expectedStartLine,
        `Expected a codeLens position to be at line ${expectedStartLine}, found ${range.start.line}`
      );

      const expectedEnd = 1;
      assert(
        range.end.line === expectedEnd,
        `Expected a codeLens position to be at line ${expectedEnd}, found ${range.end.line}`
      );
      assert(codeLens[0].command?.title === 'Edit Document');
      assert(!!codeLens[0].command?.command);
      assert(
        codeLens[0].command?.command === 'mdb.openMongoDBDocumentFromCodeLens'
      );

      const commandArguments = codeLens[0].command?.arguments;
      assert(!!commandArguments);
      assert(commandArguments[0].source === 'playground');
    });

    test('provideCodeLenses returns two code lenses when result is array of two documents', () => {
      const testCodeLensProvider = new EditDocumentCodeLensProvider(
        testConnectionController
      );
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse(
        'PLAYGROUND_RESULT_SCHEME:/Playground Result'
      );
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () => activeTextEditor
      );
      testCodeLensProvider.updateCodeLensesForPlayground({
        namespace: 'db.coll',
        type: 'Cursor',
        content: [
          { _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a' },
          { _id: '21333a0d-83f6-4e6f-a575-af7ea6187444' },
        ],
        language: 'json',
      });

      const codeLens = testCodeLensProvider.provideCodeLenses();
      assert(!!codeLens);
      assert(codeLens.length === 2);

      const firstRange = codeLens[0].range;
      const firstExpectedStartLine = 2;
      assert(
        firstRange.start.line === firstExpectedStartLine,
        `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstRange.start.line}`
      );

      const firstExpectedEnd = 2;
      assert(
        firstRange.end.line === firstExpectedEnd,
        `Expected a codeLens position to be at line ${firstExpectedEnd}, found ${firstRange.end.line}`
      );

      const secondRange = codeLens[1].range;
      const secondExpectedStartLine = 5;
      assert(
        secondRange.start.line === secondExpectedStartLine,
        `Expected a codeLens position to be at line ${secondExpectedStartLine}, found ${secondRange.start.line}`
      );

      const secondExpectedEnd = 5;
      assert(
        secondRange.end.line === secondExpectedEnd,
        `Expected a codeLens position to be at line ${secondExpectedEnd}, found ${secondRange.end.line}`
      );
    });

    test('provideCodeLenses returns code lenses when result is ejson array', () => {
      const testCodeLensProvider = new EditDocumentCodeLensProvider(
        testConnectionController
      );
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse(
        'PLAYGROUND_RESULT_SCHEME:/Playground Result'
      );
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () => activeTextEditor
      );
      testCodeLensProvider.updateCodeLensesForPlayground({
        namespace: 'db.coll',
        type: 'Cursor',
        content: [
          {
            _id: 4,
            item: 'xyz',
            price: 5,
            quantity: 20,
            date: {
              $date: '2014-04-04T11:21:39.736Z',
            },
          },
          {
            _id: 5,
            item: 'abc',
            price: 10,
            quantity: 10,
            date: {
              $date: '2014-04-04T21:23:13.331Z',
            },
          },
        ],
        language: 'json',
      });

      const codeLens = testCodeLensProvider.provideCodeLenses();
      assert(!!codeLens);
      assert(codeLens.length === 2);

      const firstRange = codeLens[0].range;
      const firstExpectedStartLine = 2;
      assert(
        firstRange.start.line === firstExpectedStartLine,
        `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstRange.start.line}`
      );

      const firstExpectedEnd = 2;
      assert(
        firstRange.end.line === firstExpectedEnd,
        `Expected a codeLens position to be at line ${firstExpectedEnd}, found ${firstRange.end.line}`
      );

      const secondRange = codeLens[1].range;
      const secondExpectedStartLine = 11;
      assert(
        secondRange.start.line === secondExpectedStartLine,
        `Expected a codeLens position to be at line ${secondExpectedStartLine}, found ${secondRange.start.line}`
      );

      const secondExpectedEnd = 11;
      assert(
        secondRange.end.line === secondExpectedEnd,
        `Expected a codeLens position to be at line ${secondExpectedEnd}, found ${secondRange.end.line}`
      );
    });
  });
});
