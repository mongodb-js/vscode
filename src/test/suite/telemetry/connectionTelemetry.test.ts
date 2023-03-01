import { before, after, beforeEach, afterEach } from 'mocha';
import { connect } from 'mongodb-data-service';
import { expect } from 'chai';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';

import getCloudInfoModule from 'mongodb-cloud-info';

import { ConnectionTypes } from '../../../connectionController';
import * as connectionTelemetry from '../../../telemetry/connectionTelemetry';

const TEST_DATABASE_URI = 'mongodb://localhost:27018';

suite('ConnectionTelemetry Controller Test Suite', function () {
  suite('with mock data service', function () {
    this.timeout(8000);
    let dataServiceStub: DataService;

    before(() => {
      const getConnectionStringStub = sinon.stub();
      getConnectionStringStub.returns({
        hosts: ['localhost:27018'],
        searchParams: { get: () => null },
        username: 'authMechanism',
      } as unknown as ReturnType<DataService['getConnectionString']>);

      const instanceStub = sinon.stub();
      instanceStub.resolves({
        dataLake: {},
        build: {},
        genuineMongoDB: {},
        host: {},
      } as unknown as Awaited<ReturnType<DataService['instance']>>);

      dataServiceStub = {
        getConnectionString: getConnectionStringStub,
        instance: instanceStub,
      } as Pick<
        DataService,
        'getConnectionString' | 'instance'
      > as unknown as DataService;

      sinon.stub(getCloudInfoModule, 'getCloudInfo').resolves({});
    });

    after(() => {
      sinon.restore();
    });

    test('it returns is_used_connect_screen true when the connection type is form', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
          dataServiceStub,
          ConnectionTypes.CONNECTION_FORM
        );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(true);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it returns is_used_command_palette true when the connection type is string', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
          dataServiceStub,
          ConnectionTypes.CONNECTION_STRING
        );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it returns is_used_saved_connection true when the connection type is id', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
          dataServiceStub,
          ConnectionTypes.CONNECTION_ID
        );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(true);
    });

    test('it has is_localhost false for a remote connection', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
          dataServiceStub,
          ConnectionTypes.CONNECTION_STRING
        );

      expect(instanceTelemetry.is_localhost).to.equal(false);
    });

    test('it has a default is atlas false', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
          dataServiceStub,
          ConnectionTypes.CONNECTION_STRING
        );

      expect(instanceTelemetry.is_atlas).to.equal(false);
    });

    test('it has a default driver auth mechanism undefined', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
          dataServiceStub,
          ConnectionTypes.CONNECTION_STRING
        );

      expect(instanceTelemetry.auth_strategy).to.equal('DEFAULT');
    });
  });

  suite('with live connection', function () {
    this.timeout(20000);
    let dataServ;

    beforeEach(async () => {
      dataServ = await connect({ connectionString: TEST_DATABASE_URI });
    });

    afterEach(async () => {
      sinon.restore();
      await dataServ.disconnect();
    });

    test('track new connection event fetches the connection instance information', async () => {
      const instanceTelemetry =
        await connectionTelemetry.getConnectionTelemetryProperties(
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
