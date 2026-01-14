import * as vscode from 'vscode';
import { Long, ObjectId } from 'bson';
import { afterEach, beforeEach } from 'mocha';
import assert from 'assert';
import type { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import type { Document, Filter } from 'mongodb';
import { expect } from 'chai';

import {
  CollectionTreeItem,
  ConnectionTreeItem,
  DatabaseTreeItem,
  DocumentTreeItem,
  SchemaTreeItem,
  StreamProcessorTreeItem,
} from '../../explorer';
import { ExtensionCommand } from '../../commands';
import FieldTreeItem from '../../explorer/fieldTreeItem';
import IndexListTreeItem from '../../explorer/indexListTreeItem';
import { mdbTestExtension } from './stubbableMdbExtension';
import { mockTextEditor } from './stubs';
import {
  StorageLocation,
  SecretStorageLocation,
  StorageVariable,
} from '../../storage/storageController';
import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';
import type { CollectionDetailsType } from '../../explorer/collectionTreeItem';
import { DeepLinkTelemetryEvent } from '../../telemetry';
import { CollectionType } from '../../explorer/documentListTreeItem';
import {
  DEEP_LINK_ALLOWED_COMMANDS,
  DEEP_LINK_DISALLOWED_COMMANDS,
} from '../../mdbExtensionController';

const testDatabaseURI = 'mongodb://localhost:27088';

function getTestConnectionTreeItem(
  options?: Partial<ConstructorParameters<typeof ConnectionTreeItem>[0]>,
): ConnectionTreeItem {
  return new ConnectionTreeItem({
    connectionId: 'tasty_sandwich',
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    isExpanded: false,
    connectionController:
      mdbTestExtension.testExtensionController._connectionController,
    cacheIsUpToDate: false,
    childrenCache: {},
    source: 'user',
    ...options,
  });
}

function getTestCollectionTreeItem(
  options?: Partial<ConstructorParameters<typeof CollectionTreeItem>[0]>,
): CollectionTreeItem {
  return new CollectionTreeItem({
    collection: {
      name: 'testColName',
      type: CollectionType.collection,
    } as unknown as CollectionDetailsType,
    databaseName: 'testDbName',
    dataService: {} as DataService,
    isExpanded: false,
    cacheIsUpToDate: false,
    cachedDocumentCount: null,
    ...options,
  });
}

function getTestDatabaseTreeItem(
  options?: Partial<ConstructorParameters<typeof DatabaseTreeItem>[0]>,
): DatabaseTreeItem {
  return new DatabaseTreeItem({
    databaseName: 'zebra',
    dataService: {} as DataService,
    isExpanded: false,
    cacheIsUpToDate: false,
    childrenCache: {},
    ...options,
  });
}

function getTestStreamProcessorTreeItem(
  options?: Partial<ConstructorParameters<typeof StreamProcessorTreeItem>[0]>,
): StreamProcessorTreeItem {
  return new StreamProcessorTreeItem({
    streamProcessorName: 'zebra',
    streamProcessorState: 'CREATED',
    dataService: {} as DataService,
    isExpanded: false,
    ...options,
  });
}

function getTestFieldTreeItem(): FieldTreeItem {
  return new FieldTreeItem({
    field: {
      name: 'dolphins are sentient',
      probability: 1,
      type: 'String',
      types: [],
    },
    isExpanded: false,
    existingCache: {},
  });
}

function getTestSchemaTreeItem(): SchemaTreeItem {
  return new SchemaTreeItem({
    databaseName: 'zebraWearwolf',
    collectionName: 'giraffeVampire',
    dataService: {} as DataService,
    isExpanded: false,
    hasClickedShowMoreFields: false,
    hasMoreFieldsToShow: false,
    cacheIsUpToDate: false,
    childrenCache: {},
  });
}

function getTestDocumentTreeItem(
  options?: Partial<ConstructorParameters<typeof DocumentTreeItem>[0]>,
): DocumentTreeItem {
  return new DocumentTreeItem({
    document: {},
    namespace: 'waffle.house',
    documentIndexInTree: 0,
    dataService: {} as DataService,
    resetDocumentListCache: () => Promise.resolve(),
    ...options,
  });
}

suite('MDBExtensionController Test Suite', function () {
  this.timeout(10000);
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  suite('Deep link command lists validation', function () {
    test('allowed and disallowed lists are disjoint', function () {
      const allowedSet = new Set(
        DEEP_LINK_ALLOWED_COMMANDS as readonly ExtensionCommand[],
      );
      const disallowedSet = new Set(
        DEEP_LINK_DISALLOWED_COMMANDS as readonly ExtensionCommand[],
      );

      const overlap = [...allowedSet].filter((cmd) => disallowedSet.has(cmd));

      expect(overlap).to.deep.equal(
        [],
        `Commands appear in both allowed and disallowed lists: ${overlap.join(
          ', ',
        )}`,
      );
    });

    test('allowed and disallowed lists are complete', function () {
      const allCommands = new Set(Object.values(ExtensionCommand));
      const allowedSet = new Set(
        DEEP_LINK_ALLOWED_COMMANDS as readonly ExtensionCommand[],
      );
      const disallowedSet = new Set(
        DEEP_LINK_DISALLOWED_COMMANDS as readonly ExtensionCommand[],
      );
      const combinedSet = new Set([...allowedSet, ...disallowedSet]);

      const missing = [...allCommands].filter((cmd) => !combinedSet.has(cmd));
      const extra = [...combinedSet].filter((cmd) => !allCommands.has(cmd));

      expect(missing).to.deep.equal(
        [],
        `Commands missing from allowed/disallowed lists: ${missing.join(', ')}`,
      );
      expect(extra).to.deep.equal(
        [],
        `Commands in allowed/disallowed lists but not in ExtensionCommand: ${extra.join(
          ', ',
        )}`,
      );
    });
  });

  suite('when not connected', function () {
    let showErrorMessageStub: SinonSpy;

    beforeEach(() => {
      sandbox.stub(vscode.window, 'showInformationMessage');
      sandbox.stub(vscode.workspace, 'openTextDocument');
      sandbox.stub(vscode.window, 'showTextDocument');
      showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection',
      );
    });

    test('mdb.addDatabase command fails when not connected to the connection', async function () {
      const testTreeItem = getTestConnectionTreeItem();
      const addDatabaseSucceeded = await vscode.commands.executeCommand(
        'mdb.addDatabase',
        testTreeItem,
      );
      expect(addDatabaseSucceeded).to.be.false;

      const expectedMessage =
        'Please connect to this connection before adding a database.';
      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
    });
  });

  suite('when connected', function () {
    let showInformationMessageStub: SinonStub;
    let openTextDocumentStub: SinonStub;
    let fakeActiveConnectionId: SinonSpy;
    let showErrorMessageStub: SinonStub;
    let fakeCreatePlaygroundFileWithContent: SinonSpy;

    beforeEach(() => {
      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage',
      );
      openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
      fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwich');
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveConnectionId',
        fakeActiveConnectionId,
      );
      fakeCreatePlaygroundFileWithContent = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        '_createPlaygroundFileWithContent',
        fakeCreatePlaygroundFileWithContent,
      );
      showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
      sandbox.stub(vscode.window, 'showTextDocument');
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection',
      );
    });

    suite('with shell format preference', function () {
      test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', async function () {
        const textCollectionTree = getTestCollectionTreeItem();
        await vscode.commands.executeCommand(
          'mdb.viewCollectionDocuments',
          textCollectionTree,
        );
        expect(
          openTextDocumentStub.firstCall.args[0].path.indexOf(
            'Results: testDbName.testColName',
          ),
        ).to.equal(0);
        expect(openTextDocumentStub.firstCall.args[0].path).to.not.include(
          '.json',
        );
        expect(openTextDocumentStub.firstCall.args[0].scheme).to.equal(
          VIEW_COLLECTION_SCHEME,
        );
        expect(openTextDocumentStub.firstCall.args[0].query).to.include(
          'namespace=testDbName.testColName',
        );
      });

      test('mdb.viewCollectionDocuments command should also work with the documents list', async function () {
        const textCollectionTree = getTestCollectionTreeItem();
        await vscode.commands.executeCommand(
          'mdb.viewCollectionDocuments',
          textCollectionTree,
        );
        expect(
          openTextDocumentStub.firstCall.args[0].path.indexOf(
            'Results: testDbName.testColName',
          ),
        ).to.equal(0);
        expect(openTextDocumentStub.firstCall.args[0].path).to.not.include(
          '.json',
        );
        expect(openTextDocumentStub.firstCall.args[0].scheme).to.equal(
          VIEW_COLLECTION_SCHEME,
        );
        expect(openTextDocumentStub.firstCall.args[0].query).to.include(
          'namespace=testDbName.testColName',
        );
      });
    });

    suite('with ejson format preference', function () {
      let documentViewAndEditFormat;

      beforeEach(async () => {
        documentViewAndEditFormat = await vscode.workspace
          .getConfiguration('mdb')
          .get('documentViewAndEditFormat');
        await vscode.workspace
          .getConfiguration('mdb')
          .update('documentViewAndEditFormat', 'ejson', true);
      });

      afterEach(async () => {
        // Unset the variable we set in `beforeEach`.
        await vscode.workspace
          .getConfiguration('mdb')
          .update('documentViewAndEditFormat', documentViewAndEditFormat, true);
      });

      test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', async function () {
        const textCollectionTree = getTestCollectionTreeItem();
        await vscode.commands.executeCommand(
          'mdb.viewCollectionDocuments',
          textCollectionTree,
        );
        expect(
          openTextDocumentStub.firstCall.args[0].path.indexOf(
            'Results: testDbName.testColName',
          ),
        ).to.equal(0);
        expect(openTextDocumentStub.firstCall.args[0].path).to.include('.json');
        expect(openTextDocumentStub.firstCall.args[0].scheme).to.equal(
          VIEW_COLLECTION_SCHEME,
        );
        expect(openTextDocumentStub.firstCall.args[0].query).to.include(
          'namespace=testDbName.testColName',
        );
      });

      test('mdb.viewCollectionDocuments command should also work with the documents list', async function () {
        const textCollectionTree = getTestCollectionTreeItem();
        await vscode.commands.executeCommand(
          'mdb.viewCollectionDocuments',
          textCollectionTree,
        );
        expect(
          openTextDocumentStub.firstCall.args[0].path.indexOf(
            'Results: testDbName.testColName',
          ),
        ).to.equal(0);
        expect(openTextDocumentStub.firstCall.args[0].path).to.include('.json');
        expect(openTextDocumentStub.firstCall.args[0].scheme).to.equal(
          VIEW_COLLECTION_SCHEME,
        );
        expect(openTextDocumentStub.firstCall.args[0].query).to.include(
          'namespace=testDbName.testColName',
        );
      });
    });

    test('mdb.addConnection command should call openWebview on the webview controller', async function () {
      const openWebviewStub = sandbox.stub(
        mdbTestExtension.testExtensionController._webviewController,
        'openWebview',
      );
      await vscode.commands.executeCommand('mdb.addConnection');
      assert.strictEqual(openWebviewStub.calledOnce, true);
    });

    test('mdb.addConnectionWithURI command should call connectWithURI on the connection controller', async function () {
      const fakeConnectWithURI = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'connectWithURI',
        fakeConnectWithURI,
      );
      await vscode.commands.executeCommand('mdb.addConnectionWithURI');
      assert.strictEqual(fakeConnectWithURI.calledOnce, true);
    });

    test('mdb.refreshConnection command should reset the cache on a connection tree item', async function () {
      const testTreeItem = getTestConnectionTreeItem();
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh,
      );
      await vscode.commands.executeCommand(
        'mdb.refreshConnection',
        testTreeItem,
      );
      assert.strictEqual(
        testTreeItem.cacheIsUpToDate,
        false,
        'Expected cache on tree item to be set to not up to date.',
      );
      assert.strictEqual(
        fakeRefresh.called,
        true,
        'Expected explorer controller refresh to be called.',
      );
    });

    test('mdb.treeItemRemoveConnection command should call removeMongoDBConnection on the connection controller with the tree item connection id', async function () {
      const testTreeItem = getTestConnectionTreeItem({
        connectionId: 'craving_for_pancakes_with_maple_syrup',
      });
      const fakeRemoveMongoDBConnection = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        '_removeMongoDBConnection',
        fakeRemoveMongoDBConnection,
      );
      await vscode.commands.executeCommand(
        'mdb.treeItemRemoveConnection',
        testTreeItem,
      );
      assert.strictEqual(fakeRemoveMongoDBConnection.calledOnce, true);
      assert.deepStrictEqual(fakeRemoveMongoDBConnection.firstCall.args[0], {
        connectionId: 'craving_for_pancakes_with_maple_syrup',
        force: undefined,
      });
    });

    test('mdb.copyConnectionString command should try to copy the driver url to the vscode env clipboard', async function () {
      const testTreeItem = getTestConnectionTreeItem();
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      const fakeCopyConnectionStringByConnectionId =
        sandbox.fake.returns('weStubThisUri');
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'copyConnectionStringByConnectionId',
        fakeCopyConnectionStringByConnectionId,
      );
      await vscode.commands.executeCommand(
        'mdb.copyConnectionString',
        testTreeItem,
      );
      assert.strictEqual(fakeWriteText.calledOnce, true);
      assert.strictEqual(fakeWriteText.firstCall.args[0], 'weStubThisUri');
    });

    test('mdb.copyDatabaseName command should try to copy the database name to the vscode env clipboard', async function () {
      const testTreeItem = getTestDatabaseTreeItem();
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      await vscode.commands.executeCommand(
        'mdb.copyDatabaseName',
        testTreeItem,
      );
      assert.strictEqual(fakeWriteText.calledOnce, true);
      assert.strictEqual(fakeWriteText.firstCall.args[0], 'zebra');
    });

    test('mdb.copyCollectionName command should try to copy the collection name to the vscode env clipboard', async function () {
      const testTreeItem = getTestCollectionTreeItem();
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      await vscode.commands.executeCommand(
        'mdb.copyCollectionName',
        testTreeItem,
      );
      assert.strictEqual(fakeWriteText.called, true);
      assert.strictEqual(fakeWriteText.firstCall.args[0], 'testColName');
    });

    test('mdb.copySchemaFieldName command should try to copy the field name to the vscode env clipboard', async function () {
      const testTreeItem = getTestFieldTreeItem();
      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      const commandResult = await vscode.commands.executeCommand(
        'mdb.copySchemaFieldName',
        testTreeItem,
      );
      assert(commandResult);
      assert.strictEqual(fakeWriteText.called, true);
      assert.strictEqual(
        fakeWriteText.firstCall.args[0],
        'dolphins are sentient',
      );
    });

    test('mdb.refreshDatabase command should reset the cache on the database tree item', async function () {
      const testTreeItem = getTestDatabaseTreeItem();
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh,
      );
      await vscode.commands.executeCommand('mdb.refreshDatabase', testTreeItem);
      assert.strictEqual(
        testTreeItem.cacheIsUpToDate,
        false,
        'Expected cache on tree item to be set to not up to date.',
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.',
      );
    });

    test('mdb.refreshCollection command should reset the expanded state of its children and call to refresh the explorer controller', async function () {
      const testTreeItem = getTestCollectionTreeItem();
      testTreeItem.isExpanded = true;

      // Set expanded.
      testTreeItem.getSchemaChild().isExpanded = true;
      testTreeItem.getDocumentListChild().isExpanded = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh,
      );
      await vscode.commands.executeCommand(
        'mdb.refreshCollection',
        testTreeItem,
      );
      assert(
        testTreeItem.getSchemaChild().isExpanded === false,
        'Expected collection tree item child to be reset to not expanded.',
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.',
      );
    });

    test('mdb.refreshDocumentList command should update the document count and call to refresh the explorer controller', async function () {
      let count = 9000;
      const testTreeItem = getTestCollectionTreeItem({
        dataService: {
          estimatedCount: () => Promise.resolve(count),
        } as unknown as DataService,
      });
      await testTreeItem.onDidExpand();

      const collectionChildren = await testTreeItem.getChildren();
      const docListTreeItem = collectionChildren[0];
      assert.strictEqual(docListTreeItem.description, '9K');
      count = 10000;
      docListTreeItem.isExpanded = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh,
      );

      await vscode.commands.executeCommand(
        'mdb.refreshDocumentList',
        docListTreeItem,
      );
      assert.strictEqual(docListTreeItem.cacheIsUpToDate, false);
      assert.strictEqual(testTreeItem.documentCount, 10000);
      assert.strictEqual(fakeRefresh.called, true);
    });

    test('mdb.refreshSchema command should reset its cache and call to refresh the explorer controller', async function () {
      const testTreeItem = getTestSchemaTreeItem();

      // Set cached.
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh,
      );
      await vscode.commands.executeCommand('mdb.refreshSchema', testTreeItem);
      assert.strictEqual(testTreeItem.cacheIsUpToDate, false);
      assert.strictEqual(fakeRefresh.called, true);
    });

    test('mdb.refreshIndexes command should reset its cache and call to refresh the explorer controller', async function () {
      const testTreeItem = new IndexListTreeItem({
        collectionName: 'zebraWearwolf',
        databaseName: 'giraffeVampire',
        dataService: {} as DataService,
        isExpanded: false,
        cacheIsUpToDate: false,
        childrenCache: [],
      });

      // Set cached.
      testTreeItem.cacheIsUpToDate = true;

      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._explorerController,
        'refresh',
        fakeRefresh,
      );
      await vscode.commands.executeCommand('mdb.refreshIndexes', testTreeItem);
      assert(
        !testTreeItem.cacheIsUpToDate,
        'Expected schema field cache to be not up to date.',
      );
      assert(
        fakeRefresh.called === true,
        'Expected explorer controller refresh to be called.',
      );
    });

    test('mdb.addDatabase should create a MongoDB playground with create collection template', async function () {
      const testTreeItem = getTestConnectionTreeItem();
      await vscode.commands.executeCommand('mdb.addDatabase', testTreeItem);

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(content.includes('// Create a new database.'));
      assert(content.includes('NEW_DATABASE_NAME'));
      assert(content.includes('NEW_COLLECTION_NAME'));
    });

    test('mdb.addCollection should create a MongoDB playground with create collection template', async function () {
      const testTreeItem = getTestDatabaseTreeItem();
      await vscode.commands.executeCommand('mdb.addCollection', testTreeItem);

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      expect(content).to.include('// The current database to use.');
      expect(content).to.include('zebra');
      expect(content).to.include('NEW_COLLECTION_NAME');
      expect(content).to.not.include('time-series');
    });

    test('mdb.searchForDocuments should create a MongoDB playground with search template', async function () {
      await vscode.commands.executeCommand('mdb.searchForDocuments', {
        databaseName: 'dbbbbbName',
        collectionName: 'colllllllllName',
      });

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      expect(content).to.include(
        'Search for documents in the current collection.',
      );
      expect(content).to.include('dbbbbbName');
      expect(content).to.include('colllllllllName');
    });

    test('mdb.createIndexFromTreeView should create a MongoDB playground with index template', async function () {
      await vscode.commands.executeCommand('mdb.createIndexFromTreeView', {
        databaseName: 'dbbbbbName',
        collectionName: 'colllllllllName',
      });

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      expect(content).to.include('Create a new index in the collection.');
      expect(content).to.include('dbbbbbName');
      expect(content).to.include('colllllllllName');
    });

    test('mdb.createPlayground should create a MongoDB playground with default template', async function () {
      const fakeGetConfiguration = sandbox.fake.returns({
        get: () => true,
      });
      sandbox.replace(
        vscode.workspace,
        'getConfiguration',
        fakeGetConfiguration,
      );
      await vscode.commands.executeCommand('mdb.createPlayground');

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      expect(content).to.include('// MongoDB Playground');
    });

    test('mdb.createPlayground command should create a MongoDB playground without template', async function () {
      const fakeGetConfiguration = sandbox.fake.returns({
        get: () => false,
      });
      sandbox.replace(
        vscode.workspace,
        'getConfiguration',
        fakeGetConfiguration,
      );
      await vscode.commands.executeCommand('mdb.createPlayground');

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      expect(content).to.equal('');
    });

    test('mdb.addDatabase command fails when disconnecting', async function () {
      const testTreeItem = getTestConnectionTreeItem();
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('theDbName');
      inputBoxResolvesStub.onCall(1).resolves('theCollectionName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const fakeIsDisconnecting = sandbox.fake.returns(true);
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'isDisconnecting',
        fakeIsDisconnecting,
      );

      const addDatabaseSucceeded = await vscode.commands.executeCommand(
        'mdb.addDatabase',
        testTreeItem,
      );
      expect(addDatabaseSucceeded).to.be.false;

      const expectedMessage =
        'Unable to add database: currently disconnecting.';
      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
    });

    test('mdb.addDatabase command fails when connecting', async function () {
      const testTreeItem = getTestConnectionTreeItem();
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('theDbName');
      inputBoxResolvesStub.onCall(1).resolves('theCollectionName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const fakeIsConnecting = sandbox.fake.returns(true);
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'isConnecting',
        fakeIsConnecting,
      );

      const addDatabaseSucceeded = await vscode.commands.executeCommand(
        'mdb.addDatabase',
        testTreeItem,
      );
      expect(addDatabaseSucceeded).to.be.false;

      const expectedMessage = 'Unable to add database: currently connecting.';
      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
    });

    test('mdb.addCollection command fails when disconnecting', async function () {
      const testTreeItem = getTestDatabaseTreeItem();
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('mintChocolateChips');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const fakeIsDisconnecting = sandbox.fake.returns(true);
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'isDisconnecting',
        fakeIsDisconnecting,
      );

      const addCollectionSucceeded = await vscode.commands.executeCommand(
        'mdb.addCollection',
        testTreeItem,
      );
      assert.strictEqual(addCollectionSucceeded, false);
      const expectedMessage =
        'Unable to add collection: currently disconnecting.';
      assert.strictEqual(
        showErrorMessageStub.firstCall.args[0],
        expectedMessage,
      );
    });

    // https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
    test('mdb.dropCollection calls data service to drop the collection after inputting the collection name', async function () {
      let calledNamespace = '';
      const testCollectionTreeItem = getTestCollectionTreeItem({
        dataService: {
          dropCollection: (namespace): Promise<boolean> => {
            calledNamespace = namespace;
            return Promise.resolve(true);
          },
        } as unknown as DataService,
      });

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('testColName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem,
      );
      assert.strictEqual(successfullyDropped, true);
      assert.strictEqual(calledNamespace, 'testDbName.testColName');
    });

    // Starting server 7.0, the outcome of dropping nonexistent collections is successful SERVER-43894
    // TODO: update or delete the test according to VSCODE-461
    test.skip('mdb.dropCollection fails when a collection does not exist', async function () {
      const testConnectionController =
        mdbTestExtension.testExtensionController._connectionController;
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: testDatabaseURI,
      });

      const testCollectionTreeItem = getTestCollectionTreeItem({
        collection: {
          name: 'doesntExistColName',
          type: CollectionType.collection,
        } as unknown as CollectionDetailsType,
        dataService:
          testConnectionController.getActiveDataService() ?? undefined,
      });
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('doesntExistColName');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem,
      );
      expect(successfullyDropped).to.be.false;

      const expectedMessage = 'Drop collection failed: ns not found';
      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);

      await testConnectionController.disconnect();
      testConnectionController.clearAllConnections();
    });

    test('mdb.dropCollection fails when the input doesnt match the collection name', async function () {
      const testCollectionTreeItem = getTestCollectionTreeItem({
        collection: {
          name: 'orange',
          type: CollectionType.collection,
        } as unknown as CollectionDetailsType,
      });
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('apple');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem,
      );
      assert.strictEqual(successfullyDropped, false);
    });

    test('mdb.dropCollection fails when the collection name input is empty', async function () {
      const testCollectionTreeItem = getTestCollectionTreeItem();
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves(/* Return undefined. */);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropCollection',
        testCollectionTreeItem,
      );
      assert.strictEqual(successfullyDropped, false);
    });

    test('mdb.dropDatabase calls DataService to drop the database after inputting the database name', async function () {
      let calledDatabaseName = '';
      const testDatabaseTreeItem = getTestDatabaseTreeItem({
        databaseName: 'iMissTangerineAltoids',
        dataService: {
          dropDatabase: (dbName): Promise<boolean> => {
            calledDatabaseName = dbName;
            return Promise.resolve(true);
          },
        } as unknown as DataService,
      });

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('iMissTangerineAltoids');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem,
      );
      assert.strictEqual(successfullyDropped, true);
      assert.strictEqual(calledDatabaseName, 'iMissTangerineAltoids');
    });

    test('mdb.dropDatabase succeeds even when a database doesnt exist (mdb behavior)', async function () {
      const testConnectionController =
        mdbTestExtension.testExtensionController._connectionController;
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: testDatabaseURI,
      });

      const testDatabaseTreeItem = getTestDatabaseTreeItem({
        databaseName: 'narnia____a',
        dataService:
          testConnectionController.getActiveDataService() ?? undefined,
      });
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('narnia____a');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem,
      );
      assert.strictEqual(successfullyDropped, true);
      assert.strictEqual(showErrorMessageStub.called, false);
    });

    test('mdb.dropDatabase fails when the input doesnt match the database name', async function () {
      const testDatabaseTreeItem = getTestDatabaseTreeItem({
        databaseName: 'orange',
      });
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('apple');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem,
      );
      assert.strictEqual(successfullyDropped, false);
    });

    test('mdb.dropDatabase fails when the database name input is empty', async function () {
      const testDatabaseTreeItem = getTestDatabaseTreeItem();
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves(/* Return undefined. */);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyDropped = await vscode.commands.executeCommand(
        'mdb.dropDatabase',
        testDatabaseTreeItem,
      );
      assert.strictEqual(successfullyDropped, false);
    });

    test('mdb.renameConnection fails when the name input is empty', async function () {
      mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon =
        {
          id: 'blueBerryPancakesAndTheSmellOfBacon',
          connectionOptions: { connectionString: 'mongodb://localhost' },
          name: 'NAAAME',
          storageLocation: StorageLocation.none,
          secretStorageLocation: SecretStorageLocation.SecretStorage,
        };

      const testTreeItem = getTestConnectionTreeItem({
        connectionId: 'blueBerryPancakesAndTheSmellOfBacon',
      });

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves(/* Return undefined. */);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyRenamed = await vscode.commands.executeCommand(
        'mdb.renameConnection',
        testTreeItem,
      );
      assert.strictEqual(successfullyRenamed, false);
      assert.strictEqual(
        mdbTestExtension.testExtensionController._connectionController
          ._connections.blueBerryPancakesAndTheSmellOfBacon.name,
        'NAAAME',
      );
      mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    });

    test('mdb.renameConnection updates the name of a connection', async function () {
      mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon =
        {
          id: 'blueBerryPancakesAndTheSmellOfBacon',
          name: 'NAAAME',
          connectionOptions: { connectionString: 'mongodb://localhost' },
          storageLocation: StorageLocation.none,
          secretStorageLocation: SecretStorageLocation.SecretStorage,
        };

      const testTreeItem = getTestConnectionTreeItem({
        connectionId: 'blueBerryPancakesAndTheSmellOfBacon',
      });
      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('orange juice');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const successfullyRenamed = await vscode.commands.executeCommand(
        'mdb.renameConnection',
        testTreeItem,
      );
      assert.strictEqual(successfullyRenamed, true);
      assert.strictEqual(
        mdbTestExtension.testExtensionController._connectionController
          ._connections.blueBerryPancakesAndTheSmellOfBacon.name,
        'orange juice',
      );
      mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    });

    test('mdb.openMongoDBDocumentFromTree opens a document from the sidebar and saves it to MongoDB with shell syntax', async function () {
      const mockDocument = {
        _id: 'pancakes',
        name: '',
        time: new Date('3001-01-01T05:00:00.000Z'),
      };
      const fakeGet = sandbox.fake.returns('pancakes');
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._documentIdStore,
        'get',
        fakeGet,
      );

      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse(
        [
          'VIEW_DOCUMENT_SCHEME:/',
          'waffle.house:pancakes?',
          'namespace=waffle.house&',
          'connectionId=tasty_sandwich&',
          'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
          'source=treeview&',
          'format=shell',
        ].join(''),
      );
      activeTextEditor.document.getText = (): string =>
        `{\n  _id: 'pancakes',\n  name: '',\n  time: ISODate('3001-01-01T05:00:00.000Z')\n}`;
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () => activeTextEditor,
      );

      const fakeGetActiveDataService = sandbox.fake.returns({
        find: () => {
          return Promise.resolve([mockDocument]);
        },
        findOneAndReplace: () => {
          mockDocument.name = 'something sweet';
          return Promise.resolve(mockDocument);
        },
      });
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        fakeGetActiveDataService,
      );

      const documentItem = getTestDocumentTreeItem({
        document: mockDocument,
      });
      await vscode.commands.executeCommand(
        'mdb.openMongoDBDocumentFromTree',
        documentItem,
      );
      expect(openTextDocumentStub.firstCall.args[0].path).to.not.include(
        '.json',
      );
      expect(openTextDocumentStub.firstCall.args[0].scheme).to.equal(
        'VIEW_DOCUMENT_SCHEME',
      );
      expect(openTextDocumentStub.firstCall.args[0].query).to.include(
        'documentId=',
      );
      expect(openTextDocumentStub.firstCall.args[0].query).to.include(
        'connectionId=',
      );
      expect(openTextDocumentStub.firstCall.args[0].query).to.include(
        'source=treeview',
      );
      expect(openTextDocumentStub.firstCall.args[0].query).to.include(
        'namespace=waffle.house',
      );
      expect(openTextDocumentStub.firstCall.args[0].query).to.include(
        'format=shell',
      );
      await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
      expect(mockDocument.name).to.equal('something sweet');

      const expectedMessage =
        "The document was saved successfully to 'waffle.house'";

      expect(showInformationMessageStub.firstCall.args[0]).to.equal(
        expectedMessage,
      );
    });

    test('mdb.saveMongoDBDocument replaces a document with a treeview source using shell format', async function () {
      const fakeGet = sandbox.fake.returns('pancakes');
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._documentIdStore,
        'get',
        fakeGet,
      );
      sandbox.replaceGetter(
        vscode.window,
        'activeTextEditor',
        () =>
          ({
            document: {
              uri: {
                scheme: 'VIEW_DOCUMENT_SCHEME',
                query: [
                  'namespace=waffle.house',
                  'connectionId=tasty_sandwich',
                  'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                  'source=treeview',
                  'format=shell',
                ].join('&'),
              },
              getText: () =>
                `{\n  _id: 'pancakes',\n  name: '',\n  time: ISODate('3001-01-01T05:00:00.000Z')\n}`,
              save: () => {},
            },
          }) as unknown as typeof vscode.window.activeTextEditor,
      );

      const fakeReplaceDocument = sandbox.fake.resolves(null);
      sandbox.replace(
        mdbTestExtension.testExtensionController._editorsController
          ._mongoDBDocumentService,
        'replaceDocument',
        fakeReplaceDocument,
      );
      await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
      expect(fakeReplaceDocument.firstCall.args[0].source).to.equal('treeview');
    });

    test('mdb.copyDocumentContentsFromTreeView should copy shell syntax to clipboard', async function () {
      const mockDocument = {
        _id: 'pancakes',
        time: new Date('3001-01-01T05:00:00.000Z'),
      };
      let namespaceUsed = '';

      const findStub = sandbox.stub();
      findStub.resolves([mockDocument]);

      const dataServiceStub = {
        find: (namespace: string) => {
          namespaceUsed = namespace;
          return Promise.resolve([mockDocument]);
        },
      } as unknown as DataService;
      const documentTreeItem = getTestDocumentTreeItem({
        dataService: dataServiceStub,
      });

      const fakeWriteText = sandbox.fake();
      sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
        writeText: fakeWriteText,
        readText: sandbox.fake(),
      }));
      await vscode.commands.executeCommand(
        'mdb.copyDocumentContentsFromTreeView',
        documentTreeItem,
      );
      expect(fakeWriteText.called).to.be.true;
      expect(fakeWriteText.firstCall.args[0]).to.equal(
        `{
  _id: 'pancakes',
  time: ISODate('3001-01-01T05:00:00.000Z')
}`,
      );
      expect(namespaceUsed).to.equal('waffle.house');
    });

    suite('document operations with ejson format', function () {
      let documentViewAndEditFormat;

      beforeEach(async () => {
        documentViewAndEditFormat = vscode.workspace
          .getConfiguration('mdb')
          .get('documentViewAndEditFormat');
        await vscode.workspace
          .getConfiguration('mdb')
          .update('documentViewAndEditFormat', 'ejson', true);
      });

      afterEach(async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('documentViewAndEditFormat', documentViewAndEditFormat, true);
      });

      test('mdb.openMongoDBDocumentFromTree opens a document from the sidebar and saves it to MongoDB', async function () {
        const mockDocument = {
          _id: 'pancakes',
          name: '',
          time: {
            $time: '12345',
          },
        };
        const fakeGet = sandbox.fake.returns('pancakes');
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._documentIdStore,
          'get',
          fakeGet,
        );

        const activeTextEditor = mockTextEditor;
        activeTextEditor.document.uri = vscode.Uri.parse(
          [
            'VIEW_DOCUMENT_SCHEME:/',
            'waffle.house:pancakes.json?',
            'namespace=waffle.house&',
            'connectionId=tasty_sandwich&',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
            'source=treeview&',
            'format=ejson',
          ].join(''),
        );
        activeTextEditor.document.getText = (): string =>
          JSON.stringify(mockDocument);
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () => activeTextEditor,
        );

        const fakeGetActiveDataService = sandbox.fake.returns({
          find: () => {
            return Promise.resolve([mockDocument]);
          },
          findOneAndReplace: () => {
            mockDocument.name = 'something sweet';

            return Promise.resolve(mockDocument);
          },
        });
        sandbox.replace(
          mdbTestExtension.testExtensionController._connectionController,
          'getActiveDataService',
          fakeGetActiveDataService,
        );

        const documentItem = getTestDocumentTreeItem({
          document: mockDocument,
        });
        await vscode.commands.executeCommand(
          'mdb.openMongoDBDocumentFromTree',
          documentItem,
        );
        assert(openTextDocumentStub.firstCall.args[0].path.includes('.json'));
        assert.strictEqual(
          openTextDocumentStub.firstCall.args[0].scheme,
          'VIEW_DOCUMENT_SCHEME',
        );
        assert(
          openTextDocumentStub.firstCall.args[0].query.includes('documentId='),
        );
        assert(
          openTextDocumentStub.firstCall.args[0].query.includes(
            'connectionId=',
          ),
        );
        assert(
          openTextDocumentStub.firstCall.args[0].query.includes(
            'source=treeview',
          ),
        );
        assert(
          openTextDocumentStub.firstCall.args[0].query.includes(
            'namespace=waffle.house',
          ),
        );
        await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
        assert.strictEqual(mockDocument.name, 'something sweet');
        assert.strictEqual(mockDocument.time.$time, '12345');

        const expectedMessage =
          "The document was saved successfully to 'waffle.house'";

        assert.strictEqual(
          showInformationMessageStub.firstCall.args[0],
          expectedMessage,
        );
      });

      test('mdb.openMongoDBDocumentFromTree opens a document from a tree with a treeview source', async function () {
        const mockDocument = {
          _id: 'pancakes',
          name: '',
          time: {
            $time: '12345',
          },
        };
        const documentItem = getTestDocumentTreeItem({
          document: mockDocument,
        });
        const fakeFetchDocument = sandbox.fake.resolves(null);
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._mongoDBDocumentService,
          'fetchDocument',
          fakeFetchDocument,
        );
        await vscode.commands.executeCommand(
          'mdb.openMongoDBDocumentFromTree',
          documentItem,
        );
        assert.strictEqual(
          fakeFetchDocument.firstCall.args[0].source,
          'treeview',
        );
      });

      test('mdb.openMongoDBDocumentFromCodeLens opens a document from a playground results with a playground source', async function () {
        const documentItem = {
          source: 'playground',
          line: 1,
          documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
          namespace: 'db.coll',
          connectionId: null,
        };
        const fakeFetchDocument = sandbox.fake.resolves(null);
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._mongoDBDocumentService,
          'fetchDocument',
          fakeFetchDocument,
        );
        await vscode.commands.executeCommand(
          'mdb.openMongoDBDocumentFromCodeLens',
          documentItem,
        );
        assert.strictEqual(
          fakeFetchDocument.firstCall.args[0].source,
          'playground',
        );
      });

      test('mdb.saveMongoDBDocument replaces a document with a treeview source', async function () {
        const mockDocument = {
          _id: 'pancakes',
          name: '',
          time: {
            $time: '12345',
          },
        };
        const fakeGet = sandbox.fake.returns('pancakes');
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._documentIdStore,
          'get',
          fakeGet,
        );
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () =>
            ({
              document: {
                uri: {
                  scheme: 'VIEW_DOCUMENT_SCHEME',
                  query: [
                    'namespace=waffle.house',
                    'connectionId=tasty_sandwich',
                    'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                    'source=treeview',
                    'format=ejson',
                  ].join('&'),
                },
                getText: () => JSON.stringify(mockDocument),
                save: () => {},
              },
            }) as unknown as typeof vscode.window.activeTextEditor,
        );

        const fakeReplaceDocument = sandbox.fake.resolves(null);
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._mongoDBDocumentService,
          'replaceDocument',
          fakeReplaceDocument,
        );
        await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
        assert.strictEqual(
          fakeReplaceDocument.firstCall.args[0].source,
          'treeview',
        );
      });

      test('mdb.saveMongoDBDocuments replaces a document with a playground source', async function () {
        const mockDocument = {
          _id: 'pancakes',
          name: '',
          time: {
            $time: '12345',
          },
        };
        const fakeGet = sandbox.fake.returns('pancakes');
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._documentIdStore,
          'get',
          fakeGet,
        );
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () =>
            ({
              document: {
                uri: {
                  scheme: 'VIEW_DOCUMENT_SCHEME',
                  query: [
                    'namespace=waffle.house',
                    'connectionId=tasty_sandwich',
                    'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                    'source=playground',
                    'format=ejson',
                  ].join('&'),
                },
                getText: () => JSON.stringify(mockDocument),
                save: () => {},
              },
            }) as unknown as typeof vscode.window.activeTextEditor,
        );

        const fakeReplaceDocument = sandbox.fake.resolves(null);
        sandbox.replace(
          mdbTestExtension.testExtensionController._editorsController
            ._mongoDBDocumentService,
          'replaceDocument',
          fakeReplaceDocument,
        );
        await vscode.commands.executeCommand('mdb.saveMongoDBDocument');
        assert.strictEqual(
          fakeReplaceDocument.firstCall.args[0].source,
          'playground',
        );
      });

      test("mdb.copyDocumentContentsFromTreeView should copy a document's content to the clipboard", async function () {
        const mockDocument = {
          _id: new ObjectId('6536b0aef59f6ffc9af93f3c'),
          pineapple: new Long('90071992547409920'),
        };
        let namespaceUsed = '';

        const findStub = sandbox.stub();
        findStub.resolves([mockDocument]);

        const dataServiceStub = {
          find: (namespace: string) => {
            namespaceUsed = namespace;
            return Promise.resolve([mockDocument]);
          },
        } as unknown as DataService;
        const documentTreeItem = getTestDocumentTreeItem({
          dataService: dataServiceStub,
        });

        const fakeWriteText = sandbox.fake();
        sandbox.replaceGetter(vscode.env, 'clipboard', () => ({
          writeText: fakeWriteText,
          readText: sandbox.fake(),
        }));
        await vscode.commands.executeCommand(
          'mdb.copyDocumentContentsFromTreeView',
          documentTreeItem,
        );
        assert.strictEqual(fakeWriteText.called, true);
        assert.strictEqual(
          fakeWriteText.firstCall.args[0],
          `{
  "_id": {
    "$oid": "6536b0aef59f6ffc9af93f3c"
  },
  "pineapple": {
    "$numberLong": "90071992547409920"
  }
}`,
        );
        assert.strictEqual(namespaceUsed, 'waffle.house');
      });
    });

    test('mdb.runSelectedPlaygroundBlocks runs selected playgroundB blocks once', async function () {
      const fakeRunSelectedPlaygroundBlocks = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'runSelectedPlaygroundBlocks',
        fakeRunSelectedPlaygroundBlocks,
      );
      await vscode.commands.executeCommand('mdb.runSelectedPlaygroundBlocks');
      assert(
        fakeRunSelectedPlaygroundBlocks.calledOnce,
        'Expected "runSelectedPlaygroundBlocks" to be called on the playground controller.',
      );
    });

    test('mdb.runAllPlaygroundBlocks runs all playgroundB blocks once', async function () {
      const fakeRunAllPlaygroundBlocks = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'runAllPlaygroundBlocks',
        fakeRunAllPlaygroundBlocks,
      );
      await vscode.commands.executeCommand('mdb.runAllPlaygroundBlocks');
      assert(
        fakeRunAllPlaygroundBlocks.calledOnce,
        'Expected "runAllPlaygroundBlocks" to be called on the playground controller.',
      );
    });

    test('mdb.changeActiveConnection changes the active connection once', async function () {
      const fakeChangeActiveConnection = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'changeActiveConnection',
        fakeChangeActiveConnection,
      );
      await vscode.commands.executeCommand('mdb.changeActiveConnection');
      assert(
        fakeChangeActiveConnection.calledOnce,
        'Expected "changeActiveConnection" to be called on the playground controller.',
      );
    });

    test('mdb.refreshPlaygroundsFromTreeView refreshes the playgrounds explorer once', async function () {
      const fakeRefresh = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundsExplorer,
        'refresh',
        fakeRefresh,
      );
      await vscode.commands.executeCommand(
        'mdb.refreshPlaygroundsFromTreeView',
      );
      assert(
        fakeRefresh.calledOnce,
        'Expected "refreshPlaygrounds" to be called on the playground controller.',
      );
    });

    test("mdb.cloneDocumentFromTreeView opens a playground with a document's content", async function () {
      const mockDocument = {
        _id: 'pancakes',
        time: new Date('3001-01-01T05:00:00.000Z'),
        objectIdField: new ObjectId('57e193d7a9cc81b4027498b2'),
      };
      let namespaceUsed = '';
      const dataServiceStub = {
        find: (namespace: string) => {
          namespaceUsed = namespace;
          return Promise.resolve([mockDocument]);
        },
      } as unknown as DataService;
      const documentTreeItem = getTestDocumentTreeItem({
        document: mockDocument,
        dataService: dataServiceStub,
      });
      const fakeCreatePlaygroundForCloneDocument = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'createPlaygroundForCloneDocument',
        fakeCreatePlaygroundForCloneDocument,
      );
      await vscode.commands.executeCommand(
        'mdb.cloneDocumentFromTreeView',
        documentTreeItem,
      );
      assert.strictEqual(fakeCreatePlaygroundForCloneDocument.calledOnce, true);
      assert.strictEqual(
        fakeCreatePlaygroundForCloneDocument.firstCall.args[0],
        `{
  _id: 'pancakes',
  time: ISODate('3001-01-01T05:00:00.000Z'),
  objectIdField: ObjectId('57e193d7a9cc81b4027498b2')
}`,
      );
      assert.strictEqual(
        fakeCreatePlaygroundForCloneDocument.firstCall.args[1],
        'waffle',
      );
      assert.strictEqual(
        fakeCreatePlaygroundForCloneDocument.firstCall.args[2],
        'house',
      );
      assert.strictEqual(namespaceUsed, 'waffle.house');
    });

    test('mdb.insertDocumentFromTreeView opens a playground with an insert document template', async function () {
      const collectionTreeItem = getTestCollectionTreeItem({
        collection: {
          name: 'pineapple',
          type: CollectionType.collection,
        } as unknown as CollectionDetailsType,
        databaseName: 'plants',
      });
      const fakeCreatePlaygroundForInsertDocument = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        'createPlaygroundForInsertDocument',
        fakeCreatePlaygroundForInsertDocument,
      );
      await vscode.commands.executeCommand(
        'mdb.insertDocumentFromTreeView',
        collectionTreeItem,
      );
      assert.strictEqual(
        fakeCreatePlaygroundForInsertDocument.calledOnce,
        true,
      );
      assert.strictEqual(
        fakeCreatePlaygroundForInsertDocument.firstCall.args[0],
        'plants',
      );
      assert.strictEqual(
        fakeCreatePlaygroundForInsertDocument.firstCall.args[1],
        'pineapple',
      );
    });

    test('mdb.deleteDocumentFromTreeView deletes a document when the confirmation is canceled', async function () {
      const mockDocument = {
        _id: 'pancakes',
        time: {
          $time: '12345',
        },
      };
      let calledDelete = false;
      const dataServiceStub = {
        deleteOne: (): ReturnType<DataService['deleteOne']> => {
          calledDelete = true;
          return Promise.resolve({
            acknowledged: true,
            deletedCount: 1,
          });
        },
      } as unknown as DataService;
      const documentTreeItem = getTestDocumentTreeItem({
        document: mockDocument,
        dataService: dataServiceStub,
      });
      const result = await vscode.commands.executeCommand(
        'mdb.deleteDocumentFromTreeView',
        documentTreeItem,
      );
      assert.strictEqual(result, false);
      assert.strictEqual(calledDelete, false);
    });

    test('mdb.deleteDocumentFromTreeView deletes a document after confirmation', async function () {
      showInformationMessageStub.resolves('Yes');

      const mockDocument = {
        _id: 'pancakes',
        time: {
          $time: '12345',
        },
      };
      let namespaceUsed = '';
      let _idUsed;
      const dataServiceStub = {
        deleteOne: (
          namespace: string,
          filter: Filter<Document>,
        ): ReturnType<DataService['deleteOne']> => {
          _idUsed = filter;
          namespaceUsed = namespace;
          return Promise.resolve({
            acknowledged: true,
            deletedCount: 1,
          });
        },
      } as unknown as DataService;
      const documentTreeItem = getTestDocumentTreeItem({
        document: mockDocument,
        dataService: dataServiceStub,
      });
      const result = await vscode.commands.executeCommand(
        'mdb.deleteDocumentFromTreeView',
        documentTreeItem,
      );
      assert.deepStrictEqual(_idUsed, {
        _id: 'pancakes',
      });
      assert.strictEqual(namespaceUsed, 'waffle.house');
      assert.strictEqual(result, true);
    });

    test('mdb.addStreamProcessor should create a MongoDB playground with create stream processor template', async function () {
      const testConnectionTreeItem = getTestConnectionTreeItem();
      await vscode.commands.executeCommand(
        'mdb.addStreamProcessor',
        testConnectionTreeItem,
      );

      const content = fakeCreatePlaygroundFileWithContent.firstCall.args[0];
      assert(content.includes('// Create a new stream processor.'));
      assert(content.includes("sp.createStreamProcessor('newStreamProcessor'"));
    });

    test('mdb.startStreamProcessor starts the stream processor', async function () {
      let calledProcessorName = '';
      const testProcessorTreeItem = getTestStreamProcessorTreeItem({
        dataService: {
          startStreamProcessor: (spName: string) => {
            calledProcessorName = spName;
            return Promise.resolve(true);
          },
        } as unknown as DataService,
      });

      const started = await vscode.commands.executeCommand(
        'mdb.startStreamProcessor',
        testProcessorTreeItem,
      );

      assert.strictEqual(started, true);
      assert.strictEqual(testProcessorTreeItem.streamProcessorState, 'STARTED');
      assert.strictEqual(
        calledProcessorName,
        testProcessorTreeItem.streamProcessorName,
      );
      assert.strictEqual(
        showInformationMessageStub.firstCall.args[0],
        'Stream processor successfully started.',
      );
    });

    test('mdb.startStreamProcessor shows error when fails', async function () {
      let calledProcessorName = '';
      const testProcessorTreeItem = getTestStreamProcessorTreeItem({
        dataService: {
          startStreamProcessor: (spName: string) => {
            calledProcessorName = spName;
            return Promise.reject(new Error('Fake test error'));
          },
        } as unknown as DataService,
      });

      const started = await vscode.commands.executeCommand(
        'mdb.startStreamProcessor',
        testProcessorTreeItem,
      );

      assert.strictEqual(started, false);
      assert.strictEqual(testProcessorTreeItem.streamProcessorState, 'CREATED');
      assert.strictEqual(
        calledProcessorName,
        testProcessorTreeItem.streamProcessorName,
      );
      assert.strictEqual(
        showErrorMessageStub.firstCall.args[0],
        'Start stream processor failed: Fake test error',
      );
    });

    test('mdb.stopStreamProcessor stops the stream processor', async function () {
      let calledProcessorName = '';
      const testProcessorTreeItem = getTestStreamProcessorTreeItem({
        dataService: {
          stopStreamProcessor: (spName: string) => {
            calledProcessorName = spName;
            return Promise.resolve(true);
          },
        } as unknown as DataService,
      });

      const stopped = await vscode.commands.executeCommand(
        'mdb.stopStreamProcessor',
        testProcessorTreeItem,
      );

      assert.strictEqual(stopped, true);
      assert.strictEqual(testProcessorTreeItem.streamProcessorState, 'STOPPED');
      assert.strictEqual(
        calledProcessorName,
        testProcessorTreeItem.streamProcessorName,
      );
      assert.strictEqual(
        showInformationMessageStub.firstCall.args[0],
        'Stream processor successfully stopped.',
      );
    });

    test('mdb.stopStreamProcessor shows error when fails', async function () {
      let calledProcessorName = '';
      const testProcessorTreeItem = getTestStreamProcessorTreeItem({
        dataService: {
          stopStreamProcessor: (spName: string) => {
            calledProcessorName = spName;
            return Promise.reject(new Error('Fake test error'));
          },
        } as unknown as DataService,
      });

      const stopped = await vscode.commands.executeCommand(
        'mdb.stopStreamProcessor',
        testProcessorTreeItem,
      );

      assert.strictEqual(stopped, false);
      assert.strictEqual(testProcessorTreeItem.streamProcessorState, 'CREATED');
      assert.strictEqual(
        calledProcessorName,
        testProcessorTreeItem.streamProcessorName,
      );
      assert.strictEqual(
        showErrorMessageStub.firstCall.args[0],
        'Stop stream processor failed: Fake test error',
      );
    });

    test('mdb.dropStreamProcessor drops the stream processor after inputting the name', async function () {
      let calledProcessorName = '';
      const testProcessorTreeItem = getTestStreamProcessorTreeItem({
        streamProcessorName: 'iMissTangerineAltoids',
        dataService: {
          dropStreamProcessor: (spName): Promise<boolean> => {
            calledProcessorName = spName;
            return Promise.resolve(true);
          },
        } as unknown as DataService,
      });

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub.onCall(0).resolves('iMissTangerineAltoids');
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const dropped = await vscode.commands.executeCommand(
        'mdb.dropStreamProcessor',
        testProcessorTreeItem,
      );
      assert.strictEqual(dropped, true);
      assert.strictEqual(calledProcessorName, 'iMissTangerineAltoids');
      assert.strictEqual(testProcessorTreeItem.streamProcessorState, 'DROPPED');
      assert.strictEqual(
        showInformationMessageStub.firstCall.args[0],
        'Stream processor successfully dropped.',
      );
    });

    test('mdb.dropStreamProcessor shows error when fails', async function () {
      let calledProcessorName = '';
      const testProcessorTreeItem = getTestStreamProcessorTreeItem({
        dataService: {
          dropStreamProcessor: (spName: string) => {
            calledProcessorName = spName;
            return Promise.reject(new Error('Fake test error'));
          },
        } as unknown as DataService,
      });

      const inputBoxResolvesStub = sandbox.stub();
      inputBoxResolvesStub
        .onCall(0)
        .resolves(testProcessorTreeItem.streamProcessorName);
      sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

      const started = await vscode.commands.executeCommand(
        'mdb.dropStreamProcessor',
        testProcessorTreeItem,
      );

      assert.strictEqual(started, false);
      assert.strictEqual(testProcessorTreeItem.streamProcessorState, 'CREATED');
      assert.strictEqual(
        calledProcessorName,
        testProcessorTreeItem.streamProcessorName,
      );
      assert.strictEqual(
        showErrorMessageStub.firstCall.args[0],
        'Drop stream processor failed: Fake test error',
      );
    });

    suite('with mock execute command', function () {
      let executeCommandStub: SinonStub;

      beforeEach(() => {
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
      });

      suite(
        "when a user hasn't been shown the initial overview page yet and they have no connections saved",
        function () {
          let fakeUpdate: SinonSpy;

          beforeEach(() => {
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'get',
              sandbox.fake.returns(false),
            );
            sandbox.replace(
              mdbTestExtension.testExtensionController._connectionStorage,
              'hasSavedConnections',
              sandbox.fake.returns(false),
            );

            fakeUpdate = sandbox.fake.resolves(undefined);
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'update',
              fakeUpdate,
            );

            void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
          });

          test('they are shown the overview page', function () {
            assert(executeCommandStub.called);
            assert.strictEqual(
              executeCommandStub.firstCall.args[0],
              'mdb.openOverviewPage',
            );
            assert.strictEqual(
              executeCommandStub.firstCall.args[0],
              ExtensionCommand.mdbOpenOverviewPage,
            );
          });

          test("it sets that they've been shown the overview page", function () {
            assert(fakeUpdate.called);
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              StorageVariable.globalHasBeenShownInitialView,
            );
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW',
            );
            assert.strictEqual(fakeUpdate.firstCall.args[1], true);
          });
        },
      );

      suite(
        'when a user hasnt been shown the initial overview page yet and they have connections saved',
        function () {
          let fakeUpdate: SinonSpy;

          beforeEach(() => {
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'get',
              sandbox.fake.returns(undefined),
            );
            sandbox.replace(
              mdbTestExtension.testExtensionController._connectionStorage,
              'hasSavedConnections',
              sandbox.fake.returns(true),
            );
            fakeUpdate = sandbox.fake.resolves(undefined);
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'update',
              fakeUpdate,
            );

            void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
          });

          test('they are not shown the overview page', function () {
            assert(!executeCommandStub.called);
          });

          test("it sets that they've been shown the overview page", function () {
            assert(fakeUpdate.called);
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              StorageVariable.globalHasBeenShownInitialView,
            );
            assert.strictEqual(
              fakeUpdate.firstCall.args[0],
              'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW',
            );
            assert.strictEqual(fakeUpdate.firstCall.args[1], true);
          });
        },
      );

      suite(
        'when a user has been shown the initial overview page',
        function () {
          beforeEach(() => {
            sandbox.replace(
              mdbTestExtension.testExtensionController._storageController,
              'get',
              sandbox.fake.returns(true),
            );

            void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
          });

          test('they are not shown the overview page', function () {
            assert(!executeCommandStub.called);
          });
        },
      );

      suite('when a user has opted out of the overview page', function () {
        beforeEach(async () => {
          await vscode.workspace
            .getConfiguration('mdb')
            .update('showOverviewPageAfterInstall', false);

          sandbox.replace(
            mdbTestExtension.testExtensionController._storageController,
            'get',
            sandbox.fake.returns(false),
          );

          void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
        });

        afterEach(async () => {
          await vscode.workspace
            .getConfiguration('mdb')
            .update('showOverviewPageAfterInstall', undefined);
        });

        test('they are not shown the overview page', function () {
          assert(!executeCommandStub.called);
        });
      });
    });
  });

  test('mdb.participantViewRawSchemaOutput command opens a json document with the output', async function () {
    const openTextDocumentStub = sandbox.stub(
      vscode.workspace,
      'openTextDocument',
    );
    const showTextDocumentStub = sandbox.stub(
      vscode.window,
      'showTextDocument',
    );

    const schemaContent = `{
  "count": 1,
  "fields": [
    {
      "name": "_id",
      "path": [
        "_id"
      ],
      "count": 1,
      "type": "ObjectId",
      "probability": 1,
      "hasDuplicates": false,
      "types": [
        {
          "name": "ObjectId",
          "path": [
            "_id"
          ],
          "count": 1,
          "probability": 1,
          "bsonType": "ObjectId"
        }
      ]
    }
  ]
}`;
    await vscode.commands.executeCommand('mdb.participantViewRawSchemaOutput', {
      schema: schemaContent,
    });

    assert(openTextDocumentStub.calledOnce);
    assert.deepStrictEqual(openTextDocumentStub.firstCall.args[0], {
      language: 'json',
      content: schemaContent,
    });

    assert(showTextDocumentStub.calledOnce);
    assert.deepStrictEqual(showTextDocumentStub.firstCall.args[1], {
      preview: true,
    });
  });

  suite('handleDeepLink', function () {
    let fakeExecuteCommand: sinon.SinonStub;
    let fakeTrack: sinon.SinonStub;

    let fakeShowErrorMessage: sinon.SinonSpy;

    beforeEach(() => {
      fakeExecuteCommand = sandbox.stub(vscode.commands, 'executeCommand');
      fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
      fakeTrack = sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'track',
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('errors when command is not registered', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse('vscode://mongodb.mongodb-vscode/invalid-command'),
      );

      expect(fakeExecuteCommand).to.not.have.been.called;
      expect(fakeShowErrorMessage).to.have.been.calledOnceWith(
        "Failed to handle 'vscode://mongodb.mongodb-vscode/invalid-command': Unable to execute command 'mdb.invalid-command' since it is not registered by the MongoDB extension.",
      );
    });

    test('handles valid command', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse('vscode://mongodb.mongodb-vscode/mdb.connectWithURI'),
      );

      expect(fakeExecuteCommand).to.have.been.calledWith('mdb.connectWithURI');
      expect(fakeShowErrorMessage).to.not.have.been.called;
    });

    test('handles valid command without mdb. prefix', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse('vscode://mongodb.mongodb-vscode/connectWithURI'),
      );

      expect(fakeExecuteCommand).to.have.been.calledWith('mdb.connectWithURI');
      expect(fakeShowErrorMessage).to.not.have.been.called;
    });

    test('handles valid command with query parameters', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse(
          'vscode://mongodb.mongodb-vscode/connectWithURI?foo=bar&baz=qux',
        ),
      );

      expect(fakeExecuteCommand).to.have.been.calledWith('mdb.connectWithURI', {
        foo: 'bar',
        baz: 'qux',
      });
      expect(fakeShowErrorMessage).to.not.have.been.called;
    });

    test('converts query parameters to booleans and numbers', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse(
          'vscode://mongodb.mongodb-vscode/connectWithURI?foo=true&bar=987&baz=str',
        ),
      );

      expect(fakeExecuteCommand).to.have.been.calledOnceWith(
        'mdb.connectWithURI',
        {
          foo: true,
          bar: 987,
          baz: 'str',
        },
      );
      expect(fakeShowErrorMessage).to.not.have.been.called;
    });

    test('decodes query parameters', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.from({
          scheme: 'vscode',
          authority: 'mongodb.mongodb-vscode',
          path: '/connectWithURI',
          query:
            'connectionString=mongodb%3A%2F%2Flocalhost%3A27017%2F%3FappName%3Dblah%26test%3Dtrue&reuseExisting=true',
        }),
      );

      expect(fakeExecuteCommand).to.have.been.calledOnceWith(
        'mdb.connectWithURI',
        {
          connectionString: 'mongodb://localhost:27017/?appName=blah&test=true',
          reuseExisting: true,
        },
      );
      expect(fakeShowErrorMessage).to.not.have.been.called;
    });

    test('shows an error message when executeCommand fails', async function () {
      fakeExecuteCommand.rejects(new Error('fake error'));

      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse('vscode://mongodb.mongodb-vscode/mdb.connectWithURI'),
      );

      expect(fakeExecuteCommand).to.have.been.calledWith('mdb.connectWithURI');
      expect(fakeShowErrorMessage).to.have.been.calledOnceWith(
        "Failed to handle 'vscode://mongodb.mongodb-vscode/mdb.connectWithURI': fake error",
      );
    });

    test('reports telemetry event', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse(
          'vscode://mongodb.mongodb-vscode/connectWithURI?foo=true&bar=987&baz=str',
        ),
      );

      expect(fakeTrack).to.have.been.calledOnceWith(
        new DeepLinkTelemetryEvent('mdb.connectWithURI'),
      );
    });

    test('reports utm_source if present', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse(
          'vscode://mongodb.mongodb-vscode/connectWithURI?foo=true&bar=987&baz=str&utm_source=AtlasCLI',
        ),
      );

      expect(fakeTrack).to.have.been.calledOnceWith(
        new DeepLinkTelemetryEvent('mdb.connectWithURI', 'AtlasCLI'),
      );
    });

    test('reports even non-existent commands', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse(
          'vscode://mongodb.mongodb-vscode/invalid_command?foo=true&bar=987&baz=str&utm_source=RogueActor',
        ),
      );

      expect(fakeTrack).to.have.been.calledOnceWith(
        new DeepLinkTelemetryEvent('mdb.invalid_command', 'RogueActor'),
      );
    });

    test('removes utm_source from parameters passed to command', async function () {
      await mdbTestExtension.testExtensionController._handleDeepLink(
        vscode.Uri.parse(
          'vscode://mongodb.mongodb-vscode/mdb.connectWithURI?foo=bar&utm_source=abc',
        ),
      );

      expect(fakeExecuteCommand).to.have.been.calledWith('mdb.connectWithURI', {
        foo: 'bar',
      });
      expect(fakeExecuteCommand.firstCall.args[1]).to.not.have.property(
        'utm_source',
      );
      expect(fakeTrack).to.have.been.calledOnceWith(
        new DeepLinkTelemetryEvent('mdb.connectWithURI', 'abc'),
      );
      expect(fakeShowErrorMessage).to.not.have.been.called;
    });

    suite(
      'blocks participant and destructive commands from deep links',
      function () {
        const disabledCommands = DEEP_LINK_DISALLOWED_COMMANDS;

        disabledCommands.forEach((command) => {
          test(`blocks ${command}`, async function () {
            await mdbTestExtension.testExtensionController._handleDeepLink(
              vscode.Uri.parse(`vscode://mongodb.mongodb-vscode/${command}`),
            );

            expect(fakeExecuteCommand).to.not.have.been.called;
            expect(fakeShowErrorMessage).to.have.been.calledOnceWith(
              `Failed to handle 'vscode://mongodb.mongodb-vscode/${command}': Command '${command}' cannot be invoked via deep links.`,
            );
          });
        });
      },
    );
  });
});
