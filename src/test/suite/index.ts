import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();
import Mocha from 'mocha';
import { glob } from 'glob';
import path from 'path';
import MDBExtensionController from '../../mdbExtensionController';
import { ExtensionContextStub } from './stubs';
import { mdbTestExtension } from './stubbableMdbExtension';

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

  const files = glob('**/**.test.js', {
    cwd: testsRoot,
    ignore: ['**/webview-app/**/*.js'],
    withFileTypes: false,
  });

  // Add files to the test suite.
  (await files).forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
  try {
    await new Promise<void>((c, e) => {
      // Run the mocha test.
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    });
  } catch (mochaRunErr) {
    console.error('Error running mocha tests:');
    console.error(mochaRunErr);
    throw mochaRunErr;
  }
}
