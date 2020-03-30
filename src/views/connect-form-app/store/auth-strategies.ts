export enum AUTH_STRATEGY_ID {
  NONE = 'NONE',
  MONGODB = 'MONGODB',
  'SCRAM-SHA-256' = 'SCRAM-SHA-256',
  KERBEROS = 'KERBEROS',
  LDAP = 'LDAP',
  X509 = 'X509'
}

type AuthStrategy = {
  id: AUTH_STRATEGY_ID;
  title: string;
};

export const AuthStrategies: AuthStrategy[] = [{
  id: AUTH_STRATEGY_ID.NONE,
  title: 'None'
}, {
  id: AUTH_STRATEGY_ID.MONGODB,
  title: 'Username / Password'
}, {
  id: AUTH_STRATEGY_ID['SCRAM-SHA-256'],
  title: 'SCRAM-SHA-256'
}, {
  id: AUTH_STRATEGY_ID.KERBEROS,
  title: 'Kerberos'
}, {
  id: AUTH_STRATEGY_ID.LDAP,
  title: 'LDAP'
}, {
  id: AUTH_STRATEGY_ID.X509,
  title: 'X.509'
}];
