import {
  ConnectionManager,
  type AnyConnectionState,
  type ConnectionStateDisconnected,
  type LoggerBase,
} from '@himanshusinghs/mongodb-mcp-server';
import {
  NodeDriverServiceProvider,
  type DevtoolsConnectOptions,
} from '@mongosh/service-provider-node-driver';
import type { ServiceProvider } from '@mongosh/service-provider-core';
import { isAtlasStream } from 'mongodb-build-info';
import { MCPLogIds } from './mcpLogIds';

export interface MCPConnectParams {
  connectionId: string;
  connectionString: string;
  connectOptions: DevtoolsConnectOptions;
}

export class MCPConnectionManager extends ConnectionManager {
  private activeConnectionId: string | null = null;
  private activeConnectionProvider: ServiceProvider | null = null;

  constructor(private readonly logger: LoggerBase) {
    super();
  }

  connect(): Promise<AnyConnectionState> {
    return Promise.reject(
      new Error(
        [
          'MongoDB MCP Server in MongoDB VSCode extension makes use of the connection that the MongoDB VSCode extension is connected to.',
          "To connect, choose a connection from MongoDB VSCode extensions's sidepanel - https://www.mongodb.com/docs/mongodb-vscode/connect/#connect-to-your-mongodb-deployment",
        ].join(' '),
      ),
    );
  }

  async connectToVSCodeConnection(
    connectParams: MCPConnectParams,
  ): Promise<AnyConnectionState> {
    try {
      const serviceProvider = await NodeDriverServiceProvider.connect(
        connectParams.connectionString,
        connectParams.connectOptions,
      );
      await serviceProvider.runCommand('admin', { hello: 1 });
      this.activeConnectionId = connectParams.connectionId;
      this.activeConnectionProvider = serviceProvider;
      return this.changeState('connection-success', {
        tag: 'connected',
        serviceProvider,
      });
    } catch (error) {
      this.logger.error({
        id: MCPLogIds.ConnectError,
        context: 'VSCodeMCPConnectionManager.connect',
        message: error instanceof Error ? error.message : String(error),
      });
      return this.changeState('connection-error', {
        tag: 'errored',
        errorReason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<ConnectionStateDisconnected> {
    try {
      await this.activeConnectionProvider?.close(true);
    } catch (error) {
      this.logger.error({
        id: MCPLogIds.DisconnectError,
        context: 'VSCodeMCPConnectionManager.disconnect',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    this.activeConnectionId = null;
    this.activeConnectionProvider = null;
    return this.changeState('connection-close', {
      tag: 'disconnected',
    });
  }

  async updateConnection({
    connectionId,
    connectionString,
    connectOptions,
  }: {
    connectionId: string | undefined;
    connectionString: string | undefined;
    connectOptions: DevtoolsConnectOptions | undefined;
  }): Promise<void> {
    try {
      if (this.activeConnectionId && this.activeConnectionId !== connectionId) {
        await this.disconnect();
      }

      const connectionWasDisconnected =
        !connectionId || !connectionString || !connectOptions;

      if (
        this.activeConnectionId === connectionId ||
        connectionWasDisconnected
      ) {
        return;
      }

      if (isAtlasStream(connectionString)) {
        this.logger.warning({
          id: MCPLogIds.UpdateConnectionError,
          context: 'VSCodeMCPConnectionManager.updateConnection',
          message: 'updateConnection called for an AtlasStreams connection',
        });
        this.changeState('connection-error', {
          tag: 'errored',
          errorReason:
            'MongoDB MCP server do not support connecting to Atlas Streams',
        });
        return;
      }

      await this.connectToVSCodeConnection({
        connectionString,
        connectOptions,
        connectionId,
      });
    } catch (error) {
      this.logger.error({
        id: MCPLogIds.UpdateConnectionError,
        context: 'VSCodeMCPConnectionManager.updateConnection',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
