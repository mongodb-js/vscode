import { promisify } from 'util';

import { KeytarInterface } from '../../utils/keytar';

const retrievalDelay = 1; // ms simulated delay on keytar methods.

export default class KeytarStub implements KeytarInterface {
  private _services: Map<string, Map<string, string>> = new Map<
    string,
    Map<string, string>
  >();

  public async findCredentials(
    service: string
  ): Promise<Map<string, string> | undefined> {
    await this.delay();
    const savedServices = this._services.get(service);
    if (savedServices) {
      return savedServices;
    }

    return undefined;
  }

  public async getPassword(
    service: string,
    account: string
  ): Promise<string | null> {
    await this.delay();
    const savedService = this._services.get(service);
    if (savedService) {
      const savedAccount = savedService.get(account);

      if (savedAccount !== undefined) {
        return savedAccount;
      }
    }

    return null;
  }

  public async setPassword(
    service: string,
    account: string,
    password: string
  ): Promise<void> {
    await this.delay();
    let savedService = this._services.get(service);
    if (!savedService) {
      savedService = new Map<string, string>();
      this._services.set(service, savedService);
    }

    savedService.set(account, password);
  }

  public async deletePassword(
    service: string,
    account: string
  ): Promise<boolean> {
    await this.delay();
    const savedService = this._services.get(service);
    if (savedService) {
      if (savedService.has(account)) {
        savedService.delete(account);
        return true;
      }
    }

    return false;
  }

  private delay(): Promise<void> {
    return promisify(setTimeout)(retrievalDelay);
  }
}
