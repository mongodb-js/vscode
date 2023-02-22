import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import assert from 'assert';
import { DataService } from 'mongodb-data-service';
import { ObjectId } from 'mongodb';
import sinon, { SinonSpy } from 'sinon';

import {
  CollectionTreeItem,
  CollectionTypes,
  ConnectionTreeItem,
  DatabaseTreeItem,
  DocumentTreeItem,
  SchemaTreeItem,
} from '../../explorer';
import EXTENSION_COMMANDS from '../../commands';
import FieldTreeItem from '../../explorer/fieldTreeItem';
import IndexListTreeItem from '../../explorer/indexListTreeItem';
import { mdbTestExtension } from './stubbableMdbExtension';
import { mockTextEditor } from './stubs';
import {
  StorageLocation,
  StorageVariables,
} from '../../storage/storageController';
import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';

const testDatabaseURI = 'mongodb://localhost:27018';

suite('MDBExtensionController Test Suite', function () {
  this.timeout(10000);

  const sandbox = sinon.createSandbox();
  let fakeShowInformationMessage: sinon.SinonStub;

  beforeEach(() => {
    // Here we stub the showInformationMessage process because it is too much
    // for the render process and leads to crashes while testing.
    fakeShowInformationMessage = sinon.stub(
      vscode.window,
      'showInformationMessage'
    );
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName',
        type: CollectionTypes.collection,
      },
      'testDbName',
      {},
      false,
      false,
      null
    );

    await vscode.commands.executeCommand(
      'mdb.viewCollectionDocuments',
      textCollectionTree
    );
    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].path.indexOf(
        'Results: testDbName.testColName'
      ),
      0
    );
    assert(mockOpenTextDocument.firstCall.args[0].path.includes('.json'));
    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].scheme,
      VIEW_COLLECTION_SCHEME
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].query.includes(
        'namespace=testDbName.testColName'
      )
    );

    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'magna carta');
  });

  test('mdb.viewCollectionDocuments command should also work with the documents list', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName',
        type: CollectionTypes.collection,
      },
      'testDbName',
      {},
      false,
      false,
      null
    );

    await vscode.commands.executeCommand(
      'mdb.viewCollectionDocuments',
      textCollectionTree
    );
    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].path.indexOf(
        'Results: testDbName.testColName'
      ),
      0
    );
    assert(mockOpenTextDocument.firstCall.args[0].path.includes('.json'));
    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].scheme,
      VIEW_COLLECTION_SCHEME
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].query.includes(
        'namespace=testDbName.testColName'
      )
    );

    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'magna carta');
  });

  test('mdb.addConnection command should call openWebview on the webview controller', async () => {
    const mockOpenWebview = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._webviewController,
      'openWebview',
      mockOpenWebview
    );

    await vscode.commands.executeCommand('mdb.addConnection');
    assert.strictEqual(mockOpenWebview.calledOnce, true);
  });

  test('mdb.addConnectionWithURI command should call connectWithURI on the connection controller', async () => {
    const mockConnectWithUri = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connectWithURI',
      mockConnectWithUri
    );

    await vscode.commands.executeCommand('mdb.addConnectionWithURI');
    assert.strictEqual(mockConnectWithUri.calledOnce, true);
  });

  test('mdb.refreshConnection command should reset the cache on a connection tree item', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'test',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand('mdb.refreshConnection', mockTreeItem);
    assert.strictEqual(
      mockTreeItem.cacheIsUpToDate,
      false,
      'Expected cache on tree item to be set to not up to date.'
    );
    assert.strictEqual(
      mockExplorerControllerRefresh.called,
      true,
      'Expected explorer controller refresh to be called.'
    );
  });

  test('mdb.treeItemRemoveConnection command should call removeMongoDBConnection on the connection controller with the tree item connection id', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'craving_for_pancakes_with_maple_syrup',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockRemoveMongoDBConnection = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'removeMongoDBConnection',
      mockRemoveMongoDBConnection
    );

    await vscode.commands.executeCommand(
      'mdb.treeItemRemoveConnection',
      mockTreeItem
    );
    assert.strictEqual(mockRemoveMongoDBConnection.calledOnce, true);
    assert.strictEqual(
      mockRemoveMongoDBConnection.firstCall.args[0],
      'craving_for_pancakes_with_maple_syrup'
    );
  });

  test('mdb.copyConnectionString command should try to copy the driver url to the vscode env clipboard', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'craving_for_pancakes_with_maple_syrup',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake(),
    }));

    const mockStubUri = sinon.fake.returns('weStubThisUri');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'copyConnectionStringByConnectionId',
      mockStubUri
    );

    await vscode.commands.executeCommand(
      'mdb.copyConnectionString',
      mockTreeItem
    );
    assert.strictEqual(mockCopyToClipboard.calledOnce, true);
    assert.strictEqual(mockCopyToClipboard.firstCall.args[0], 'weStubThisUri');
  });

  test('mdb.copyDatabaseName command should try to copy the database name to the vscode env clipboard', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'isClubMateTheBestDrinkEver',
      {},
      false,
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake(),
    }));

    await vscode.commands.executeCommand('mdb.copyDatabaseName', mockTreeItem);
    assert.strictEqual(mockCopyToClipboard.calledOnce, true);
    assert.strictEqual(
      mockCopyToClipboard.firstCall.args[0],
      'isClubMateTheBestDrinkEver'
    );
  });

  test('mdb.copyCollectionName command should try to copy the collection name to the vscode env clipboard', async () => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'waterBuffalo',
        type: CollectionTypes.collection,
      },
      'airZebra',
      {},
      false,
      false,
      null
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake(),
    }));

    await vscode.commands.executeCommand(
      'mdb.copyCollectionName',
      mockTreeItem
    );
    assert(
      mockCopyToClipboard.called,
      'Expected "writeText" to be called on "vscode.env.clipboard".'
    );
    assert(
      mockCopyToClipboard.firstCall.args[0] === 'waterBuffalo',
      `Expected the clipboard to be sent the uri string "waterBuffalo", found ${mockCopyToClipboard.firstCall.args[0]}.`
    );
  });

  test('mdb.copySchemaFieldName command should try to copy the field name to the vscode env clipboard', async () => {
    const mockTreeItem = new FieldTreeItem(
      {
        name: 'dolphins are sentient',
        probability: 1,
        type: 'String',
        types: [],
      },
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake(),
    }));

    const commandResult = await vscode.commands.executeCommand(
      'mdb.copySchemaFieldName',
      mockTreeItem
    );

    assert(commandResult);
    assert(
      mockCopyToClipboard.called,
      'Expected "writeText" to be called on "vscode.env.clipboard".'
    );
    assert(
      mockCopyToClipboard.firstCall.args[0] === 'dolphins are sentient',
      `Expected the clipboard to be sent the schema field name "dolphins are sentient", found ${mockCopyToClipboard.firstCall.args[0]}.`
    );
  });

  test('mdb.refreshDatabase command should reset the cache on the database tree item', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'pinkLemonade',
      {},
      false,
      false,
      {}
    );

    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand('mdb.refreshDatabase', mockTreeItem);
    assert.strictEqual(
      mockTreeItem.cacheIsUpToDate,
      false,
      'Expected cache on tree item to be set to not up to date.'
    );
    assert(
      mockExplorerControllerRefresh.called === true,
      'Expected explorer controller refresh to be called.'
    );
  });

  test('mdb.refreshCollection command should reset the expanded state of its children and call to refresh the explorer controller', async () => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'iSawACatThatLookedLikeALionToday',
        type: CollectionTypes.collection,
      },
      'airZebra',
      {},
      false,
      false,
      null
    );

    mockTreeItem.isExpanded = true;

    // Set expanded.
    mockTreeItem.getSchemaChild().isExpanded = true;
    mockTreeItem.getDocumentListChild().isExpanded = true;

    const mockExplorerControllerRefresh = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand('mdb.refreshCollection', mockTreeItem);
    assert(
      mockTreeItem.getSchemaChild().isExpanded === false,
      'Expected collection tree item child to be reset to not expanded.'
    );
    assert(
      mockExplorerControllerRefresh.called === true,
      'Expected explorer controller refresh to be called.'
    );
  });

  test('mdb.refreshDocumentList command should update the document count and call to refresh the explorer controller', async () => {
    let count = 9000;
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'iSawACatThatLookedLikeALionToday',
        type: CollectionTypes.collection,
      },
      'airZebra',
      { estimatedCount: () => Promise.resolve(count) },
      false,
      false,
      null
    );

    await mockTreeItem.onDidExpand();

    const collectionChildren = await mockTreeItem.getChildren();
    const docListTreeItem = collectionChildren[0];

    assert(docListTreeItem.description === '9K');

    count = 10000;

    docListTreeItem.isExpanded = true;

    const mockExplorerControllerRefresh = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand(
      'mdb.refreshDocumentList',
      docListTreeItem
    );

    assert(
      docListTreeItem.cacheIsUpToDate === false,
      'Expected document list cache to be out of date.'
    );
    assert(
      mockTreeItem.documentCount === 10000,
      `Expected document count to be 10000, found ${mockTreeItem.documentCount}.`
    );
    assert(
      mockExplorerControllerRefresh.called === true,
      'Expected explorer controller refresh to be called.'
    );
  });

  test('mdb.refreshSchema command should reset its cache and call to refresh the explorer controller', async () => {
    const mockTreeItem = new SchemaTreeItem(
      'zebraWearwolf',
      'giraffeVampire',
      {} as DataService,
      false,
      false,
      false,
      false,
      {}
    );

    // Set cached.
    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand('mdb.refreshSchema', mockTreeItem);
    assert(
      !mockTreeItem.cacheIsUpToDate,
      'Expected schema field cache to be not up to date.'
    );
    assert(
      mockExplorerControllerRefresh.called === true,
      'Expected explorer controller refresh to be called.'
    );
  });

  test('mdb.refreshIndexes command should reset its cache and call to refresh the explorer controller', async () => {
    const mockTreeItem = new IndexListTreeItem(
      'zebraWearwolf',
      'giraffeVampire',
      {} as DataService,
      false,
      false,
      []
    );

    // Set cached.
    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand('mdb.refreshIndexes', mockTreeItem);
    assert(
      !mockTreeItem.cacheIsUpToDate,
      'Expected schema field cache to be not up to date.'
    );
    assert(
      mockExplorerControllerRefresh.called === true,
      'Expected explorer controller refresh to be called.'
    );
  });

  test('mdb.addDatabase command fails when not connected to the connection', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const addDatabaseSucceeded = await vscode.commands.executeCommand(
      'mdb.addDatabase',
      mockTreeItem
    );
    assert(
      addDatabaseSucceeded === false,
      'Expected the command handler to return a false succeeded response'
    );
    const expectedMessage =
      'Please connect to this connection before adding a database.';
    assert(
      fakeVscodeErrorMessage.firstCall.args[0] === expectedMessage,
      `Expected an error message "${expectedMessage}" to be shown when attempting to add a database to a not connected connection found "${fakeVscodeErrorMessage.firstCall.args[0]}"`
    );
  });

  test('mdb.addDatabase should create a MongoDB playground with create collection template', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.addDatabase', mockTreeItem);

    assert(mockOpenTextDocument.firstCall.args[0].language === 'mongodb');
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        '// Create a new database.'
      )
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        'NEW_DATABASE_NAME'
      )
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        'NEW_COLLECTION_NAME'
      )
    );
  });

  test('mdb.addDatabase command fails when disconnecting', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const mockIsDisconnecting = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isDisconnecting',
      mockIsDisconnecting
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const addDatabaseSucceeded = await vscode.commands.executeCommand(
      'mdb.addDatabase',
      mockTreeItem
    );
    assert(
      addDatabaseSucceeded === false,
      'Expected the add database command handler to return a false succeeded response'
    );
    const expectedMessage = 'Unable to add database: currently disconnecting.';
    assert(
      fakeVscodeErrorMessage.firstCall.args[0] === expectedMessage,
      `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${fakeVscodeErrorMessage.firstCall.args[0]}"`
    );
  });

  test('mdb.addDatabase command fails when connecting', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const mockIsConnecting = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isConnecting',
      mockIsConnecting
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);
    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const addDatabaseSucceeded = await vscode.commands.executeCommand(
      'mdb.addDatabase',
      mockTreeItem
    );
    assert(
      addDatabaseSucceeded === false,
      'Expected the add database command handler to return a false succeeded response'
    );
    const expectedMessage = 'Unable to add database: currently connecting.';
    assert(
      fakeVscodeErrorMessage.firstCall.args[0] === expectedMessage,
      `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${fakeVscodeErrorMessage.firstCall.args[0]}"`
    );
  });

  test('mdb.addCollection should create a MongoDB playground with create collection template', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      {},
      false,
      false,
      {}
    );

    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.addCollection', mockTreeItem);

    assert(mockOpenTextDocument.firstCall.args[0].language === 'mongodb');
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        '// The current database to use.'
      )
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes('iceCreamDB')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        'NEW_COLLECTION_NAME'
      )
    );
    assert(
      !mockOpenTextDocument.firstCall.args[0].content.includes('time-series')
    );
  });

  test('mdb.addCollection command fails when disconnecting', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      {},
      false,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const mockIsDisconnecting = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isDisconnecting',
      mockIsDisconnecting
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const addCollectionSucceeded = await vscode.commands.executeCommand(
      'mdb.addCollection',
      mockTreeItem
    );
    assert(
      addCollectionSucceeded === false,
      'Expected the add collection command handler to return a false succeeded response'
    );
    const expectedMessage =
      'Unable to add collection: currently disconnecting.';
    assert(
      fakeVscodeErrorMessage.firstCall.args[0] === expectedMessage,
      `Expected "${expectedMessage}" when adding a database to a not connected connection, recieved "${fakeVscodeErrorMessage.firstCall.args[0]}"`
    );
  });

  // https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups

  test('mdb.dropCollection calls data service to drop the collection after inputting the collection name', async () => {
    let calledNamespace = '';
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'testColName', type: CollectionTypes.collection },
      'testDbName',
      {
        dropCollection: (namespace, callback): void => {
          calledNamespace = namespace;
          callback(null, true);
        },
      },
      false,
      false,
      null
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('testColName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropCollection',
      testCollectionTreeItem
    );
    assert(successfullyDropped);
    assert(calledNamespace === 'testDbName.testColName');
  });

  test('mdb.dropCollection fails when a collection doesnt exist', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    await testConnectionController.addNewConnectionStringAndConnect(
      testDatabaseURI
    );
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'doesntExistColName', type: CollectionTypes.collection },
      'doesntExistDBName',
      testConnectionController.getActiveDataService(),
      false,
      false,
      null
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('doesntExistColName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropCollection',
      testCollectionTreeItem
    );
    assert(
      successfullyDropped === false,
      'Expected the drop collection command handler to return a false succeeded response'
    );
    const expectedMessage = 'Drop collection failed: ns not found';
    assert(
      fakeVscodeErrorMessage.firstCall.args[0] === expectedMessage,
      `Expected "${expectedMessage}" when dropping a collection that doesn't exist, recieved "${fakeVscodeErrorMessage.firstCall.args[0]}"`
    );

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
  });

  test('mdb.dropCollection fails when the input doesnt match the collection name', async () => {
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'orange', type: CollectionTypes.collection },
      'fruitsThatAreTasty',
      {},
      false,
      false,
      null
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('apple');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropCollection',
      testCollectionTreeItem
    );
    assert(
      successfullyDropped === false,
      'Expected the drop collection command handler to return a false succeeded response'
    );
  });

  test('mdb.dropCollection fails when the collection name input is empty', async () => {
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'orange', type: CollectionTypes.view },
      'fruitsThatAreTasty',
      {},
      false,
      false,
      null
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves(/* Return undefined. */);
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropCollection',
      testCollectionTreeItem
    );
    assert(
      successfullyDropped === false,
      'Expected the drop collection command handler to return a false succeeded response'
    );
  });

  test('mdb.dropDatabase calls dataservice to drop the database after inputting the database name', async () => {
    let calledDatabaseName = '';
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'iMissTangerineAltoids',
      {
        dropDatabase: (dbName, callback): void => {
          calledDatabaseName = dbName;
          callback(null, true);
        },
      },
      false,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('iMissTangerineAltoids');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropDatabase',
      testDatabaseTreeItem
    );
    assert.strictEqual(successfullyDropped, true);
    assert.strictEqual(calledDatabaseName, 'iMissTangerineAltoids');
  });

  test('mdb.dropDatabase succeeds even when a database doesnt exist (mdb behavior)', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    await testConnectionController.addNewConnectionStringAndConnect(
      testDatabaseURI
    );
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'narnia____a',
      testConnectionController.getActiveDataService(),
      false,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('narnia____a');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropDatabase',
      testDatabaseTreeItem
    );
    assert(
      successfullyDropped,
      'Expected the drop database command handler to return a successful boolean response'
    );
    assert(
      fakeVscodeErrorMessage.called === false,
      'Expected no error messages'
    );
  });

  test('mdb.dropDatabase fails when the input doesnt match the database name', async () => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'cinnamonToastCrunch',
      {},
      false,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('apple');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropDatabase',
      testDatabaseTreeItem
    );
    assert(
      successfullyDropped === false,
      'Expected the drop database command handler to return a false succeeded response'
    );
  });

  test('mdb.dropDatabase fails when the database name input is empty', async () => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      {},
      false,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves(/* Return undefined. */);
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropDatabase',
      testDatabaseTreeItem
    );
    assert(
      successfullyDropped === false,
      'Expected the drop database command handler to return a false succeeded response'
    );
  });

  test('mdb.renameConnection fails when the name input is empty', async () => {
    mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon =
      {
        id: 'blueBerryPancakesAndTheSmellOfBacon',
        connectionOptions: { connectionString: 'mongodb://localhost' },
        name: 'NAAAME',
        storageLocation: StorageLocation.NONE,
      };

    const mockTreeItem = new ConnectionTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves(/* Return undefined. */);
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyRenamed = await vscode.commands.executeCommand(
      'mdb.renameConnection',
      mockTreeItem
    );
    assert(
      successfullyRenamed === false,
      'Expected the rename connection command handler to return a false succeeded response'
    );
    assert(
      mdbTestExtension.testExtensionController._connectionController
        ._connections.blueBerryPancakesAndTheSmellOfBacon.name === 'NAAAME',
      'Expected connection not to be ranamed.'
    );
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
  });

  test('mdb.renameConnection updates the name of a connection', async () => {
    mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon =
      {
        id: 'blueBerryPancakesAndTheSmellOfBacon',
        name: 'NAAAME',
        connectionOptions: { connectionString: 'mongodb://localhost' },
        storageLocation: StorageLocation.NONE,
      };

    const mockTreeItem = new ConnectionTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves: any = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('orange juice');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyRenamed = await vscode.commands.executeCommand(
      'mdb.renameConnection',
      mockTreeItem
    );
    assert.strictEqual(successfullyRenamed, true);
    assert.strictEqual(
      mdbTestExtension.testExtensionController._connectionController
        ._connections.blueBerryPancakesAndTheSmellOfBacon.name,
      'orange juice'
    );
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
  });

  test('documents can be opened from the sidebar and saved to MongoDB', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345',
      },
    };

    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGet = sinon.fake.returns('pancakes');
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._documentIdStore,
      'get',
      mockGet
    );

    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse(
      [
        'VIEW_DOCUMENT_SCHEME:/',
        'waffle.house:pancakes.json?',
        'namespace=waffle.house&',
        'connectionId=tasty_sandwhich&',
        'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
        'source=treeview',
      ].join('')
    );
    activeTextEditor.document.getText = () => JSON.stringify(mockDocument);
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor
    );

    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockGetActiveDataService = sinon.fake.returns({
      find: () => {
        return Promise.resolve([mockDocument]);
      },
      findOneAndReplace: (
        namespace: string,
        filter: object,
        replacement: object,
        options: object,
        callback: (error: Error | null, result: object) => void
      ) => {
        mockDocument.name = 'something sweet';

        return callback(null, mockDocument);
      },
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );

    const documentItem = new DocumentTreeItem(
      mockDocument,
      'waffle.house',
      0,
      {} as DataService,
      () => Promise.resolve()
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromTree',
      documentItem
    );

    assert(mockOpenTextDocument.firstCall.args[0].path.includes('.json'));
    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].scheme,
      'VIEW_DOCUMENT_SCHEME'
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].query.includes('documentId=')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].query.includes('connectionId=')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].query.includes('source=treeview')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].query.includes(
        'namespace=waffle.house'
      )
    );
    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'magna carta');

    await vscode.commands.executeCommand('mdb.saveMongoDBDocument');

    assert(mockDocument.name === 'something sweet');
    assert(mockDocument.time.$time === '12345');

    const expectedMessage =
      "The document was saved successfully to 'waffle.house'";

    assert.strictEqual(
      fakeShowInformationMessage.firstCall.args[0],
      expectedMessage
    );
  });

  test('document opened from a tree has treeview source', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345',
      },
    };
    const documentItem = new DocumentTreeItem(
      mockDocument,
      'waffle.house',
      0,
      {} as DataService,
      () => Promise.resolve()
    );

    const mockFetchDocument = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._mongoDBDocumentService,
      'fetchDocument',
      mockFetchDocument
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromTree',
      documentItem
    );

    assert.strictEqual(mockFetchDocument.firstCall.args[0].source, 'treeview');
  });

  test('document opened from playground results has treeview source', async () => {
    const documentItem = {
      source: 'playground',
      line: 1,
      documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
      namespace: 'db.coll',
      connectionId: null,
    };

    const mockFetchDocument = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._mongoDBDocumentService,
      'fetchDocument',
      mockFetchDocument
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromCodeLens',
      documentItem
    );

    assert.strictEqual(
      mockFetchDocument.firstCall.args[0].source,
      'playground'
    );
  });

  test('fetchDocument recieves treeview source if document opened from a tree', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345',
      },
    };

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGet = sinon.fake.returns('pancakes');
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._documentIdStore,
      'get',
      mockGet
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
                'connectionId=tasty_sandwhich',
                'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                'source=treeview',
              ].join('&'),
            },
            getText: () => JSON.stringify(mockDocument),
            save: () => {},
          },
        } as unknown as typeof vscode.window.activeTextEditor)
    );

    const mockReplaceDocument = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._mongoDBDocumentService,
      'replaceDocument',
      mockReplaceDocument
    );

    await vscode.commands.executeCommand('mdb.saveMongoDBDocument');

    assert.strictEqual(
      mockReplaceDocument.firstCall.args[0].source,
      'treeview'
    );
  });

  test('fetchDocument recieves playground source if document opened from playground results', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345',
      },
    };

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGet = sinon.fake.returns('pancakes');
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._documentIdStore,
      'get',
      mockGet
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
                'connectionId=tasty_sandwhich',
                'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
                'source=playground',
              ].join('&'),
            },
            getText: () => JSON.stringify(mockDocument),
            save: () => {},
          },
        } as unknown as typeof vscode.window.activeTextEditor)
    );

    const mockReplaceDocument = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._mongoDBDocumentService,
      'replaceDocument',
      mockReplaceDocument
    );

    await vscode.commands.executeCommand('mdb.saveMongoDBDocument');

    assert.strictEqual(
      mockReplaceDocument.firstCall.args[0].source,
      'playground'
    );
  });

  test('mdb.searchForDocuments should create a MongoDB playground with search template', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.searchForDocuments', {
      databaseName: 'dbbbbbName',
      collectionName: 'colllllllllName',
    });

    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].language,
      'mongodb'
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        'Search for documents in the current collection.'
      )
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes('dbbbbbName')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes('colllllllllName')
    );
    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'untitled');
  });

  test('mdb.createIndexFromTreeView should create a MongoDB playground with index template', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.createIndexFromTreeView', {
      databaseName: 'dbbbbbName',
      collectionName: 'colllllllllName',
    });

    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].language,
      'mongodb'
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes('dbbbbbName')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes('colllllllllName')
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.includes(
        'Create a new index in the collection.'
      )
    );
    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'untitled');
  });

  test('mdb.createPlayground should create a MongoDB playground with default template', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGetConfiguration = sinon.fake.returns({
      get: () => true,
    });
    sinon.replace(vscode.workspace, 'getConfiguration', mockGetConfiguration);

    await vscode.commands.executeCommand('mdb.createPlayground');

    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].language,
      'mongodb'
    );
    assert(
      mockOpenTextDocument.firstCall.args[0].content.startsWith(
        '// MongoDB Playground'
      )
    );
    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'untitled');
  });

  test('mdb.createNewPlaygroundFromViewAction should create a MongoDB playground', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.createPlayground');
    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].language,
      'mongodb'
    );
    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'untitled');
  });

  test('mdb.createPlayground command should create a MongoDB playground without template', async () => {
    const mockOpenTextDocument = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGetConfiguration = sinon.fake.returns({
      get: () => false,
    });
    sinon.replace(vscode.workspace, 'getConfiguration', mockGetConfiguration);

    await vscode.commands.executeCommand('mdb.createPlayground');

    assert.strictEqual(
      mockOpenTextDocument.firstCall.args[0].language,
      'mongodb'
    );
    assert.strictEqual(mockOpenTextDocument.firstCall.args[0].content, '');
    assert.strictEqual(mockShowTextDocument.firstCall.args[0], 'untitled');
  });

  test('mdb.runSelectedPlaygroundBlocks command should call runSelectedPlaygroundBlocks on the playground controller', async () => {
    const mockRunSelectedPlaygroundBlocks = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      'runSelectedPlaygroundBlocks',
      mockRunSelectedPlaygroundBlocks
    );

    await vscode.commands.executeCommand('mdb.runSelectedPlaygroundBlocks');
    assert(
      mockRunSelectedPlaygroundBlocks.calledOnce,
      'Expected "runSelectedPlaygroundBlocks" to be called on the playground controller.'
    );
  });

  test('mdb.runAllPlaygroundBlocks command should call runAllPlaygroundBlocks on the playground controller', async () => {
    const mockRunAllPlaygroundBlocks = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      'runAllPlaygroundBlocks',
      mockRunAllPlaygroundBlocks
    );

    await vscode.commands.executeCommand('mdb.runAllPlaygroundBlocks');
    assert(
      mockRunAllPlaygroundBlocks.calledOnce,
      'Expected "runAllPlaygroundBlocks" to be called on the playground controller.'
    );
  });

  test('mdb.changeActiveConnection command should call changeActiveConnection on the playground controller', async () => {
    const mockChangeActiveConnection = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'changeActiveConnection',
      mockChangeActiveConnection
    );

    await vscode.commands.executeCommand('mdb.changeActiveConnection');
    assert(
      mockChangeActiveConnection.calledOnce,
      'Expected "changeActiveConnection" to be called on the playground controller.'
    );
  });

  test('mdb.refreshPlaygrounds command should call refreshPlaygrounds on the playgrounds explorer controller', async () => {
    const mockRefreshPlaygrounds = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundsExplorer,
      'refresh',
      mockRefreshPlaygrounds
    );

    await vscode.commands.executeCommand('mdb.refreshPlaygrounds');
    assert(
      mockRefreshPlaygrounds.calledOnce,
      'Expected "refreshPlaygrounds" to be called on the playground controller.'
    );
  });

  test("mdb.copyDocumentContentsFromTreeView should copy a document's content to the clipboard", async () => {
    const mockDocument = {
      _id: 'pancakes',
      time: {
        $time: '12345',
      },
    };

    let namespaceUsed = '';

    const mockDataService: any = {
      find: (namespace: string) => {
        namespaceUsed = namespace;
        return Promise.resolve([mockDocument]);
      },
    };

    const documentTreeItem = new DocumentTreeItem(
      mockDocument,
      'waffle.house',
      0,
      mockDataService,
      () => Promise.resolve()
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake(),
    }));

    await vscode.commands.executeCommand(
      'mdb.copyDocumentContentsFromTreeView',
      documentTreeItem
    );
    assert.strictEqual(mockCopyToClipboard.called, true);
    assert.strictEqual(
      mockCopyToClipboard.firstCall.args[0],
      `{
  "_id": "pancakes",
  "time": {
    "$time": "12345"
  }
}`
    );
    assert.strictEqual(namespaceUsed, 'waffle.house');
  });

  test("mdb.cloneDocumentFromTreeView event should open a playground with a document's content", async () => {
    const mockDocument = {
      _id: 'pancakes',
      time: new Date('3001-01-01T05:00:00.000Z'),
      objectIdField: new ObjectId('57e193d7a9cc81b4027498b2'),
    };

    let namespaceUsed = '';

    const mockDataService: any = {
      find: (namespace: string) => {
        namespaceUsed = namespace;
        return Promise.resolve([mockDocument]);
      },
    };

    const documentTreeItem = new DocumentTreeItem(
      mockDocument,
      'waffle.house',
      0,
      mockDataService,
      () => Promise.resolve()
    );

    const mockCreatePlaygroundForCloneDocument = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      'createPlaygroundForCloneDocument',
      mockCreatePlaygroundForCloneDocument
    );

    await vscode.commands.executeCommand(
      'mdb.cloneDocumentFromTreeView',
      documentTreeItem
    );
    assert.strictEqual(mockCreatePlaygroundForCloneDocument.calledOnce, true);
    assert.strictEqual(
      mockCreatePlaygroundForCloneDocument.firstCall.args[0],
      `{
  _id: 'pancakes',
  time: ISODate('3001-01-01T05:00:00.000Z'),
  objectIdField: ObjectId('57e193d7a9cc81b4027498b2')
}`
    );
    assert.strictEqual(
      mockCreatePlaygroundForCloneDocument.firstCall.args[1],
      'waffle'
    );
    assert.strictEqual(
      mockCreatePlaygroundForCloneDocument.firstCall.args[2],
      'house'
    );
    assert.strictEqual(namespaceUsed, 'waffle.house');
  });

  test('mdb.deleteDocumentFromTreeView should not delete a document when the confirmation is cancelled', async () => {
    const mockDocument = {
      _id: 'pancakes',
      time: {
        $time: '12345',
      },
    };

    let calledDelete = false;

    const mockDataService: any = {
      deleteOne: (
        namespace: string,
        _id: any,
        options: object,
        callback: (error: Error | undefined, documents: object[]) => void
      ) => {
        calledDelete = true;
        callback(undefined, [mockDocument]);
      },
    };

    const documentTreeItem = new DocumentTreeItem(
      mockDocument,
      'waffle.house',
      0,
      mockDataService,
      () => Promise.resolve()
    );

    const result = await vscode.commands.executeCommand(
      'mdb.deleteDocumentFromTreeView',
      documentTreeItem
    );

    assert.strictEqual(result, false);
    assert.strictEqual(calledDelete, false);
  });

  test('mdb.deleteDocumentFromTreeView deletes a document after confirmation', async () => {
    fakeShowInformationMessage.resolves('Yes');

    const mockDocument = {
      _id: 'pancakes',
      time: {
        $time: '12345',
      },
    };

    let namespaceUsed = '';
    let _idUsed;

    const mockDataService: any = {
      deleteOne: (
        namespace: string,
        query: any,
        options: object,
        callback: (
          error: Error | undefined,
          result: { deletedCount: number }
        ) => void
      ) => {
        _idUsed = query;
        namespaceUsed = namespace;
        callback(undefined, {
          deletedCount: 1,
        });
      },
    };

    const documentTreeItem = new DocumentTreeItem(
      mockDocument,
      'waffle.house',
      0,
      mockDataService,
      () => Promise.resolve()
    );

    const result = await vscode.commands.executeCommand(
      'mdb.deleteDocumentFromTreeView',
      documentTreeItem
    );
    assert.deepStrictEqual(_idUsed, {
      _id: 'pancakes',
    });
    assert.strictEqual(namespaceUsed, 'waffle.house');
    assert.strictEqual(result, true);
  });

  suite(
    'when a user hasnt been shown the initial overview page yet and they have no connections saved',
    () => {
      let mockVSCodeExecuteCommand: SinonSpy;
      let mockStorageControllerUpdate: SinonSpy;

      beforeEach(() => {
        mockVSCodeExecuteCommand = sinon.fake.resolves(undefined);
        sinon.replace(
          vscode.commands,
          'executeCommand',
          mockVSCodeExecuteCommand
        );
        sinon.replace(
          mdbTestExtension.testExtensionController._storageController,
          'get',
          sinon.fake.returns(false)
        );
        sinon.replace(
          mdbTestExtension.testExtensionController._storageController,
          'hasSavedConnections',
          sinon.fake.returns(false)
        );

        mockStorageControllerUpdate = sinon.fake.resolves(undefined);
        sinon.replace(
          mdbTestExtension.testExtensionController._storageController,
          'update',
          mockStorageControllerUpdate
        );

        void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
      });

      afterEach(() => {
        sinon.restore();
      });

      test('they are shown the overview page', () => {
        assert(mockVSCodeExecuteCommand.called);
        assert(
          mockVSCodeExecuteCommand.firstCall.args[0] === 'mdb.openOverviewPage'
        );
        assert(
          mockVSCodeExecuteCommand.firstCall.args[0] ===
            EXTENSION_COMMANDS.MDB_OPEN_OVERVIEW_PAGE
        );
      });

      test("it sets that they've been shown the overview page", () => {
        assert(mockStorageControllerUpdate.called);
        assert(
          mockStorageControllerUpdate.firstCall.args[0] ===
            StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW
        );
        assert(
          mockStorageControllerUpdate.firstCall.args[0] ===
            'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW'
        );
        assert(mockStorageControllerUpdate.firstCall.args[1] === true);
      });
    }
  );

  suite(
    'when a user hasnt been shown the initial overview page yet and they have connections saved',
    () => {
      let mockVSCodeExecuteCommand: SinonSpy;
      let mockStorageControllerUpdate: SinonSpy;

      beforeEach(() => {
        mockVSCodeExecuteCommand = sinon.fake.resolves(undefined);
        sinon.replace(
          vscode.commands,
          'executeCommand',
          mockVSCodeExecuteCommand
        );
        sinon.replace(
          mdbTestExtension.testExtensionController._storageController,
          'get',
          sinon.fake.returns(undefined)
        );

        sinon.replace(
          mdbTestExtension.testExtensionController._storageController,
          'hasSavedConnections',
          sinon.fake.returns(true)
        );

        mockStorageControllerUpdate = sinon.fake.resolves(undefined);
        sinon.replace(
          mdbTestExtension.testExtensionController._storageController,
          'update',
          mockStorageControllerUpdate
        );

        void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
      });

      test('they are not shown the overview page', () => {
        assert(!mockVSCodeExecuteCommand.called);
      });

      test("it sets that they've been shown the overview page", () => {
        assert(mockStorageControllerUpdate.called);
        assert(
          mockStorageControllerUpdate.firstCall.args[0] ===
            StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW
        );
        assert(
          mockStorageControllerUpdate.firstCall.args[0] ===
            'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW'
        );
        assert(mockStorageControllerUpdate.firstCall.args[1] === true);
      });
    }
  );

  suite('when a user has been shown the initial overview page', () => {
    let mockVSCodeExecuteCommand: SinonSpy;

    beforeEach(() => {
      sinon.replace(
        mdbTestExtension.testExtensionController._storageController,
        'get',
        sinon.fake.returns(true)
      );

      mockVSCodeExecuteCommand = sinon.fake.resolves(undefined);
      sinon.replace(
        vscode.commands,
        'executeCommand',
        mockVSCodeExecuteCommand
      );

      void mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
    });

    test('they are not shown the overview page', () => {
      assert(!mockVSCodeExecuteCommand.called);
    });
  });
});
