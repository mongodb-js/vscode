import Mocha from 'mocha';
import glob from 'glob';
import path from 'path';
import MDBExtensionController from '../../mdbExtensionController';
import { ext } from '../../extensionConstants';
import KeytarStub from './keytarStub';
import { ExtensionContextStub } from './stubs';
import { mdbTestExtension } from './stubbableMdbExtension';

export async function run(): Promise<void> {
  const reporterOptions = {
    spec: '-',
    'mocha-junit-reporter': path.join(__dirname, './test-results.xml'),
  };

  // Create the mocha tester.
  const mocha = new Mocha({
    reporter: 'mocha-multi',
    reporterOptions,
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.join(__dirname, '..');

  // Activate the extension.
  mdbTestExtension.extensionContextStub = new ExtensionContextStub();
  mdbTestExtension.testExtensionController = new MDBExtensionController(
    mdbTestExtension.extensionContextStub,
    { shouldTrackTelemetry: false }
  );

  await mdbTestExtension.testExtensionController.activate(
    mdbTestExtension.extensionContextStub
  );

  const files = await glob('**/**.test.js', {
    cwd: testsRoot,
    ignore: ['**/webview-app/**/*.js'],
  });

  // We avoid using the user's credential store when running tests
  // in order to ensure we're not polluting the credential store
  // and because its tough to get the credential store running on
  // headless linux.
  ext.keytarModule = new KeytarStub();

  // Add files to the test suite.
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  return new Promise((resolve, reject) => {
    try {
      // Run the mocha test.
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (mochaRunErr) {
      console.error('Error running mocha tests:');
      console.error(mochaRunErr);
      reject(mochaRunErr);
    }
    mocha.run();
  });
}
