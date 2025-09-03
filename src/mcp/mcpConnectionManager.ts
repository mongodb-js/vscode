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
  private activeConnection: {
    id: string;
    provider: ServiceProvider;
  } | null = null;

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
      this.activeConnection = {
        id: connectParams.connectionId,
        provider: serviceProvider,
      };
      return this.changeState('connection-success', {
        tag: 'connected',
        serviceProvider,
      });
    } catch (error) {
      this.logger.error({
        id: MCPLogIds.ConnectError,
        context: 'vscode-mcp-connection-manager',
        message: `Error connecting to VSCode connection - ${error instanceof Error ? error.message : String(error)}`,
      });
      return this.changeState('connection-error', {
        tag: 'errored',
        errorReason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<ConnectionStateDisconnected> {
    try {
      await this.activeConnection?.provider?.close(true);
    } catch (error) {
      this.logger.error({
        id: MCPLogIds.DisconnectError,
        context: 'vscode-mcp-connection-manager',
        message: `Error disconnecting from VSCode connection - ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    this.activeConnection = null;
    return this.changeState('connection-close', {
      tag: 'disconnected',
    });
  }

  async updateConnection(
    connectParams: MCPConnectParams | undefined,
  ): Promise<void> {
    if (connectParams?.connectionId === this.activeConnection?.id) {
      return;
    }

    await this.disconnect();

    if (!connectParams) {
      return;
    }

    if (isAtlasStream(connectParams.connectionString)) {
      this.logger.warning({
        id: MCPLogIds.UpdateConnectionError,
        context: 'vscode-mcp-connection-manager',
        message: 'Attempting a connection to an AtlasStreams.',
      });
      this.changeState('connection-error', {
        tag: 'errored',
        errorReason:
          'MongoDB MCP server does not support connecting to Atlas Streams',
      });
      return;
    }

    await this.connectToVSCodeConnection(connectParams);
  }
}
