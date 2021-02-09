// Array of field names associated with each `authStrategy`.
export default {
  NONE: [],
  MONGODB: [
    'mongodbUsername', // required
    'mongodbPassword', // required
    'mongodbDatabaseName' // optional
  ],
  'SCRAM-SHA-256': [
    'mongodbUsername', // required
    'mongodbPassword', // required
    'mongodbDatabaseName' // optional
  ],
  KERBEROS: [
    'kerberosPrincipal', // required
    'kerberosPassword', // optional
    'kerberosServiceName', // optional
    'kerberosCanonicalizeHostname'
  ],
  X509: [],
  LDAP: [
    'ldapUsername', // required
    'ldapPassword' // required
  ]
};
