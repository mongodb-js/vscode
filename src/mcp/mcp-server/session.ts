import type { ApiClientCredentials } from './common/atlas/apiClient';
import { ApiClient } from './common/atlas/apiClient';
import type { Implementation } from '@modelcontextprotocol/sdk/types';
import logger, { LogId } from './logger';
import EventEmitter from 'events';
import { setAppNameParamIfMissing } from './helpers/connectionOptions';
import { packageInfo } from './helpers/packageInfo';
import {
  connect,
  createConnectionAttempt,
  type DataService,
} from 'mongodb-data-service';
import type { MongoLogId } from 'mongodb-log-writer';
import { mongoLogId } from 'mongodb-log-writer';

export interface SessionOptions {
  apiBaseUrl: string;
  apiClientId?: string;
  apiClientSecret?: string;
}

export class Session extends EventEmitter<{
  close: [];
  disconnect: [];
  connect: [];
}> {
  sessionId?: string;
  private _serviceProvider?: DataService;
  apiClient: ApiClient;
  agentRunner?: {
    name: string;
    version: string;
  };
  connectedAtlasCluster?: {
    username: string;
    projectId: string;
    clusterName: string;
    expiryDate: Date;
  };

  public get serviceProvider(): DataService | undefined {
    return this._serviceProvider;
  }

  public set serviceProvider(serviceProvider: DataService | undefined) {
    this._serviceProvider = serviceProvider;
    this.emit('connect');
  }

  constructor({ apiBaseUrl, apiClientId, apiClientSecret }: SessionOptions) {
    super();

    const credentials: ApiClientCredentials | undefined =
      apiClientId && apiClientSecret
        ? {
            clientId: apiClientId,
            clientSecret: apiClientSecret,
          }
        : undefined;

    this.apiClient = new ApiClient({
      baseUrl: apiBaseUrl,
      credentials,
    });
  }

  setAgentRunner(agentRunner: Implementation | undefined) {
    if (agentRunner?.name && agentRunner?.version) {
      this.agentRunner = {
        name: agentRunner.name,
        version: agentRunner.version,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.serviceProvider) {
      try {
        await this.serviceProvider.disconnect();
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(
          LogId.mongodbDisconnectFailure,
          'Error closing service provider:',
          error.message,
        );
      }
      this.serviceProvider = undefined;
    }
    if (!this.connectedAtlasCluster) {
      this.emit('disconnect');
      return;
    }
    void this.apiClient
      .deleteDatabaseUser({
        params: {
          path: {
            groupId: this.connectedAtlasCluster.projectId,
            username: this.connectedAtlasCluster.username,
            databaseName: 'admin',
          },
        },
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(
          LogId.atlasDeleteDatabaseUserFailure,
          'atlas-connect-cluster',
          `Error deleting previous database user: ${error.message}`,
        );
      });
    this.connectedAtlasCluster = undefined;

    this.emit('disconnect');
  }

  async close(): Promise<void> {
    await this.disconnect();
    this.emit('close');
  }

  async connectToMongoDB(connectionString: string): Promise<void> {
    connectionString = setAppNameParamIfMissing({
      connectionString,
      defaultAppName: `${packageInfo.mcpServerName} ${packageInfo.version}`,
    });
    const attempt = createConnectionAttempt({
      connectFn: (connectionConfig) =>
        connect({
          ...connectionConfig,
          productName: 'MongoDB MCP',
          productDocsLink: 'https://github.com/mongodb-js/mongodb-mcp-server/',
        }),
      logger: {
        mongoLogId,
        debug: (
          component: string,
          id: MongoLogId,
          context: string,
          message: string,
        ) => {
          logger.debug(id, context, message);
        },
        warn: (
          component: string,
          id: MongoLogId,
          context: string,
          message: string,
        ) => {
          logger.warning(id, context, message);
        },
        error: (
          component: string,
          id: MongoLogId,
          context: string,
          message: string,
        ) => {
          logger.error(id, context, message);
        },
        info: (
          component: string,
          id: MongoLogId,
          context: string,
          message: string,
        ) => {
          logger.info(id, context, message);
        },
        fatal: (
          component: string,
          id: MongoLogId,
          context: string,
          message: string,
        ) => {
          logger.emergency(id, context, message);
        },
      },
      proxyOptions: {},
    });
    this.serviceProvider =
      (await attempt.connect({
        connectionString,
      })) ?? undefined;
  }
}
