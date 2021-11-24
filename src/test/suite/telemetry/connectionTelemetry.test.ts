import sinon from 'sinon';
import DataService = require('mongodb-data-service');
import Connection = require('mongodb-connection-model/lib/model');
import { expect } from 'chai';
import { promisify } from 'util';
import { beforeEach, afterEach } from 'mocha';

import {
  getConnectionTelemetryProperties
} from '../../../telemetry/connectionTelemetry';
import { ConnectionTypes } from '../../../connectionController';

suite('ConnectionTelemetry Controller Test Suite', function () {
  this.timeout(5000);

  suite('with mock client', () => {
    const mockClient: any = {
      db: () => ({
        command: () => ({})
      })
    };
    const testConnectionModel = new Connection({
      hostname: 'scubatank',
      port: 22345
    });

    test('it returns is_used_connect_screen true when the connection type is form', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        testConnectionModel,
        ConnectionTypes.CONNECTION_FORM
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(true);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });
    test('it returns is_used_command_palette true when the connection type is string', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        testConnectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
    });
    test('it returns is_used_saved_connection true when the connection type is id', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        testConnectionModel,
        ConnectionTypes.CONNECTION_ID
      );

      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(false);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(true);
    });
    test('it has is_localhost false for a remote connection', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        testConnectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_localhost).to.equal(false);
      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });
    test('it has is_localhost false for a remote connection', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        testConnectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_localhost).to.equal(false);
      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });
    test('it has is_atlas true for an atlas url connection', async () => {
      const connectionModel = new Connection({
        hostname: 'test.mongodb.net',
        port: 22345
      });
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        connectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.is_localhost).to.equal(false);
      expect(instanceTelemetry.is_atlas).to.equal(true);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });
    test('it has a default driver auth mechanism undefined', async () => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        testConnectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.auth_strategy).to.equal(undefined);
    });
    test('it has the driver auth mechanism for x509', async () => {
      const connectionModel = new Connection({
        hostname: 'localhost',
        authStrategy: 'X509',
        port: 27040
      });
      const instanceTelemetry = await getConnectionTelemetryProperties(
        mockClient,
        connectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(instanceTelemetry.auth_strategy).to.equal('MONGODB-X509');
    });
  });

  suite('with live connection', () => {
    let dataServ;
    const connectionModel = new Connection({
      hostname: 'localhost',
      port: 27018
    });

    beforeEach(async () => {
      dataServ = new DataService(connectionModel);
      const runConnect = promisify(dataServ.connect.bind(dataServ));
      await runConnect();
    });

    afterEach(async () => {
      sinon.restore();
      const runDisconnect = promisify(dataServ.disconnect.bind(dataServ));
      await runDisconnect();
    });

    test('track new connection event fetches the connection instance information', async() => {
      const instanceTelemetry = await getConnectionTelemetryProperties(
        dataServ.client.client,
        connectionModel,
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
