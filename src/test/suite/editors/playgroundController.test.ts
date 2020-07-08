import * as vscode from 'vscode';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext, MockLanguageServerController } from '../stubs';
import { before, after, beforeEach, afterEach } from 'mocha';
import TelemetryController from '../../../telemetry/telemetryController';
import { getDocUri, loadPlayground } from '../editorTestHelper';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const CONNECTION = {
  driverUrlWithSsh: 'mongodb://localhost:27018',
  driverOptions: {}
};

suite('Playground Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryController = new TelemetryController(
    mockStorageController,
    mockExtensionContext
  );
  const testConnectionController = new ConnectionController(
    new StatusView(mockExtensionContext),
    mockStorageController,
    testTelemetryController
  );
  const mockLanguageServerController = new MockLanguageServerController(
    mockExtensionContext,
    mockStorageController
  );
  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    mockLanguageServerController as LanguageServerController,
    testTelemetryController
  );
  const sandbox = sinon.createSandbox();
  let fakeShowInformationMessage: any;
  let fakeShowErrorMessage: any;

  before(async () => {
    fakeShowInformationMessage = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );
    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  after(() => {
    sandbox.restore();
  });

  suite('user is not connected', () => {
    before(() => {
      const mockGetActiveConnectionName = sinon.fake.returns('');
      const mockGetActiveConnectionModel = sinon.fake.returns(null);

      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionName',
        mockGetActiveConnectionName
      );
      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionModel',
        mockGetActiveConnectionModel
      );
    });

    after(() => {
      sinon.restore();
    });

    test('run all playground blocks should throw the error', async () => {
      const errorMessage =
        'Please connect to a database before running a playground.';

      fakeShowErrorMessage.resolves(errorMessage);

      try {
        await testPlaygroundController.runAllPlaygroundBlocks();
      } catch (error) {
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
      }
    });
  });

  suite('user is connected', () => {
    beforeEach(async () => {
      const mockGetActiveConnectionName = sinon.fake.returns('fakeName');
      const mockGetActiveConnectionModel = sinon.fake.returns({
        appname: 'VSCode Playground Tests',
        port: 27018,
        disconnect: () => {},
        getAttributes: () => CONNECTION
      });

      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionName',
        mockGetActiveConnectionName
      );
      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionModel',
        mockGetActiveConnectionModel
      );

      await testPlaygroundController.connectToServiceProvider();
    });

    afterEach(() => {
      sinon.restore();
    });

    test('show a confirmation message if mdb.confirmRunAll is true', async () => {
      let result: any;

      fakeShowInformationMessage.resolves('Yes');

      try {
        result = await testPlaygroundController.runAllPlaygroundBlocks();
      } catch (error) {
        // No action.
      }

      expect(result).to.be.true;
    });

    test('do not show a confirmation message if mdb.confirmRunAll is false', async () => {
      let result: any;

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', false);

      try {
        result = await testPlaygroundController.runAllPlaygroundBlocks();
      } catch (error) {
        // No action.
      }

      expect(result).to.be.true;
    });

    test('do not run a playground if user selected No in the confirmation message', async () => {
      let result: any;

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', true);

      fakeShowInformationMessage.resolves('No');

      try {
        result = await testPlaygroundController.runAllPlaygroundBlocks();
      } catch (error) {
        // No action.
      }

      expect(result).to.be.false;
    });

    test('close cancelation modal when a playground is canceled', async () => {
      let result: any;

      sinon.replace(testPlaygroundController, 'evaluate', sinon.fake.rejects());

      try {
        result = await testPlaygroundController.evaluateWithCancelModal();
      } catch (error) {
        // No action.
      }

      expect(result).to.be.null;
    });

    test('do not show code lens if a part of a line is selected', async function () {
      this.timeout(3000);

      testPlaygroundController._activeTextEditor = await loadPlayground(
        getDocUri('testCodeLens.mongodb')
      );

      testPlaygroundController.showCodeLensForSelection(
        new vscode.Range(0, 5, 0, 11)
      );

      const codeLens = testPlaygroundController._partialExecutionCodeLensProvider?.provideCodeLenses();

      expect(codeLens?.length).to.be.equal(0);
    });

    test('show code lens if whole line is selected', async function () {
      this.timeout(3000);

      testPlaygroundController._activeTextEditor = await loadPlayground(
        getDocUri('testCodeLens.mongodb')
      );

      testPlaygroundController.showCodeLensForSelection(
        new vscode.Range(0, 0, 0, 14)
      );

      const codeLens = testPlaygroundController._partialExecutionCodeLensProvider?.provideCodeLenses();

      expect(codeLens?.length).to.be.equal(1);
    });
  });
});
