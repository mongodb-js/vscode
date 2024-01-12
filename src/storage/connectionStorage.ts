import * as vscode from 'vscode';
import {
  getConnectionTitle,
  extractSecrets,
  mergeSecrets,
} from '@mongodb-js/connection-info';
import type { ConnectionOptions } from 'mongodb-data-service';

import { createLogger } from '../logging';
import type StorageController from './storageController';
import type { SecretStorageLocationType } from './storageController';
import {
  DefaultSavingLocations,
  SecretStorageLocation,
  StorageLocation,
  StorageVariables,
} from './storageController';

const log = createLogger('connection storage');

export interface StoreConnectionInfo {
  id: string; // Connection model id or a new uuid.
  name: string; // Possibly user given name, not unique.
  storageLocation: StorageLocation;
  secretStorageLocation?: SecretStorageLocationType;
  connectionOptions?: ConnectionOptions;
}

type StoreConnectionInfoWithConnectionOptions = StoreConnectionInfo &
  Required<Pick<StoreConnectionInfo, 'connectionOptions'>>;

type StoreConnectionInfoWithSecretStorageLocation = StoreConnectionInfo &
  Required<Pick<StoreConnectionInfo, 'secretStorageLocation'>>;

export type LoadedConnection = StoreConnectionInfoWithConnectionOptions &
  StoreConnectionInfoWithSecretStorageLocation;

export class ConnectionStorage {
  _storageController: StorageController;

  constructor({ storageController }: { storageController: StorageController }) {
    this._storageController = storageController;
  }

  // Returns the saved connection (without secrets).
  async saveNewConnection(connection: {
    connectionOptions: ConnectionOptions;
    id: string;
  }): Promise<LoadedConnection> {
    const name = getConnectionTitle(connection);
    const newConnectionInfo = {
      id: connection.id,
      name,
      // To begin we just store it on the session, the storage controller
      // handles changing this based on user preference.
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: connection.connectionOptions,
    };

    return await this.saveConnectionWithSecrets(newConnectionInfo);
  }

  async _getConnectionInfoWithSecrets(
    connectionInfo: StoreConnectionInfo
  ): Promise<LoadedConnection | undefined> {
    try {
      // We tried migrating this connection earlier but failed because Keytar was not
      // available. So we return simply the connection without secrets.
      if (
        (connectionInfo as any).connectionModel ||
        !connectionInfo.secretStorageLocation ||
        connectionInfo.secretStorageLocation === 'vscode.Keytar' ||
        connectionInfo.secretStorageLocation === 'vscode.KeytarSecondAttempt'
      ) {
        // We had migrations in VSCode for ~5 months. We drop the connections
        // that did not migrate.
        return undefined;
      }

      const unparsedSecrets =
        (await this._storageController.getSecret(connectionInfo.id)) ?? '';

      return this._mergedConnectionInfoWithSecrets(
        connectionInfo as LoadedConnection,
        unparsedSecrets
      );
    } catch (error) {
      log.error('Error while retrieving connection info', error);
      return undefined;
    }
  }

  async saveConnection<T extends StoreConnectionInfo>(
    storeConnectionInfo: T
  ): Promise<T> {
    const dontShowSaveLocationPrompt = vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .get('hideOptionToChooseWhereToSaveNewConnections');

    if (dontShowSaveLocationPrompt === true) {
      // The user has chosen not to show the message on where to save the connection.
      // Save the connection in their default preference.
      storeConnectionInfo.storageLocation =
        this.getPreferredStorageLocationFromConfiguration();
    } else {
      storeConnectionInfo.storageLocation =
        await this.getStorageLocationFromPrompt();
    }

    if (
      [StorageLocation.GLOBAL, StorageLocation.WORKSPACE].includes(
        storeConnectionInfo.storageLocation
      )
    ) {
      await this._saveConnectionToStore(storeConnectionInfo);
    }

    return storeConnectionInfo;
  }

  _mergedConnectionInfoWithSecrets(
    connectionInfo: LoadedConnection,
    unparsedSecrets: string
  ): LoadedConnection {
    if (!unparsedSecrets) {
      return connectionInfo;
    }

    const secrets = JSON.parse(unparsedSecrets);
    const connectionInfoWithSecrets = mergeSecrets(
      {
        id: connectionInfo.id,
        connectionOptions: connectionInfo.connectionOptions,
      },
      secrets
    );

    return {
      ...connectionInfo,
      connectionOptions: connectionInfoWithSecrets.connectionOptions,
    };
  }

