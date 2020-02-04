import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  before,
  after
} from 'mocha';

import ConnectionManager from '../../connectionManager';
import { StatusView } from '../../views';

const testDatabaseURI = 'mongodb://localhost';
const testDatabaseURI_2_WithTimeout = 'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Connection Manager Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  let disposables: vscode.Disposable[] = [];

  teardown(() => {
    disposables.forEach(d => d.dispose());
    disposables.length = 0;
  });

  before(require('mongodb-runner/mocha/before'));
  after(require('mongodb-runner/mocha/after'));

  test('it connects to mongodb', function (done) {
    const testConnectionMgr = new ConnectionManager(new StatusView());
    this.timeout(2000);

    testConnectionMgr.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
      assert(succesfullyConnected === true, 'Expected a successful connection response.');
      assert(
        Object.keys(testConnectionMgr.getConnections()).length === 1,
        'Expected there to be 1 connection in the connection list.'
      );
      const instanceId = testConnectionMgr.getActiveConnectionInstanceId();
      assert(
        instanceId === 'localhost:27017',
        `Expected active connection to be 'localhost:27017' found ${instanceId}`
      );

    }).then(() => done(), done);
  });

  test('"disconnect()" disconnects from the active connection', function (done) {
    const testConnectionMgr = new ConnectionManager(new StatusView());
    this.timeout(2000);

    testConnectionMgr.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
      assert(succesfullyConnected === true, 'Expected a successful (true) connection response.');

      testConnectionMgr.disconnect().then(successfullyDisconnected => {
        assert(successfullyDisconnected === true, 'Expected a successful (true) disconnect response.');
        // Disconnecting should keep the connection contract, just disconnected.
        const connectionsCount = Object.keys(testConnectionMgr.getConnections()).length;
        assert(
          connectionsCount === 1,
          `Expected the amount of connections to be 1 found ${connectionsCount}.`
        );
        const instanceId = testConnectionMgr.getActiveConnectionInstanceId();
        assert(
          instanceId === null,
          `Expected the active connection instance id to be null, found ${instanceId}`
        );
      }).then(() => done(), done);
    });
  });

  test('"removeMongoDBConnection()" returns false when there is no active connection', done => {
    const testConnectionMgr = new ConnectionManager(new StatusView());

    testConnectionMgr.removeMongoDBConnection().then(successfullyDisconnected => {
      assert(
        successfullyDisconnected === false,
        `Expected a false remove connection response, recieved ${successfullyDisconnected}.`
      );
    }).then(() => done(), done);
  });

  test('"disconnect()" fails when there is no active connection', done => {
    const testConnectionMgr = new ConnectionManager(new StatusView());

    testConnectionMgr.disconnect().then(null, err => {
      assert(!!err, `Expected an error disconnect response.`);
    }).then(() => done(), done);
  });

  test('when adding a new connection it disconnects from the current connection', function (done) {
    const testConnectionMgr = new ConnectionManager(new StatusView());
    this.timeout(2000);

    testConnectionMgr.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
      assert(succesfullyConnected === true, 'Expected a successful (true) connection response.');

      testConnectionMgr.addNewConnectionAndConnect(testDatabaseURI_2_WithTimeout).then(null, err => {
        assert(!!err, 'Expected an error promise response.');
        assert(
          testConnectionMgr.getActiveConnection() === null,
          'Expected to current connection to be null (not connected).'
        );
        assert(
          testConnectionMgr.getActiveConnectionInstanceId() === null,
          'Expected to current connection instanceId to be null (not connected).'
        );
      }).then(() => done());
    });
  });

  test('when adding a new connection it disconnects from the current connection', function (done) {
    const testConnectionMgr = new ConnectionManager(new StatusView());
    this.timeout(2000);

    testConnectionMgr.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
      assert(succesfullyConnected === true, 'Expected a successful (true) connection response.');

      testConnectionMgr.addNewConnectionAndConnect(testDatabaseURI_2_WithTimeout).then(null, err => {
        assert(!!err, 'Expected an error promise response.');
        assert(
          testConnectionMgr.getActiveConnection() === null,
          'Expected to current connection to be null (not connected).'
        );
        assert(
          testConnectionMgr.getActiveConnectionInstanceId() === null,
          'Expected to current connection instanceId to be null (not connected).'
        );
      }).then(() => done());
    });
  });


  /**
   * Connection tests to write:
   * - Connect to a database.
   * - Connect to multiple databases.
   * - Connect to multiple databases and ensure only 1 is live.
   * - Ensure status bar shows text when connecting & disconnecting.
   * - Disconnect from a database.
   * - Disconnect from 2nd database on connection list and ensure that one dcs.
   * - Disconnect from active database connection.
   * - Try to disconnect while connecting.
   * - Try to connect while disconnecting.
   *
   * - End to end on commands for connecting?
   */
});
