import Mocha from 'mocha';
import glob from 'glob';
import * as vscode from 'vscode';
import path = require('path');
import * as keytarType from 'keytar';

import MDBExtensionController from '../../mdbExtensionController';
import { ext } from '../../extensionConstants';
import KeytarStub from './keytarStub';
import { TestExtensionContext } from './stubs';
import { mdbTestExtension } from './stubbableMdbExtension';

type KeyTar = typeof keytarType;

export function run(): Promise<void> {
  const reporterOptions = {
    spec: '-',
    'mocha-junit-reporter': path.join(__dirname, './test-results.xml')
  };

  // Create the mocha tester.
  const mocha = new Mocha({
    reporter: 'mocha-multi',
    reporterOptions,
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.join(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/**.test.js', {
      cwd: testsRoot,
      ignore: ['**/webview-app/**/*.js']
    }, (err, files) => {
      if (err) {
        return e(err);
      }

      // Activate the extension.
      mdbTestExtension.testExtensionContext = new TestExtensionContext();
      mdbTestExtension.testExtensionController = new MDBExtensionController(
        mdbTestExtension.testExtensionContext
      );
      mdbTestExtension.testExtensionController.activate();

      // We avoid using the user's credential store when running tests
      // in order to ensure we're not polluting the credential store
      // and because its tough to get the credential store running on
      // headless linux.
      ext.keytarModule = new KeytarStub();

      // Disable metrics.
      vscode.workspace.getConfiguration('mdb').update('sendTelemetry', false);

      // Disable the dialogue for prompting the user where to store the connection.
      vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update('hideOptionToChooseWhereToSaveNewConnections', true)
        .then(() => {
          // Add files to the test suite.
          files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
          try {
            // Run the mocha test.
            mocha.run((failures) => {
              if (failures > 0) {
                e(new Error(`${failures} tests failed.`));
              } else {
                c();
              }
            });
          } catch (mochaRunErr) {
            console.error('Error running mocha tests:');
            console.error(mochaRunErr);
            e(mochaRunErr);
          }
        });
    });
  });
}
