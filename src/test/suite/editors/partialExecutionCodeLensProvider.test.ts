import assert from 'assert';
import * as vscode from 'vscode';
import PartialExecutionCodeLensProvider from '../../../editors/partialExecutionCodeLensProvider';

suite('Partial Execution Code Lens Provider Test Suite', () => {
  test('expected provideCodeLenses to return empty array when text is not selected', () => {
    const testCodeLensProvider = new PartialExecutionCodeLensProvider();

    testCodeLensProvider.refresh();

    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 0);
  });

  test('expected provideCodeLenses to return a code lens when text is selected', () => {
    const testCodeLensProvider = new PartialExecutionCodeLensProvider();

    testCodeLensProvider.refresh(new vscode.Range(4, 5, 5, 30));

    const codeLens = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLens);
    assert(codeLens.length === 1);
    const range = codeLens[0].range;
    const expectedStartLine = 4;
    assert(
      range.start.line === expectedStartLine,
      `Expected a codeLens position to be at line ${expectedStartLine}, found ${range.start.line}`
    );
    const expectedEnd = 5;
    assert(
      range.end.line === expectedEnd,
      `Expected a codeLens position to be at line ${expectedEnd}, found ${range.end.line}`
    );
  });
});
