import { ConnectionInfo } from 'mongodb-data-service';
import { expect } from 'chai';

import {
  mergeSecrets,
  extractSecrets,
  ConnectionSecrets,
} from '../../../utils/connectionSecrets';

suite('connection secrets', () => {
  suite('mergeSecrets', () => {
    test('does not modify the original object', () => {
      const originalConnectionInfo: ConnectionInfo = {
        connectionOptions: {
          connectionString: 'mongodb://localhost:27017',
          sshTunnel: {
            host: 'localhost',
            username: 'user',
            port: 22,
          },
        },
        favorite: {
          name: 'connection 1',
        },
      };

      const originalConnectionInfoStr = JSON.stringify(originalConnectionInfo);

      const newConnectionInfo = mergeSecrets(originalConnectionInfo, {
        password: 'xxx',
        awsSessionToken: 'xxx',
        sshTunnelPassphrase: 'xxx',
        tlsCertificateKeyFilePassword: 'xxx',
      });

      expect(newConnectionInfo).to.not.equal(originalConnectionInfo);

      expect(newConnectionInfo.connectionOptions).to.not.equal(
        originalConnectionInfo.connectionOptions
      );

      expect(newConnectionInfo.connectionOptions.sshTunnel).to.not.equal(
        originalConnectionInfo.connectionOptions.sshTunnel
      );

      expect(newConnectionInfo.favorite).to.not.equal(
        originalConnectionInfo.favorite
      );

      expect(originalConnectionInfoStr).to.equal(
        JSON.stringify(originalConnectionInfo)
      );
    });

    test('merges secrets', () => {
      const originalConnectionInfo: ConnectionInfo = {
        connectionOptions: {
          connectionString: 'mongodb://username@localhost:27017/',
          sshTunnel: {
            host: 'localhost',
            username: 'user',
            port: 22,
          },
        },
      };

      const newConnectionInfo = mergeSecrets(originalConnectionInfo, {
        awsSessionToken: 'sessionToken',
        password: 'userPassword',
        sshTunnelPassphrase: 'passphrase',
        tlsCertificateKeyFilePassword: 'tlsCertPassword',
      });

      expect(newConnectionInfo).to.be.deep.equal({
        connectionOptions: {
          connectionString:
            'mongodb://username:userPassword@localhost:27017/?tlsCertificateKeyFilePassword=tlsCertPassword&authMechanismProperties=AWS_SESSION_TOKEN%3AsessionToken',
          sshTunnel: {
            host: 'localhost',
            username: 'user',
            port: 22,
            identityKeyPassphrase: 'passphrase',
          },
        },
      } as ConnectionInfo);
    });
  });

  suite('extractSecrets', () => {
    test('does not modify the original object', () => {
      const originalConnectionInfo: ConnectionInfo = {
        connectionOptions: {
          connectionString: 'mongodb://localhost:27017',
          sshTunnel: {
            host: 'localhost',
            username: 'user',
            port: 22,
          },
        },
        favorite: {
          name: 'connection 1',
        },
      };

      const originalConnectionInfoStr = JSON.stringify(originalConnectionInfo);

      const { connectionInfo: newConnectionInfo } = extractSecrets(
        originalConnectionInfo
      );

      expect(newConnectionInfo).to.not.equal(originalConnectionInfo);

      expect(newConnectionInfo.connectionOptions).to.not.equal(
        originalConnectionInfo.connectionOptions
      );

      expect(newConnectionInfo.connectionOptions.sshTunnel).to.not.equal(
        originalConnectionInfo.connectionOptions.sshTunnel
      );

      expect(newConnectionInfo.favorite).to.not.equal(
        originalConnectionInfo.favorite
      );

      expect(originalConnectionInfoStr).to.equal(
        JSON.stringify(originalConnectionInfo)
      );
    });

    test('extracts secrets', () => {
      const originalConnectionInfo: ConnectionInfo = {
        connectionOptions: {
          connectionString:
            'mongodb://username:userPassword@localhost:27017/?tlsCertificateKeyFilePassword=tlsCertPassword&authMechanismProperties=AWS_SESSION_TOKEN%3AsessionToken',
          sshTunnel: {
            host: 'localhost',
            username: 'user',
            port: 22,
            identityKeyPassphrase: 'passphrase',
          },
        },
      };

      const { connectionInfo: newConnectionInfo, secrets } = extractSecrets(
        originalConnectionInfo
      );

      expect(newConnectionInfo).to.be.deep.equal({
        connectionOptions: {
          connectionString: 'mongodb://username@localhost:27017/',
          sshTunnel: {
            host: 'localhost',
            username: 'user',
            port: 22,
          },
        },
      } as ConnectionInfo);

      expect(secrets).to.be.deep.equal({
        awsSessionToken: 'sessionToken',
        password: 'userPassword',
        sshTunnelPassphrase: 'passphrase',
        tlsCertificateKeyFilePassword: 'tlsCertPassword',
      } as ConnectionSecrets);
    });
  });
});