  private async saveConnectionWithSecrets(
    newStoreConnectionInfoWithSecrets: LoadedConnection
  ): Promise<LoadedConnection> {
    // We don't want to store secrets to disc.
    const { connectionInfo: safeConnectionInfo, secrets } = extractSecrets(
      newStoreConnectionInfoWithSecrets
    );
    const savedConnectionInfo = await this.saveConnection({
      ...newStoreConnectionInfoWithSecrets,
      connectionOptions: safeConnectionInfo.connectionOptions, // The connection info without secrets.
    });
    await this._storageController.setSecret(
      savedConnectionInfo.id,
      JSON.stringify(secrets)
    );

    return savedConnectionInfo;
  }

  async _saveConnectionToStore(
    storeConnectionInfo: StoreConnectionInfo
  ): Promise<void> {
    const variableName =
      storeConnectionInfo.storageLocation === StorageLocation.GLOBAL
        ? StorageVariables.GLOBAL_SAVED_CONNECTIONS
        : StorageVariables.WORKSPACE_SAVED_CONNECTIONS;

    // Get the current saved connections.
    let savedConnections = this._storageController.get(
      variableName,
      storeConnectionInfo.storageLocation
    );

    if (!savedConnections) {
      savedConnections = {};
    }

    // Add the new connection.
    savedConnections[storeConnectionInfo.id] = storeConnectionInfo;

    // Update the store.
    return this._storageController.update(
      variableName,
      savedConnections,
      storeConnectionInfo.storageLocation
    );
  }

  async getStorageLocationFromPrompt() {
    const storeOnWorkspace = 'Save the connection on this workspace';
    const storeGlobally = 'Save the connection globally on vscode';
    // Prompt the user where they want to save the new connection.
    const chosenConnectionSavingLocation = await vscode.window.showQuickPick(
      [
        storeOnWorkspace,
        storeGlobally,
        "Don't save this connection (it will be lost when the session is closed)",
      ],
      {
        placeHolder:
          'Where would you like to save this new connection? (This message can be disabled in the extension settings.)',
      }
    );

    if (chosenConnectionSavingLocation === storeOnWorkspace) {
      return StorageLocation.WORKSPACE;
    }

    if (chosenConnectionSavingLocation === storeGlobally) {
      return StorageLocation.GLOBAL;
    }

    return StorageLocation.NONE;
  }

  async loadConnections() {
    const globalAndWorkspaceConnections = Object.values({
      ...this._storageController.get(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS,
        StorageLocation.GLOBAL
      ),
      ...this._storageController.get(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        StorageLocation.WORKSPACE
      ),
    });

    const loadedConnections = (
      await Promise.all(
        globalAndWorkspaceConnections.map(async (connectionInfo) => {
          return await this._getConnectionInfoWithSecrets(connectionInfo);
        })
      )
    ).filter((connection): connection is LoadedConnection => !!connection);

    const toBeReSaved: LoadedConnection[] = [];
    // Scrub OIDC tokens from connections when the option to store them has been disabled.
    if (!vscode.workspace.getConfiguration('mdb').get('persistOIDCTokens')) {
      for (const connection of loadedConnections) {
        if (connection.connectionOptions.oidc?.serializedState) {
          delete connection.connectionOptions.oidc?.serializedState;
          toBeReSaved.push(connection);
        }
      }
    }

    await Promise.all(
      toBeReSaved.map(async (connectionInfo) => {
        await this.saveConnectionWithSecrets(connectionInfo);
      })
    );

    return loadedConnections;
  }

  async removeConnection(connectionId: string) {
    await this._storageController.deleteSecret(connectionId);

    // See if the connection exists in the saved global or workspace connections
    // and remove it if it is.
    const globalStoredConnections = this._storageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );
    if (globalStoredConnections && globalStoredConnections[connectionId]) {
      delete globalStoredConnections[connectionId];
      void this._storageController.update(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS,
        globalStoredConnections,
        StorageLocation.GLOBAL
      );
    }

    const workspaceStoredConnections = this._storageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    if (
      workspaceStoredConnections &&
      workspaceStoredConnections[connectionId]
    ) {
      delete workspaceStoredConnections[connectionId];
      void this._storageController.update(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        workspaceStoredConnections,
        StorageLocation.WORKSPACE
      );
    }
  }

  hasSavedConnections(): boolean {
    const savedWorkspaceConnections = this._storageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    const savedGlobalConnections = this._storageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    return !!(
      (savedWorkspaceConnections &&
        Object.keys(savedWorkspaceConnections).length > 0) ||
      (savedGlobalConnections && Object.keys(savedGlobalConnections).length > 0)
    );
  }

  getPreferredStorageLocationFromConfiguration(): StorageLocation {
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
