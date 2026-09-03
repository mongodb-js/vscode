import { before, beforeEach, afterEach } from 'mocha';
import { connect } from 'mongodb-data-service';
import { expect } from 'chai';
import sinon from 'sinon';

import { ConnectionType } from '../../../connectionController';
import { getConnectionTelemetryProperties } from '../../../telemetry/connectionTelemetry';
import { TEST_DATABASE_URI } from '../dbTestHelper';

import ConnectionString from 'mongodb-connection-string-url';

suite('ConnectionTelemetry Controller Test Suite', function () {
  suite('with mock data service', function () {
    this.timeout(8000);
    let sandbox: sinon.SinonSandbox;
    let dataServiceStub;
    let getConnectionStringStub;
    let getLastSeenTopology;
    let instanceStub;

    before(function () {
      sandbox = sinon.createSandbox();
      getConnectionStringStub = sandbox.stub();
      getLastSeenTopology = sandbox.stub();
      instanceStub = sandbox.stub();
      dataServiceStub = {
        getCurrentTopologyType: sandbox.stub(),
        getConnectionString: getConnectionStringStub,
        getLastSeenTopology: getLastSeenTopology,
        instance: instanceStub,
      };
    });

    afterEach(function () {
      sandbox.restore();
    });

    test('it tracks public cloud info', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://13.64.151.161'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('13.64.151.161', {
          address: '13.64.151.161',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_public_cloud).to.equal(true);
      expect(instanceTelemetry.public_cloud_name).to.equal('Azure');
    });

    test('it tracks non public cloud info', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_public_cloud).to.equal(false);
    });

    test('it tracks atlas local dev', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
        isAtlas: false,
        isLocalAtlas: true,
        featureCompatibilityVersion: null,
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.atlas_hostname).to.equal(null);
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
      expect(instanceTelemetry.is_local_atlas).to.equal(true);
    });

    test('it tracks atlas', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
        isAtlas: true,
        isLocalAtlas: false,
        featureCompatibilityVersion: null,
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://test-data-sets-a011bb.mongodb.net'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('test-data-sets-00-02-a011bb.mongodb.net', {
          address: 'test-data-sets-00-02-a011bb.mongodb.net',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_atlas).to.equal(true);
      expect(instanceTelemetry.atlas_hostname).to.equal(
        'test-data-sets-00-02-a011bb.mongodb.net',
      );
      expect(instanceTelemetry.is_atlas_url).to.equal(true);
      expect(instanceTelemetry.is_local_atlas).to.equal(false);
    });

    test('it tracks atlas IPv6', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
        isAtlas: true,
        isLocalAtlas: false,
        featureCompatibilityVersion: null,
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://[3fff:0:a88:15a3::ac2f]:8001'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('[3fff:0:a88:15a3::ac2f]:8001', {
          address: '[3fff:0:a88:15a3::ac2f]:8001',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_atlas).to.equal(true);
      expect(instanceTelemetry.atlas_hostname).to.equal(
        '3fff:0:a88:15a3::ac2f',
      );
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
    });

    test('it falls back to the connection string seed host when the topology has no address', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
        isAtlas: false,
        isLocalAtlas: false,
        featureCompatibilityVersion: null,
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('', {
          address: '',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_localhost).to.equal(true);
    });

    test('it tracks digital ocean', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString(
          'mongodb://example.mongo.ondigitalocean.com:27017',
        ),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('example.mongo.ondigitalocean.com:27017', {
          address: 'example.mongo.ondigitalocean.com:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.is_localhost).to.equal(false);
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
      expect(instanceTelemetry.is_do_url).to.equal(true);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });

    test('it tracks is_used_connect_screen true when the connection type is form', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      expect(instanceTelemetry.is_used_connect_screen).to.equal(true);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it tracks is_used_command_palette true when the connection type is string', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it tracks is_used_saved_connection true when the connection type is id', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionId,
      );
      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(true);
    });

    test('it tracks is_localhost false for a remote connection', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString(
          'mongodb://example.mongo.ondigitalocean.com:27017',
        ),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('example.mongo.ondigitalocean.com:27017', {
          address: 'example.mongo.ondigitalocean.com:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.is_localhost).to.equal(false);
    });

    test('it tracks is_localhost true for a local connection', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.is_localhost).to.equal(true);
    });

    test('it tracks server info for ubuntu', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: '1.2.3',
        },
        genuineMongoDB: {
          dbType: 'mongo_2',
          isGenuine: true,
        },
        host: {
          arch: 'debian',
          os_family: 'ubuntu',
        },
        build: {
          isEnterprise: false,
          version: '4.3.9',
        },
        isAtlas: false,
        isLocalAtlas: false,
        featureCompatibilityVersion: null,
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://127.0.0.1'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('127.0.0.1', {
          address: '127.0.0.1',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.server_version).to.equal('4.3.9');
      expect(instanceTelemetry.server_arch).to.equal('debian');
      expect(instanceTelemetry.server_os_family).to.equal('ubuntu');
    });

    test('it tracks server info for mac', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: true,
          version: '1.2.3',
        },
        genuineMongoDB: {
          dbType: 'mongo',
          isGenuine: false,
        },
        host: {
          arch: 'darwin',
          os_family: 'mac',
        },
        build: {
          isEnterprise: true,
          version: '4.3.2',
        },
        isAtlas: false,
        isLocalAtlas: false,
        featureCompatibilityVersion: null,
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://127.0.0.1'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('127.0.0.1', {
          address: '127.0.0.1',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.server_version).to.equal('4.3.2');
      expect(instanceTelemetry.server_arch).to.equal('darwin');
      expect(instanceTelemetry.server_os_family).to.equal('mac');
    });

    test('it returns DEFAULT when auth mechanism undefined and username is specified', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://artishok:pass@localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.auth_strategy).to.equal('DEFAULT');
    });

    test('it returns NONE when auth mechanism undefined and username undefined', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString('mongodb://localhost:27017'),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.auth_strategy).to.equal('NONE');
    });

    test('it returns authMechanism when specified', async function () {
      instanceStub.resolves({
        dataLake: {
          isDataLake: false,
          version: 'na',
        },
        genuineMongoDB: {
          dbType: 'na',
          isGenuine: true,
        },
        host: {},
        build: {
          isEnterprise: false,
          version: 'na',
        },
      });
      getConnectionStringStub.returns(
        new ConnectionString(
          'mongodb://foo:bar@localhost:27017/?authSource=source&authMechanism=SCRAM-SHA-1',
        ),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('localhost:27017', {
          address: 'localhost:27017',
        }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      expect(instanceTelemetry.auth_strategy).to.equal('SCRAM-SHA-1');
    });
  });

  // `mongodb-cloud-info` is loaded through a dynamic `import()`, so it is mocked
  // via `require.cache` instead of sinon. This relies on the CommonJS output; if
  // it is ever loaded as real ESM the mock stops intercepting and these tests
  // would issue live DNS lookups.
  suite('dns resolving fallback', function () {
    this.timeout(8000);

    const PASSWORD = 'sup3rs3cr3tp4ssw0rd';
    const USERNAME = 'leaky-user';

    let sandbox: sinon.SinonSandbox;
    let dataServiceStub;
    let getConnectionStringStub;
    let getLastSeenTopology;
    let lookedUpHosts: string[];

    const cloudInfoPath = require.resolve('mongodb-cloud-info');
    let realCloudInfoModule: NodeModule | undefined;

    beforeEach(function () {
      sandbox = sinon.createSandbox();
      lookedUpHosts = [];

      realCloudInfoModule = require.cache[cloudInfoPath];
      require.cache[cloudInfoPath] = {
        id: cloudInfoPath,
        filename: cloudInfoPath,
        loaded: true,
        exports: {
          getCloudInfo: (host: string) => {
            lookedUpHosts.push(host);
            return Promise.resolve({
              isAws: false,
              isAzure: false,
              isGcp: false,
            });
          },
        },
      } as unknown as NodeModule;

      getConnectionStringStub = sandbox.stub();
      getLastSeenTopology = sandbox.stub();
      dataServiceStub = {
        getCurrentTopologyType: sandbox.stub(),
        getConnectionString: getConnectionStringStub,
        getLastSeenTopology: getLastSeenTopology,
        instance: sandbox.stub().resolves({
          dataLake: { isDataLake: false, version: 'na' },
          genuineMongoDB: { dbType: 'na', isGenuine: true },
          host: {},
          build: { isEnterprise: false, version: 'na' },
          isAtlas: true,
          isLocalAtlas: false,
          featureCompatibilityVersion: null,
        }),
      };
    });

    afterEach(function () {
      sandbox.restore();
      if (realCloudInfoModule) {
        require.cache[cloudInfoPath] = realCloudInfoModule;
      } else {
        delete require.cache[cloudInfoPath];
      }
    });

    function expectNoCredentialsLeaked(
      instanceTelemetry: Record<string, unknown>,
    ): void {
      for (const host of lookedUpHosts) {
        expect(host).to.not.contain(PASSWORD);
        expect(host).to.not.contain(USERNAME);
        expect(host).to.not.contain('@');
        expect(host).to.not.contain('mongodb://');
        expect(host).to.not.contain('mongodb+srv://');
      }

      const serialised = JSON.stringify(instanceTelemetry);
      expect(serialised).to.not.contain(PASSWORD);
      expect(serialised).to.not.contain(USERNAME);
    }

    test('it does not send credentials to dns when the topology has no servers', async function () {
      getConnectionStringStub.returns(
        new ConnectionString(
          `mongodb://${USERNAME}:${PASSWORD}@cluster0.abcde.mongodb.net:27017`,
        ),
      );
      getLastSeenTopology.returns({ servers: new Map() });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );

      expectNoCredentialsLeaked(instanceTelemetry);
      expect(lookedUpHosts).to.deep.equal(['cluster0.abcde.mongodb.net']);
    });

    test('it does not send credentials to dns when the first server address is empty', async function () {
      getConnectionStringStub.returns(
        new ConnectionString(
          `mongodb://${USERNAME}:${PASSWORD}@cluster0.abcde.mongodb.net:27017`,
        ),
      );
      getLastSeenTopology.returns({
        servers: new Map().set('', { address: '' }),
      });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );

      expectNoCredentialsLeaked(instanceTelemetry);
      expect(lookedUpHosts).to.deep.equal(['cluster0.abcde.mongodb.net']);
    });

    test('it does not send credentials to dns when the topology is missing entirely', async function () {
      getConnectionStringStub.returns(
        new ConnectionString(
          `mongodb://${USERNAME}:${PASSWORD}@cluster0.abcde.mongodb.net:27017`,
        ),
      );
      getLastSeenTopology.returns(undefined);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );

      expectNoCredentialsLeaked(instanceTelemetry);
    });

    test('it issues no dns query at all when no hostname can be derived', async function () {
      // A connection string always has at least one host, so the only way to
      // reach `getHostInformation(null)` is a malformed seed host.
      getConnectionStringStub.returns({
        searchParams: new URLSearchParams(),
        username: USERNAME,
        password: PASSWORD,
        hosts: [':27017'],
        toString: () =>
          `mongodb://${USERNAME}:${PASSWORD}@cluster0.abcde.mongodb.net:27017`,
      });
      getLastSeenTopology.returns({ servers: new Map() });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );

      expect(lookedUpHosts).to.deep.equal([]);
      expectNoCredentialsLeaked(instanceTelemetry);
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
      expect(instanceTelemetry.is_localhost).to.equal(false);
      expect(instanceTelemetry.is_do_url).to.equal(false);
    });

    test('it does not send credentials to dns for a credentialed srv connection', async function () {
      getConnectionStringStub.returns(
        new ConnectionString(
          `mongodb+srv://${USERNAME}:${PASSWORD}@cluster0.abcde.mongodb.net/?authSource=admin`,
        ),
      );
      getLastSeenTopology.returns({ servers: new Map() });

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionType.connectionString,
      );

      expectNoCredentialsLeaked(instanceTelemetry);
      expect(instanceTelemetry.atlas_hostname).to.equal(
        'cluster0.abcde.mongodb.net',
      );
    });
  });

  suite('with live connection', function () {
    this.timeout(20000);
    let dataServ;

    beforeEach(async function () {
      dataServ = await connect({
        connectionOptions: { connectionString: TEST_DATABASE_URI },
      });
    });

    afterEach(async function () {
      await dataServ.disconnect();
    });

    test('track new connection event fetches the connection instance information', async function () {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServ,
        ConnectionType.connectionString,
      );

      expect(instanceTelemetry.is_localhost).to.equal(true);
      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });
  });
});
