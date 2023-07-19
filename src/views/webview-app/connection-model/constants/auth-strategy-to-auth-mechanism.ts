// Maps `authStrategy` to driver `authMechanism`.
export default {
  NONE: undefined,
  MONGODB: 'DEFAULT',
  X509: 'MONGODB-X509',
  LDAP: 'PLAIN',
  'SCRAM-SHA-256': 'SCRAM-SHA-256',
};
