import assert from 'assert';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import ConnectionController from '../../../connectionController';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { StatusView } from '../../../views';

suite('Edit Document Code Lens Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryService = new TelemetryService(
    mockStorageController,
    mockExtensionContext
  );
  const testStatusView = new StatusView(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    testStatusView,
    mockStorageController,
    testTelemetryService
  );

  test('provideCodeLenses returns an empty array if codeLensesInfo is empty', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 0);
  });

  suite('after updateCodeLensesForPlayground', () => {
    test('provideCodeLenses returns one code lens when result is a single document', () => {
      const testCodeLensProvider = new EditDocumentCodeLensProvider(
        testConnectionController
      );

      testCodeLensProvider.updateCodeLensesForPlayground({
        namespace: 'db.coll',
        type: 'Document',
        content: { _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a' }
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
      assert(codeLens[0].command?.command === 'mdb.openMongoDBDocumentFromPlayground');
      const commandArguments = codeLens[0].command?.arguments;
      assert(!!commandArguments);
      assert(commandArguments[0].source === 'playground');
    });

    test('provideCodeLenses returns two code lenses when result is array of two documents', () => {
      const testCodeLensProvider = new EditDocumentCodeLensProvider(
        testConnectionController
      );

      testCodeLensProvider.updateCodeLensesForPlayground({
        namespace: 'db.coll',
        type: 'Cursor',
        content: [
          { _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a' },
          { _id: '21333a0d-83f6-4e6f-a575-af7ea6187444' }
        ]
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
              $date: '2014-04-04T11:21:39.736Z'
            }
          },
          {
            _id: 5,
            item: 'abc',
            price: 10,
            quantity: 10,
            date: {
              $date: '2014-04-04T21:23:13.331Z'
            }
          }
        ]
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
