/* eslint-disable no-console */
import path from 'path';
import { runTests } from '@vscode/test-electron';
import { MongoCluster } from 'mongodb-runner';
import os from 'os';

import { TEST_DATABASE_PORT } from './suite/dbTestHelper';

// More information on vscode specific tests: https://github.com/microsoft/vscode-test

async function startTestMongoDBServer(): Promise<MongoCluster> {
  console.log('Starting MongoDB server on port', TEST_DATABASE_PORT);
  return await MongoCluster.start({
    topology: 'standalone',
    tmpDir: path.join(os.tmpdir(), 'vscode-test-mongodb-runner'),
    args: ['--port', TEST_DATABASE_PORT],
  });
}

let testMongoDBServer: MongoCluster;

function cleanup(): void {
  console.log('Stopping MongoDB server on port', TEST_DATABASE_PORT);
  void testMongoDBServer?.close();
}

async function main(): Promise<any> {
  testMongoDBServer = await startTestMongoDBServer();

  // The folder containing the Extension Manifest package.json
  // Passed to `--extensionDevelopmentPath`
  const extensionDevelopmentPath = path.join(__dirname, '../../');

  // The path to test runner passed to --extensionTestsPath
  const extensionTestsPath = path.join(__dirname, './suite/index');

  // This is the workspace we open in our tests.
  const testWorkspace = path.join(__dirname, '../../out/test');

  // Download VS Code, unzip it and run the integration test
  await runTests({
    version: 'stable', // TODO: revert to insiders when test issue is resolved // Download latest stable.
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [testWorkspace, '--disable-extensions'],
  });

  cleanup();
}

process.once('SIGINT', () => {
  console.log('Process was interrupted. Cleaning-up and exiting.');
  cleanup();
  process.kill(process.pid, 'SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Process was terminated. Cleaning-up and exiting.');
  cleanup();
  process.kill(process.pid, 'SIGTERM');
});

process.once('uncaughtException', (err: Error) => {
  console.log('Uncaught exception. Cleaning-up and exiting.');
  cleanup();
  throw err;
});

process.on('unhandledRejection', (err: Error) => {
  if (!err.message.match('Test run failed with code 1')?.[0]) {
    // Log an unhandled exception when it's not the regular test failure.
    // Test failures are logged in the test runner already so we avoid a generic message here.
    console.log('Unhandled exception. Cleaning-up and exiting.');
    console.error(err.stack || err.message || err);
  }

  cleanup();
  process.exitCode = 1;
});

void main();
