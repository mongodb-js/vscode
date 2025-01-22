import os from 'os';
import path from 'path';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs/promises';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { before, after, afterEach, beforeEach } from 'mocha';
import EventEmitter, { once } from 'events';
import { ExtensionContextStub } from './stubs';
import { StorageController } from '../../storage';
import TelemetryService from '../../telemetry';
import ConnectionController from '../../connectionController';
import { StatusView } from '../../views';
import { waitFor } from './waitFor';

import { MongoCluster } from 'mongodb-runner';
import type { MongoClusterOptions } from 'mongodb-runner';
import { OIDCMockProvider } from '@mongodb-js/oidc-mock-provider';
import type { OIDCMockProviderConfig } from '@mongodb-js/oidc-mock-provider';
import { ConnectionString } from 'mongodb-connection-string-url';

import launchMongoShell from '../../commands/launchMongoShell';
import { getFullRange } from './suggestTestHelpers';

chai.use(chaiAsPromised);

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

// Need to be provided via CI env because we can't get a hold for node.js exec
// path in our tests - they run inside a vscode process in the built dir.
const browserShellCommand = `$(echo "$(which node) ${__dirname}/../../../src/test/fixture/curl.js")`;

const UNIQUE_TASK_ID =
  process.env.GITHUB_RUN_ID && process.env.GITHUB_RUN_NUMBER
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_NUMBER}`
    : '';
const defaultClusterOptions: MongoClusterOptions = {
  topology: 'standalone',
  tmpDir: path.join(os.tmpdir(), `vscode-tests-${hash(UNIQUE_TASK_ID)}-data`),
  logDir: process.env.MONGODB_RUNNER_LOGDIR,
  version: process.env.MONGODB_VERSION,
};

const DEFAULT_TOKEN_PAYLOAD = {
  expires_in: 3600,
  payload: {
    // Define the user information stored inside the access tokens
    groups: ['testgroup'],
    sub: 'testuser',
    aud: 'resource-server-audience-value',
  },
};

suite('OIDC Tests', function () {
  this.timeout(50000);

  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testConnectionController = new ConnectionController({
    statusView: new StatusView(extensionContextStub),
    storageController: testStorageController,
    telemetryService: testTelemetryService,
  });
  let showInformationMessageStub: SinonStub;
  const sandbox = sinon.createSandbox();

  // OIDC related variables
  let getTokenPayload: typeof oidcMockProviderConfig.getTokenPayload = () =>
    DEFAULT_TOKEN_PAYLOAD;
  let overrideRequestHandler: typeof oidcMockProviderConfig.overrideRequestHandler;
  let oidcMockProviderConfig: OIDCMockProviderConfig;
  let oidcMockProvider: OIDCMockProvider;
  let oidcMockProviderEndpointAccesses: Record<string, number>;

  let tmpdir: string;
  let cluster: MongoCluster;
  let connectionString: string;

  let createTerminalStub: SinonStub;
  let sendTextStub: SinonStub;

  before(async function () {
    if (process.platform !== 'linux') {
      // OIDC is only supported on Linux in the 7.0+ enterprise server.
      return this.skip();
    }

    oidcMockProviderEndpointAccesses = {};
    oidcMockProviderConfig = {
      getTokenPayload(metadata: Parameters<typeof getTokenPayload>[0]) {
        return getTokenPayload(metadata);
      },
      overrideRequestHandler(url, req, res) {
        const { pathname } = new URL(url);
        oidcMockProviderEndpointAccesses[pathname] ??= 0;
        oidcMockProviderEndpointAccesses[pathname]++;
        return overrideRequestHandler?.(url, req, res);
      },
    };
    oidcMockProvider = await OIDCMockProvider.create(oidcMockProviderConfig);

    tmpdir = path.join(os.tmpdir(), `vscode-oidc-${Date.now().toString(32)}`);
    await fs.mkdir(path.join(tmpdir, 'db'), { recursive: true });
    const serverOidcConfig = {
      issuer: oidcMockProvider.issuer,
      clientId: 'testServer',
      requestScopes: ['mongodbGroups'],
      authorizationClaim: 'groups',
      audience: 'resource-server-audience-value',
      authNamePrefix: 'dev',
    };

    cluster = await MongoCluster.start({
      ...defaultClusterOptions,
      version: '8.0.x',
      downloadOptions: { enterprise: true },
      args: [
        '--setParameter',
        'authenticationMechanisms=SCRAM-SHA-256,MONGODB-OIDC',
        // enableTestCommands allows using http:// issuers such as http://localhost
        '--setParameter',
        'enableTestCommands=true',
        '--setParameter',
        `oidcIdentityProviders=${JSON.stringify([serverOidcConfig])}`,
      ],
    });

    const cs = new ConnectionString(cluster.connectionString);
    cs.searchParams.set('authMechanism', 'MONGODB-OIDC');

    connectionString = cs.toString();
  });

  after(async function () {
    if (process.platform !== 'linux') {
      return;
    }

    await oidcMockProvider?.close();
    await cluster?.close();
  });

  beforeEach(async function () {
    sandbox.stub(testTelemetryService, 'trackNewConnection');
    showInformationMessageStub = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );

    // This is required to follow through the redirect while establishing
    // connection
    await vscode.workspace
      .getConfiguration('mdb')
      .update('browserCommandForOIDCAuth', browserShellCommand);

    createTerminalStub = sandbox.stub(vscode.window, 'createTerminal');
    sendTextStub = sandbox.stub();
    createTerminalStub.returns({
      sendText: sendTextStub,
      show: () => {},
    });
  });

  afterEach(async function () {
    // Reset our mock extension's state.
    extensionContextStub._workspaceState = {};
    extensionContextStub._globalState = {};

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    sandbox.restore();
  });

  test('can successfully connect with a connection string', async function () {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      );
    expect(succesfullyConnected).to.be.true;

    await launchMongoShell(testConnectionController);
    expect(createTerminalStub).to.be.called;

    const terminalOptions: vscode.TerminalOptions =
      createTerminalStub.firstCall.args[0];
    const terminalConnectionString = terminalOptions.env?.MDB_CONNECTION_STRING;

    if (!terminalConnectionString) {
      expect.fail('Terminal connection string not found');
    }
    const terminalCsWithoutAppName = new ConnectionString(
      terminalConnectionString
    );
    terminalCsWithoutAppName.searchParams.delete('appname');

    expect(terminalCsWithoutAppName.toString()).to.equal(connectionString);

    const shellCommandText = sendTextStub.firstCall.args[0];
    expect(shellCommandText).to.equal('mongosh $MDB_CONNECTION_STRING;');

    // Required for shell to share the OIDC state
    expect(terminalOptions.env?.MONGOSH_OIDC_PARENT_HANDLE).to.not.be.undefined;
  });

  test('it persists tokens for further attempt if the settings is set to true', async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('persistOIDCTokens', true);
    let tokenFetchCalls = 0;
    getTokenPayload = () => {
      tokenFetchCalls++;
      return DEFAULT_TOKEN_PAYLOAD;
    };

    expect(
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      )
    ).to.be.true;

    const connectionId = testConnectionController.getActiveConnectionId();
    if (!connectionId) {
      expect.fail('Connection id not found for active connection');
    }

    await testConnectionController.disconnect();

    expect(
      (await testConnectionController.connectWithConnectionId(connectionId))
        .successfullyConnected
    ).to.be.true;
    expect(tokenFetchCalls).to.equal(1);
  });

  test('it will not persist tokens for further attempt if the settings is set to false', async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('persistOIDCTokens', false);
    let tokenFetchCalls = 0;
    getTokenPayload = () => {
      tokenFetchCalls++;
      return DEFAULT_TOKEN_PAYLOAD;
    };

    expect(
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      )
    ).to.be.true;

    const connectionId = testConnectionController.getActiveConnectionId();
    if (!connectionId) {
      expect.fail('Connection id not found for active connection');
    }

    await testConnectionController.disconnect();

    expect(
      (await testConnectionController.connectWithConnectionId(connectionId))
        .successfullyConnected
    ).to.be.true;
    expect(tokenFetchCalls).to.equal(2);
  });

  test('can cancel a connection attempt and then successfully connect', async function () {
    const emitter = new EventEmitter();
    const secondConnectionEstablished = once(
      emitter,
      'secondConnectionEstablished'
    );
    overrideRequestHandler = async (url) => {
      if (new URL(url).pathname === '/authorize') {
        emitter.emit('authorizeEndpointCalled');
        // This does effectively mean that our 'fake browser'
        // will never get a response from the authorization endpoint
        // during the first connection attempt, and that therefore
        // the local HTTP server will never have its redirect endpoint
        // accessed.
        await secondConnectionEstablished;
      }
    };

    testConnectionController
      .addNewConnectionStringAndConnect(connectionString)
      .catch(() => {
        // ignored
      });

    await once(emitter, 'authorizeEndpointCalled');
    overrideRequestHandler = () => {};
    const connected =
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      );
    emitter.emit('secondConnectionEstablished');
    expect(connected).to.be.true;
  });

  test('can successfully re-authenticate', async function () {
    showInformationMessageStub.resolves('Confirm');
    const originalReAuthHandler =
      testConnectionController._reauthenticationHandler.bind(
        testConnectionController
      );
    let reAuthCalled = false;
    let resolveReAuthPromise: (value?: unknown) => void;
    const reAuthPromise = new Promise((resolve) => {
      resolveReAuthPromise = resolve;
    });
    sandbox
      .stub(testConnectionController, '_reauthenticationHandler')
      .callsFake(async () => {
        reAuthCalled = true;
        resolveReAuthPromise();
        await originalReAuthHandler();
      });
    let tokenFetchCalls = 0;
    let afterReauth = false;
    getTokenPayload = () => {
      tokenFetchCalls++;
      return {
        ...DEFAULT_TOKEN_PAYLOAD,
        ...(afterReauth ? {} : { expires_in: 1 }),
      };
    };

    expect(
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      )
    ).to.be.true;
    afterReauth = true;

    // Trigger a command on data service for reauthentication
    while (reAuthCalled === false) {
      await testConnectionController.getActiveDataService()?.count('x.y', {});
    }

    // Wait for reauthentication promise to resolve
    await reAuthPromise;

    expect(tokenFetchCalls).to.equal(2);
    expect(testConnectionController.isCurrentlyConnected()).to.be.true;
  });

  test('can decline re-authentication if wanted', async function () {
    showInformationMessageStub.resolves('Declined');
    const originalReAuthHandler =
      testConnectionController._reauthenticationHandler.bind(
        testConnectionController
      );
    let reAuthCalled = false;
    let resolveReAuthPromise: (value?: unknown) => void;
    const reAuthPromise = new Promise((resolve) => {
      resolveReAuthPromise = resolve;
    });
    sandbox
      .stub(testConnectionController, '_reauthenticationHandler')
      .callsFake(async () => {
        reAuthCalled = true;
        resolveReAuthPromise();
        await originalReAuthHandler();
      });
    let tokenFetchCalls = 0;
    let afterReauth = false;
    getTokenPayload = () => {
      tokenFetchCalls++;
      return {
        ...DEFAULT_TOKEN_PAYLOAD,
        ...(afterReauth ? {} : { expires_in: 1 }),
      };
    };

    const isConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      );

    expect(isConnected).to.be.true;

    afterReauth = true;

    // Trigger a command on data service for reauthentication.
    while (reAuthCalled === false) {
      await testConnectionController
        .getActiveDataService()
        ?.count('x.y', {})
        .catch((error) => {
          expect(error.message).to.equal('Reauthentication declined by user');
        });
    }

    await reAuthPromise;
    await waitFor(() => {
      return testConnectionController.isCurrentlyConnected() === false;
    }, 100);

    // Because we declined the auth in showInformationMessage above
    expect(tokenFetchCalls).to.equal(1);
    expect(testConnectionController.isCurrentlyConnected()).to.be.false;
  });

  test('shares the oidc state also with the playgrounds', async function () {
    let tokenFetchCalls = 0;
    getTokenPayload = () => {
      tokenFetchCalls++;
      return DEFAULT_TOKEN_PAYLOAD;
    };

    expect(
      await testConnectionController.addNewConnectionStringAndConnect(
        connectionString
      )
    ).to.be.true;

    await vscode.commands.executeCommand('mdb.createPlayground');

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('Window active text editor is undefined');
    }

    const testDocumentUri = editor.document.uri;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      testDocumentUri,
      getFullRange(editor.document),
      "use('random'); db.randomColl.find({}).count();"
    );
    await vscode.workspace.applyEdit(edit);
    await vscode.commands.executeCommand('mdb.runPlayground');
    expect(tokenFetchCalls).to.equal(1);
  });
});
