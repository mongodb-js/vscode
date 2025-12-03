import type * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

import type { StoreConnectionInfo } from './connectionStorage';

export const STORAGE_VARIABLES = {
  // Only exists on globalState.
  GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW: 'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW',
  GLOBAL_SAVED_CONNECTIONS: 'GLOBAL_SAVED_CONNECTIONS',
  // Analytics user identify.
  GLOBAL_USER_ID: 'GLOBAL_USER_ID',
  GLOBAL_ANONYMOUS_ID: 'GLOBAL_ANONYMOUS_ID',
  // Only exists on workspaceState.
  WORKSPACE_SAVED_CONNECTIONS: 'WORKSPACE_SAVED_CONNECTIONS',
  COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE:
    'COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE',
} as const;

export type StorageVariables =
  (typeof STORAGE_VARIABLES)[keyof typeof STORAGE_VARIABLES];

// Typically variables default to 'GLOBAL' scope.
export const STORAGE_LOCATIONS = {
  GLOBAL: 'GLOBAL',
  WORKSPACE: 'WORKSPACE',
  NONE: 'NONE',
} as const;

export type StorageLocation =
  (typeof STORAGE_LOCATIONS)[keyof typeof STORAGE_LOCATIONS];

// Coupled with the `defaultConnectionSavingLocation` configuration in `package.json`.
export const DEFAULT_SAVING_LOCATIONS = {
  Workspace: 'Workspace',
  Global: 'Global',
  'Session Only': 'Session Only',
} as const;

export type DefaultSavingLocations =
  (typeof DEFAULT_SAVING_LOCATIONS)[keyof typeof DEFAULT_SAVING_LOCATIONS];

export type ConnectionsFromStorage = {
  [connectionId: string]: StoreConnectionInfo;
};

// Keytar is deprecated and no longer used. All new
// connections use 'SecretStorage'.
export const SECRET_STORAGE_LOCATIONS = {
  Keytar: 'vscode.Keytar',
  KeytarSecondAttempt: 'vscode.KeytarSecondAttempt',

  SecretStorage: 'vscode.SecretStorage',
} as const;

export type SecretStorageLocationType =
  (typeof SECRET_STORAGE_LOCATIONS)[keyof typeof SECRET_STORAGE_LOCATIONS];

interface StorageVariableContents {
  [STORAGE_VARIABLES.GLOBAL_USER_ID]: string;
  [STORAGE_VARIABLES.GLOBAL_ANONYMOUS_ID]: string;
  [STORAGE_VARIABLES.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW]: boolean;
  [STORAGE_VARIABLES.GLOBAL_SAVED_CONNECTIONS]: ConnectionsFromStorage;
  [STORAGE_VARIABLES.WORKSPACE_SAVED_CONNECTIONS]: ConnectionsFromStorage;
  [STORAGE_VARIABLES.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE]: boolean;
}
type StoredVariableName = keyof StorageVariableContents;
type StoredItem<T extends StoredVariableName> = StorageVariableContents[T];

export default class StorageController {
  _storage: {
    [STORAGE_LOCATIONS.GLOBAL]: vscode.Memento;
    [STORAGE_LOCATIONS.WORKSPACE]: vscode.Memento;
  };

  _secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this._storage = {
      [STORAGE_LOCATIONS.GLOBAL]: context.globalState,
      [STORAGE_LOCATIONS.WORKSPACE]: context.workspaceState,
    };
    this._secretStorage = context.secrets;
  }

  get<T extends StoredVariableName>(
    variableName: T,
    storageLocation: StorageLocation = STORAGE_LOCATIONS.GLOBAL,
  ): StoredItem<T> {
    return this._storage[storageLocation].get(variableName);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  update<T extends StoredVariableName>(
    variableName: T,
    value: StoredItem<T>,
    storageLocation: StorageLocation = STORAGE_LOCATIONS.GLOBAL,
  ): Thenable<void> {
    this._storage[storageLocation].update(variableName, value);
    return Promise.resolve();
  }

  getUserIdentity(): { anonymousId: string } {
    let anonymousId = this.get(STORAGE_VARIABLES.GLOBAL_ANONYMOUS_ID);

    // The anonymousId becomes required with analytics-node v6.
    if (!anonymousId) {
      anonymousId = uuidv4();
      void this.update(STORAGE_VARIABLES.GLOBAL_ANONYMOUS_ID, anonymousId);
    }

    return { anonymousId };
  }

  async getSecret(key: string): Promise<string | null> {
    return (await this._secretStorage.get(key)) ?? null;
  }

  async deleteSecret(key: string): Promise<boolean> {
    await this._secretStorage.delete(key);
    return true;
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this._secretStorage.store(key, value);
  }
}
