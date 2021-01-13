import * as vscode from 'vscode';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { beforeEach, afterEach } from 'mocha';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

suite('Active DB CodeLens Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryService = new TelemetryService(
    mockStorageController,
    mockExtensionContext
  );
  const testStatusView = new StatusView(mockExtensionContext);

  suite('user is not connected', () => {
    const testConnectionController = new ConnectionController(
      testStatusView,
      mockStorageController,
      testTelemetryService
    );
    const testCodeLensProvider = new ActiveDBCodeLensProvider(
      testConnectionController
    );
    const mockShowQuickPick = sinon.fake.resolves();

    beforeEach(() => {
      sinon.replace(vscode.window, 'showQuickPick', mockShowQuickPick);
    });

    afterEach(() => {
      sinon.restore();
    });

    test('show disconnected message in code lenses', () => {
      const codeLens = testCodeLensProvider.provideCodeLenses();

      expect(codeLens).to.be.an('array');
      expect(codeLens.length).to.be.equal(1);
      expect(codeLens[0].command?.title).to.be.equal(
        'Disconnected. Click here to connect.'
      );
      expect(codeLens[0].range.start.line).to.be.equal(0);
      expect(codeLens[0].range.end.line).to.be.equal(0);
    });
  });

  suite('user is connected', () => {
    const testConnectionController = new ConnectionController(
      testStatusView,
      mockStorageController,
      testTelemetryService
    );
    const testCodeLensProvider = new ActiveDBCodeLensProvider(
      testConnectionController
    );
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, ['Text message']);
      },
      client: {}
    };

    testConnectionController.setActiveConnection(mockActiveConnection);

    beforeEach(() => {
      sinon.replace(
        testConnectionController,
        'getActiveConnectionName',
        sinon.fake.returns('fakeName')
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('show active connection in code lenses', () => {
      const codeLens = testCodeLensProvider.provideCodeLenses();

      expect(codeLens).to.be.an('array');
      expect(codeLens.length).to.be.equal(1);
      expect(codeLens[0].command?.title).to.be.equal(
        'Currently connected to fakeName. Click here to change connection.'
      );
      expect(codeLens[0].range.start.line).to.be.equal(0);
      expect(codeLens[0].range.end.line).to.be.equal(0);
      expect(codeLens[0].command?.command).to.be.equal(
        'mdb.changeActiveConnection'
      );
    });
  });
});
