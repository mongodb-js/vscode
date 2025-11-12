import { before, beforeEach, afterEach } from 'mocha';
import { connect } from 'mongodb-data-service';
import { expect } from 'chai';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';

import { CONNECTION_TYPES } from '../../../connectionController';
import { getConnectionTelemetryProperties } from '../../../telemetry/connectionTelemetry';
import { TEST_DATABASE_URI } from '../dbTestHelper';

import ConnectionString from 'mongodb-connection-string-url';

suite('ConnectionTelemetry Controller Test Suite', function () {
  suite('with mock data service', function () {
    this.timeout(8000);
    const sandbox = sinon.createSandbox();
    let dataServiceStub;
    let getConnectionStringStub;
    let getLastSeenTopology;
    let instanceStub;

    before(() => {
      getConnectionStringStub = sandbox.stub();
      getLastSeenTopology = sandbox.stub();
      instanceStub = sandbox.stub();
      dataServiceStub = {
        getCurrentTopologyType: sandbox.stub(),
        getConnectionString: getConnectionStringStub,
        getLastSeenTopology: getLastSeenTopology,
        instance: instanceStub,
      } as unknown as DataService;
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('it tracks public cloud info', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_public_cloud).to.equal(true);
      expect(instanceTelemetry.public_cloud_name).to.equal('Azure');
    });

    test('it tracks non public cloud info', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_public_cloud).to.equal(false);
    });

    test('it tracks atlas local dev', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.atlas_hostname).to.equal(null);
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
      expect(instanceTelemetry.is_local_atlas).to.equal(true);
    });

    test('it tracks atlas', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_atlas).to.equal(true);
      expect(instanceTelemetry.atlas_hostname).to.equal(
        'test-data-sets-00-02-a011bb.mongodb.net',
      );
      expect(instanceTelemetry.is_atlas_url).to.equal(true);
      expect(instanceTelemetry.is_local_atlas).to.equal(false);
    });

    test('it tracks atlas IPv6', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_atlas).to.equal(true);
      expect(instanceTelemetry.atlas_hostname).to.equal(
        '3fff:0:a88:15a3::ac2f',
      );
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
    });

    test('it tracks atlas with fallback to original uri if failed resolving srv', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_localhost).to.equal(true);
    });

    test('it tracks digital ocean', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.is_localhost).to.equal(false);
      expect(instanceTelemetry.is_atlas_url).to.equal(false);
      expect(instanceTelemetry.is_do_url).to.equal(true);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });

    test('it tracks is_used_connect_screen true when the connection type is form', async () => {
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
        CONNECTION_TYPES.CONNECTION_FORM,
      );
      expect(instanceTelemetry.is_used_connect_screen).to.equal(true);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it tracks is_used_command_palette true when the connection type is string', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it tracks is_used_saved_connection true when the connection type is id', async () => {
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
        CONNECTION_TYPES.CONNECTION_ID,
      );
      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(true);
    });

    test('it tracks is_localhost false for a remote connection', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.is_localhost).to.equal(false);
    });

    test('it tracks is_localhost true for a local connection', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.is_localhost).to.equal(true);
    });

    test('it tracks server info for ubuntu', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.server_version).to.equal('4.3.9');
      expect(instanceTelemetry.server_arch).to.equal('debian');
      expect(instanceTelemetry.server_os_family).to.equal('ubuntu');
    });

    test('it tracks server info for mac', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.server_version).to.equal('4.3.2');
      expect(instanceTelemetry.server_arch).to.equal('darwin');
      expect(instanceTelemetry.server_os_family).to.equal('mac');
    });

    test('it returns DEFAULT when auth mechanism undefined and username is specified', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.auth_strategy).to.equal('DEFAULT');
    });

    test('it returns NONE when auth mechanism undefined and username undefined', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.auth_strategy).to.equal('NONE');
    });

    test('it returns authMechanism when specified', async () => {
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
        CONNECTION_TYPES.CONNECTION_STRING,
      );
      expect(instanceTelemetry.auth_strategy).to.equal('SCRAM-SHA-1');
    });
  });

  // TODO: Enable test back when Insider is fixed https://jira.mongodb.org/browse/VSCODE-452
  // MS GitHub Issue: https://github.com/microsoft/vscode/issues/188676
  suite.skip('with live connection', function () {
    this.timeout(20000);
    let dataServ;

    beforeEach(async () => {
      dataServ = await connect({
        connectionOptions: { connectionString: TEST_DATABASE_URI },
      });
    });

    afterEach(async () => {
      await dataServ.disconnect();
    });

    test('track new connection event fetches the connection instance information', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServ,
        CONNECTION_TYPES.CONNECTION_STRING,
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
