import type * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

import type { StoreConnectionInfo } from './connectionStorage';

export const StorageVariable = {
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

export type StorageVariable =
  (typeof StorageVariable)[keyof typeof StorageVariable];

// Typically variables default to 'GLOBAL' scope.
export const StorageLocation = {
  GLOBAL: 'GLOBAL',
  WORKSPACE: 'WORKSPACE',
  NONE: 'NONE',
} as const;

export type StorageLocation =
  (typeof StorageLocation)[keyof typeof StorageLocation];

// Coupled with the `defaultConnectionSavingLocation` configuration in `package.json`.
export const DefaultSavingLocation = {
  Workspace: 'Workspace',
  Global: 'Global',
  'Session Only': 'Session Only',
} as const;

export type DefaultSavingLocation =
  (typeof DefaultSavingLocation)[keyof typeof DefaultSavingLocation];

export type ConnectionsFromStorage = {
  [connectionId: string]: StoreConnectionInfo;
};

// Keytar is deprecated and no longer used. All new
// connections use 'SecretStorage'.
export const SecretStorageLocation = {
  Keytar: 'vscode.Keytar',
  KeytarSecondAttempt: 'vscode.KeytarSecondAttempt',

  SecretStorage: 'vscode.SecretStorage',
} as const;

export type SecretStorageLocation =
  (typeof SecretStorageLocation)[keyof typeof SecretStorageLocation];

interface StorageVariableContents {
  [StorageVariable.GLOBAL_USER_ID]: string;
  [StorageVariable.GLOBAL_ANONYMOUS_ID]: string;
  [StorageVariable.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW]: boolean;
  [StorageVariable.GLOBAL_SAVED_CONNECTIONS]: ConnectionsFromStorage;
  [StorageVariable.WORKSPACE_SAVED_CONNECTIONS]: ConnectionsFromStorage;
  [StorageVariable.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE]: boolean;
}
type StoredVariableName = keyof StorageVariableContents;
type StoredItem<T extends StoredVariableName> = StorageVariableContents[T];

export default class StorageController {
  _storage: {
    [StorageLocation.GLOBAL]: vscode.Memento;
    [StorageLocation.WORKSPACE]: vscode.Memento;
  };

  _secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this._storage = {
      [StorageLocation.GLOBAL]: context.globalState,
      [StorageLocation.WORKSPACE]: context.workspaceState,
    };
    this._secretStorage = context.secrets;
  }

  get<T extends StoredVariableName>(
    variableName: T,
    storageLocation: StorageLocation = StorageLocation.GLOBAL,
  ): StoredItem<T> {
    return this._storage[storageLocation].get(variableName);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  update<T extends StoredVariableName>(
    variableName: T,
    value: StoredItem<T>,
    storageLocation: StorageLocation = StorageLocation.GLOBAL,
  ): Thenable<void> {
    this._storage[storageLocation].update(variableName, value);
    return Promise.resolve();
  }

  getUserIdentity(): { anonymousId: string } {
    let anonymousId = this.get(StorageVariable.GLOBAL_ANONYMOUS_ID);

    // The anonymousId becomes required with analytics-node v6.
    if (!anonymousId) {
      anonymousId = uuidv4();
      void this.update(StorageVariable.GLOBAL_ANONYMOUS_ID, anonymousId);
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
