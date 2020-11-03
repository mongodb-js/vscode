import { KeytarInterface, KeytarCredential } from '../../utils/keytar';

const retrievalDelay = 1; // ms simulated delay on keytar methods.

export default class KeytarStub implements KeytarInterface {
  private _services: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();

  public async findCredentials(service: string): Promise<Array<KeytarCredential> | undefined> {
    await this.delay();
    const savedServices = this._services.get(service);
    if (savedServices) {
      return Array.from(savedServices.keys()).map(key => ({
        account: key,
        password: savedServices.get(key) || ''
      }));
    }

    return undefined;
  }

  public async getPassword(service: string, account: string): Promise<string | null> {
    await this.delay();
    const savedService = this._services.get(service);
    if (savedService) {
      const savedPassword = savedService.get(account);

      if (savedPassword !== undefined) {
        return savedPassword;
      }
    }

    return null;
  }

  public async setPassword(service: string, account: string, password: string): Promise<void> {
    await this.delay();
    let savedService = this._services.get(service);
    if (!savedService) {
      savedService = new Map<string, string>();
      this._services.set(service, savedService);
    }

    savedService.set(account, password);
  }

  public async deletePassword(service: string, account: string): Promise<boolean> {
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

  private async delay(): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, retrievalDelay);
    });
  }
}
