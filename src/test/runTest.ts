import path from 'path';
import { runTests } from '@vscode/test-electron';
import crossSpawn from 'cross-spawn';
import fs from 'fs';

// More information on vscode specific tests: https://github.com/microsoft/vscode-test

function startTestMongoDBServer() {
  console.log('Starting MongoDB server');
  crossSpawn.sync('npm', ['run', 'start-test-server'], { stdio: 'inherit' });
}

function cleanupTestMongoDBServer() {
  console.log('Stopping MongoDB server and cleaning up server data');
  try {
    crossSpawn.sync('npm', ['run', 'stop-test-server'], {
      // If it's taking too long we might as well kill the process and
      // move on, mongodb-runner is flaky sometimes.
      timeout: 30_000,
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('Failed to stop MongoDB Server', e);
  }
  try {
    fs.rmdirSync('.mongodb', { recursive: true });
  } catch (e) {
    console.error('Failed to clean up server data', e);
  }
}

async function main(): Promise<any> {
  startTestMongoDBServer();

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
    process.exit(1);
  } finally {
    cleanupTestMongoDBServer();
  }
}

void main();
