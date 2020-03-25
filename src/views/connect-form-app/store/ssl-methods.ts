export enum SSL_METHOD_ID {
  NO_SSL_ROLE = 'NO_SSL_ROLE',
  SYSTEM_CA_SSL_ROLE = 'SYSTEM_CA_SSL_ROLE',
  SERVER_VALIDATION_SSL_ROLE = 'SERVER_VALIDATION_SSL_ROLE',
  SERVER_CLIENT_VALIDATION_SSL_ROLE = 'SERVER_CLIENT_VALIDATION_SSL_ROLE',
  UNVALIDATED_SLL_ROLE = 'UNVALIDATED_SLL_ROLE'
}

type SSLMethod = {
  id: SSL_METHOD_ID;
  title: string;
};

export const SSLMethods: SSLMethod[] = [{
  id: SSL_METHOD_ID.NO_SSL_ROLE,
  title: 'None'
}, {
  id: SSL_METHOD_ID.SYSTEM_CA_SSL_ROLE,
  title: 'System CA / Atlas Deployment'
}, {
  id: SSL_METHOD_ID.SERVER_VALIDATION_SSL_ROLE,
  title: 'Server Validation'
}, {
  id: SSL_METHOD_ID.SERVER_CLIENT_VALIDATION_SSL_ROLE,
  title: 'Server and Client Validation'
}, {
  id: SSL_METHOD_ID.UNVALIDATED_SLL_ROLE,
  title: 'Unvalidated (insecure)'
}];
