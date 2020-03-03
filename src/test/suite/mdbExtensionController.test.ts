import * as assert from 'assert';
import * as vscode from 'vscode';
import { after } from 'mocha';
const sinon = require('sinon');

import ConnectionController from '../../connectionController';
import { CollectionTreeItem } from '../../explorer';
import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';
import { StorageController } from '../../storage';
import { TestExtensionContext } from './stubs';
import { StatusView } from '../../views';
import ConnectionTreeItem from '../../explorer/connectionTreeItem';

import { mdbTestExtension } from './stubbableMdbExtension';

suite('MDBExtensionController Test Suite', () => {
  after(function () {
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

  // Commands to test:
  // 'mdb.addConnectionWithURI',
  // 'mdb.copyConnectionString',
  // 'mdb.refreshConnection',
  // 'mdb.treeItemRemoveConnection',

  // 'mdb.addDatabase',
  // 'mdb.copyDatabaseName',
  // 'mdb.refreshDatabase',
  // 'mdb.addCollection',
  // 'mdb.copyCollectionName',
  // 'mdb.refreshCollection',

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

    vscode.commands.executeCommand('mdb.refreshConnection', mockTreeItem).then(() => {
      assert(
        mockTreeItem._childrenCacheIsUpToDate === false,
        'Expected cache on tree item to be set to not up to date.'
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
});
