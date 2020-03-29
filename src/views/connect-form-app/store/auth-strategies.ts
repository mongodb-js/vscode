// export enum AUTH_STRATEGY_ID {
//   NO_AUTH_ROLE = 'NO_AUTH_ROLE',
//   MONGODB_AUTH_ROLE = 'MONGODB_AUTH_ROLE',
//   SCRAM_SHA_256_AUTH_ROLE = 'SCRAM_SHA_256_AUTH_ROLE'
// }

export enum AUTH_STRATEGY_ID {
  NO_AUTH_ROLE = 'NONE',
  MONGODB_AUTH_ROLE = 'MONGODB',
  SCRAM_SHA_256_AUTH_ROLE = 'SCRAM-SHA-256'
}

type AuthStrategy = {
  id: AUTH_STRATEGY_ID;
  title: string;
};

export const AuthStrategies: AuthStrategy[] = [{
  id: AUTH_STRATEGY_ID.NO_AUTH_ROLE,
  title: 'None'
}, {
  id: AUTH_STRATEGY_ID.MONGODB_AUTH_ROLE,
  title: 'Username / Password'
}, {
  id: AUTH_STRATEGY_ID.SCRAM_SHA_256_AUTH_ROLE,
  title: 'SCRAM-SHA-256'
}];
