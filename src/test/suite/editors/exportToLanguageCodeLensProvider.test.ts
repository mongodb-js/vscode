import { beforeEach } from 'mocha';
import chai from 'chai';

import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';

const expect = chai.expect;

suite('Export To Language Code Lens Provider Test Suite', function () {
  const defaults = {
    codeToTranspile: '123',
    driverSyntax: false,
    language: 'shell',
  };
  let testExportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;

  beforeEach(() => {
    testExportToLanguageCodeLensProvider =
      new ExportToLanguageCodeLensProvider();
  });

  test('renders the include driver syntax code lens by default for shell', () => {
    testExportToLanguageCodeLensProvider.refresh(defaults);

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(1);
    expect(codeLenses[0].command?.title).to.be.equal('Include Driver Syntax');
  });

  test('renders the include driver syntax code lens when driverSyntax is false for shell', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      driverSyntax: false,
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(1);
    expect(codeLenses[0].command?.title).to.be.equal('Include Driver Syntax');
  });

  test('renders the exclude driver syntax code lens when driverSyntax is true for shell', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      driverSyntax: true,
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(1);
    expect(codeLenses[0].command?.title).to.be.equal('Exclude Driver Syntax');
  });

  test('does not render code lenses for csharp', () => {
    testExportToLanguageCodeLensProvider.refresh({
      ...defaults,
      language: 'csharp',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(0); // Csharp does not support driver syntax.
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
