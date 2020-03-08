import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
const sinon = require('sinon');

import { CollectionTreeItem } from '../../explorer';
import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';
import ConnectionTreeItem from '../../explorer/connectionTreeItem';

import { mdbTestExtension } from './stubbableMdbExtension';
import DatabaseTreeItem from '../../explorer/databaseTreeItem';
import { CollectionTypes } from '../../explorer/collectionTreeItem';

suite('MDBExtensionController Test Suite', () => {
  afterEach(function () {
    sinon.restore();
  });

  test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', (done) => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake.resolves();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName'
      },
      'testDbName',
      {},
      false,
      [],
      10
    );

    vscode.commands.executeCommand('mdb.viewCollectionDocuments', textCollectionTree).then(() => {
      assert(mockOpenTextDocument.firstArg.path.indexOf('Results: testDbName.testColName') === 0);
      assert(mockOpenTextDocument.firstArg.path.includes('.json'));
      assert(mockOpenTextDocument.firstArg.scheme === VIEW_COLLECTION_SCHEME);
      assert(mockOpenTextDocument.firstArg.query.includes('namespace=testDbName.testColName'));

      assert(
        mockShowTextDocument.firstArg === 'magna carta',
        'Expected it to call vscode to show the returned documents from the provider'
      );
    }).then(done, done);
  });

  test('mdb.addConnection command should call addMongoDBConnection on the connection controller', (done) => {
    const mockAddConnection = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'addMongoDBConnection',
      mockAddConnection
    );

    vscode.commands.executeCommand('mdb.addConnection').then(() => {
      assert(
        mockAddConnection.called,
        'Expected "addMongoDBConnection" to be called on the connection controller.'
      );
    }).then(done, done);
  });

  test('mdb.addConnectionWithURI command should call connectWithURI on the connection controller', (done) => {
    const mockConnectWithUri = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connectWithURI',
      mockConnectWithUri
    );

    vscode.commands.executeCommand('mdb.addConnectionWithURI').then(() => {
      assert(
        mockConnectWithUri.called,
        'Expected "connectWithURI" to be called on the connection controller.'
      );
    }).then(done, done);
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

    vscode.commands.executeCommand('mdb.refreshConnection', mockTreeItem).then(() => {
      assert(
        mockTreeItem._childrenCacheIsUpToDate === false,
        'Expected cache on tree item to be set to not up to date.'
      );
      assert(
        mockExplorerControllerRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    }).then(done, done);
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

    vscode.commands.executeCommand('mdb.treeItemRemoveConnection', mockTreeItem).then(() => {
      assert(
        mockRemoveMongoDBConnection.called,
        'Expected "removeMongoDBConnection" to be called on the connection controller.'
      );
      assert(
        mockRemoveMongoDBConnection.firstArg === 'craving_for_pancakes_with_maple_syrup',
        `Expected the mock connection controller to be called to remove the connection with the id "craving_for_pancakes_with_maple_syrup", found ${mockRemoveMongoDBConnection.firstArg}.`
      );
    }).then(done, done);
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
    sinon.replace(
      vscode.env.clipboard,
      'writeText',
      mockCopyToClipboard
    );

    const mockStubUri = sinon.fake.returns('weStubThisUri');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getConnectionStringFromConnectionId',
      mockStubUri
    );

    vscode.commands.executeCommand('mdb.copyConnectionString', mockTreeItem).then(() => {
      assert(
        mockCopyToClipboard.called,
        'Expected "writeText" to be called on "vscode.env.clipboard".'
      );
      assert(
        mockCopyToClipboard.firstArg === 'weStubThisUri',
        `Expected the clipboard to be sent the uri string "weStubThisUri", found ${mockCopyToClipboard.firstArg}.`
      );
    }).then(done, done);
  });

  test('mdb.copyDatabaseName command should try to copy the database name to the vscode env clipboard', (done) => {
    const mockTreeItem = new DatabaseTreeItem(
      'isClubMateTheBestDrinkEver',
      {},
      false,
      {}
    );

    const mockCopyToClipboard = sinon.fake.resolves();
    sinon.replace(
      vscode.env.clipboard,
      'writeText',
      mockCopyToClipboard
    );

    vscode.commands.executeCommand('mdb.copyDatabaseName', mockTreeItem).then(() => {
      assert(
        mockCopyToClipboard.called,
        'Expected "writeText" to be called on "vscode.env.clipboard".'
      );
      assert(
        mockCopyToClipboard.firstArg === 'isClubMateTheBestDrinkEver',
        `Expected the clipboard to be sent the uri string "isClubMateTheBestDrinkEver", found ${mockCopyToClipboard.firstArg}.`
      );
    }).then(done, done);
  });

  test('mdb.copyCollectionName command should try to copy the collection name to the vscode env clipboard', (done) => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'waterBuffalo',
        type: CollectionTypes.collection
      },
      'airZebra',
      {},
      false,
      [],
      5
    );

    const mockCopyToClipboard = sinon.fake.resolves();
    sinon.replace(
      vscode.env.clipboard,
      'writeText',
      mockCopyToClipboard
    );

    vscode.commands.executeCommand('mdb.copyCollectionName', mockTreeItem).then(() => {
      assert(
        mockCopyToClipboard.called,
        'Expected "writeText" to be called on "vscode.env.clipboard".'
      );
      assert(
        mockCopyToClipboard.firstArg === 'waterBuffalo',
        `Expected the clipboard to be sent the uri string "waterBuffalo", found ${mockCopyToClipboard.firstArg}.`
      );
    }).then(done, done);
  });

  test('mdb.refreshDatabase command should reset the cache on the database tree item', (done) => {
    const mockTreeItem = new DatabaseTreeItem(
      'pinkLemonade',
      {},
      false,
      {}
    );

    mockTreeItem._childrenCacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    vscode.commands.executeCommand('mdb.refreshDatabase', mockTreeItem).then(() => {
      assert(
        mockTreeItem._childrenCacheIsUpToDate === false,
        'Expected cache on tree item to be set to not up to date.'
      );
      assert(
        mockExplorerControllerRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    }).then(done, done);
  });

  test('mdb.refreshCollection command should reset the cache on the collection tree item and call to refresh the explorer controller', (done) => {
    const mockTreeItem = new CollectionTreeItem(
      {
        name: 'iSawACatThatLookedLikeALionToday',
        type: CollectionTypes.collection
      },
      'airZebra',
      {},
      false,
      [],
      5
    );

    mockTreeItem._childrenCacheIsUpToDate = true;

    const mockExplorerControllerRefresh = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._explorerController,
      'refresh',
      mockExplorerControllerRefresh
    );

    vscode.commands.executeCommand('mdb.refreshCollection', mockTreeItem).then(() => {
      assert(
        mockTreeItem._childrenCacheIsUpToDate === false,
        'Expected cache on tree item to be set to not up to date.'
      );
      assert(
        mockExplorerControllerRefresh.called === true,
        'Expected explorer controller refresh to be called.'
      );
    }).then(done, done);
  });

  test('mdb.addDatabase command fails when not connected to the connection', (done) => {
    const mockTreeItem = new ConnectionTreeItem(
      'tasty_sandwhich',
      vscode.TreeItemCollapsibleState.None,
      false,
      mdbTestExtension.testExtensionController._connectionController,
      {}
    );

    vscode.commands.executeCommand('mdb.addDatabase', mockTreeItem).then(() => {
      assert(
        false,
        'Expected an error to occur when attempting to add a database to a not connected connection'
      );
    }, (err) => {
      assert(
        err.message === 'Please connect to this connection before adding a database.',
        `Expected "Please connect to this connection before adding a database." when adding a database to a not connected connection, recieved "${err.message}"`
      );
    }).then(done, done);
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
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );

    let returnedNamespaceArg = '';
    const mockGetActiveConnection = sinon.fake.returns({
      createCollection: (namespace, options, callback) => {
        returnedNamespaceArg = namespace;
        callback(null);
      }
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnection',
      mockGetActiveConnection
    );
    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionInstanceId',
      mockActiveConnectionId
    );

    vscode.commands.executeCommand('mdb.addDatabase', mockTreeItem).then(() => {
      assert(
        mockInputBoxResolves.called === true,
        'Expected show input box to be called'
      );
      assert(
        returnedNamespaceArg === 'theDbName.theCollectionName',
        'Expected create collection to be called with the namespace supplied.'
      );
    }).then(done, done);
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
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );

    const mockIsDisconnecting = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isDisconnecting',
      mockIsDisconnecting
    );

    vscode.commands.executeCommand('mdb.addDatabase', mockTreeItem).then(() => {
      assert(
        false,
        'Expected an error to occur when attempting to add a database to a not connected connection'
      );
    }, (err) => {
      assert(
        err.message === 'Please connect to this connection before adding a database.',
        `Expected "Please connect to this connection before adding a database." when adding a database to a not connected connection, recieved "${err.message}"`
      );
    }).then(done, done);
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
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );

    const mockIsConnecting = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isConnecting',
      mockIsConnecting
    );

    vscode.commands.executeCommand('mdb.addDatabase', mockTreeItem).then(() => {
      assert(
        false,
        'Expected an error to occur when attempting to add a database to a not connected connection'
      );
    }, (err) => {
      assert(
        err.message === 'Please connect to this connection before adding a database.',
        `Expected "Please connect to this connection before adding a database." when adding a database to a not connected connection, recieved "${err.message}"`
      );
    }).then(done, done);
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
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );
    const mockGetActiveConnection = sinon.fake.returns({
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
      'getActiveConnection',
      mockGetActiveConnection
    );
    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionInstanceId',
      mockActiveConnectionId
    );

    vscode.commands.executeCommand('mdb.addDatabase', mockTreeItem).then(() => {
      assert(stubHideMessage.called === true);
    }).then(done, done);
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
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );

    vscode.commands.executeCommand('mdb.addCollection', mockTreeItem).then(() => {
      assert(
        mockInputBoxResolves.called === true,
        'Expected show input box to be called'
      );
      assert(
        returnedNamespaceArg === 'iceCreamDB.mintChocolateChips',
        `Expected create collection to be called with the namespace "iceCreamDB.mintChocolateChips" got ${returnedNamespaceArg}.`
      );
    }).then(done, done);
  });

  test('mdb.addCollection command fails when disconnecting', (done) => {
    const mockTreeItem = new DatabaseTreeItem(
      'iceCreamDB',
      {},
      false,
      {}
    );

    const mockInputBoxResolves = sinon.stub();
    mockInputBoxResolves.onCall(0).resolves('mintChocolateChips');
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );

    const mockIsDisconnecting = sinon.fake.returns(true);
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isDisconnecting',
      mockIsDisconnecting
    );

    vscode.commands.executeCommand('mdb.addCollection', mockTreeItem).then(() => {
      assert(
        false,
        'Expected to error'
      );
    }, err => {
      assert(
        err.message === 'Unable to add collection: currently disconnecting.',
        `Expected "Unable to add collection: currently disconnecting." when adding a database to a not connected connection, recieved "${err.message}"`
      );
    }).then(done, done);
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
    sinon.replace(
      vscode.window,
      'showInputBox',
      mockInputBoxResolves
    );

    vscode.commands.executeCommand('mdb.addCollection', mockTreeItem).then(() => {
      assert(stubHideMessage.called === true);
    }).then(done, done);
  });
});
