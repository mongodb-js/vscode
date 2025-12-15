import * as vscode from 'vscode';
import {
  extractSecrets,
  getConnectionTitle,
  mergeSecrets,
} from '@mongodb-js/connection-info';
import type { ConnectionOptions } from 'mongodb-data-service';

import { createLogger } from '../logging';
import type StorageController from './storageController';
import { StorageLocation } from './storageController';
import {
  DefaultSavingLocation,
  SecretStorageLocation,
  StorageVariable,
} from './storageController';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('connection storage');

export type ConnectionSource = 'globalSettings' | 'workspaceSettings' | 'user';
export interface StoreConnectionInfo {
  id: string; // Connection model id or a new uuid.
  name: string; // Possibly user given name, not unique.
  storageLocation: StorageLocation;
  secretStorageLocation?: SecretStorageLocation;
  connectionOptions?: ConnectionOptions;
  source?: ConnectionSource;
  lastUsed?: Date; // Date and time when the connection was last used, i.e. connected with.
}

export type PresetSavedConnection = {
  name: string;
  connectionString: string;
};

export type PresetSavedConnectionWithSource = PresetSavedConnection & {
  source: ConnectionSource;
};

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
    name,
  }: {
    connectionOptions: ConnectionOptions;
    connectionId: string;
    name?: string;
  }): LoadedConnection {
    name ??= getConnectionTitle({
      connectionOptions,
    });

    return {
      id: connectionId,
      name,
      source: 'user',
      storageLocation: this.getPreferredStorageLocationFromConfiguration(),
      secretStorageLocation: 'vscode.SecretStorage',
      connectionOptions: connectionOptions,
    };
  }

  async _getConnectionInfoWithSecrets(
    connectionInfo: StoreConnectionInfo,
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
        unparsedSecrets,
      );
    } catch (error) {
      log.error('Error while retrieving connection info', error);
      return undefined;
    }
  }

  _mergedConnectionInfoWithSecrets(
    connectionInfo: LoadedConnection,
    unparsedSecrets: string,
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
      secrets,
    );

    return {
      ...connectionInfo,
      connectionOptions: connectionInfoWithSecrets.connectionOptions,
    };
  }

  async saveConnection(connection: LoadedConnection): Promise<void> {
    if (
      !(
        [StorageLocation.GLOBAL, StorageLocation.WORKSPACE] as StorageLocation[]
      ).includes(connection.storageLocation)
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
      JSON.stringify(secrets),
    );
  }

  async _saveConnectionToStore(
    connectionWithoutSecrets: StoreConnectionInfo,
  ): Promise<void> {
    const variableName =
      connectionWithoutSecrets.storageLocation === StorageLocation.GLOBAL
        ? StorageVariable.GLOBAL_SAVED_CONNECTIONS
        : StorageVariable.WORKSPACE_SAVED_CONNECTIONS;

    // Get the current saved connections.
    let savedConnections = this._storageController.get(
      variableName,
      connectionWithoutSecrets.storageLocation,
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
      connectionWithoutSecrets.storageLocation,
    );
  }

  _loadPresetConnections(): LoadedConnection[] {
    const configuration = vscode.workspace.getConfiguration('mdb');
    const presetConnectionsInfo =
      configuration.inspect<PresetSavedConnection[]>('presetConnections');

    if (!presetConnectionsInfo) {
      return [];
    }

    const combinedPresetConnections: PresetSavedConnectionWithSource[] = [
      ...(presetConnectionsInfo?.globalValue ?? []).map((preset) => ({
        ...preset,
        source: 'globalSettings' as const,
      })),
      ...(presetConnectionsInfo?.workspaceValue ?? []).map((preset) => ({
        ...preset,
        source: 'workspaceSettings' as const,
      })),
    ];

    return combinedPresetConnections.map(
      (presetConnection) =>
        ({
          id: uuidv4(),
          name: presetConnection.name,
          connectionOptions: {
            connectionString: presetConnection.connectionString,
          },
          source: presetConnection.source,
          storageLocation: StorageLocation.NONE,
          secretStorageLocation: SecretStorageLocation.SecretStorage,
        }) satisfies LoadedConnection,
    );
  }

  async loadConnections(): Promise<LoadedConnection[]> {
    const globalAndWorkspaceConnections = Object.values({
      ...this._storageController.get(
        StorageVariable.GLOBAL_SAVED_CONNECTIONS,
        StorageLocation.GLOBAL,
      ),
      ...this._storageController.get(
        StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
        StorageLocation.WORKSPACE,
      ),
    });

    const loadedConnections = (
      await Promise.all(
        globalAndWorkspaceConnections.map(async (connectionInfo) => {
          return await this._getConnectionInfoWithSecrets(connectionInfo);
        }),
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
      }),
    );

    const presetConnections = this._loadPresetConnections();

    return [...loadedConnections, ...presetConnections];
  }

  async removeConnection(connectionId: string): Promise<void> {
    await this._storageController.deleteSecret(connectionId);

    // See if the connection exists in the saved global or workspace connections
    // and remove it if it is.
    const globalStoredConnections = this._storageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );
    if (globalStoredConnections && globalStoredConnections[connectionId]) {
      delete globalStoredConnections[connectionId];
      void this._storageController.update(
        StorageVariable.GLOBAL_SAVED_CONNECTIONS,
        globalStoredConnections,
        StorageLocation.GLOBAL,
      );
    }

    const workspaceStoredConnections = this._storageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );
    if (
      workspaceStoredConnections &&
      workspaceStoredConnections[connectionId]
    ) {
      delete workspaceStoredConnections[connectionId];
      void this._storageController.update(
        StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
        workspaceStoredConnections,
        StorageLocation.WORKSPACE,
      );
    }
  }

  hasSavedConnections(): boolean {
    const savedWorkspaceConnections = this._storageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );
    const savedGlobalConnections = this._storageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
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

    if (defaultConnectionSavingLocation === DefaultSavingLocation.WORKSPACE) {
      return StorageLocation.WORKSPACE;
    }

    if (defaultConnectionSavingLocation === DefaultSavingLocation.GLOBAL) {
      return StorageLocation.GLOBAL;
    }

    return StorageLocation.NONE;
  }

  getUserAnonymousId(): string {
    return this._storageController.getUserIdentity().anonymousId;
  }
}
