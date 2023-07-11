// Maps `authMechanism` to `authStrategy`
export default {
  DEFAULT: 'MONGODB',
  'SCRAM-SHA-1': 'MONGODB',
  'SCRAM-SHA-256': 'SCRAM-SHA-256',
  'MONGODB-CR': 'MONGODB',
  'MONGODB-X509': 'X509',
  PLAIN: 'LDAP',
  LDAP: 'LDAP',
};
