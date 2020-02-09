import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  before,
  after
} from 'mocha';

import ExplorerController from '../../../explorer/explorerController';

const testDatabaseURI = 'mongodb://localhost';
const testDatabaseURI_2_WithTimeout = 'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Explorer Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  before(require('mongodb-runner/mocha/before'));
  after(require('mongodb-runner/mocha/after'));

  // test('it connects to mongodb', function (done) {
  //   const testConnectionController = new ConnectionController(new StatusView());
  //   this.timeout(2000);

  //   testConnectionController.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
  //     assert(succesfullyConnected === true, 'Expected a successful connection response.');
  //     assert(
  //       Object.keys(testConnectionController.getConnections()).length === 1,
  //       'Expected there to be 1 connection in the connection list.'
  //     );
  //     const instanceId = testConnectionController.getActiveConnectionInstanceId();
  //     assert(
  //       instanceId === 'localhost:27017',
  //       `Expected active connection to be 'localhost:27017' found ${instanceId}`
  //     );

  //   }).then(() => done(), done);
  // });
});
