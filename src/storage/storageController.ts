import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export enum StorageVariables {
  GLOBAL_SAVED_CONNECTIONS = 'GLOBAL_SAVED_CONNECTIONS', // Only exists on globalState.
  GLOBAL_USER_ID = 'GLOBAL_USER_ID', // Only exists on globalState.
  WORKSPACE_SAVED_CONNECTIONS = 'WORKSPACE_SAVED_CONNECTIONS' // Only exists on workspaceState.
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

export type SavedConnection = {
  id: string; // uuidv4
  name: string; // Possibly user given name, not unique.
  driverUrl: string;
  storageLocation: StorageScope;
};

export default class StorageController {
  _globalState: vscode.Memento;
  _workspaceState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this._globalState = context.globalState;
    this._workspaceState = context.workspaceState;
  }

  public get(variableName: StorageVariables, storageScope?: StorageScope): any {
    if (storageScope === StorageScope.WORKSPACE) {
      return this._workspaceState.get(variableName);
    }

    return this._globalState.get(variableName);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  public update(
    variableName: StorageVariables,
    value: any,
    storageScope?: StorageScope
  ): Thenable<void> {
    if (storageScope === StorageScope.WORKSPACE) {
      this._workspaceState.update(variableName, value);
      return Promise.resolve();
    }

    this._globalState.update(variableName, value);
    return Promise.resolve();
  }

  public getUserID() {
    let globalUserId = this.get(StorageVariables.GLOBAL_USER_ID);

    if (globalUserId) {
      return globalUserId;
    }

    globalUserId = uuidv4();
    this.update(StorageVariables.GLOBAL_USER_ID, globalUserId);

    return globalUserId;
  }

  public saveConnectionToGlobalStore(
    connection: SavedConnection
  ): Thenable<void> {
    // Get the current save connections.
    let globalConnections:
      | { [key: string]: SavedConnection }
      | undefined = this.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS);

    if (!globalConnections) {
      globalConnections = {};
    }

    connection.storageLocation = StorageScope.GLOBAL;

    // Add the new connection.
    globalConnections[connection.id] = connection;

    // Update the store.
    return this.update(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      globalConnections
    );
  }

  public saveConnectionToWorkspaceStore(
    connection: SavedConnection
  ): Thenable<void> {
    // Get the current save connections.
    let workspaceConnections:
      | { [key: string]: SavedConnection }
      | undefined = this.get(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        StorageScope.WORKSPACE
      );
    if (!workspaceConnections) {
      workspaceConnections = {};
    }

    connection.storageLocation = StorageScope.WORKSPACE;

    // Add the new connection.
    workspaceConnections[connection.id] = connection;

    // Update the store.
    return this.update(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      workspaceConnections,
      StorageScope.WORKSPACE
    );
  }

  public storeNewConnection(newConnection: SavedConnection): Thenable<void> {
    const dontShowSaveLocationPrompt = vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .get('hideOptionToChooseWhereToSaveNewConnections');

    if (dontShowSaveLocationPrompt === true) {
      // The user has chosen not to show the message on where to save the connection.
      // Save the connection in their default preference.
      const preferedStorageScope = vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .get('defaultConnectionSavingLocation');

      if (preferedStorageScope === DefaultSavingLocations.Workspace) {
        return this.saveConnectionToWorkspaceStore(newConnection);
      } else if (preferedStorageScope === DefaultSavingLocations.Global) {
        return this.saveConnectionToGlobalStore(newConnection);
      }

      // The user prefers for the connections not to be saved.
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const storeOnWorkspace = 'Save the connection on this workspace';
      const storeGlobally = 'Save the connection globally on vscode';
      // Prompt the user where they want to save the new connection.
      vscode.window
        .showQuickPick(
          [
            storeOnWorkspace,
            storeGlobally,
            "Don't save this connection (it will be lost when the session is closed)"
          ],
          {
            placeHolder:
              'Where would you like to save this new connection? (This message can be disabled in the extension settings.)'
          }
        )
        .then((saveConnectionScope) => {
          if (saveConnectionScope === storeOnWorkspace) {
            return this.saveConnectionToWorkspaceStore(newConnection).then(
              resolve
            );
          } else if (saveConnectionScope === storeGlobally) {
            return this.saveConnectionToGlobalStore(newConnection).then(
              resolve
            );
          }

          // Store it on the session (don't save anywhere).
          return resolve();
        });
    });
  }

  public removeConnection(connectionId: string): void {
    // See if the connection exists in the saved global or workspace connections
    // and remove it if it is.
    const globalStoredConnections:
      | { [key: string]: SavedConnection }
      | undefined = this.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS);
    if (globalStoredConnections && globalStoredConnections[connectionId]) {
      delete globalStoredConnections[connectionId];
      this.update(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS,
        globalStoredConnections
      );
    }

    const workspaceStoredConnections:
      | { [key: string]: SavedConnection }
      | undefined = this.get(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        StorageScope.WORKSPACE
      );
    if (
      workspaceStoredConnections &&
      workspaceStoredConnections[connectionId]
    ) {
      delete workspaceStoredConnections[connectionId];
      this.update(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        workspaceStoredConnections,
        StorageScope.WORKSPACE
      );
    }
  }
}
