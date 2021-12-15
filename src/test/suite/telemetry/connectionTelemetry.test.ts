import { beforeEach, afterEach } from 'mocha';
import { connect } from 'mongodb-data-service';
import { expect } from 'chai';
import sinon from 'sinon';

import { ConnectionTypes } from '../../../connectionController';
import {
  getConnectionTelemetryProperties
} from '../../../telemetry/connectionTelemetry';

const TEST_DATABASE_URI = 'mongodb://localhost:27018';

suite('ConnectionTelemetry Controller Test Suite', function () {
  this.timeout(5000);

  suite('with mock data service', () => {
    const mockDataService: any = {
      getConnectionString: () => ({
        hosts: ['localhost:27018'],
        searchParams: { get: () => null },
        username: 'authMechanism'
      }),
      instance: () => Promise.resolve({
        dataLake: {},
        build: {},
        genuineMongoDB: {},
        host: {}
      })
    };

    test('it returns is_used_connect_screen true when the connection type is form', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockDataService,
        ConnectionTypes.CONNECTION_FORM
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(true);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it returns is_used_command_palette true when the connection type is string', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockDataService,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });

    test('it returns is_used_saved_connection true when the connection type is id', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockDataService,
        ConnectionTypes.CONNECTION_ID
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(true);
    });

    test('it has is_localhost false for a remote connection', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockDataService,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_localhost).to.equal(false);
    });

    test('it has a default is atlas false', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockDataService,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_atlas).to.equal(false);
    });

    test('it has a default driver auth mechanism undefined', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockDataService,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.auth_strategy).to.equal('DEFAULT');
    });
  });

  suite('with live connection', () => {
    let dataServ;

    beforeEach(async () => {
      dataServ = await connect({ connectionString: TEST_DATABASE_URI });
      await dataServ.connect();
    });

    afterEach(async () => {
      sinon.restore();
      await dataServ.disconnect();
    });

    test('track new connection event fetches the connection instance information', async() => {
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
