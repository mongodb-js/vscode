import * as keytarType from 'keytar';

import { getNodeModule } from './getNodeModule';

export type KeytarCredential = {
  account: string;
  password: string;
};

export interface KeytarInterface {
  /**
   * Find all accounts and passwords for `service` in the keychain.
   *
   * @param service The string service name.
   *
   * @returns A promise for the array of found credentials.
   */
  findCredentials(service: string): Promise<Array<KeytarCredential> | undefined>;

  /**
   * Get the stored password for the service and account.
   *
   * @param service The string service name.
   * @param account The string account name.
   *
   * @returns A promise for the password string.
   */
  getPassword(service: string, account: string): Promise<string | null>;

  /**
   * Add the password for the service and account to the keychain.
   *
   * @param service The string service name.
   * @param account The string account name.
   * @param password The string password.
   *
   * @returns A promise for the set password completion.
   */
  setPassword(
    service: string,
    account: string,
    password: string
  ): Promise<void>;

  /**
   * Delete the stored password for the service and account.
   *
   * @param service The string service name.
   * @param account The string account name.
   *
   * @returns A promise for the deletion status. True on success.
   */
  deletePassword(service: string, account: string): Promise<boolean>;
}

export const createKeytar = (): KeytarInterface | undefined => {
  // We load keytar in two different ways. This is because when the
  // extension is webpacked it requires the vscode external keytar dependency
  // differently then our development environment.
  let keytarModule: KeytarInterface | undefined = require('keytar');

  if (!keytarModule) {
    keytarModule = getNodeModule<typeof keytarType>('keytar');
  }

  return keytarModule;
};
