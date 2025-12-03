import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();
import Mocha from 'mocha';
import glob from 'glob';
import path from 'path';
import MDBExtensionController from '../../mdbExtensionController';
import { ExtensionContextStub } from './stubs';
import { mdbTestExtension } from './stubbableMdbExtension';

if (!process.env.SEGMENT_KEY) {
  process.env.SEGMENT_KEY = 'test-segment-key';
}

export async function run(): Promise<void> {
  const reporterOptions = {
    spec: '-',
    'mocha-junit-reporter': path.join(__dirname, './test-results.xml'),
  };

  // Create the mocha tester.
  const mocha = new Mocha({
    reporter: 'spec',
    reporterOptions,
    ui: 'tdd',
    color: true,
    grep: process.env.MOCHA_GREP,
  });

  const testsRoot = path.join(__dirname, '..');

  // Activate the extension.
  mdbTestExtension.extensionContextStub = new ExtensionContextStub();
  mdbTestExtension.testExtensionController = new MDBExtensionController(
    mdbTestExtension.extensionContextStub,
    { shouldTrackTelemetry: false },
  );

  await mdbTestExtension.testExtensionController.activate();

  return new Promise((c, e) => {
    void glob(
      '**/**.test.js',
      {
        cwd: testsRoot,
        ignore: ['**/webview-app/**/*.js'],
      },
      (err, files) => {
        if (err) {
          return e(err);
        }

        // Add files to the test suite.
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
        try {
          // Run the mocha test.
          mocha.run((failures) => {
            // Deactivate the extension to properly clean up the language server
            void mdbTestExtension.testExtensionController
              .deactivate()
              .then(() => {
                if (failures > 0) {
                  e(new Error(`${failures} tests failed.`));
                } else {
                  c();
                }
              })
              .catch((deactivateErr) => {
                console.error('Error deactivating extension:');
                console.error(deactivateErr);
                e(deactivateErr);
              });
          });
        } catch (mochaRunErr) {
          console.error('Error running mocha tests:');
          console.error(mochaRunErr);
          e(mochaRunErr);
        }
      },
    );
  });
}
