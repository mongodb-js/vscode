/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import assert from 'assert';
import sinon, { SinonSpy } from 'sinon';

import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';
import {
  CollectionTreeItem,
  CollectionTypes,
  ConnectionTreeItem,
  DatabaseTreeItem,
  DocumentTreeItem,
  SchemaTreeItem
} from '../../explorer';
import EXTENSION_COMMANDS from '../../commands';
import FieldTreeItem from '../../explorer/fieldTreeItem';
import IndexListTreeItem from '../../explorer/indexListTreeItem';
import { mdbTestExtension } from './stubbableMdbExtension';
import { mockTextEditor } from './stubs';
import {
  StorageScope,
  StorageVariables
} from '../../storage/storageController';
import ConnectionModel from '../../views/webview-app/connection-model/connection-model';
import TreeItemParentInterface from '../../explorer/treeItemParentInterface';

const testDatabaseURI = 'mongodb://localhost:27018';

const mockEmptyMongoClient: any = {};

suite('MDBExtensionController Test Suite', function () {
  this.timeout(10000);

  const sandbox: any = sinon.createSandbox();
  const fakeShowInformationMessage = sinon.fake();

  beforeEach(() => {
    // Here we stub the showInformationMessage process because it is too much
    // for the render process and leads to crashes while testing.
    sinon.replace(
      vscode.window,
      'showInformationMessage',
      fakeShowInformationMessage
    );
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName',
        type: CollectionTypes.collection
      },
      'testDbName',
      mockEmptyMongoClient,
      false,
      false,
      null
    );

    await vscode.commands.executeCommand(
      'mdb.viewCollectionDocuments',
      textCollectionTree
    );
    assert(
      mockOpenTextDocument.firstArg.path.indexOf(
        'Results: testDbName.testColName'
      ) === 0
    );
    assert(mockOpenTextDocument.firstArg.path.includes('.json'));
    assert(mockOpenTextDocument.firstArg.scheme === VIEW_COLLECTION_SCHEME);
    assert(
      mockOpenTextDocument.firstArg.query.includes(
        'namespace=testDbName.testColName'
      )
    );

    assert(
      mockShowTextDocument.firstArg === 'magna carta',
      'Expected it to call vscode to show the returned documents from the provider'
    );
  });

  test('mdb.viewCollectionDocuments command should also work with the documents list', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName',
        type: CollectionTypes.collection
      },
      'testDbName',
      mockEmptyMongoClient,
      false,
      false,
      null
    );

    await vscode.commands.executeCommand(
      'mdb.viewCollectionDocuments',
      textCollectionTree
    );
    assert(
      mockOpenTextDocument.firstArg.path.indexOf(
        'Results: testDbName.testColName'
      ) === 0
    );
    assert(mockOpenTextDocument.firstArg.path.includes('.json'));
    assert(mockOpenTextDocument.firstArg.scheme === VIEW_COLLECTION_SCHEME);
    assert(
      mockOpenTextDocument.firstArg.query.includes(
        'namespace=testDbName.testColName'
      )
    );

    assert(
      mockShowTextDocument.firstArg === 'magna carta',
      'Expected it to call vscode to show the returned documents from the provider'
    );
  });

  test('mdb.addConnection command should call openWebview on the webview controller', async () => {
    const mockOpenWebview: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._webviewController,
      'openWebview',
      mockOpenWebview
    );

    await vscode.commands.executeCommand('mdb.addConnection');
    assert(
      mockOpenWebview.called,
      'Expected "mockOpenWebview" to be called on the webview controller.'
    );
  });

  test('mdb.addConnectionWithURI command should call connectWithURI on the connection controller', async () => {
    const mockConnectWithUri: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connectWithURI',
      mockConnectWithUri
    );

    await vscode.commands.executeCommand(
      'mdb.addConnectionWithURI'
    );
    assert(
      mockConnectWithUri.called,
      'Expected "connectWithURI" to be called on the connection controller.'
    );
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

    const mockExplorerControllerRefresh: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand(
      'mdb.refreshConnection',
      mockTreeItem
    );
    assert(
      (mockTreeItem as any).cacheIsUpToDate === false,
      'Expected cache on tree item to be set to not up to date.'
    );
    assert(
      mockExplorerControllerRefresh.called === true,
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

    const mockRemoveMongoDBConnection: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'removeMongoDBConnection',
      mockRemoveMongoDBConnection
    );

    await vscode.commands.executeCommand(
      'mdb.treeItemRemoveConnection',
      mockTreeItem
    );
    assert(
      mockRemoveMongoDBConnection.called,
      'Expected "removeMongoDBConnection" to be called on the connection controller.'
    );
    assert(
      mockRemoveMongoDBConnection.firstArg ===
            'craving_for_pancakes_with_maple_syrup',
      `Expected the mock connection controller to be called to remove the connection with the id "craving_for_pancakes_with_maple_syrup", found ${mockRemoveMongoDBConnection.firstArg}.`
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
      readText: sinon.fake()
    }));

    const mockStubUri: any = sinon.fake.returns('weStubThisUri');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getConnectionStringFromConnectionId',
      mockStubUri
    );

    await vscode.commands.executeCommand(
      'mdb.copyConnectionString',
      mockTreeItem
    );
    assert(
      mockCopyToClipboard.called,
      'Expected "writeText" to be called on "vscode.env.clipboard".'
    );
    assert(
      mockCopyToClipboard.firstCall.firstArg === 'weStubThisUri',
      `Expected the clipboard to be sent the uri string "weStubThisUri", found ${mockCopyToClipboard.firstCall.firstArg}.`
    );
  });

  test('mdb.copyDatabaseName command should try to copy the database name to the vscode env clipboard', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'isClubMateTheBestDrinkEver',
      mockEmptyMongoClient,
      false,
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake()
    }));

    await vscode.commands.executeCommand(
      'mdb.copyDatabaseName',
      mockTreeItem
    );
    assert(
      mockCopyToClipboard.called,
      'Expected "writeText" to be called on "vscode.env.clipboard".'
    );
    assert(
      mockCopyToClipboard.firstCall.firstArg === 'isClubMateTheBestDrinkEver',
      `Expected the clipboard to be sent the uri string "isClubMateTheBestDrinkEver", found ${mockCopyToClipboard.firstCall.firstArg}.`
    );
  });

  test('mdb.copyCollectionName command should try to copy the collection name to the vscode env clipboard', async () => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'waterBuffalo',
        type: CollectionTypes.collection
      },
      'airZebra',
      mockEmptyMongoClient,
      false,
      false,
      null
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake()
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
      mockCopyToClipboard.firstCall.firstArg === 'waterBuffalo',
      `Expected the clipboard to be sent the uri string "waterBuffalo", found ${mockCopyToClipboard.firstCall.firstArg}.`
    );
  });

  test('mdb.copySchemaFieldName command should try to copy the field name to the vscode env clipboard', async () => {
    const mockTreeItem = new FieldTreeItem(
      {
        name: 'dolphins are sentient',
        probability: 1,
        type: 'String',
        types: []
      },
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake();
    sinon.replaceGetter(vscode.env, 'clipboard', () => ({
      writeText: mockCopyToClipboard,
      readText: sinon.fake()
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
      mockCopyToClipboard.firstCall.firstArg === 'dolphins are sentient',
      `Expected the clipboard to be sent the schema field name "dolphins are sentient", found ${mockCopyToClipboard.firstCall.firstArg}.`
    );
  });

  test('mdb.refreshDatabase command should reset the cache on the database tree item', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'pinkLemonade',
      mockEmptyMongoClient,
      false,
      false,
      {}
    );

    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand(
      'mdb.refreshDatabase',
      mockTreeItem
    );
    assert(
      (mockTreeItem as any).cacheIsUpToDate === false,
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
        type: CollectionTypes.collection
      },
      'airZebra',
      mockEmptyMongoClient,
      false,
      false,
      null
    );

    mockTreeItem.isExpanded = true;

    // Set expanded.
    mockTreeItem.getSchemaChild().isExpanded = true;
    mockTreeItem.getDocumentListChild().isExpanded = true;

    const mockExplorerControllerRefresh: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    await vscode.commands.executeCommand(
      'mdb.refreshCollection',
      mockTreeItem
    );
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
        type: CollectionTypes.collection
      },
      'airZebra',
      {
        estimatedCount: (ns, opts, cb): void => {
          cb(null, count);
        }
      } as any,
      false,
      false,
      null
    );

    await mockTreeItem.onDidExpand();

    const collectionChildren = await mockTreeItem.getChildren();
    const docListTreeItem = collectionChildren[0] as (vscode.TreeItem & TreeItemParentInterface);

    assert(docListTreeItem.description === '9K');

    count = 10000;

    docListTreeItem.isExpanded = true;

    const mockExplorerControllerRefresh: any = sinon.fake();
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
      mockEmptyMongoClient,
      false,
      false,
      false,
      false,
      {}
    );

    // Set cached.
    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh: any = sinon.fake();
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
      mockEmptyMongoClient,
      false,
      false,
      []
    );

    // Set cached.
    mockTreeItem.cacheIsUpToDate = true;

    const mockExplorerControllerRefresh: any = sinon.fake();
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
      fakeVscodeErrorMessage.firstCall.firstArg === expectedMessage,
      `Expected an error message "${expectedMessage}" to be shown when attempting to add a database to a not connected connection found "${fakeVscodeErrorMessage.firstCall.firstArg}"`
    );
  });

  test('mdb.addDatabase command calls the dataservice to add the database and collection the user inputs', async () => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    let returnedNamespaceArg = '';
    const mockGetActiveDataService = sinon.fake.returns({
      createCollection: (namespace: string, options, callback) => {
        returnedNamespaceArg = namespace;
        callback(null);
      }
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );
    const mockActiveConnectionId: any = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const succeeded = await vscode.commands.executeCommand(
      'mdb.addDatabase',
      mockTreeItem
    );
    assert(succeeded);
    assert(
      mockInputBoxResolves.called === true,
      'Expected show input box to be called'
    );
    assert(
      returnedNamespaceArg === 'theDbName.theCollectionName',
      'Expected create collection to be called with the namespace supplied.'
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

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const mockIsDisconnecting: any = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isDisconnecting',
      mockIsDisconnecting
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const mockActiveConnectionId: any = sinon.fake.returns('tasty_sandwhich');
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
    const expectedMessage =
          'Unable to add database: currently disconnecting.';
    assert(
      fakeVscodeErrorMessage.firstCall.firstArg === expectedMessage,
      `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${fakeVscodeErrorMessage.firstCall.firstArg}"`
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

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const mockIsConnecting: any = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isConnecting',
      mockIsConnecting
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);
    const mockActiveConnectionId: any = sinon.fake.returns('tasty_sandwhich');
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
      fakeVscodeErrorMessage.firstCall.firstArg === expectedMessage,
      `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${fakeVscodeErrorMessage.firstCall.firstArg}"`
    );
  });

  test('mdb.addDatabase shows a status bar item while it is creating the collection then hide it', async () => {
    const stubShowMessage = sinon.fake();
    const stubHideMessage = sinon.fake();

    const testStatusViewObject = {
      show: stubShowMessage,
      hide: stubHideMessage,
      text: ''
    };
    const mockSatusBarItem: any = sinon.fake.returns(testStatusViewObject);
    sinon.replace(vscode.window, 'createStatusBarItem', mockSatusBarItem);

    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);
    const mockGetActiveDataService = sinon.fake.returns({
      createCollection: (namespace, options, callback) => {
        assert(stubShowMessage.called);
        assert(!stubHideMessage.called);
        const expectedMessage = 'Creating new database and collection...';
        assert(
          testStatusViewObject.text === expectedMessage,
          `Expected to show status bar message "${expectedMessage}", found ${stubShowMessage.firstCall.firstArg}`
        );

        callback(null);
      }
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );
    const mockActiveConnectionId: any = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    await vscode.commands.executeCommand(
      'mdb.addDatabase',
      mockTreeItem
    );
    assert(stubHideMessage.called === true);
  });

  test('mdb.addCollection command calls the dataservice to add the collection the user inputs', async () => {
    let returnedDatabaseArg = '';
    let returnedCollectionArg = '';
    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      {
        db: (database: string) => ({
          createCollection: (collection: string): Promise<void> => {
            returnedDatabaseArg = database;
            returnedCollectionArg = collection;

            return Promise.resolve();
          }
        })
      } as any,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const addCollectionSucceeded = await vscode.commands.executeCommand(
      'mdb.addCollection',
      mockTreeItem
    );
    assert(addCollectionSucceeded);
    assert(
      mockInputBoxResolves.called === true,
      'Expected show input box to be called'
    );
    assert(
      returnedDatabaseArg === 'iceCreamDB',
      `Expected create collection to be called with the database "iceCreamDB" got ${
        returnedDatabaseArg
      }.`
    );
    assert(
      returnedCollectionArg === 'mintChocolateChips',
      `Expected create collection to be called with the collection "mintChocolateChips" got ${
        returnedCollectionArg
      }.`
    );
  });

  test('mdb.addCollection command fails when disconnecting', async () => {
    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      mockEmptyMongoClient,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const mockIsDisconnecting: any = sinon.fake.returns(true);
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
      fakeVscodeErrorMessage.firstCall.firstArg === expectedMessage,
      `Expected "${expectedMessage}" when adding a database to a not connected connection, recieved "${fakeVscodeErrorMessage.firstCall.firstArg}"`
    );
  });

  test('mdb.addCollection shows a status bar item while it is creating the collection then hide it', async () => {
    const stubShowMessage = sinon.stub();
    const stubHideMessage = sinon.stub();

    const testStatusViewObject = {
      show: stubShowMessage,
      hide: stubHideMessage,
      text: ''
    };
    const mockSatusBarItem = sinon.fake.returns(testStatusViewObject);
    sinon.replace(vscode.window, 'createStatusBarItem', mockSatusBarItem);

    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      {
        db: () => ({
          createCollection: (): Promise<void> => {
            assert(stubShowMessage.called);
            assert(!stubHideMessage.called);
            const expectedMessage = 'Creating new collection...';
            assert(
              testStatusViewObject.text === expectedMessage,
              `Expected to show status bar message "${expectedMessage}", found ${stubShowMessage.firstCall.firstArg}`
            );

            return Promise.resolve();
          }
        })
      } as any,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    await vscode.commands.executeCommand(
      'mdb.addCollection',
      mockTreeItem
    );
    assert(stubHideMessage.called === true);
  });

  // https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups

  test('mdb.dropCollection calls dataservice to drop the collection after inputting the collection name', async () => {
    let calledDatabaseArg = '';
    let calledCollectionArg = '';
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'testColName', type: CollectionTypes.collection },
      'testDbName',
      {
        db: (database: string) => ({
          createCollection: (collection: string): Promise<boolean> => {
            calledDatabaseArg = database;
            calledCollectionArg = collection;

            return Promise.resolve(true);
          }
        })
      } as any,
      false,
      false,
      null
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('testColName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropCollection',
      testCollectionTreeItem
    );
    assert(successfullyDropped);
    assert(calledDatabaseArg === 'testDbName');
    assert(calledCollectionArg === 'testColName');
  });

  test('mdb.dropCollection fails when a collection doesnt exist', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    await testConnectionController.addNewConnectionStringAndConnect(
      testDatabaseURI
    );

    const dataService = testConnectionController.getActiveDataService();

    if (!dataService) {
      throw new Error('expected data service for testing drop collection');
    }

    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'doesntExistColName', type: CollectionTypes.collection },
      'doesntExistDBName',
      dataService,
      false,
      false,
      null
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('doesntExistColName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(
      vscode.window,
      'showErrorMessage',
      fakeVscodeErrorMessage
    );

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
      fakeVscodeErrorMessage.firstCall.firstArg === expectedMessage,
      `Expected "${expectedMessage}" when dropping a collection that doesn't exist, recieved "${fakeVscodeErrorMessage.firstCall.firstArg}"`
    );

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
  });

  test('mdb.dropCollection fails when the input doesnt match the collection name', async () => {
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'orange', type: CollectionTypes.collection },
      'fruitsThatAreTasty',
      mockEmptyMongoClient,
      false,
      false,
      null
    );

    const mockInputBoxResolves = sinon.stub();
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
      mockEmptyMongoClient,
      false,
      false,
      null
    );

    const mockInputBoxResolves = sinon.stub();
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
        db: (dbName: string) => ({
          dropDatabase: (): Promise<void> => {
            calledDatabaseName = dbName;
            return Promise.resolve();
          }
        })
      } as any,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('iMissTangerineAltoids');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyDropped = await vscode.commands.executeCommand(
      'mdb.dropDatabase',
      testDatabaseTreeItem
    );
    assert(successfullyDropped);
    assert(calledDatabaseName === 'iMissTangerineAltoids');
  });

  test('mdb.dropDatabase succeeds even when a database doesnt exist (mdb behavior)', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    await testConnectionController.addNewConnectionStringAndConnect(
      testDatabaseURI
    );

    const dataService = testConnectionController.getActiveDataService();
    if (!dataService) {
      throw new Error('expected dataservice to exist');
    }
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'narnia____a',
      dataService,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('narnia____a');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(
      vscode.window,
      'showErrorMessage',
      fakeVscodeErrorMessage
    );

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
      mockEmptyMongoClient,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
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
      mockEmptyMongoClient,
      false,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
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
    mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon = {
      id: 'blueBerryPancakesAndTheSmellOfBacon',
      connectionModel: new ConnectionModel(),
      name: 'NAAAME',
      storageLocation: StorageScope.NONE
    };

    const mockTreeItem = new ConnectionTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
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
    mdbTestExtension.testExtensionController._connectionController._connections.blueBerryPancakesAndTheSmellOfBacon = {
      id: 'blueBerryPancakesAndTheSmellOfBacon',
      name: 'NAAAME',
      connectionModel: new ConnectionModel(),
      storageLocation: StorageScope.NONE
    };

    const mockTreeItem = new ConnectionTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('orange juice');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const successfullyRenamed = await vscode.commands.executeCommand(
      'mdb.renameConnection',
      mockTreeItem
    );
    assert(successfullyRenamed);
    assert(
      mdbTestExtension.testExtensionController._connectionController
        ._connections.blueBerryPancakesAndTheSmellOfBacon.name ===
            'orange juice',
      'Expected connection to be ranamed.'
    );
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
  });

  test('documents can be opened from the sidebar and saved to MongoDB', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345'
      }
    };

    const mockOpenTextDocument: any = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGet: any = sinon.fake.returns('pancakes');
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._documentIdStore,
      'get',
      mockGet
    );

    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse([
      'VIEW_DOCUMENT_SCHEME:/',
      'waffle.house:pancakes.json?',
      'namespace=waffle.house&',
      'connectionId=tasty_sandwhich&',
      'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
      'source=treeview'
    ].join(''));
    activeTextEditor.document.getText = () => JSON.stringify(mockDocument);
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => activeTextEditor);

    const mockActiveConnectionId: any = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockGetActiveDataService = sinon.fake.returns({
      find: (
        namespace: string,
        filter: object,
        options: object,
        callback: (error: Error | undefined, documents: object[]) => void
      ) => {
        callback(undefined, [mockDocument]);
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
      }
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );

    const documentItem = new DocumentTreeItem(mockDocument, 'waffle.house', 0);

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromTree',
      documentItem
    );

    assert(mockOpenTextDocument.firstArg.path.includes('.json'));
    assert(mockOpenTextDocument.firstArg.scheme === 'VIEW_DOCUMENT_SCHEME');
    assert(mockOpenTextDocument.firstArg.query.includes('documentId='));
    assert(mockOpenTextDocument.firstArg.query.includes('connectionId='));
    assert(mockOpenTextDocument.firstArg.query.includes('source=treeview'));
    assert(
      mockOpenTextDocument.firstArg.query.includes('namespace=waffle.house')
    );
    assert(
      mockShowTextDocument.firstArg === 'magna carta',
      'Expected it to call vscode to show the returned document from the provider'
    );

    await vscode.commands.executeCommand('mdb.saveMongoDBDocument');

    assert(mockDocument.name === 'something sweet');
    assert(mockDocument.time.$time === '12345');

    const expectedMessage =
      "The document was saved successfully to 'waffle.house'";

    assert(
      fakeShowInformationMessage.firstCall.firstArg === expectedMessage,
      `Expected an error message "${expectedMessage}" to be shown when attempting to add a database to a not connected connection found "${fakeShowInformationMessage.firstCall.firstArg}"`
    );
  });

  test('document opened from a tree has treeview source', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345'
      }
    };
    const documentItem = new DocumentTreeItem(mockDocument, 'waffle.house', 0);

    const mockFetchDocument: any = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController._mongoDBDocumentService,
      'fetchDocument',
      mockFetchDocument
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromTree',
      documentItem
    );

    assert(mockFetchDocument.firstArg.source === 'treeview');
  });

  test('document opened from playground results has treeview source', async () => {
    const documentItem = {
      source: 'playground',
      line: 1,
      documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
      namespace: 'db.coll',
      connectionId: null
    };

    const mockFetchDocument: any = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController._mongoDBDocumentService,
      'fetchDocument',
      mockFetchDocument
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromCodeLens',
      documentItem
    );

    assert(mockFetchDocument.firstArg.source === 'playground');
  });

  test('fetchDocument recieves treeview source if document opened from a tree', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345'
      }
    };

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGet: any = sinon.fake.returns('pancakes');
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._documentIdStore,
      'get',
      mockGet
    );

    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
            'source=treeview'
          ].join('&')
        },
        getText: () => JSON.stringify(mockDocument),
        save: () => {}
      }
    }));

    const mockReplaceDocument: any = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController._mongoDBDocumentService,
      'replaceDocument',
      mockReplaceDocument
    );

    await vscode.commands.executeCommand('mdb.saveMongoDBDocument');

    assert(mockReplaceDocument.firstArg.source === 'treeview');
  });

  test('fetchDocument recieves playground source if document opened from playground results', async () => {
    const mockDocument = {
      _id: 'pancakes',
      name: '',
      time: {
        $time: '12345'
      }
    };

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGet: any = sinon.fake.returns('pancakes');
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController
        ._documentIdStore,
      'get',
      mockGet
    );

    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a',
            'source=playground'
          ].join('&')
        },
        getText: () => JSON.stringify(mockDocument),
        save: () => {}
      }
    }));

    const mockReplaceDocument: any = sinon.fake.resolves(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._editorsController._mongoDBDocumentService,
      'replaceDocument',
      mockReplaceDocument
    );

    await vscode.commands.executeCommand('mdb.saveMongoDBDocument');

    assert(mockReplaceDocument.firstArg.source === 'playground');
  });

  test('mdb.searchForDocuments should create a MongoDB playground with search template', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.searchForDocuments', {
      databaseName: 'dbbbbbName',
      collectionName: 'colllllllllName'
    });

    assert(mockOpenTextDocument.firstArg.language === 'mongodb');
    assert(
      mockOpenTextDocument.firstArg.content.includes(
        'Search for documents in the current collection.'
      )
    );
    assert(mockOpenTextDocument.firstArg.content.includes('dbbbbbName'));
    assert(mockOpenTextDocument.firstArg.content.includes('colllllllllName'));
    assert(
      mockShowTextDocument.firstArg === 'untitled',
      'Expected it to call vscode to show the playground'
    );
  });

  test('mdb.createIndexFromTreeView should create a MongoDB playground with search template', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.createIndexFromTreeView', {
      databaseName: 'dbbbbbName',
      collectionName: 'colllllllllName'
    });

    assert(mockOpenTextDocument.firstArg.language === 'mongodb');
    assert(mockOpenTextDocument.firstArg.content.includes('dbbbbbName'));
    assert(mockOpenTextDocument.firstArg.content.includes('colllllllllName'));
    assert(
      mockOpenTextDocument.firstArg.content.includes(
        'Create a new index in the collection.'
      )
    );
    assert(
      mockShowTextDocument.firstArg === 'untitled',
      'Expected it to call vscode to show the playground'
    );
  });

  test('mdb.createPlayground should create a MongoDB playground with default template', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGetConfiguration: any = sinon.fake.returns({
      get: () => true
    });
    sinon.replace(vscode.workspace, 'getConfiguration', mockGetConfiguration);

    await vscode.commands.executeCommand('mdb.createPlayground');

    assert(mockOpenTextDocument.firstArg.language === 'mongodb');
    assert(
      mockOpenTextDocument.firstArg.content.startsWith('// MongoDB Playground')
    );
    assert(
      mockShowTextDocument.firstArg === 'untitled',
      'Expected it to call vscode to show the playground'
    );
  });

  test('mdb.createNewPlaygroundFromViewAction should create a MongoDB playground', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    await vscode.commands.executeCommand('mdb.createPlayground');
    assert(mockOpenTextDocument.firstArg.language === 'mongodb');
    assert(
      mockShowTextDocument.firstArg === 'untitled',
      'Expected it to call vscode to show the playground'
    );
  });

  test('mdb.createPlayground command should create a MongoDB playground without template', async () => {
    const mockOpenTextDocument: any = sinon.fake.resolves('untitled');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument: any = sinon.fake();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const mockGetConfiguration: any = sinon.fake.returns({
      get: () => false
    });
    sinon.replace(vscode.workspace, 'getConfiguration', mockGetConfiguration);

    await vscode.commands.executeCommand('mdb.createPlayground');

    assert(mockOpenTextDocument.firstArg.language === 'mongodb');
    assert(mockOpenTextDocument.firstArg.content === '');
    assert(
      mockShowTextDocument.firstArg === 'untitled',
      'Expected it to call vscode to show the playground'
    );
  });

  test('mdb.runSelectedPlaygroundBlocks command should call runSelectedPlaygroundBlocks on the playground controller', async () => {
    const mockRunSelectedPlaygroundBlocks: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      'runSelectedPlaygroundBlocks',
      mockRunSelectedPlaygroundBlocks
    );

    await vscode.commands.executeCommand(
      'mdb.runSelectedPlaygroundBlocks'
    );
    assert(
      mockRunSelectedPlaygroundBlocks.called,
      'Expected "runSelectedPlaygroundBlocks" to be called on the playground controller.'
    );
  });

  test('mdb.runAllPlaygroundBlocks command should call runAllPlaygroundBlocks on the playground controller', async () => {
    const mockRunAllPlaygroundBlocks: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      'runAllPlaygroundBlocks',
      mockRunAllPlaygroundBlocks
    );

    await vscode.commands.executeCommand(
      'mdb.runAllPlaygroundBlocks'
    );

    assert(
      mockRunAllPlaygroundBlocks.called,
      'Expected "runAllPlaygroundBlocks" to be called on the playground controller.'
    );
  });

  test('mdb.changeActiveConnection command should call changeActiveConnection on the playground controller', async () => {
    const mockChangeActiveConnection: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'changeActiveConnection',
      mockChangeActiveConnection
    );

    await vscode.commands.executeCommand(
      'mdb.changeActiveConnection'
    );

    assert(
      mockChangeActiveConnection.called,
      'Expected "changeActiveConnection" to be called on the playground controller.'
    );
  });

  test('mdb.refreshPlaygrounds command should call refreshPlaygrounds on the playgrounds explorer controller', async () => {
    const mockRefreshPlaygrounds: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundsExplorer,
      'refresh',
      mockRefreshPlaygrounds
    );

    await vscode.commands.executeCommand(
      'mdb.refreshPlaygrounds'
    );

    assert(
      mockRefreshPlaygrounds.called,
      'Expected "refreshPlaygrounds" to be called on the playground controller.'
    );
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

        mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
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

        mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
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

      mdbTestExtension.testExtensionController.showOverviewPageIfRecentlyInstalled();
    });

    test('they are not shown the overview page', () => {
      assert(!mockVSCodeExecuteCommand.called);
    });
  });
});
