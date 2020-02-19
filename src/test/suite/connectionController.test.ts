import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';

import ConnectionController, {
  DataServiceEventTypes
} from '../../connectionController';
import { StorageController, StorageVariables } from '../../storage';
import { STORAGE_PREFIX } from '../../storage/storageController';
import { StatusView } from '../../views';

import { TestExtensionContext } from './stubs';

const testDatabaseURI = 'mongodb://localhost';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Connection Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  before(require('mongodb-runner/mocha/before'));
  after(require('mongodb-runner/mocha/after'));

  const mockExtensionContext = new TestExtensionContext();
  // Disable the dialogue for prompting the user where to store the connection.
  mockExtensionContext.globalState.update(
    `${STORAGE_PREFIX}${StorageVariables.HIDE_OPTION_TO_CHOOSE_CONNECTION_STORING_SCOPE}`,
    true
  );
  const mockStorageController = new StorageController(mockExtensionContext);

  test('it connects to mongodb', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );
        assert(
          Object.keys(testConnectionController.getConnections()).length === 1,
          'Expected there to be 1 connection in the connection list.'
        );
        const instanceId = testConnectionController.getActiveConnectionInstanceId();
        assert(
          instanceId === 'localhost:27017',
          `Expected active connection to be 'localhost:27017' found ${instanceId}`
        );
      })
      .then(done, done);
  });

  test('"disconnect()" disconnects from the active connection', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .disconnect()
          .then(successfullyDisconnected => {
            assert(
              successfullyDisconnected === true,
              'Expected a successful (true) disconnect response.'
            );
            // Disconnecting should keep the connection contract, just disconnected.
            const connectionsCount = Object.keys(
              testConnectionController.getConnections()
            ).length;
            assert(
              connectionsCount === 1,
              `Expected the amount of connections to be 1 found ${connectionsCount}.`
            );
            const instanceId = testConnectionController.getActiveConnectionInstanceId();
            assert(
              instanceId === null,
              `Expected the active connection instance id to be null, found ${instanceId}`
            );
          })
          .then(done, done);
      });
  });

  test('"removeMongoDBConnection()" returns a reject promise when there is no active connection', done => {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController
      .removeMongoDBConnection()
      .then(null, err => {
        assert(!!err, `Expected an error response, recieved ${err}.`);
      })
      .then(done, done);
  });

  test('"disconnect()" fails when there is no active connection', done => {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController
      .disconnect()
      .then(null, err => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('when adding a new connection it disconnects from the current connection', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .addNewConnectionAndConnect(testDatabaseURI2WithTimeout)
          .then(null, err => {
            assert(!!err, 'Expected an error promise response.');
            assert(
              testConnectionController.getActiveConnection() === null,
              'Expected to current connection to be null (not connected).'
            );
            assert(
              testConnectionController.getActiveConnectionInstanceId() === null,
              'Expected to current connection instanceId to be null (not connected).'
            );
          })
          .then(done, done);
      });
  });

  test('when adding a new connection it disconnects from the current connection', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .addNewConnectionAndConnect(testDatabaseURI2WithTimeout)
          .then(null, err => {
            assert(!!err, 'Expected an error promise response.');
            assert(
              testConnectionController.getActiveConnection() === null,
              'Expected to current connection to be null (not connected).'
            );
            assert(
              testConnectionController.getActiveConnectionInstanceId() === null,
              'Expected to current connection instanceId to be null (not connected).'
            );
          })
          .then(done, done);
      });
  });

  test('"connect()" failed when we are currently connecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setConnnecting(true);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(null, err => {
        assert(!!err, 'Expected an error promise response.');
      })
      .then(done, done);
  });

  test('"connect()" failed when we are currently disconnecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setDisconnecting(true);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(null, err => {
        assert(!!err, 'Expected an error promise response.');
      })
      .then(done, done);
  });

  test('"disconnect()" fails when we are currently connecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setConnnecting(true);

    testConnectionController
      .disconnect()
      .then(null, err => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('"disconnect()" fails when we are currently disconnecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setDisconnecting(true);

    testConnectionController
      .disconnect()
      .then(null, err => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('"connect()" should fire a CONNECTIONS_DID_CHANGE event', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    let didFireConnectionEvent = false;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        didFireConnectionEvent = true;
      }
    );

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        setTimeout(function () {
          assert(
            didFireConnectionEvent === true,
            'Expected connection event to be fired.'
          );
          done();
        }, 150);
      });
  });

  const expectedTimesToFire = 3;
  test(`"connect()" then "disconnect()" should fire the connections did change event ${expectedTimesToFire} times`, function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    let connectionEventFiredCount = 0;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        connectionEventFiredCount++;
      }
    );

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        testConnectionController.disconnect().then(() => {
          setTimeout(function () {
            assert(
              connectionEventFiredCount === expectedTimesToFire,
              `Expected connection event to be fired ${expectedTimesToFire} times, got ${connectionEventFiredCount}.`
            );
            done();
          }, 150);
        });
      });
  });

  // test('when there are no existing connections in the store and the connection controller is activated', function () {
  //   const testExtensionContext = new TestExtensionContext();
  //   const testStorageController = new StorageController(testExtensionContext);

  //   const testConnectionController = new ConnectionController(
  //     new StatusView(),
  //     testStorageController
  //   );

  //   testConnectionController.activate();
  //   assert(
  //     testConnectionController.getConnections() === {},
  //     `Expected connections to be '{}' found ${testConnectionController.getConnections()}`
  //   );
  //   assert(
  //     Object.keys(testConnectionController.getConnections()).length === 0,
  //     `Expected 0 connection configurations found ${Object.keys(testConnectionController.getConnections()).length}`
  //   );
  // });

  // test('When activated, the connection model loads both global and workspace stored connection models', function () {
  //   const testExtensionContext = new TestExtensionContext();
  //   // Set existing connections.
  //   testExtensionContext.globalState.update(
  //     `${STORAGE_PREFIX}${StorageVariables.GLOBAL_CONNECTION_MODELS}`,
  //     {
  //       'testGlobalConnectionModel': {},
  //       'testGlobalConnectionModel2': {},
  //     }
  //   );
  //   const testStorageController = new StorageController(testExtensionContext);

  //   const testConnectionController = new ConnectionController(
  //     new StatusView(),
  //     testStorageController
  //   );
  // });
});
