import * as vscode from 'vscode';
import {
  extractSecrets,
  getConnectionTitle,
  mergeSecrets,
} from '@mongodb-js/connection-info';
import type { ConnectionOptions } from 'mongodb-data-service';

import { createLogger } from '../logging';
import type StorageController from './storageController';
import type { SecretStorageLocationType } from './storageController';
import {
  DefaultSavingLocations,
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
  lastUsed?: Date; // Date and time when the connection was last used, i.e. connected with.
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

  createNewConnection({
    connectionOptions,
    connectionId,
  }: {
    connectionOptions: ConnectionOptions;
    connectionId: string;
  }): LoadedConnection {
    const name = getConnectionTitle({
      connectionOptions,
    });

    return {
      id: connectionId,
      name,
      storageLocation: this.getPreferredStorageLocationFromConfiguration(),
      secretStorageLocation: 'vscode.SecretStorage',
      connectionOptions: connectionOptions,
    };
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

  async saveConnection(connection: LoadedConnection): Promise<void> {
    if (
      ![StorageLocation.GLOBAL, StorageLocation.WORKSPACE].includes(
        connection.storageLocation
      )
    ) {
      return;
    }
    // We don't want to store secrets to disc.
    const { connectionInfo: safeConnectionInfo, secrets } =
      extractSecrets(connection);
    await this._saveConnectionToStore({
      ...connection,
      connectionOptions: safeConnectionInfo.connectionOptions, // The connection info without secrets.
    });

    await this._storageController.setSecret(
      connection.id,
      JSON.stringify(secrets)
    );
  }

  async _saveConnectionToStore(
    connectionWithoutSecrets: StoreConnectionInfo
  ): Promise<void> {
    const variableName =
      connectionWithoutSecrets.storageLocation === StorageLocation.GLOBAL
        ? StorageVariables.GLOBAL_SAVED_CONNECTIONS
        : StorageVariables.WORKSPACE_SAVED_CONNECTIONS;

    // Get the current saved connections.
    let savedConnections = this._storageController.get(
      variableName,
      connectionWithoutSecrets.storageLocation
    );

    if (!savedConnections) {
      savedConnections = {};
    }

    // Add the new connection.
    savedConnections[connectionWithoutSecrets.id] = connectionWithoutSecrets;

    // Update the store.
    return this._storageController.update(
      variableName,
      savedConnections,
      connectionWithoutSecrets.storageLocation
    );
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
        await this.saveConnection(connectionInfo);
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
