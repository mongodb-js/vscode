import {
  ConnectionManager,
  type AnyConnectionState,
  type ConnectionStateDisconnected,
  type LoggerBase,
} from 'mongodb-mcp-server';
import {
  NodeDriverServiceProvider,
  type DevtoolsConnectOptions,
} from '@mongosh/service-provider-node-driver';
import type { ServiceProvider } from '@mongosh/service-provider-core';
import { isAtlas, isAtlasStream } from 'mongodb-build-info';
import { MCPLogIds } from './mcpLogIds';
import ConnectionString from 'mongodb-connection-string-url';
import { DEFAULT_TELEMETRY_APP_NAME } from '../connectionController';

export interface MCPConnectParams {
  connectionId: string;
  connectionString: string;
  connectOptions: DevtoolsConnectOptions;
}

export const MCP_SERVER_TELEMETRY_APP_NAME_SUFFIX = 'MongoDB MCP Server';

type MCPConnectionManagerConfig = {
  logger: LoggerBase;
  getTelemetryAnonymousId: () => string;
};

export class MCPConnectionManager extends ConnectionManager {
  private logger: LoggerBase;
  private getTelemetryAnonymousId: () => string;
  private activeConnection: {
    id: string;
    provider: ServiceProvider;
  } | null = null;

  constructor({ logger, getTelemetryAnonymousId }: MCPConnectionManagerConfig) {
    super();
    this.logger = logger;
    this.getTelemetryAnonymousId = getTelemetryAnonymousId;
  }

  connect(): Promise<AnyConnectionState> {
    return Promise.reject(
      new Error(
        // eslint-disable-next-line no-multi-str
        "MongoDB MCP Server in MongoDB VSCode extension makes use of the connection that the MongoDB VSCode extension is connected to. \
To connect, choose a connection from MongoDB VSCode extensions's sidepanel - https://www.mongodb.com/docs/mongodb-vscode/connect/#connect-to-your-mongodb-deployment",
      ),
    );
  }

  async connectToVSCodeConnection(
    connectParams: MCPConnectParams,
  ): Promise<AnyConnectionState> {
    try {
      const { connectionId, connectOptions, connectionString } =
        this.overridePresetAppName(connectParams);
      const serviceProvider = await NodeDriverServiceProvider.connect(
        connectionString,
        connectOptions,
      );
      await serviceProvider.runCommand('admin', { hello: 1 });
      this.activeConnection = {
        id: connectionId,
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

  overridePresetAppName(connectParams: MCPConnectParams): MCPConnectParams {
    const connectionURL = new ConnectionString(connectParams.connectionString);
    const connectOptions: DevtoolsConnectOptions = {
      ...connectParams.connectOptions,
    };
    const searchParams =
      connectionURL.typedSearchParams<DevtoolsConnectOptions>();
    const appName = searchParams.get('appName');

    if (
      !appName ||
      (appName.startsWith(DEFAULT_TELEMETRY_APP_NAME) &&
        !appName.includes(MCP_SERVER_TELEMETRY_APP_NAME_SUFFIX))
    ) {
      const defaultAppName = `${DEFAULT_TELEMETRY_APP_NAME} ${MCP_SERVER_TELEMETRY_APP_NAME_SUFFIX}`;
      const telemetryAnonymousId = this.getTelemetryAnonymousId();
      const connectionId = connectParams.connectionId;
      const newAppName = isAtlas(connectParams.connectionString)
        ? `${defaultAppName}${
            telemetryAnonymousId ? `--${telemetryAnonymousId}` : ''
          }--${connectionId}`
        : defaultAppName;

      searchParams.set('appName', newAppName);
      connectOptions.appName = newAppName;
    }

    return {
      connectionId: connectParams.connectionId,
      connectionString: connectionURL.toString(),
      connectOptions,
    };
  }
}
