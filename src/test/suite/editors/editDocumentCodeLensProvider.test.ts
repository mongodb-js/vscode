import assert from 'assert';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';

suite('Edit Document Code Lens Provider Test Suite', () => {
  test('provideCodeLenses returns an empty array if codeLensesInfo is empty', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider();

    testCodeLensProvider.refresh([]);

    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 0);
  });

  test('provideCodeLenses returns one code lens when codeLensesInfo contains one item', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider();

    testCodeLensProvider.refresh([
      {
        line: 0,
        documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        namespace: 'db.name'
      }
    ]);

    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 1);
    const range = codeLens[0].range;
    const expectedStartLine = 0;
    assert(
      range.start.line === expectedStartLine,
      `Expected a codeLens position to be at line ${expectedStartLine}, found ${range.start.line}`
    );
    const expectedEnd = 0;
    assert(
      range.end.line === expectedEnd,
      `Expected a codeLens position to be at line ${expectedEnd}, found ${range.end.line}`
    );
  });

  test('provideCodeLenses returns two code lenses when codeLensesInfo contains two items', () => {
    const testCodeLensProvider = new EditDocumentCodeLensProvider();

    testCodeLensProvider.refresh([
      {
        line: 0,
        documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        namespace: 'db.name'
      },
      {
        line: 5,
        documentId: '21333a0d-83f6-4e6f-a575-af7ea6187444',
        namespace: 'db.name'
      }
    ]);

    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 2);
    const firstRange = codeLens[0].range;
    const firstExpectedStartLine = 0;
    assert(
      firstRange.start.line === firstExpectedStartLine,
      `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstRange.start.line}`
    );
    const firstExpectedEnd = 0;
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
});
