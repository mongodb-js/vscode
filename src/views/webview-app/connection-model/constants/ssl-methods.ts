// Allowed values for the `sslMethod` field.
export enum SSL_METHODS {
  /**
   * Do not use SSL for anything.
   */
  NONE = 'NONE',
  /**
   * Use system CA.
   */
  SYSTEMCA = 'SYSTEMCA',
  /**
   * Use SSL if available.
   */
  IFAVAILABLE = 'IFAVAILABLE',
  /**
   * Use SSL but do not perform any validation of the certificate chain.
   */
  UNVALIDATED = 'UNVALIDATED',
  /**
   * The driver should validate the server certificate and fail to connect if validation fails.
   */
  SERVER = 'SERVER',
  /**
   * The driver must present a valid certificate and validate the server certificate.
   */
  ALL = 'ALL',
}

type SSLMethod = {
  id: SSL_METHODS;
  title: string;
};

export const SSLMethodOptions: SSLMethod[] = [
  {
    id: SSL_METHODS.NONE,
    title: 'None',
  },
  {
    id: SSL_METHODS.SYSTEMCA,
    title: 'System CA / Atlas Deployment',
  },
  {
    id: SSL_METHODS.SERVER,
    title: 'Server Validation',
  },
  {
    id: SSL_METHODS.ALL,
    title: 'Server and Client Validation',
  },
  {
    id: SSL_METHODS.UNVALIDATED,
    title: 'Unvalidated (insecure)',
  },
];

export default SSL_METHODS;
