import AUTH_STRATEGIES from './constants/auth-strategies';
import READ_PREFERENCES from './constants/read-preferences';
import SSL_METHODS from './constants/ssl-methods';
import SSH_TUNNEL_TYPES from './constants/ssh-tunnel-types';
import { MongoClientOptions } from 'mongodb';

const {
  name: appName,
  version: appVersion
} = require('../../../../package.json');


// Defaults.
const AUTH_STRATEGY_DEFAULT = AUTH_STRATEGIES.NONE;
const READ_PREFERENCE_DEFAULT = READ_PREFERENCES.PRIMARY;
const SSL_DEFAULT = SSL_METHODS.NONE;
const SSH_TUNNEL_DEFAULT = SSH_TUNNEL_TYPES.NONE;

type port = number;

export interface Host {
  host: string;
  port: port;
}

export const DEFAULT_HOST: Host = { host: 'localhost', port: 27017 };

// NOTE: This is currently tightly coupled with `mongodb-connection-model`.
class ConnectionModel {
  isSrvRecord = false;
  hostname = 'localhost';
  port: port = 27017;
  hosts: Host[] = [{ ...DEFAULT_HOST }];
  extraOptions = {};
  replicaSet: undefined | string;
  readPreference: READ_PREFERENCES = READ_PREFERENCE_DEFAULT;

  appname = `${appName} ${appVersion}`;

  /**
   * Authentication.
   */
  authStrategy: AUTH_STRATEGIES = AUTH_STRATEGY_DEFAULT;
  kerberosCanonicalizeHostname = false;
  kerberosPassword?: string;
  kerberosPrincipal?: string;
  kerberosServiceName?: string;
  ldapPassword?: string;
  ldapUsername?: string;
  mongodbDatabaseName?: string;
  mongodbPassword?: string;
  mongodbUsername?: string;
  x509Username?: string;

  /**
   * SSL
   */
  sslMethod: SSL_METHODS = SSL_DEFAULT;
  /**
   * Array of valid certificates either as Buffers or Strings
   * (needs to have a mongod server with ssl support, 2.4 or higher).
   */
  sslCA?: string[];
  /**
   * String or buffer containing the certificate we wish to present
   * (needs to have a mongod server with ssl support, 2.4 or higher).
   */
  sslCert?: string[];
  /**
   * String or buffer containing the certificate private key we wish to present
   * (needs to have a mongod server with ssl support, 2.4 or higher).
   */
  sslKey?: string[];
  /**
   * String or buffer containing the certificate password
   * (needs to have a mongod server with ssl support, 2.4 or higher).
   */
  sslPass?: string;

  /**
   * SSH TUNNEL
   */
  sshTunnel: SSH_TUNNEL_TYPES = SSH_TUNNEL_DEFAULT;
  // The hostname of the SSH remote host.
  sshTunnelHostname?: string;
  // The SSH port of the remote host.
  sshTunnelPort: port = 22;
  // Bind the localhost endpoint of the SSH Tunnel to this port.
  sshTunnelBindToLocalPort?: port;
  // The optional SSH username for the remote host.
  sshTunnelUsername?: string;
  // The optional SSH password for the remote host.
  sshTunnelPassword?: string;
  // The optional path to the SSH identity file for the remote host.
  sshTunnelIdentityFile?: string[];
  // The optional passphrase for `sshTunnelIdentityFile`.
  sshTunnelPassphrase?: string;

  constructor(model: any) {
    this.isSrvRecord = model.isSrvRecord as boolean;
  }
}

/**
 * Enforce constraints for SSL.
 * @param {Object} attrs - Incoming attributes.
 */
const validateSsl = (attrs: ConnectionModel): void => {
  if (
    !attrs.sslMethod ||
    ['NONE', 'UNVALIDATED', 'IFAVAILABLE', 'SYSTEMCA'].includes(attrs.sslMethod)
  ) {
    return;
  }

  if (attrs.sslMethod === SSL_METHODS.SERVER && !attrs.sslCA) {
    throw new TypeError('sslCA is required when ssl is SERVER.');
  } else if (attrs.sslMethod === SSL_METHODS.ALL) {
    if (!attrs.sslCA) {
      throw new TypeError('sslCA is required when ssl is ALL.');
    }

    if (!attrs.sslCert) {
      throw new TypeError('sslCert is required when ssl is ALL.');
    }
  }
};

const validateMongodb = (attrs: ConnectionModel): void => {
  if (
    attrs.authStrategy === AUTH_STRATEGIES.MONGODB ||
    attrs.authStrategy === AUTH_STRATEGIES['SCRAM-SHA-256']
  ) {
    if (!attrs.mongodbUsername) {
      throw new TypeError(
        'The mongodbUsername field is required when ' +
          'using MONGODB or SCRAM-SHA-256 for authStrategy.'
      );
    }

    if (!attrs.mongodbPassword) {
      throw new TypeError(
        'The mongodbPassword field is required when ' +
          'using MONGODB or SCRAM-SHA-256 for authStrategy.'
      );
    }
  }
};

/**
 * Enforce constraints for Kerberos.
 * @param {Object} attrs - Incoming attributes.
 */
