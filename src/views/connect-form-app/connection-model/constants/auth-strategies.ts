// Allowed values for the `authStrategy` field.
enum AUTH_STRATEGY_VALUES {
  /**
   * Use no authentication strategy.
   */
  NONE = 'NONE',
  /**
   * Allow the driver to autodetect and select SCRAM-SHA-1
   * or MONGODB-CR depending on server capabilities.
   */
  MONGODB = 'MONGODB',
  /**
   * @enterprise
   * @see http://bit.ly/mongodb-node-driver-x509
   */
  X509 = 'X509',
  /**
   * @enterprise
   * @see http://bit.ly/mongodb-node-driver-kerberos
   */
  KERBEROS = 'KERBEROS',
  /**
   * @enterprise
   * @see http://bit.ly/mongodb-node-driver-ldap
   */
  LDAP = 'LDAP',
  'SCRAM-SHA-256' = 'SCRAM-SHA-256'
}

type AuthStrategy = {
  id: AUTH_STRATEGY_VALUES;
  title: string;
};

export const AuthStrategies: AuthStrategy[] = [
  {
    id: AUTH_STRATEGY_VALUES.NONE,
    title: 'None'
  },
  {
    id: AUTH_STRATEGY_VALUES.MONGODB,
    title: 'Username / Password'
  },
  {
    id: AUTH_STRATEGY_VALUES['SCRAM-SHA-256'],
    title: 'SCRAM-SHA-256'
  },
  // {
  //   id: AUTH_STRATEGY_VALUES.KERBEROS,
  //   title: 'Kerberos'
  // },
  {
    id: AUTH_STRATEGY_VALUES.LDAP,
    title: 'LDAP'
  },
  {
    id: AUTH_STRATEGY_VALUES.X509,
    title: 'X.509'
  }
];

export default AUTH_STRATEGY_VALUES;
