/* eslint-disable no-console */
import path from 'path';
import { runTests } from '@vscode/test-electron';
import { MongoCluster } from 'mongodb-runner';
import os from 'os';

import { TEST_DATABASE_PORT } from './suite/dbTestHelper';

// More information on vscode specific tests: https://github.com/microsoft/vscode-test

async function startTestMongoDBServer() {
  console.log('Starting MongoDB server on port', TEST_DATABASE_PORT);
  return await MongoCluster.start({
    topology: 'standalone',
    tmpDir: path.join(os.tmpdir(), 'vscode-test-mongodb-runner'),
    args: ['--port', TEST_DATABASE_PORT],
  });
}

async function main(): Promise<any> {
  const testMongoDBServer = await startTestMongoDBServer();

  let failed = false;

  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.join(__dirname, '../../');

    // The path to test runner pased to --extensionTestsPath
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
  } catch (err) {
    console.error('Failed to run tests:');
    console.error(err);
    failed = true;
  } finally {
    console.log('Stopping MongoDB server on port', TEST_DATABASE_PORT);
    await testMongoDBServer.close();
  }

  if (failed) {
    process.exit(1);
  }
}

void main();
