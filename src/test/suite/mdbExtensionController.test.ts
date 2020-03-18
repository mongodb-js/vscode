import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
const sinon = require('sinon');

import {
  VIEW_COLLECTION_SCHEME
} from '../../editors/collectionDocumentsProvider';
import {
  VIEW_DOCUMENT_SCHEME
} from '../../editors/documentProvider';
import {
  CollectionTreeItem,
  CollectionTypes,
  ConnectionTreeItem,
  DatabaseTreeItem,
  DocumentTreeItem,
  SchemaTreeItem
} from '../../explorer';
import { mdbTestExtension } from './stubbableMdbExtension';
import ConnectionController from '../../connectionController';
import { StorageController } from '../../storage';
import { StorageScope } from '../../storage/storageController';

const testDatabaseURI = 'mongodb://localhost:27018';

suite('MDBExtensionController Test Suite', () => {
  afterEach(() => {
    sinon.restore();
  });

  test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', (done) => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake.resolves();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName',
        type: CollectionTypes.collection
      },
      'testDbName',
      {},
      false
    );

    vscode.commands
      .executeCommand('mdb.viewCollectionDocuments', textCollectionTree)
      .then(() => {
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
      })
      .then(done, done);
  });

  test('mdb.viewCollectionDocuments command should also work with the documents list', (done) => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake.resolves();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName',
        type: CollectionTypes.collection
      },
      'testDbName',
      {},
      false
    );

    vscode.commands
      .executeCommand('mdb.viewCollectionDocuments', textCollectionTree)
      .then(() => {
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
      })
      .then(done, done);
  });

  test('mdb.addConnection command should call addMongoDBConnection on the connection controller', (done) => {
    const mockAddConnection = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'addMongoDBConnection',
      mockAddConnection
    );

    vscode.commands
      .executeCommand('mdb.addConnection')
      .then(() => {
        assert(
          mockAddConnection.called,
          'Expected "addMongoDBConnection" to be called on the connection controller.'
        );
      })
      .then(done, done);
  });

  test('mdb.addConnectionWithURI command should call connectWithURI on the connection controller', (done) => {
    const mockConnectWithUri = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connectWithURI',
      mockConnectWithUri
    );

    vscode.commands
      .executeCommand('mdb.addConnectionWithURI')
      .then(() => {
        assert(
          mockConnectWithUri.called,
          'Expected "connectWithURI" to be called on the connection controller.'
        );
      })
      .then(done, done);
  });

  test('mdb.refreshConnection command should reset the cache on a connection tree item', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'test',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    mockTreeItem._childrenCacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    vscode.commands
      .executeCommand('mdb.refreshConnection', mockTreeItem)
      .then(() => {
        assert(
          mockTreeItem._childrenCacheIsUpToDate === false,
          'Expected cache on tree item to be set to not up to date.'
        );
        assert(
          mockExplorerControllerRefresh.called === true,
          'Expected explorer controller refresh to be called.'
        );
      })
      .then(done, done);
  });

  test('mdb.treeItemRemoveConnection command should call removeMongoDBConnection on the connection controller with the tree item connection id', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'craving_for_pancakes_with_maple_syrup',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockRemoveMongoDBConnection = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'removeMongoDBConnection',
      mockRemoveMongoDBConnection
    );

    vscode.commands
      .executeCommand('mdb.treeItemRemoveConnection', mockTreeItem)
      .then(() => {
        assert(
          mockRemoveMongoDBConnection.called,
          'Expected "removeMongoDBConnection" to be called on the connection controller.'
        );
        assert(
          mockRemoveMongoDBConnection.firstArg ===
          'craving_for_pancakes_with_maple_syrup',
          `Expected the mock connection controller to be called to remove the connection with the id "craving_for_pancakes_with_maple_syrup", found ${mockRemoveMongoDBConnection.firstArg}.`
        );
      })
      .then(done, done);
  });

  test('mdb.copyConnectionString command should try to copy the driver url to the vscode env clipboard', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'craving_for_pancakes_with_maple_syrup',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockCopyToClipboard = sinon.fake.resolves();
    sinon.replace(vscode.env.clipboard, 'writeText', mockCopyToClipboard);

    const mockStubUri = sinon.fake.returns('weStubThisUri');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getConnectionStringFromConnectionId',
      mockStubUri
    );

    vscode.commands
      .executeCommand('mdb.copyConnectionString', mockTreeItem)
      .then(() => {
        assert(
          mockCopyToClipboard.called,
          'Expected "writeText" to be called on "vscode.env.clipboard".'
        );
        assert(
          mockCopyToClipboard.firstArg === 'weStubThisUri',
          `Expected the clipboard to be sent the uri string "weStubThisUri", found ${mockCopyToClipboard.firstArg}.`
        );
      })
      .then(done, done);
  });

  test('mdb.copyDatabaseName command should try to copy the database name to the vscode env clipboard', (done) => {
    const mockTreeItem = new DatabaseTreeItem(
      'isClubMateTheBestDrinkEver',
      {},
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake.resolves();
    sinon.replace(vscode.env.clipboard, 'writeText', mockCopyToClipboard);

    vscode.commands
      .executeCommand('mdb.copyDatabaseName', mockTreeItem)
      .then(() => {
        assert(
          mockCopyToClipboard.called,
          'Expected "writeText" to be called on "vscode.env.clipboard".'
        );
        assert(
          mockCopyToClipboard.firstArg === 'isClubMateTheBestDrinkEver',
          `Expected the clipboard to be sent the uri string "isClubMateTheBestDrinkEver", found ${mockCopyToClipboard.firstArg}.`
        );
      })
      .then(done, done);
  });

  test('mdb.copyCollectionName command should try to copy the collection name to the vscode env clipboard', (done) => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'waterBuffalo',
        type: CollectionTypes.collection
      },
      'airZebra',
      {},
      false
    );

    const mockCopyToClipboard = sinon.fake.resolves();
    sinon.replace(vscode.env.clipboard, 'writeText', mockCopyToClipboard);

    vscode.commands
      .executeCommand('mdb.copyCollectionName', mockTreeItem)
      .then(() => {
        assert(
          mockCopyToClipboard.called,
          'Expected "writeText" to be called on "vscode.env.clipboard".'
        );
        assert(
          mockCopyToClipboard.firstArg === 'waterBuffalo',
          `Expected the clipboard to be sent the uri string "waterBuffalo", found ${mockCopyToClipboard.firstArg}.`
        );
      })
      .then(done, done);
  });

  test('mdb.refreshDatabase command should reset the cache on the database tree item', (done) => {
    const mockTreeItem = new DatabaseTreeItem('pinkLemonade', {}, false, {});

    mockTreeItem._childrenCacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    vscode.commands
      .executeCommand('mdb.refreshDatabase', mockTreeItem)
      .then(() => {
        assert(
          mockTreeItem._childrenCacheIsUpToDate === false,
          'Expected cache on tree item to be set to not up to date.'
        );
        assert(
          mockExplorerControllerRefresh.called === true,
          'Expected explorer controller refresh to be called.'
        );
      })
      .then(done, done);
  });

  test('mdb.refreshCollection command should reset the expanded state of its children and call to refresh the explorer controller', (done) => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'iSawACatThatLookedLikeALionToday',
        type: CollectionTypes.collection
      },
      'airZebra',
      {},
      false
    );

    // Set expanded.
    mockTreeItem.getSchemaChild().isExpanded = true;
    mockTreeItem.getDocumentListChild().isExpanded = true;

    const mockExplorerControllerRefresh = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    vscode.commands
      .executeCommand('mdb.refreshCollection', mockTreeItem)
      .then(() => {
        assert(
          mockTreeItem.getDocumentListChild().isExpanded === false,
          'Expected document list on collection tree item to be reset to not expanded.'
        );
        assert(
          mockTreeItem.getSchemaChild().isExpanded === false,
          'Expected schema on collection tree item to be reset to not expanded.'
        );
        assert(
          mockExplorerControllerRefresh.called === true,
          'Expected explorer controller refresh to be called.'
        );
      })
      .then(done, done);
  });

  test('mdb.refreshSchema command should reset its cache and call to refresh the explorer controller', (done) => {
    const mockTreeItem = new SchemaTreeItem(
      'zebraWearwolf',
      'giraffeVampire',
      {},
      false
    );

    // Set cached.
    mockTreeItem.childrenCacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    vscode.commands
      .executeCommand('mdb.refreshSchema', mockTreeItem)
      .then(() => {
        assert(
          mockTreeItem.childrenCacheIsUpToDate === false,
          'Expected schema field cache to be not up to date.'
        );
        assert(
          mockExplorerControllerRefresh.called === true,
          'Expected explorer controller refresh to be called.'
        );
      })
      .then(done, done);
  });

  test('mdb.addDatabase command fails when not connected to the connection', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    vscode.commands
      .executeCommand('mdb.addDatabase', mockTreeItem)
      .then((addDatabaseSucceeded) => {
        assert(
          addDatabaseSucceeded === false,
          'Expected the command handler to return a false succeeded response'
        );
        const expectedMessage =
          'Please connect to this connection before adding a database.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected an error message "${expectedMessage}" to be shown when attempting to add a database to a not connected connection found "${fakeVscodeErrorMessage.firstArg}"`
        );
      }, done)
      .then(done, done);
  });

  test('mdb.addDatabase command calls the dataservice to add the database and collection the user inputs', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('theDbName');
    mockInputBoxResolves.onCall(1).resolves('theCollectionName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    let returnedNamespaceArg = '';
    const mockGetActiveDataService = sinon.fake.returns({
      createCollection: (namespace, options, callback) => {
        returnedNamespaceArg = namespace;
        callback(null);
      }
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );
    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    vscode.commands
      .executeCommand('mdb.addDatabase', mockTreeItem)
      .then((succeeded) => {
        assert(succeeded);
        assert(
          mockInputBoxResolves.called === true,
          'Expected show input box to be called'
        );
        assert(
          returnedNamespaceArg === 'theDbName.theCollectionName',
          'Expected create collection to be called with the namespace supplied.'
        );
      })
      .then(done, done);
  });

  test('mdb.addDatabase command fails when disconnecting', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
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

    vscode.commands
      .executeCommand('mdb.addDatabase', mockTreeItem)
      .then((addDatabaseSucceeded) => {
        assert(
          addDatabaseSucceeded === false,
          'Expected the add database command handler to return a false succeeded response'
        );
        const expectedMessage =
          'Unable to add database: currently disconnecting.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${fakeVscodeErrorMessage.firstArg}"`
        );
      }, done)
      .then(done, done);
  });

  test('mdb.addDatabase command fails when connecting', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
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

    vscode.commands
      .executeCommand('mdb.addDatabase', mockTreeItem)
      .then((addDatabaseSucceeded) => {
        assert(
          addDatabaseSucceeded === false,
          'Expected the add database command handler to return a false succeeded response'
        );
        const expectedMessage = 'Unable to add database: currently connecting.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${fakeVscodeErrorMessage.firstArg}"`
        );
      })
      .then(done, done);
  });

  test('mdb.addDatabase shows a status bar item while it is creating the collection then hide it', (done) => {
    const stubShowMessage = sinon.fake();
    const stubHideMessage = sinon.fake();

    const testStatusViewObject = {
      show: stubShowMessage,
      hide: stubHideMessage,
      text: ''
    };
    const mockSatusBarItem = sinon.fake.returns(testStatusViewObject);
    sinon.replace(vscode.window, 'createStatusBarItem', mockSatusBarItem);

    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
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
          `Expected to show status bar message "${expectedMessage}", found ${stubShowMessage.firstArg}`
        );

        callback(null);
      }
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );
    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    vscode.commands
      .executeCommand('mdb.addDatabase', mockTreeItem)
      .then(() => {
        assert(stubHideMessage.called === true);
      })
      .then(done, done);
  });

  test('mdb.addCollection command calls the dataservice to add the collection the user inputs', (done) => {
    let returnedNamespaceArg = '';
    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      {
        createCollection: (namespace, options, callback): void => {
          returnedNamespaceArg = namespace;
          callback(null);
        }
      },
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.addCollection', mockTreeItem)
      .then((addCollectionSucceeded) => {
        assert(addCollectionSucceeded);
        assert(
          mockInputBoxResolves.called === true,
          'Expected show input box to be called'
        );
        assert(
          returnedNamespaceArg === 'iceCreamDB.mintChocolateChips',
          `Expected create collection to be called with the namespace "iceCreamDB.mintChocolateChips" got ${returnedNamespaceArg}.`
        );
      })
      .then(done, done);
  });

  test('mdb.addCollection command fails when disconnecting', (done) => {
    const mockTreeItem = new DatabaseTreeItem('iceCreamDB', {}, false, {});

    const mockInputBoxResolves = sinon.stub();
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

    vscode.commands
      .executeCommand('mdb.addCollection', mockTreeItem)
      .then((addCollectionSucceeded) => {
        assert(
          addCollectionSucceeded === false,
          'Expected the add collection command handler to return a false succeeded response'
        );
        const expectedMessage =
          'Unable to add collection: currently disconnecting.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected "${expectedMessage}" when adding a database to a not connected connection, recieved "${fakeVscodeErrorMessage.firstArg}"`
        );
      })
      .then(done, done);
  });

  test('mdb.addCollection shows a status bar item while it is creating the collection then hide it', (done) => {
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
        createCollection: (namespace, options, callback): void => {
          assert(stubShowMessage.called);
          assert(!stubHideMessage.called);
          const expectedMessage = 'Creating new collection...';
          assert(
            testStatusViewObject.text === expectedMessage,
            `Expected to show status bar message "${expectedMessage}", found ${stubShowMessage.firstArg}`
          );

          callback(null);
        }
      },
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.addCollection', mockTreeItem)
      .then(() => {
        assert(stubHideMessage.called === true);
      })
      .then(done, done);
  });

  // https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups

  test('mdb.dropCollection calls dataservice to drop the collection after inputting the collection name', (done) => {
    let calledNamespace = '';
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'testColName' },
      'testDbName',
      {
        dropCollection: (namespace, callback): void => {
          calledNamespace = namespace;
          callback(null, true);
        }
      },
      false
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('testColName');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.dropCollection', testCollectionTreeItem)
      .then((successfullyDropped) => {
        assert(successfullyDropped);
        assert(calledNamespace === 'testDbName.testColName');
      })
      .then(done, done);
  });

  test('mdb.dropCollection fails when a collection doesnt exist', (done) => {
    const testConnectionController = new ConnectionController(
      mdbTestExtension.testExtensionController._statusView,
      new StorageController(mdbTestExtension.testExtensionContext)
    );

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        const testCollectionTreeItem = new CollectionTreeItem(
          { name: 'doesntExistColName', type: CollectionTypes.collection },
          'doesntExistDBName',
          testConnectionController.getActiveDataService(),
          false
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

        vscode.commands
          .executeCommand('mdb.dropCollection', testCollectionTreeItem)
          .then((successfullyDropped) => {
            assert(
              successfullyDropped === false,
              'Expected the drop collection command handler to return a false succeeded response'
            );
            const expectedMessage = 'Drop collection failed: ns not found';
            assert(
              fakeVscodeErrorMessage.firstArg === expectedMessage,
              `Expected "${expectedMessage}" when dropping a collection that doesn't exist, recieved "${fakeVscodeErrorMessage.firstArg}"`
            );
          })
          .then(done, done);
      });
  });

  test('mdb.dropCollection fails when the input doesnt match the collection name', (done) => {
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'orange', type: CollectionTypes.collection },
      'fruitsThatAreTasty',
      {},
      false
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('apple');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.dropCollection', testCollectionTreeItem)
      .then((successfullyDropped) => {
        assert(
          successfullyDropped === false,
          'Expected the drop collection command handler to return a false succeeded response'
        );
      })
      .then(done, done);
  });

  test('mdb.dropCollection fails when the collection name input is empty', (done) => {
    const testCollectionTreeItem = new CollectionTreeItem(
      { name: 'orange', type: CollectionTypes.view },
      'fruitsThatAreTasty',
      {},
      false
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves(/* Return undefined. */);
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.dropCollection', testCollectionTreeItem)
      .then((successfullyDropped) => {
        assert(
          successfullyDropped === false,
          'Expected the drop collection command handler to return a false succeeded response'
        );
      })
      .then(done, done);
  });

  test('mdb.dropDatabase calls dataservice to drop the database after inputting the database name', (done) => {
    let calledDatabaseName = '';
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'iMissTangerineAltoids',
      {
        dropDatabase: (dbName, callback): void => {
          calledDatabaseName = dbName;
          callback(null, true);
        }
      },
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('iMissTangerineAltoids');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.dropDatabase', testDatabaseTreeItem)
      .then((successfullyDropped) => {
        assert(successfullyDropped);
        assert(calledDatabaseName === 'iMissTangerineAltoids');
      })
      .then(done, done);
  });

  test('mdb.dropDatabase succeeds even when a database doesnt exist (mdb behavior)', (done) => {
    const testConnectionController = new ConnectionController(
      mdbTestExtension.testExtensionController._statusView,
      new StorageController(mdbTestExtension.testExtensionContext)
    );

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        const testDatabaseTreeItem = new DatabaseTreeItem(
          'narnia____a',
          testConnectionController.getActiveDataService(),
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

        vscode.commands
          .executeCommand('mdb.dropDatabase', testDatabaseTreeItem)
          .then((successfullyDropped) => {
            assert(
              successfullyDropped,
              'Expected the drop database command handler to return a successful boolean response'
            );
            assert(
              fakeVscodeErrorMessage.called === false,
              'Expected no error messages'
            );
          })
          .then(done, done);
      });
  });

  test('mdb.dropDatabase fails when the input doesnt match the database name', (done) => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'cinnamonToastCrunch',
      {},
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('apple');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.dropDatabase', testDatabaseTreeItem)
      .then((successfullyDropped) => {
        assert(
          successfullyDropped === false,
          'Expected the drop database command handler to return a false succeeded response'
        );
      })
      .then(done, done);
  });

  test('mdb.dropDatabase fails when the database name input is empty', (done) => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      {},
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves(/* Return undefined. */);
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.dropDatabase', testDatabaseTreeItem)
      .then((successfullyDropped) => {
        assert(
          successfullyDropped === false,
          'Expected the drop database command handler to return a false succeeded response'
        );
      })
      .then(done, done);
  });

  test('mdb.renameConnection fails when the name input is empty', (done) => {
    mdbTestExtension.testExtensionController._connectionController._savedConnections.blueBerryPancakesAndTheSmellOfBacon = {
      id: 'blueBerryPancakesAndTheSmellOfBacon',
      name: 'NAAAME',
      driverUrl: '',
      storageLocation: StorageScope.NONE
    };

    const mockTreeItem = new ConnectionTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves(/* Return undefined. */);
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.renameConnection', mockTreeItem)
      .then((successfullyRenamed) => {
        assert(
          successfullyRenamed === false,
          'Expected the rename connection command handler to return a false succeeded response'
        );
        assert(
          mdbTestExtension.testExtensionController._connectionController
            ._savedConnections.blueBerryPancakesAndTheSmellOfBacon.name ===
          'NAAAME',
          'Expected connection not to be ranamed.'
        );
        mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
      })
      .then(done, () => {
        mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
        done();
      });
  });

  test('mdb.renameConnection updates the name of a connection', (done) => {
    mdbTestExtension.testExtensionController._connectionController._savedConnections.blueBerryPancakesAndTheSmellOfBacon = {
      id: 'blueBerryPancakesAndTheSmellOfBacon',
      name: 'NAAAME',
      driverUrl: '',
      storageLocation: StorageScope.NONE
    };

    const mockTreeItem = new ConnectionTreeItem(
      'blueBerryPancakesAndTheSmellOfBacon',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('orange juice');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    vscode.commands
      .executeCommand('mdb.renameConnection', mockTreeItem)
      .then((successfullyRenamed) => {
        assert(successfullyRenamed);
        assert(
          mdbTestExtension.testExtensionController._connectionController
            ._savedConnections.blueBerryPancakesAndTheSmellOfBacon.name ===
          'orange juice',
          'Expected connection to be ranamed.'
        );
        mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
      })
      .then(done, () => {
        mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
        done();
      });
  });

  test('mdb.viewDocument opens an editor with the document using its id', (done) => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake.resolves();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const documentItem = new DocumentTreeItem(
      {
        _id: 'pancakes'
      },
      'waffle.house',
      0
    );

    vscode.commands
      .executeCommand('mdb.viewDocument', documentItem)
      .then(() => {
        assert(
          mockOpenTextDocument.firstArg.path.includes(
            'waffle.house: "pancakes"'
          )
        );
        assert(mockOpenTextDocument.firstArg.path.includes('.json'));
        assert(mockOpenTextDocument.firstArg.scheme === VIEW_DOCUMENT_SCHEME);
        assert(
          mockOpenTextDocument.firstArg.query.includes(
            'documentId={"value":"pancakes"}'
          )
        );
        assert(
          mockOpenTextDocument.firstArg.query.includes(
            'namespace=waffle.house'
          )
        );

        assert(
          mockShowTextDocument.firstArg === 'magna carta',
          'Expected it to call vscode to show the returned document from the provider'
        );
      })
      .then(done, done);
  });

  // To test:
  // Open collection document.
  // Open document fails.
  // Open document with weird _id.

  // NOTE: We're using regular json stringify now. For better _id and things.
});
