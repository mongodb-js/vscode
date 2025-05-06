import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import { QueryWithCopilotCodeLensProvider } from '../../../editors/queryWithCopilotCodeLensProvider';
import EXTENSION_COMMANDS from '../../../commands';

suite('Query with Copilot CodeLens Provider Test Suite', () => {
  let testCodeLensProvider: QueryWithCopilotCodeLensProvider;
  const sandbox = sinon.createSandbox();

  const mockExtensionChangeEmitter: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  beforeEach(() => {
    sandbox.replaceGetter(
      vscode.extensions,
      'onDidChange',
      () => mockExtensionChangeEmitter.event,
    );

    testCodeLensProvider = new QueryWithCopilotCodeLensProvider();
  });

  afterEach(() => {
    sandbox.restore();
  });

  suite('the MongoDB playground in JS', () => {
    const mockFileName = path.join('nonexistent', 'playground-test.mongodb.js');
    const mockDocumentUri = vscode.Uri.from({
      path: mockFileName,
      scheme: 'untitled',
    });
    const mockTextDoc: vscode.TextDocument = {
      uri: mockDocumentUri,
    } as Pick<vscode.TextDocument, 'uri'> as vscode.TextDocument;

    suite('does not have the copilot extension', () => {
      beforeEach(() => {
        sandbox.stub(vscode.extensions, 'getExtension').returns(undefined);
      });

      test('should not show the codelens', () => {
        const codeLens = testCodeLensProvider.provideCodeLenses(mockTextDoc);

        expect(codeLens).to.be.an('array');
        expect(codeLens.length).to.be.equal(0);
      });
    });

    suite('has the extension but it is not active', () => {
      test('should not show the codelens', () => {
        const codeLens = testCodeLensProvider.provideCodeLenses(mockTextDoc);

        expect(codeLens).to.be.an('array');
        expect(codeLens.length).to.be.equal(0);
      });
    });

    suite('has the copilot extension active', () => {
      beforeEach(() => {
        sandbox.stub(vscode.extensions, 'getExtension').returns({
          isActive: true,
        } as vscode.Extension<unknown>);
      });

      test('should show the codelens', () => {
        const codeLens = testCodeLensProvider.provideCodeLenses(mockTextDoc);

        expect(codeLens).to.be.an('array');
        expect(codeLens.length).to.be.equal(1);
        expect(codeLens[0].command?.title).to.be.equal(
          '✨ Generate query with MongoDB Copilot',
        );
        expect(codeLens[0].range.start.line).to.be.equal(0);
        expect(codeLens[0].range.end.line).to.be.equal(0);
        expect(codeLens[0].command?.command).to.be.equal(
          EXTENSION_COMMANDS.SEND_MESSAGE_TO_PARTICIPANT_FROM_INPUT,
        );
      });
    });

    suite('on extensions list changes', function () {
      test('calls onDidChangeCodeLenses', function () {
        const extensionListChanged = sinon.stub();
        testCodeLensProvider.onDidChangeCodeLenses(extensionListChanged);

        mockExtensionChangeEmitter.fire();

        expect(extensionListChanged).calledOnce;
      });
    });
  });

  suite('the regular JS file', () => {
    const mockFileName = path.join('nonexistent', 'playground-test.js');
    const mockDocumentUri = vscode.Uri.from({
      path: mockFileName,
      scheme: 'untitled',
    });
    const mockTextDoc: vscode.TextDocument = {
      uri: mockDocumentUri,
    } as Pick<vscode.TextDocument, 'uri'> as vscode.TextDocument;

    suite('does not have the copilot extension', () => {
      beforeEach(() => {
        sandbox.stub(vscode.extensions, 'getExtension').returns(undefined);
      });

      test('should not show the codelens', () => {
        const codeLens = testCodeLensProvider.provideCodeLenses(mockTextDoc);

        expect(codeLens).to.be.an('array');
        expect(codeLens.length).to.be.equal(0);
      });
    });

    suite('has the copilot extension active', () => {
      beforeEach(() => {
        sandbox.stub(vscode.extensions, 'getExtension').returns(undefined);
      });

      test('should not show the codelens', () => {
        const codeLens = testCodeLensProvider.provideCodeLenses(mockTextDoc);

        expect(codeLens).to.be.an('array');
        expect(codeLens.length).to.be.equal(0);
      });
    });
  });
});
