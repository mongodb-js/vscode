import { before, beforeEach, afterEach } from 'mocha';
import { connect } from 'mongodb-data-service';
import { expect } from 'chai';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';
import mongoDBBuildInfo from 'mongodb-build-info';

import * as getCloudInfoModule from 'mongodb-cloud-info';

import { ConnectionTypes } from '../../../connectionController';
import { getConnectionTelemetryProperties } from '../../../telemetry/connectionTelemetry';
import { TEST_DATABASE_URI } from '../dbTestHelper';

suite('ConnectionTelemetry Controller Test Suite', function () {
  suite('with mock data service', function () {
    this.timeout(8000);
    const sandbox = sinon.createSandbox();
    let dataServiceStub;
    let getConnectionStringStub;
    let isAtlasStub;

    before(() => {
      getConnectionStringStub = sandbox.stub();
      isAtlasStub = sinon.stub(mongoDBBuildInfo, 'isAtlas');

      const instanceStub = sandbox.stub();
      instanceStub.resolves({
        dataLake: {},
        build: {},
        genuineMongoDB: {},
        host: {},
      } as unknown as Awaited<ReturnType<DataService['instance']>>);

      dataServiceStub = {
        getConnectionString: getConnectionStringStub,
        instance: instanceStub,
      } as unknown as DataService;

      sandbox.stub(getCloudInfoModule, 'getCloudInfo').callsFake(() =>
        Promise.resolve({
          isAws: false,
          isGcp: false,
          isAzure: false,
        })
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('it returns atlas_host_id hostname for atlas clusters', async () => {
      isAtlasStub.returns(true);
      getConnectionStringStub.returns({
        hosts: ['test-data-sets-a011bb.test.net'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_FORM
      );

      expect(instanceTelemetry.is_atlas).to.equal(true);
      expect(instanceTelemetry.atlas_host_id).to.equal(
        'test-data-sets-a011bb.test.net'
      );
    });

    test('it returns atlas_host_id null for non atlas clusters', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_FORM
      );

      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.atlas_host_id).to.equal(null);
    });

    test('it returns is_used_connect_screen true when the connection type is form', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_FORM
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(true);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it returns is_used_command_palette true when the connection type is string', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it returns is_used_saved_connection true when the connection type is id', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_ID
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(true);
    });

    test('it returns is_localhost false for a remote connection', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_localhost).to.equal(false);
    });

    test('it returns DEFAULT when auth mechanism undefined and username is specified', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
        username: 'Artishok',
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.auth_strategy).to.equal('DEFAULT');
    });

    test('it returns NONE when auth mechanism undefined and username undefined', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => null },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.auth_strategy).to.equal('NONE');
    });

    test('it returns authMechanism when specified', async () => {
      isAtlasStub.returns(false);
      getConnectionStringStub.returns({
        hosts: ['localhost:27088'],
        searchParams: { get: () => 'SCRAM-SHA-1' },
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServiceStub,
        ConnectionTypes.CONNECTION_STRING
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
        ConnectionTypes.CONNECTION_STRING
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
