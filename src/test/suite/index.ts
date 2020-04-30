import * as Mocha from 'mocha';
import * as glob from 'glob';
import * as vscode from 'vscode';
import path = require('path');
import * as keytarType from 'keytar';

import MDBExtensionController from '../../mdbExtensionController';
import { TestExtensionContext } from './stubs';
import { mdbTestExtension } from './stubbableMdbExtension';

export function run(): Promise<void> {
  const reporterOptions = {
    spec: '-',
    'mocha-junit-reporter': path.join(__dirname, './test-results.xml')
  };

  // Create the mocha tester.
  const mocha = new Mocha({
    reporter: 'mocha-multi',
    reporterOptions,
    ui: 'tdd'
  });
  mocha.useColors(true);

  const testsRoot = path.join(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      // Activate the extension.
      mdbTestExtension.testExtensionContext = new TestExtensionContext();
      mdbTestExtension.testExtensionController = new MDBExtensionController(
        mdbTestExtension.testExtensionContext
      );
      mdbTestExtension.testExtensionController.activate();

      // Disable the dialogue for prompting the user where to store the connection.
      vscode.workspace.getConfiguration('mdb.connectionSaving').update(
        'hideOptionToChooseWhereToSaveNewConnections',
        true
      ).then(async () => {
        // We require keytar in runtime because it is a vscode provided
        // native node module.
        const keytar: typeof keytarType = require('keytar');
        const existingCredentials = await keytar.findCredentials('vscode.mongoDB.savedConnections');

        // Add files to the test suite.
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
        try {
          // Run the mocha test.
          mocha.run(async (failures) => {
            // After tests are run we clear any passwords added
            // to local secure storage.
            const postRunCredentials = await keytar.findCredentials('vscode.mongoDB.savedConnections');
            postRunCredentials.forEach(credential => {
              if (!existingCredentials.find(existingCredential => existingCredential.account === credential.account)) {
              // If the credential is newly added, we remove it.
                keytar.deletePassword('vscode.mongoDB.savedConnections', credential.account);
              }
            });

            if (failures > 0) {
              e(new Error(`${failures} tests failed.`));
            } else {
              c();
            }
          });
        } catch (mochaRunErr) {
          e(mochaRunErr);
        }
      });
    });
  });
}
