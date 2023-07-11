// Array of field names associated with each `authStrategy`.
export default {
  NONE: [],
  MONGODB: [
    'mongodbUsername', // required
    'mongodbPassword', // required
    'mongodbDatabaseName', // optional
  ],
  'SCRAM-SHA-256': [
    'mongodbUsername', // required
    'mongodbPassword', // required
    'mongodbDatabaseName', // optional
  ],
  X509: [
    'x509Username', // required
  ],
  LDAP: [
    'ldapUsername', // required
    'ldapPassword', // required
  ],
};
