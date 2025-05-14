import type StorageController from './storageController';
import { StorageLocation, StorageVariables } from './storageController';

export class AtlasStorage {
  _storageController: StorageController;

  constructor({ storageController }: { storageController: StorageController }) {
    this._storageController = storageController;
  }

  getStoredClientId(): string | null {
    return (
      this._storageController.get(
        StorageVariables.ATLAS_CLIENT_ID,
        StorageLocation.WORKSPACE,
      ) ?? null
    );
  }
  getStoredClientSecret(): Promise<string | null> {
    const clientId = this.getStoredClientId();
    if (!clientId) {
      return Promise.resolve(null);
    }
    return this._storageController.getSecret('atlasClientSecret_' + clientId);
  }
  setClientId(clientId: string): Promise<void> {
    return this._storageController.setSecret('atlasClientId', clientId);
  }
  setClientSecret(clientSecret: string): Promise<void> {
    const clientId = this.getStoredClientId();
    if (!clientId) {
      return Promise.reject(new Error('Client ID is not set'));
    }
    return this._storageController.setSecret(
      'atlasClientSecret_' + clientId,
      clientSecret,
    );
  }
  async clearCredentials(): Promise<void> {
    const clientId = this.getStoredClientId();
    if (!clientId) {
      return;
    }
    await Promise.all([
      this._storageController.update(
        StorageVariables.ATLAS_CLIENT_ID,
        undefined,
      ),
      this._storageController.deleteSecret('atlasClientSecret_' + clientId),
    ]);
  }
}
