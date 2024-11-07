import { beforeEach } from 'mocha';
import chai from 'chai';

import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';

const expect = chai.expect;

suite('Export To Language Code Lens Provider Test Suite', function () {
  const defaults = {
    importStatements: false,
    driverSyntax: false,
    language: 'shell',
  };
  let testExportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;

  beforeEach(() => {
    testExportToLanguageCodeLensProvider =
      new ExportToLanguageCodeLensProvider();
  });

  test('has the include import statements code lens when importStatements is false', () => {
    testExportToLanguageCodeLensProvider.refresh(defaults);

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal(
      'Include Import Statements'
    );
  });

  test('has the exclude import statements code lens when importStatements is true', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      importStatements: true,
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal(
      'Exclude Import Statements'
    );
  });

  test('has the include import statements code lens when driverSyntax is false', () => {
    testExportToLanguageCodeLensProvider.refresh(defaults);

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[1].command?.title).to.be.equal('Include Driver Syntax');
  });

  test('has the exclude import statements code lens when driverSyntax is true', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      driverSyntax: true,
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[1].command?.title).to.be.equal('Exclude Driver Syntax');
  });

  test('does not have the include driver syntax code lens when language is csharp', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      language: 'csharp',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(1); // Csharp does not support driver syntax.
    expect(codeLenses[0].command?.title).to.be.equal(
      'Include Import Statements'
    );
  });

  test('does not render code lenses for json text', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      language: 'json',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(0);
  });

  test('does not render code lenses for plain text text', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      language: 'plaintext',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(0);
  });
});
