import type { Keychain } from '@mongodb-js/mcp-core';
import {
  ConnectionEntry,
  ErrorCodes,
  MongoDBError,
  type ConnectionManager,
  type ConnectionRegistry,
  type CreateConnectionEntryOptions,
  type CreateConnectionOptions,
} from '@mongodb-js/mcp-tools-mongodb';
import type { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';

/** Handle for the extension's active connection; the tool shim injects it so it never reaches the agent. */
export const VSCODE_CONNECTION_ID = 'vscode-active';

const VSCODE_CONNECTION_NAME = 'vscode-connection';

/**
 * Exposes the connection the user selected in the sidebar as the single registry
 * entry, so v3's connectionId-addressed tools resolve against the live VSCode connection.
 */
export class VSCodeConnectionRegistry implements ConnectionRegistry {
  private readonly manager: ConnectionManager;
  private readonly keychain: Keychain;

  constructor({
    manager,
    keychain,
  }: {
    manager: ConnectionManager;
    keychain: Keychain;
  }) {
    this.manager = manager;
    this.keychain = keychain;
  }

  private entry(): ConnectionEntry {
    return new ConnectionEntry({
      connectionId: VSCODE_CONNECTION_ID,
      name: VSCODE_CONNECTION_NAME,
      source: 'preconfigured',
      manager: this.manager,
      keychain: this.keychain,
    });
  }

  createEntry(_opts: CreateConnectionEntryOptions): Promise<ConnectionEntry> {
    return Promise.reject(
      new Error(
        'The VSCode extension manages connections; new connections cannot be created through the MCP server.',
      ),
    );
  }

  connect(_opts: CreateConnectionOptions): Promise<ConnectionEntry> {
    return Promise.reject(
      new Error(
        'The VSCode extension manages connections; new connections cannot be created through the MCP server.',
      ),
    );
  }

  get(connectionId: string): Promise<ConnectionEntry | undefined> {
    return Promise.resolve(
      connectionId === VSCODE_CONNECTION_ID ? this.entry() : undefined,
    );
  }

  peek(connectionId: string): Promise<ConnectionEntry | undefined> {
    return this.get(connectionId);
  }

  find(
    _predicate?: (entry: ConnectionEntry) => boolean,
  ): Promise<ConnectionEntry[]> {
    return Promise.resolve([this.entry()]);
  }

  resolve(connectionId: string): Promise<NodeDriverServiceProvider> {
    if (connectionId !== VSCODE_CONNECTION_ID) {
      return Promise.reject(
        new MongoDBError(
          ErrorCodes.UnknownConnectionId,
          `Unknown connectionId "${connectionId}".`,
        ),
      );
    }

    try {
      return Promise.resolve(this.entry().getServiceProvider());
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    if (connectionId !== VSCODE_CONNECTION_ID) {
      throw new MongoDBError(
        ErrorCodes.UnknownConnectionId,
        `Unknown connectionId "${connectionId}".`,
      );
    }

    await this.manager.disconnect();
  }

  /** The shared manager outlives every request-scoped server, so closing a view is a no-op. */
  close(): Promise<void> {
    return Promise.resolve();
  }
}
