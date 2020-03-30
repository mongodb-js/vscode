import { format as toURL } from 'url';

import AUTHENICATION_TO_AUTH_MECHANISM from './constants/auth-strategy-to-auth-mechanism';
import AUTH_STRATEGIES from './constants/auth-strategies';
import READ_PREFERENCES from './constants/read-preferences';
import SSL_METHODS from './constants/ssl-methods';
import SSH_TUNNEL_TYPES from './constants/ssh-tunnel-types';

// Defaults.
const AUTH_STRATEGY_DEFAULT = AUTH_STRATEGIES.NONE;
const READ_PREFERENCE_DEFAULT = READ_PREFERENCES.PRIMARY;
const MONGODB_DATABASE_NAME_DEFAULT = 'admin';
const KERBEROS_SERVICE_NAME_DEFAULT = 'mongodb';
const SSL_DEFAULT = SSL_METHODS.NONE;
const SSH_TUNNEL_DEFAULT = SSH_TUNNEL_TYPES.NONE;

type port = number;

type host = {
  host: string;
  port: port;
};

class ConnectionModel {
  ns: string | null = null;
  isSrvRecord = false;
  hostname = 'localhost';
  port: port = 27017;
  hosts: host[] = [{ host: 'localhost', port: 27017 }];
  extraOptions = {};
  replicaSet?: string;
  readPreference: READ_PREFERENCES = READ_PREFERENCE_DEFAULT;

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
  // /**
  //  * Array of valid certificates either as Buffers or Strings
  //  * (needs to have a mongod server with ssl support, 2.4 or higher).
  //  */
  // sslCA?: any;
  // /**
  //  * String or buffer containing the certificate we wish to present
  //  * (needs to have a mongod server with ssl support, 2.4 or higher).
  //  */
  // sslCert?: any;
  // /**
  //  * String or buffer containing the certificate private key we wish to present
  //  * (needs to have a mongod server with ssl support, 2.4 or higher).
  //  */
  // sslKey?: any;
  // /**
  //  * String or buffer containing the certificate password
  //  * (needs to have a mongod server with ssl support, 2.4 or higher).
  //  */
  // sslPass?: string;

  // /**
  //  * SSH TUNNEL
  //  */
  sshTunnel: SSH_TUNNEL_TYPES = SSH_TUNNEL_DEFAULT;
  // // The hostname of the SSH remote host.
  // sshTunnelHostname?: string;
  // // The SSH port of the remote host.
  // sshTunnelPort: port = 22;
  // // Bind the localhost endpoint of the SSH Tunnel to this port.
  // sshTunnelBindToLocalPort?: port;
  // // The optional SSH username for the remote host.
  // sshTunnelUsername?: string;
  // // The optional SSH password for the remote host.
  // sshTunnelPassword?: string;
  // // The optional path to the SSH identity file for the remote host.
  // sshTunnelIdentityFile?: any;
  // // The optional passphrase for `sshTunnelIdentityFile`.
  // sshTunnelPassphrase?: string;

  getInstanceId(): string {
    return `${this.hostname}:${this.port}`;
  }
  getDriverAuthMechanism(): string | undefined {
    return AUTHENICATION_TO_AUTH_MECHANISM[this.authStrategy];
  }

  // eslint-disable-next-line complexity
  getBaseUrl(): string {
    const req: any = {
      protocol: 'mongodb',
      port: null,
      slashes: true,
      pathname: '/',
      query: {}
    };

    // In the `mongodb+srv` protocol the comma separated list of host names is
    // replaced with a single hostname.
    // The format is: `mongodb+srv://{hostname}.{domainname}/{options}`
    if (this.isSrvRecord) {
      req.protocol = 'mongodb+srv';
      req.hostname = this.hostname;
    } else if (this.hosts.length === 1) {
      // Driver adds sharding info to the original hostname.
      // And returnes a list of all coresponding hosts.
      // If driver returns a list of hosts which size is equal one,
      // we can use hostname attribute that stores unmodified value.
      req.hostname = this.hostname;
      req.port = this.port;
    } else {
      req.host = this.hosts
        .map((item) => `${item.host}:${item.port}`)
        .join(',');
    }

    if (this.ns) {
      req.pathname = `/${this.ns}`;
    }

    // Encode auth for url format
    if (this.authStrategy === AUTH_STRATEGIES.MONGODB) {
      req.auth = 'AUTH_TOKEN';
      req.query.authSource =
        this.mongodbDatabaseName || MONGODB_DATABASE_NAME_DEFAULT;
    } else if (this.authStrategy === 'SCRAM-SHA-256') {
      req.auth = 'AUTH_TOKEN';
      req.query.authSource =
        this.mongodbDatabaseName || MONGODB_DATABASE_NAME_DEFAULT;
      req.query.authMechanism = this.getDriverAuthMechanism();
    } else if (this.authStrategy === AUTH_STRATEGIES.KERBEROS) {
      req.auth = 'AUTH_TOKEN';
      req.query.gssapiServiceName =
        this.kerberosServiceName || KERBEROS_SERVICE_NAME_DEFAULT;
      req.query.authMechanism = this.getDriverAuthMechanism();
    } else if (this.authStrategy === AUTH_STRATEGIES.X509) {
      req.auth = 'AUTH_TOKEN';
      req.query.authMechanism = this.getDriverAuthMechanism();
    } else if (this.authStrategy === AUTH_STRATEGIES.LDAP) {
      req.auth = 'AUTH_TOKEN';
      req.query.authMechanism = this.getDriverAuthMechanism();
    }

    if (req.query.readPreference !== undefined) {
      req.query.readPreference = this.readPreference;
    }
    if (req.query.replicaSet !== undefined) {
      req.query.replicaSet = this.replicaSet;
    }

    if (this.sslMethod === SSL_METHODS.NONE) {
      req.query.ssl = 'false';
    } else {
      req.query.ssl = 'true';
    }

    const reqClone = {
      ...req
    };

    return toURL(reqClone);
  }

