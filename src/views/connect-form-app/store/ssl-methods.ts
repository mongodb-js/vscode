export enum SSL_METHOD_ID {
  NONE = 'NONE',
  SYSTEMCA = 'SYSTEMCA',
  SERVER = 'SERVER',
  ALL = 'ALL',
  UNVALIDATED = 'UNVALIDATED'
}

type SSLMethod = {
  id: SSL_METHOD_ID;
  title: string;
};

export const SSLMethods: SSLMethod[] = [{
  id: SSL_METHOD_ID.NONE,
  title: 'None'
}, {
  id: SSL_METHOD_ID.SYSTEMCA,
  title: 'System CA / Atlas Deployment'
}, {
  id: SSL_METHOD_ID.SERVER,
  title: 'Server Validation'
}, {
  id: SSL_METHOD_ID.SERVER,
  title: 'Server and Client Validation'
}, {
  id: SSL_METHOD_ID.UNVALIDATED,
  title: 'Unvalidated (insecure)'
}];
