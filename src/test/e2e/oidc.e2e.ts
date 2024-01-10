import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { before, after, suite, test } from 'mocha';
import { browser } from '@wdio/globals';
import ConnectionString from 'mongodb-connection-string-url';
import { MongoCluster, type MongoClusterOptions } from 'mongodb-runner';
import { OIDCMockProvider } from '@mongodb-js/oidc-mock-provider';
import { type OIDCMockProviderConfig } from '@mongodb-js/oidc-mock-provider';

import {
  connectWithConnectionStringUsingWebviewForm,
  connectWithConnectionStringUsingCommand,
} from './commands';
import { openMongoDbShell } from './commands/open-mongodb-shell';

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

const clusters = new Map<string, MongoCluster>();
const defaults: MongoClusterOptions = {
  topology: 'standalone',
  tmpDir: path.join(
    os.tmpdir(),
    `vscode-tests-${hash(process.env.EVERGREEN_TASK_ID ?? '')}`
  ),
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

export async function startTestServer(
  config: Partial<MongoClusterOptions> & { alwaysStartNewServer?: boolean } = {}
): Promise<MongoCluster> {
  const key = JSON.stringify(config);
  const existing = !config.alwaysStartNewServer && clusters.get(key);
  if (existing && !existing.isClosed()) return existing;
  const cluster = await MongoCluster.start({
    ...defaults,
    ...config,
  });

  clusters.set(key, cluster);
  return cluster;
}

suite('OIDC tests', () => {
  let getTokenPayload: typeof oidcMockProviderConfig.getTokenPayload = () =>
    DEFAULT_TOKEN_PAYLOAD;
  let overrideRequestHandler: typeof oidcMockProviderConfig.overrideRequestHandler;
  let oidcMockProviderConfig: OIDCMockProviderConfig;
  let oidcMockProvider: OIDCMockProvider;
  let oidcMockProviderEndpointAccesses: Record<string, number>;

  let i = 0;
  let tmpdir: string;
  let cluster: MongoCluster;
  let connectionString: string;
  // let defaultConnectionName: string;

  before(async function () {
    if (process.platform !== 'linux') {
      // defaultConnectionName = 'localhost:27096';

      // TODO: Change this string to your local oidc-mock-server connection url.
      // Use our docker-devtools repo to spin an OIDC mock server and mongodb
      // server
      connectionString =
        'mongodb://localhost:27096/?authMechanism=MONGODB-OIDC';
      return;
      // TODO: When pushing for review, remove the stubs above and re-enable the
      // skip behaviour
      // this.skip();
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

    tmpdir = path.join(
      os.tmpdir(),
      `vscode-oidc-${Date.now().toString(32)}-${++i}`
    );
    await fs.mkdir(path.join(tmpdir, 'db'), { recursive: true });
    const serverOidcConfig = {
      issuer: oidcMockProvider.issuer,
      clientId: 'testServer',
      requestScopes: ['mongodbGroups'],
      authorizationClaim: 'groups',
      audience: 'resource-server-audience-value',
      authNamePrefix: 'dev',
    };

    cluster = await startTestServer({
      version: '7.0.x',
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

    // defaultConnectionName = `${cs.hostname}:${cs.port}`;
    connectionString = cs.toString();
  });

  after(async function () {
    await cluster?.close();
    await oidcMockProvider?.close();
    if (tmpdir) await fs.rmdir(tmpdir, { recursive: true });
  });

  test('should connect successfully with a connection string (UI based)', async function () {
    const workbench = await browser.getWorkbench();
    const webview = await connectWithConnectionStringUsingWebviewForm(
      browser,
      connectionString
    );

    // Need to close the webview otherwise the browser selectors will continue targeting it.
    await webview.close();

    // Check if we have connection successful notification
    await browser.waitUntil(
      async () => {
        const notifs = await workbench.getNotifications();
        const messages = await Promise.all(notifs.map((n) => n.getMessage()));
        return messages.includes('MongoDB connection successful.');
      },
      {
        timeoutMsg: 'Could not find connection successful notification',
      }
    );

    await openMongoDbShell(browser);
  });

  test.skip('should connect successfully with a connection string', async function () {
    // Unable to use this assert just one call because of the reason mentioned
    // below

    // let tokenFetchCalls = 0;
    getTokenPayload = () => {
      // tokenFetchCalls++;
      return DEFAULT_TOKEN_PAYLOAD;
    };
    const workbench = await browser.getWorkbench();
    await connectWithConnectionStringUsingCommand(browser, connectionString);

    // Note: Commented this one out because second call to executeCommand after
    // already using it to connect with connection string does not work for some
    // reasons. However when using executeCommand for any command other than the
    // command "MongoDB: Connect with connection string", it works as expected.
    // Most likely has something to do with the nature of our connect with
    // connection string command which follows up with a second prompt to enter
    // the connection string. Because of this we are not able to test if opening
    // shell works fine or not.

    // await workbench.executeCommand( 'MongoDB: Launch MongoDB Shell'
    // );
    // expect(tokenFetchCalls).toBe(1);

    // Check if we have connection successful notification
    await browser.waitUntil(
      async () => {
        const notifs = await workbench.getNotifications();
        const messages = await Promise.all(notifs.map((n) => n.getMessage()));
        return messages.includes('MongoDB connection successful.');
      },
      {
        timeoutMsg: 'Could not find connection successful notification',
      }
    );
  });
});
