import { beforeEach } from 'mocha';
import chai from 'chai';

import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import { ExportToLanguageMode } from '../../../types/playgroundType';

const expect = chai.expect;

suite('Export To Language Code Lens Provider Test Suite', function () {
  const defaults = {
    importStatements: false,
    driverSyntax: false,
    builders: false,
    language: 'shell'
  };
  let testExportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;

  beforeEach(() => {
    testExportToLanguageCodeLensProvider = new ExportToLanguageCodeLensProvider();
  });

  test('has the include import statements code lens when importStatements is false', () => {
    testExportToLanguageCodeLensProvider.refresh(defaults);

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal('Include Import Statements');
  });

  test('has the exclude import statements code lens when importStatements is true', () => {
    testExportToLanguageCodeLensProvider.refresh({ ...defaults, importStatements: true });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal('Exclude Import Statements');
  });

  test('has the include import statements code lens when driverSyntax is false', () => {
    testExportToLanguageCodeLensProvider.refresh(defaults);

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[1].command?.title).to.be.equal('Include Driver Syntax');
  });

  test('has the exclude import statements code lens when driverSyntax is true', () => {
    testExportToLanguageCodeLensProvider.refresh({ ...defaults, driverSyntax: true });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(2);
    expect(codeLenses[1].command?.title).to.be.equal('Exclude Driver Syntax');
  });

  test('has the use builders code lens when builders is false, language is java, and mode is query', () => {
    testExportToLanguageCodeLensProvider.refresh({ ...defaults, mode: ExportToLanguageMode.QUERY, language: 'java' });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(3);
    expect(codeLenses[2].command?.title).to.be.equal('Use Builders');
  });

  test('has the use raw query code lens when builders is true, language is java, and mode is query', () => {
    testExportToLanguageCodeLensProvider.refresh({ ...defaults, builders: true, mode: ExportToLanguageMode.QUERY, language: 'java' });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(3);
    expect(codeLenses[2].command?.title).to.be.equal('Use Raw Query');
  });

  test('does not have the use raw query code lens when builders is true, language is java, and mode is plain text', () => {
    testExportToLanguageCodeLensProvider.refresh({ ...defaults, builders: true, mode: ExportToLanguageMode.OTHER, language: 'java' });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(2);
  });
});
