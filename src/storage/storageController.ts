import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

import { ConnectionInfo, getConnectionTitle } from 'mongodb-data-service';
import { SavedConnectionInfo } from '../connectionController';

export enum StorageVariables {
  // Only exists on globalState.
  GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW = 'GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW',
  GLOBAL_SAVED_CONNECTIONS = 'GLOBAL_SAVED_CONNECTIONS',
  GLOBAL_USER_ID = 'GLOBAL_USER_ID',
  // Only exists on workspaceState.
  WORKSPACE_SAVED_CONNECTIONS = 'WORKSPACE_SAVED_CONNECTIONS'
}

// Typically variables default to 'GLOBAL' scope.
export enum StorageScope {
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
  [key: string]: SavedConnectionInfo
};

type StoredVariableName = StorageVariables.GLOBAL_USER_ID |
  StorageVariables.GLOBAL_SAVED_CONNECTIONS |
  StorageVariables.WORKSPACE_SAVED_CONNECTIONS |
  StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW;

type StoredItem<T> =
    T extends StorageVariables.GLOBAL_USER_ID ? string :
    T extends StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW ? boolean :
    T extends StorageVariables.GLOBAL_SAVED_CONNECTIONS ? ConnectionsFromStorage :
    T extends StorageVariables.WORKSPACE_SAVED_CONNECTIONS ? ConnectionsFromStorage :
    never;

export default class StorageController {
  _storage: { [StorageScope.GLOBAL]: vscode.Memento, [StorageScope.WORKSPACE]: vscode.Memento };

  constructor(context: vscode.ExtensionContext) {
    this._storage = {
      [StorageScope.GLOBAL]: context.globalState,
      [StorageScope.WORKSPACE]: context.workspaceState
    };
  }

  get<T extends StoredVariableName>(variableName: T, storageScope: StorageScope = StorageScope.GLOBAL): StoredItem<T> {
    return this._storage[storageScope].get(variableName);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  update(
    variableName: StorageVariables,
    value: boolean | string | ConnectionsFromStorage,
    storageScope: StorageScope = StorageScope.GLOBAL
  ): Thenable<void> {
    this._storage[storageScope].update(variableName, value);
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

  async saveConnectionToGlobalStore(
    savedConnectionInfo: SavedConnectionInfo
  ): Promise<void> {
    // Get the current save connections.
    const globalConnections = this.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS) || {};

    // Add the new connection.
    globalConnections[savedConnectionInfo.id] = savedConnectionInfo;

    // Update the store.
    return this.update(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      globalConnections
    );
  }

  async saveConnectionToWorkspaceStore(
    savedConnectionInfo: SavedConnectionInfo
  ): Promise<void> {
    // Get the current save connections.
    const workspaceConnections = this.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageScope.WORKSPACE
    ) || {};

    // Add the new connection.
    workspaceConnections[savedConnectionInfo.id] = savedConnectionInfo;

    // Update the store.
    return this.update(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      workspaceConnections,
      StorageScope.WORKSPACE
    );
  }

  getPreferedStorageLocationFromConfiguration(): StorageScope {
    const defaultConnectionSavingLocation = vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .get('defaultConnectionSavingLocation');

    if (defaultConnectionSavingLocation === DefaultSavingLocations.Workspace) {
      return StorageScope.WORKSPACE;
    }

    if (defaultConnectionSavingLocation === DefaultSavingLocations.Global) {
      return StorageScope.GLOBAL;
    }

    return StorageScope.NONE;
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
      return StorageScope.WORKSPACE;
    }

    if (chosenConnectionSavingLocation === DefaultSavingLocations.Global) {
      return StorageScope.GLOBAL;
    }

    return StorageScope.NONE;
  }

  async storeNewConnection(safeConnectionInfo: ConnectionInfo): Promise<SavedConnectionInfo> {
    const name = getConnectionTitle(safeConnectionInfo);
    const savedConnectionInfo = {
      id: safeConnectionInfo.id || uuidv4(),
      name,
      // To begin we just store it on the session, the storage controller
      // handles changing this based on user preference.
      storageLocation: StorageScope.NONE,
      connectionOptions: safeConnectionInfo.connectionOptions
    };

    const dontShowSaveLocationPrompt = vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .get('hideOptionToChooseWhereToSaveNewConnections');

    if (dontShowSaveLocationPrompt === true) {
      // The user has chosen not to show the message on where to save the connection.
      // Save the connection in their default preference.
      savedConnectionInfo.storageLocation = this.getPreferedStorageLocationFromConfiguration();
    } else {
      savedConnectionInfo.storageLocation = await this.getStorageLocationFromPrompt();
    }

    if (savedConnectionInfo.storageLocation === StorageScope.WORKSPACE) {
      await this.saveConnectionToWorkspaceStore(savedConnectionInfo);
    } else if (savedConnectionInfo.storageLocation === StorageScope.GLOBAL) {
      await this.saveConnectionToGlobalStore(savedConnectionInfo);
    }

    return savedConnectionInfo;
  }

  removeConnection(connectionId: string): void {
    // See if the connection exists in the saved global or workspace connections
    // and remove it if it is.
    const globalStoredConnections = this.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    if (globalStoredConnections && globalStoredConnections[connectionId]) {
      delete globalStoredConnections[connectionId];
      void this.update(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS,
        globalStoredConnections
      );
    }

    const workspaceStoredConnections = this.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageScope.WORKSPACE
    );
    if (
      workspaceStoredConnections &&
      workspaceStoredConnections[connectionId]
    ) {
      delete workspaceStoredConnections[connectionId];
      void this.update(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        workspaceStoredConnections,
        StorageScope.WORKSPACE
      );
    }
  }

  hasSavedConnections(): boolean {
    const savedWorkspaceConnections = this.get(StorageVariables.WORKSPACE_SAVED_CONNECTIONS, StorageScope.WORKSPACE);
    const savedGlobalConnections = this.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS, StorageScope.GLOBAL);

    return (
      (savedWorkspaceConnections && Object.keys(savedWorkspaceConnections).length > 0) ||
      (savedGlobalConnections && Object.keys(savedGlobalConnections).length > 0)
    );
  }
}
