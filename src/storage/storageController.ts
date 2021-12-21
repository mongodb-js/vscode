import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

import { StoreConnectionInfo } from '../connectionController';

export enum StorageVariables {
  // Only exists on globalState.
  GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW = 'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW',
  GLOBAL_SAVED_CONNECTIONS = 'GLOBAL_SAVED_CONNECTIONS',
  GLOBAL_USER_ID = 'GLOBAL_USER_ID',
  // Only exists on workspaceState.
  WORKSPACE_SAVED_CONNECTIONS = 'WORKSPACE_SAVED_CONNECTIONS'
}

// Typically variables default to 'GLOBAL' scope.
export enum StorageLocation {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE',
  NONE = 'NONE'
}

// Coupled with the `defaultConnectionSavingLocation` configuration in `package.json`.
export enum DefaultSavingLocations {
  'Workspace' = 'Workspace',
  'Global' = 'Global',
  'Session Only' = 'Session Only'
}

export type ConnectionsFromStorage = {
  [connectionId: string]: StoreConnectionInfo
};

interface StorageVariableContents {
  [StorageVariables.GLOBAL_USER_ID]: string;
  [StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW]: boolean;
  [StorageVariables.GLOBAL_SAVED_CONNECTIONS]: ConnectionsFromStorage;
  [StorageVariables.WORKSPACE_SAVED_CONNECTIONS]: ConnectionsFromStorage;
}
type StoredVariableName = keyof StorageVariableContents;
type StoredItem<T extends StoredVariableName> = StorageVariableContents[T];

export default class StorageController {
  _storage: { [StorageLocation.GLOBAL]: vscode.Memento, [StorageLocation.WORKSPACE]: vscode.Memento };

  constructor(context: vscode.ExtensionContext) {
    this._storage = {
      [StorageLocation.GLOBAL]: context.globalState,
      [StorageLocation.WORKSPACE]: context.workspaceState
    };
  }

  get<T extends StoredVariableName>(variableName: T, storageLocation: StorageLocation = StorageLocation.GLOBAL): StoredItem<T> {
    return this._storage[storageLocation].get(variableName);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  update<T extends StoredVariableName>(
    variableName: T,
    value: StoredItem<T>,
    storageLocation: StorageLocation = StorageLocation.GLOBAL
  ): Thenable<void> {
    this._storage[storageLocation].update(variableName, value);
    return Promise.resolve();
  }

  getUserID(): string {
    let globalUserId = this.get(StorageVariables.GLOBAL_USER_ID);

    if (globalUserId && typeof globalUserId === 'string') {
      return globalUserId;
    }

    globalUserId = uuidv4();
    void this.update(StorageVariables.GLOBAL_USER_ID, globalUserId);

    return globalUserId;
  }

  async saveConnectionToStore(storeConnectionInfo: StoreConnectionInfo): Promise<void> {
    const variableName = (storeConnectionInfo.storageLocation === StorageLocation.GLOBAL)
      ? StorageVariables.GLOBAL_SAVED_CONNECTIONS
      : StorageVariables.WORKSPACE_SAVED_CONNECTIONS;

    // Get the current saved connections.
    let savedConnections = this.get(variableName, storeConnectionInfo.storageLocation);

    if (!savedConnections) {
      savedConnections = {};
    }

    // Add the new connection.
    savedConnections[storeConnectionInfo.id] = storeConnectionInfo;

    // Update the store.
    return this.update(
      variableName,
      savedConnections,
      storeConnectionInfo.storageLocation
    );
  }

  async saveConnection(storeConnectionInfo: StoreConnectionInfo): Promise<StoreConnectionInfo> {
    const dontShowSaveLocationPrompt = vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .get('hideOptionToChooseWhereToSaveNewConnections');

    if (dontShowSaveLocationPrompt === true) {
      // The user has chosen not to show the message on where to save the connection.
      // Save the connection in their default preference.
      storeConnectionInfo.storageLocation = this.getPreferedStorageLocationFromConfiguration();
    } else {
      storeConnectionInfo.storageLocation = await this.getStorageLocationFromPrompt();
    }

    if ([StorageLocation.GLOBAL, StorageLocation.WORKSPACE].includes(storeConnectionInfo.storageLocation)) {
      await this.saveConnectionToStore(storeConnectionInfo);
    }

    return storeConnectionInfo;
  }

  async getStorageLocationFromPrompt() {
    const storeOnWorkspace = 'Save the connection on this workspace';
    const storeGlobally = 'Save the connection globally on vscode';
    // Prompt the user where they want to save the new connection.
    const chosenConnectionSavingLocation = await vscode.window.showQuickPick(
      [
        storeOnWorkspace,
        storeGlobally,
        "Don't save this connection (it will be lost when the session is closed)"
      ],
      {
        placeHolder:
          'Where would you like to save this new connection? (This message can be disabled in the extension settings.)'
      }
    );

    if (chosenConnectionSavingLocation === DefaultSavingLocations.Workspace) {
      return StorageLocation.WORKSPACE;
    }

    if (chosenConnectionSavingLocation === DefaultSavingLocations.Global) {
      return StorageLocation.GLOBAL;
    }

    return StorageLocation.NONE;
  }

  removeConnection(connectionId: string): void {
    // See if the connection exists in the saved global or workspace connections
    // and remove it if it is.
    const globalStoredConnections = this.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );
    if (globalStoredConnections && globalStoredConnections[connectionId]) {
      delete globalStoredConnections[connectionId];
      void this.update(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS,
        globalStoredConnections,
        StorageLocation.GLOBAL
      );
    }

    const workspaceStoredConnections = this.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    if (
      workspaceStoredConnections &&
      workspaceStoredConnections[connectionId]
    ) {
      delete workspaceStoredConnections[connectionId];
      void this.update(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        workspaceStoredConnections,
        StorageLocation.WORKSPACE
      );
    }
  }

  hasSavedConnections(): boolean {
    const savedWorkspaceConnections = this.get(StorageVariables.WORKSPACE_SAVED_CONNECTIONS, StorageLocation.WORKSPACE);
    const savedGlobalConnections = this.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS, StorageLocation.GLOBAL);

    return (
      (savedWorkspaceConnections && Object.keys(savedWorkspaceConnections).length > 0) ||
      (savedGlobalConnections && Object.keys(savedGlobalConnections).length > 0)
    );
  }

  getPreferedStorageLocationFromConfiguration(): StorageLocation {
    const defaultConnectionSavingLocation = vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .get('defaultConnectionSavingLocation');

    if (defaultConnectionSavingLocation === DefaultSavingLocations.Workspace) {
      return StorageLocation.WORKSPACE;
    }

    if (defaultConnectionSavingLocation === DefaultSavingLocations.Global) {
      return StorageLocation.GLOBAL;
    }

    return StorageLocation.NONE;
  }
}
