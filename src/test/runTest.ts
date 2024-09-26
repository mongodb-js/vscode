/* eslint-disable no-console */
import path from 'path';
import { runTests } from '@vscode/test-electron';

// More information on vscode specific tests: https://github.com/microsoft/vscode-test

async function main(): Promise<any> {
  // The folder containing the Extension Manifest package.json
  // Passed to `--extensionDevelopmentPath`
  const extensionDevelopmentPath = path.join(__dirname, '../../');

  // The path to test runner passed to --extensionTestsPath
  const extensionTestsPath = path.join(__dirname, './suite/index');

  // This is the workspace we open in our tests.
  const testWorkspace = path.join(__dirname, '../../out/test');

  // Download VS Code, unzip it and run the integration test
  await runTests({
    version: 'insiders', // Download latest insiders.
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [testWorkspace, '--disable-extensions'],
  });
}

process.on('unhandledRejection', (err: Error) => {
  if (!err.message.match('Test run failed with code 1')?.[0]) {
    // Log an unhandled exception when it's not the regular test failure.
    // Test failures are logged in the test runner already so we avoid a generic message here.
    console.log('Unhandled exception. Cleaning-up and exiting.');
    console.error(err.stack || err.message || err);
  }

  process.exitCode = 1;
});

void main();