  // eslint-disable-next-line complexity
  getDriverUrl(): string {
    let username = '';
    let password = '';
    let authField = '';
    let result = this.getBaseUrl();

    // Post url.format() workaround for
    // https://github.com/nodejs/node/issues/1802
    if (
      this.authStrategy === 'MONGODB' ||
      this.authStrategy === 'SCRAM-SHA-256'
    ) {
      username = encodeURIComponent(this.mongodbUsername || '');
      password = encodeURIComponent(this.mongodbPassword || '');
      authField = `${username}:${password}`;
    } else if (this.authStrategy === 'LDAP') {
      username = encodeURIComponent(this.ldapUsername || '');
      password = encodeURIComponent(this.ldapPassword || '');
      authField = `${username}:${password}`;
    } else if (this.authStrategy === 'X509') {
      username = encodeURIComponent(this.x509Username || '');
      authField = username;
    } else if (this.authStrategy === 'KERBEROS' && this.kerberosPassword) {
      username = encodeURIComponent(this.kerberosPrincipal || '');
      password = encodeURIComponent(this.kerberosPassword);
      authField = `${username}:${password}`;
    } else if (this.authStrategy === 'KERBEROS') {
      username = encodeURIComponent(this.kerberosPrincipal || '');
      authField = `${username}:`;
    }

    // The auth component comes straight after `the mongodb://`
    // so a single string replace should always work.
    result = result.replace('AUTH_TOKEN', authField);

    if (
      this.authStrategy === AUTH_STRATEGIES.KERBEROS ||
      this.authStrategy === AUTH_STRATEGIES.LDAP
    ) {
      result = `${result}&authSource=$external`;
    }

    if (
      this.authStrategy === AUTH_STRATEGIES.KERBEROS &&
      this.kerberosCanonicalizeHostname
    ) {
      result = `${result}&authMechanismProperties=CANONICALIZE_HOST_NAME:true`;
    }

    return result;
  }
}

/**
 * Enforce constraints for SSL.
 * @param {Object} attrs - Incoming attributes.
 */
const validateSsl = (attrs): void => {
  if (
    !attrs.sslMethod ||
    ['NONE', 'UNVALIDATED', 'IFAVAILABLE', 'SYSTEMCA'].includes(attrs.sslMethod)
  ) {
    return;
  }

  if (attrs.sslMethod === 'SERVER' && !attrs.sslCA) {
    throw new TypeError('sslCA is required when ssl is SERVER.');
  } else if (attrs.sslMethod === 'ALL') {
    if (!attrs.sslCA) {
      throw new TypeError('sslCA is required when ssl is ALL.');
    }

    if (!attrs.sslKey) {
      throw new TypeError('sslKey is required when ssl is ALL.');
    }

    if (!attrs.sslCert) {
      throw new TypeError('sslCert is required when ssl is ALL.');
    }
  }
};

const validateMongodb = (attrs): void => {
  if (
    attrs.authStrategy === 'MONGODB' ||
    attrs.authStrategy === 'SCRAM-SHA-256'
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
const validateKerberos = (attrs): void => {
  if (attrs.authStrategy !== 'KERBEROS') {
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

const validateX509 = (attrs): void => {
  if (attrs.authStrategy === 'X509') {
    if (!attrs.x509Username) {
      throw new TypeError(
        'The x509Username field is required when using X509 for authStrategy.'
      );
    }
  }
};

const validateLdap = (attrs): void => {
  if (attrs.authStrategy === 'LDAP') {
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

const validateStandardSshTunnelOptions = (attrs): void => {
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

const validateSshTunnel = (attrs): void => {
  if (!attrs.sshTunnel || attrs.sshTunnel === SSH_TUNNEL_DEFAULT) {
    return;
  }

  if (attrs.sshTunnel === 'USER_PASSWORD') {
    validateStandardSshTunnelOptions(attrs);

    if (!attrs.sshTunnelPassword) {
      throw new TypeError(
        'sslTunnelPassword is required when sshTunnel is USER_PASSWORD.'
      );
    }
  } else if (attrs.sshTunnel === 'IDENTITY_FILE') {
    validateStandardSshTunnelOptions(attrs);

    if (!attrs.sshTunnelIdentityFile) {
      throw new TypeError(
        'sslTunnelIdentityFile is required when sshTunnel is IDENTITY_FILE.'
      );
    }
  }
};

const validateConnectionModel = (attrs): Error | undefined => {
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

export { validateConnectionModel };
export default ConnectionModel;
