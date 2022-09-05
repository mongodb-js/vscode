import path = require('path');

import { runTests } from '@vscode/test-electron';

// More information on vscode specific tests: https://github.com/microsoft/vscode-test

async function main(): Promise<any> {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.join(__dirname, '../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.join(__dirname, './suite/index');

    // This is the workspace we open in our tests.
    const testWorkspace = path.join(__dirname, '../../out/test');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace, '--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run tests:');
    console.error(err);
    process.exit(1);
  }
}

void main();
