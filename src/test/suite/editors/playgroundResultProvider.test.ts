import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { TestExtensionContext } from '../stubs';
import { afterEach } from 'mocha';
import ConnectionController from '../../../connectionController';
import { StorageController } from '../../../storage';
import TelemetryController from '../../../telemetry/telemetryController';
import { StatusView } from '../../../views';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

suite('Playground Result Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryController = new TelemetryController(
    mockStorageController,
    mockExtensionContext
  );
  const testStatusView = new StatusView(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    testStatusView,
    mockStorageController,
    testTelemetryController
  );

  afterEach(() => {
    sinon.restore();
  });

  test('sets default playground result', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    expect(testPlaygroundResultViewProvider._playgroundResult).to.be.deep.equal(
      {
        namespace: null,
        type: null,
        content: undefined
      }
    );
  });

  test('refreshes playground result', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Cursor',
      content: {
        _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        name: 'Berlin'
      }
    };

    testPlaygroundResultViewProvider.setPlaygroundResult(playgroundResult);

    expect(testPlaygroundResultViewProvider._playgroundResult).to.be.deep.equal(
      playgroundResult
    );
  });

  test('returns undefined formatted to string if content is undefined', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'undefined',
      content: null
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('undefined');
  });

  test('returns null formatted to string if content is null', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: null
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('null');
  });

  test('returns number formatted to string if content is number', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'number',
      content: 4
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('4');
  });

  test('returns array formatted to string if content is array', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: []
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('[]');
  });

  test('returns object formatted to string if content is object', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: {}
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('{}');
  });

  test('returns boolean formatted to string if content is boolean', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'boolean',
      content: true
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('true');
  });

  test('returns string if content is string', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'string',
      content: 'Berlin'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('Berlin');
  });

  test('returns Cursor formatted to string if content is string', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );
    const content = [
      {
        _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        name: 'Berlin'
      },
      {
        _id: '55333a0d-83f6-4e6f-a575-af7ea6187a55',
        name: 'Rome'
      }
    ];
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Cursor',
      content
    };

    const mockRefresh = sinon.fake.resolves();
    sinon.replace(
      testPlaygroundResultViewProvider._editDocumentCodeLensProvider,
      'updateCodeLensesPosition',
      mockRefresh
    );

    testPlaygroundResultViewProvider._playgroundResult = playgroundResult;

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();
    mockRefresh.firstArg;

    expect(result).to.be.equal(JSON.stringify(content, null, 2));
    expect(mockRefresh.firstArg).to.be.deep.equal(playgroundResult);
  });

  test('returns Document formatted to string if content is string', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      mockExtensionContext,
      testConnectionController
    );
    const content = {
      _id: '20213a0d-83f6-4e6f-a575-af7ea6187lala',
      name: 'Minsk'
    };
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Document',
      content
    };

    const mockRefresh = sinon.fake.resolves();
    sinon.replace(
      testPlaygroundResultViewProvider._editDocumentCodeLensProvider,
      'updateCodeLensesPosition',
      mockRefresh
    );

    testPlaygroundResultViewProvider._playgroundResult = playgroundResult;

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();
    mockRefresh.firstArg;

    expect(result).to.be.equal(JSON.stringify(content, null, 2));
    expect(mockRefresh.firstArg).to.be.deep.equal(playgroundResult);
  });
});
