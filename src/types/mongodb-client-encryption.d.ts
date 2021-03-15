declare module 'mongodb-client-encryption' {
  const resource: { [key: string]: any };

  type AWSEncryptionKeyOptions = any;
  type AzureEncryptionKeyOptions = any;
  type GCPEncryptionKeyOptions = any;
  type ClientEncryption = any;
  type ClientEncryptionCreateDataKeyCallback = any;
  type ClientEncryptionCreateDataKeyProviderOptions = any;
  type ClientEncryptionDataKeyProvider = any;
  type ClientEncryptionDecryptCallback = any;
  type ClientEncryptionEncryptCallback = any;
  type ClientEncryptionEncryptOptions = any;
  type ClientEncryptionOptions = any;
  type KMSProviders = any;

  export {
    AWSEncryptionKeyOptions,
    AzureEncryptionKeyOptions,
    GCPEncryptionKeyOptions,
    ClientEncryption,
    ClientEncryptionCreateDataKeyCallback,
    ClientEncryptionCreateDataKeyProviderOptions,
    ClientEncryptionDataKeyProvider,
    ClientEncryptionDecryptCallback,
    ClientEncryptionEncryptCallback,
    ClientEncryptionEncryptOptions,
    ClientEncryptionOptions,
    KMSProviders
  };

  export default resource;
}
