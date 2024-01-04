import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { before, after, suite, test } from 'mocha';
import { browser } from '@wdio/globals';
import { invisibilityOf } from 'wdio-wait-for';
import ConnectionString from 'mongodb-connection-string-url';
import { MongoCluster, type MongoClusterOptions } from 'mongodb-runner';
import { OIDCMockProvider } from '@mongodb-js/oidc-mock-provider';
import { type OIDCMockProviderConfig } from '@mongodb-js/oidc-mock-provider';

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
  let getTokenPayload: typeof oidcMockProviderConfig.getTokenPayload;
  let overrideRequestHandler: typeof oidcMockProviderConfig.overrideRequestHandler;
  let oidcMockProviderConfig: OIDCMockProviderConfig;
  let oidcMockProvider: OIDCMockProvider;
  let oidcMockProviderEndpointAccesses: Record<string, number>;

  let i = 0;
  let tmpdir: string;
  let cluster: MongoCluster;
  let connectionString: string;

  before(async function () {
    if (process.platform !== 'linux') {
      this.skip();
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

    connectionString = cs.toString();
  });

  after(async function () {
    await cluster?.close();
    await oidcMockProvider?.close();
    if (tmpdir) await fs.rmdir(tmpdir, { recursive: true });
  });

  test('should connect successfully with a connection string', async function () {
    // connectionString = 'mongodb://localhost:27096/?authMechanism=MONGODB-OIDC';

    const workbench = await browser.getWorkbench();

    // Connect with OIDC connection string
    const connectionStringInput = await workbench.executeCommand(
      'MongoDB: Connect with Connection String...'
    );
    await connectionStringInput.wait();
    await connectionStringInput.setText(connectionString);
    await connectionStringInput.confirm();
    await browser.waitUntil(invisibilityOf(connectionStringInput.elem));

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