const validateKerberos = (attrs: ConnectionModel): void => {
  if (attrs.authStrategy !== AUTH_STRATEGIES.KERBEROS) {
    if (attrs.kerberosServiceName) {
      throw new TypeError(
        `The kerberosServiceName field does not apply when using ${attrs.authStrategy} for authStrategy.`
      );
    }
    if (attrs.kerberosPrincipal) {
      throw new TypeError(
        `The kerberosPrincipal field does not apply when using ${attrs.authStrategy} for authStrategy.`
      );
    }
    if (attrs.kerberosPassword) {
      throw new TypeError(
        `The kerberosPassword field does not apply when using ${attrs.authStrategy} for authStrategy.`
      );
    }
  } else if (!attrs.kerberosPrincipal) {
    throw new TypeError(
      'The kerberosPrincipal field is required when using KERBEROS for authStrategy.'
    );
  }
};

const validateX509 = (attrs: ConnectionModel): void => {
  if (attrs.authStrategy === AUTH_STRATEGIES.X509 && attrs.sslMethod !== SSL_METHODS.ALL) {
    throw new TypeError(
      'SSL method is required to be set to \'Server and Client\' when using x509 authentication'
    );
  }
};

const validateLdap = (attrs: ConnectionModel): void => {
  if (attrs.authStrategy === AUTH_STRATEGIES.LDAP) {
    if (!attrs.ldapUsername) {
      throw new TypeError(
        'The ldapUsername field is required when using LDAP for authStrategy.'
      );
    }
    if (!attrs.ldapPassword) {
      throw new TypeError(
        'The ldapPassword field is required when using LDAP for authStrategy.'
      );
    }
  }
};

const validateStandardSshTunnelOptions = (attrs: ConnectionModel): void => {
  if (attrs.sshTunnel !== SSH_TUNNEL_TYPES.NONE && attrs.isSrvRecord) {
    throw new TypeError(
      'SSH Tunnel connections are not currently supported with srv records, please specify an individual server to connect to.'
    );
  }

  if (!attrs.sshTunnelUsername) {
    throw new TypeError(
      'sslTunnelUsername is required when sshTunnel is not NONE.'
    );
  }

  if (!attrs.sshTunnelHostname) {
    throw new TypeError(
      'sslTunnelHostname is required when sshTunnel is not NONE.'
    );
  }

  if (!attrs.sshTunnelPort) {
    throw new TypeError(
      'sslTunnelPort is required when sshTunnel is not NONE.'
    );
  }
};

const validateSshTunnel = (attrs: ConnectionModel): void => {
  if (!attrs.sshTunnel || attrs.sshTunnel === SSH_TUNNEL_DEFAULT) {
    return;
  }

  if (attrs.sshTunnel === SSH_TUNNEL_TYPES.USER_PASSWORD) {
    validateStandardSshTunnelOptions(attrs);

    if (!attrs.sshTunnelPassword) {
      throw new TypeError(
        'sslTunnelPassword is required when sshTunnel is USER_PASSWORD.'
      );
    }
  } else if (attrs.sshTunnel === SSH_TUNNEL_TYPES.IDENTITY_FILE) {
    validateStandardSshTunnelOptions(attrs);

    if (!attrs.sshTunnelIdentityFile) {
      throw new TypeError(
        'sslTunnelIdentityFile is required when sshTunnel is IDENTITY_FILE.'
      );
    }
  }
};

export const validateConnectionModel = (attrs: ConnectionModel): Error | undefined => {
  try {
    validateSsl(attrs);
    validateMongodb(attrs);
    validateKerberos(attrs);
    validateX509(attrs);
    validateLdap(attrs);
    validateSshTunnel(attrs);
  } catch (err) {
    return err;
  }
};

export const parseConnectionModel = (
  model: any
): ConnectionModel => {
  const newConnectionModel = new ConnectionModel(model);

  // TODO: Parse connection model.

  return newConnectionModel;
};

export const buildConnectionModelFromConnectionString = (
  connectionString: string
): ConnectionModel => {
  const model = new ConnectionModel({
    isSrvRecord: true
  });

  console.log('build w/', connectionString);

  // TODO: Parse connection string into model.

  return model;
};

export const buildConnectionStringFromConnectionModel = (
  model: ConnectionModel,
  options?: {
    withSSHTunnelIfConfigured?: boolean;
  }
): string => {
  // TODO
  console.log('build w/', model, options);

  return 'mongodb://localhost:27017';
};

export const getDriverOptionsFromConnectionModel = (
  model: ConnectionModel
): MongoClientOptions => {
  // TODO

  console.log('build w/', model);

  return { };
};

export function getConnectionNameFromConnectionModel(
  model: ConnectionModel
): string {
  if (
    model.sshTunnel &&
    model.sshTunnel !== SSH_TUNNEL_TYPES.NONE &&
    model.sshTunnelHostname &&
    model.sshTunnelPort
  ) {
    return `SSH to ${model.hosts
      .map(({ host, port }) => `${host}:${port}`)
      .join(',')}`;
  }

  if (model.isSrvRecord) {
    return model.hostname;
  }

  if (model.hosts && model.hosts.length > 0) {
    return model.hosts
      .map(({ host, port }) => `${host}:${port}`)
      .join(',');
  }

  return model.hostname;
}

export default ConnectionModel;
