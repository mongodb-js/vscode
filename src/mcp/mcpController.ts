import * as vscode from 'vscode';
import {
  applyConfigOverrides,
  CliServer,
  closeSharedServices,
  createKeychainFromConfig,
  createLoggerFromConfig,
  createSharedServicesFromConfig,
  Resources,
  UserConfigSchema,
  type SharedServerServices,
  type UserConfig,
} from '@mongodb-js/mcp-cli';
import {
  Elicitation,
  McpServer,
  RedactingLoggerBase,
} from '@mongodb-js/mcp-core';
import {
  MCPHttpServer,
  StreamableHttpRunner,
} from '@mongodb-js/mcp-http-runners';
import type { ConnectionErrorHandler } from '@mongodb-js/mcp-tools-mongodb';
import type {
  HttpServerOptions,
  LogLevel,
  LogPayload,
  LoggerType,
  TransportRequestContext,
} from '@mongodb-js/mcp-types';
import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import type { TelemetryService } from '../telemetry';
import formatError from '../utils/formatError';
import {
  getMCPConfigFromVSCodeSettings,
  MCP_SERVER_METADATA,
} from './mcpConfig';
import { createMCPConnectionErrorHandler } from './mcpConnectionErrorHandler';
import type { MCPConnectParams } from './mcpConnectionManager';
import { MCPConnectionManager } from './mcpConnectionManager';
import { VSCodeConnectionRegistry } from './mcpConnectionRegistry';
import { VSCodeAtlasTelemetry } from './mcpTelemetry';
import { MCPTools } from './mcpTools';

export type MCPServerStartupConfig =
  'prompt' | 'autoStartEnabled' | 'autoStartDisabled';

class VSCodeMCPLogger extends RedactingLoggerBase {
  private readonly _logger = createLogger('mcp-server');
  protected readonly type: LoggerType = 'console';

  protected logCore(level: LogLevel, payload: LogPayload): void {
    const logMethod = this.mapToMongoDBLogLevel(level);

    this._logger[logMethod](
      `${payload.id.__value} - ${payload.context}: ${payload.message}`,
      ...(payload.attributes ? [payload.attributes] : []),
    );
  }

  private mapToMongoDBLogLevel(
    level: LogLevel,
  ): 'info' | 'warn' | 'error' | 'debug' | 'fatal' {
    switch (level) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warn';
      case 'error':
        return 'error';
      case 'notice':
      case 'debug':
        return 'debug';
      case 'critical':
      case 'alert':
      case 'emergency':
        return 'fatal';
      default:
        return 'info';
    }
  }
}

const logger = createLogger('mcp-controller');

export type MCPServerInfo = {
  runner: StreamableHttpRunner;
  mcpHttpServer: VSCodeMCPHttpServer;
  sharedServices: SharedServerServices;
  connectionManager: MCPConnectionManager;
  headers: Record<string, string>;
};

type MCPControllerConfig = {
  context: vscode.ExtensionContext;
  connectionController: ConnectionController;
  getTelemetryAnonymousId: () => string;
  telemetryService: TelemetryService;
};

/** Injects the extension's connection registry and error handler, which `createServerFromConfig` hardcodes. */
class VSCodeMCPHttpServer extends MCPHttpServer<CliServer> {
  private readonly sharedServices: SharedServerServices;
  private readonly connectionRegistry: VSCodeConnectionRegistry;
  private readonly connectionErrorHandler: ConnectionErrorHandler;

  constructor({
    sharedServices,
    options,
    connectionRegistry,
    connectionErrorHandler,
  }: {
    sharedServices: SharedServerServices;
    options: { http: HttpServerOptions };
    connectionRegistry: VSCodeConnectionRegistry;
    connectionErrorHandler: ConnectionErrorHandler;
  }) {
    super({
      options,
      logger: sharedServices.logger,
      metrics: sharedServices.metrics,
    });
    this.sharedServices = sharedServices;
    this.connectionRegistry = connectionRegistry;
    this.connectionErrorHandler = connectionErrorHandler;
  }

  protected override createServerForRequest(
    request: TransportRequestContext,
  ): Promise<CliServer> {
    const config = applyConfigOverrides({
      baseConfig: this.sharedServices.config,
      request,
    });

    const mcpServer = new McpServer({
      name: MCP_SERVER_METADATA.mcpServerName,
      version: MCP_SERVER_METADATA.version,
    });
    const elicitation = new Elicitation({ server: mcpServer.server });

    return Promise.resolve(
      new CliServer({
        config,
        logger: this.sharedServices.logger,
        keychain: this.sharedServices.keychain,
        connectionRegistry: this.connectionRegistry,
        exportsManager: this.sharedServices.exportsManager,
        apiClient: this.sharedServices.apiClient,
        connectionErrorHandler: this.connectionErrorHandler,
        atlasLocalClient: this.sharedServices.atlasLocalClient,
        mcpServer,
        telemetry: this.sharedServices.telemetry,
        elicitation,
        metrics: this.sharedServices.metrics,
        tools: this.sharedServices.tools,
        resources: this.sharedServices.resources,
        serverMetadata: this.sharedServices.serverMetadata,
        transportRequest: request,
      }),
    );
  }
}

export class MCPController {
  private context: vscode.ExtensionContext;
  private connectionController: ConnectionController;
  private getTelemetryAnonymousId: () => string;
  private telemetryService: TelemetryService;

  private didChangeEmitter = new vscode.EventEmitter<void>();
  private server?: MCPServerInfo;

  constructor({
    context,
    connectionController,
    getTelemetryAnonymousId,
    telemetryService,
  }: MCPControllerConfig) {
    this.context = context;
    this.connectionController = connectionController;
    this.getTelemetryAnonymousId = getTelemetryAnonymousId;
    this.telemetryService = telemetryService;
  }

  public async activate(): Promise<void> {
    await this.migrateOldConfigToNewConfig(
      // The stored value may be old, already-migrated, or unknown, so read it as `unknown`.
      this.getMCPAutoStartConfig<unknown>(),
    );

    this.context.subscriptions.push(
      vscode.lm.registerMcpServerDefinitionProvider('mongodb', {
        onDidChangeMcpServerDefinitions: this.didChangeEmitter.event,
        provideMcpServerDefinitions: () => {
          return [this.getServerConfig()].filter((d) => d !== undefined);
        },
        resolveMcpServerDefinition: (server: vscode.McpServerDefinition) => {
          return server;
        },
      }),
    );

    this.connectionController.addEventListener(
      'ACTIVE_CONNECTION_CHANGED',
      () => {
        void this.onActiveConnectionChanged();
      },
    );

    if (this.getMCPAutoStartConfig() === 'autoStartEnabled') {
      await this.startServer();
    }
  }

  private async migrateOldConfigToNewConfig(oldConfig: unknown): Promise<void> {
    try {
      switch (oldConfig) {
        // 'enabled' was set automatically on activate, not by explicit user action, so map it to 'prompt'.
        case 'ask':
        case 'enabled': {
          await this.setMCPAutoStartConfig('prompt');
          break;
        }

        // 'disabled' was the only value set by explicit user action, so preserve it.
        case 'disabled': {
          await this.setMCPAutoStartConfig('autoStartDisabled');
          break;
        }

        // Any other value is explicit user input or already migrated, so leave it.
        default: {
          break;
        }
      }
    } catch (error) {
      logger.error('Error when migrating old config to the new config', error);
    }
  }

  private async promptForMCPAutoStart(): Promise<void> {
    try {
      const autoStartConfig = this.getMCPAutoStartConfig();
      const shouldPrompt = autoStartConfig === 'prompt';

      logger.debug('Prompt to configure MCP auto start requested.', {
        autoStartConfig,
        shouldPrompt,
        serverRunning: !!this.server,
      });

      if (!shouldPrompt) {
        return;
      }

      // Hide 'Start Once' when the server is already running, where it would confuse users.
      const notificationActions = this.server
        ? (['Auto-Start', 'Never'] as const)
        : (['Auto-Start', 'Start Once', 'Never'] as const);

      const promptResponse = await vscode.window.showInformationMessage(
        'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
        ...notificationActions,
      );

      switch (promptResponse) {
        case 'Auto-Start': {
          await this.setMCPAutoStartConfig('autoStartEnabled');
          await this.startServer();
          break;
        }

        case 'Start Once': {
          await this.startServer();
          break;
        }

        case 'Never': {
          await this.setMCPAutoStartConfig('autoStartDisabled');
          break;
        }

        default:
          break;
      }
    } catch (error) {
      logger.error('Error when prompting for MCP auto start', error);
    }
  }

  public async startServer(): Promise<void> {
    let sharedServices: SharedServerServices | undefined;
    let connectionManager: MCPConnectionManager | undefined;
    let runner: StreamableHttpRunner | undefined;
    try {
      if (this.server) {
        logger.info(
          'MCP server start requested. An MCP server is already running, will not start a new server.',
        );
        return;
      }

      const token = crypto.randomUUID();
      const headers = {
        authorization: `Bearer ${token}`,
      };

      const mcpConfig = this.getMCPServerConfig(headers);

      logger.info('Starting MCP server with config', {
        ...mcpConfig,
        httpHeaders: '<redacted>',
        apiClientId: '<redacted>',
        apiClientSecret: '<redacted>',
      });

      // The keychain is immutable in v3, so the generated auth token is registered up front.
      const keychain = createKeychainFromConfig({
        config: mcpConfig,
        additionalSecrets: { [token]: 'password' },
      });
      const mcpLogger = await createLoggerFromConfig({
        config: mcpConfig,
        keychain,
      });
      mcpLogger.addLogger(new VSCodeMCPLogger({ keychain }));

      sharedServices = await createSharedServicesFromConfig({
        config: mcpConfig,
        serverMetadata: MCP_SERVER_METADATA,
        tools: MCPTools,
        resources: Resources,
        logger: mcpLogger,
        keychain,
      });

      // Swap in a pipeline that also reports the VSCode hosting mode.
      await sharedServices.telemetry.close();
      sharedServices.telemetry = VSCodeAtlasTelemetry.createVSCodeTelemetry({
        logger: mcpLogger,
        deviceId: sharedServices.deviceId,
        apiClient: sharedServices.apiClient,
        keychain,
        enabled: mcpConfig.telemetry === 'enabled',
        serverMetadata: sharedServices.serverMetadata,
      });

      connectionManager = new MCPConnectionManager({
        logger: mcpLogger,
        getTelemetryAnonymousId: this.getTelemetryAnonymousId,
      });
      const connectionRegistry = new VSCodeConnectionRegistry({
        manager: connectionManager,
        keychain,
      });
      sharedServices.connectionRegistry = connectionRegistry;

      const mcpHttpServer = new VSCodeMCPHttpServer({
        sharedServices,
        options: {
          http: {
            host: mcpConfig.httpHost,
            port: mcpConfig.httpPort,
            bodyLimit: mcpConfig.httpBodyLimit,
            headers: mcpConfig.httpHeaders,
            responseType: mcpConfig.httpResponseType,
            dangerousHostBinding: mcpConfig.dangerousHostBinding,
          },
        },
        connectionRegistry,
        connectionErrorHandler: createMCPConnectionErrorHandler(
          this.connectionController,
        ),
      });

      runner = new StreamableHttpRunner({
        logger: mcpLogger,
        mcpHttpServer,
        monitoringServer: sharedServices.monitoringServer,
      });
      await runner.start();

      this.server = {
        runner,
        mcpHttpServer,
        sharedServices,
        connectionManager,
        headers,
      };

      await this.switchConnectionManagerToCurrentConnection(connectionManager);
      this.didChangeEmitter.fire();
    } catch (error) {
      // Silence start errors so the extension host cannot crash; log them instead.
      logger.error('Error when attempting to start MCP server', error);

      // Close anything created before `this.server` was assigned so a failed
      // start doesn't leak services the server would otherwise own.
      if (!this.server) {
        await Promise.allSettled([
          runner?.close(),
          connectionManager?.close(),
          sharedServices ? closeSharedServices(sharedServices) : undefined,
        ]);
      }
    }
  }

  private getMCPServerConfig(headers: Record<string, string>): UserConfig {
    const configFromSettings = getMCPConfigFromVSCodeSettings();
    const vsCodeConfig: Partial<UserConfig> = {
      ...configFromSettings,
      transport: 'http',
      httpPort: 0,
      httpHeaders: headers,
      disabledTools: Array.from(
        new Set(['connect', ...(configFromSettings.disabledTools ?? [])]),
      ),
      loggers: Array.from(
        new Set(['mcp', ...(configFromSettings.loggers ?? [])]),
      ),
      telemetry: this.telemetryService.isTelemetryFeatureEnabled()
        ? 'enabled'
        : 'disabled',
    };

    return UserConfigSchema.parse(vsCodeConfig);
  }

  public async stopServer(): Promise<void> {
    try {
      if (!this.server) {
        logger.info(
          'MCP server stop requested. No MCP server running, nothing to stop.',
        );
        return;
      }

      const { runner, sharedServices, connectionManager } = this.server;
      this.server = undefined;

      await connectionManager.close();
      await runner.close();
      await closeSharedServices(sharedServices);
      this.didChangeEmitter.fire();
    } catch (error) {
      logger.error('Error when attempting to close the MCP server', error);
    }
  }

  public async openServerConfig(): Promise<boolean> {
    const config = this.getServerConfig();
    if (!config) {
      void vscode.window.showErrorMessage(
        'MongoDB MCP Server is not running. Start the server by running "MDB: Start MCP Server" in the command palette.',
      );
      return false;
    }

    try {
      // An in-memory untitled URI, e.g. untitled:/extensionPath/mongodb-mcp-config.json
      const documentUri = vscode.Uri.from({
        path: 'mongodb-mcp-config.json',
        scheme: 'untitled',
      });

      // Fill in the content
      const jsonConfig = JSON.stringify(
        {
          mcpServers: {
            [config.label]: {
              url: config.uri.toString(),
              headers: config.headers,
            },
          },
        },
        null,
        2,
      );

      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        documentUri,
        new vscode.Position(0, 0),
        `// Example config - refer to your IDE's docs for exact configuration details
// Note that the server generates a new authorization header and port every
// time it restarts, so this config will change if vscode or the MCP server
// is restarted.
${jsonConfig}`,
      );
      await vscode.workspace.applyEdit(edit);

      // Open by URI so the secondary `mongodb` extension distinguishes it from regular JS files.
      const document = await vscode.workspace.openTextDocument(documentUri);
      await vscode.languages.setTextDocumentLanguage(document, 'json');
      await vscode.window.showTextDocument(document);
      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a config document: ${formatError(error).message}`,
      );
      return false;
    }
  }

  private getServerConfig(): vscode.McpHttpServerDefinition | undefined {
    if (!this.server) {
      return undefined;
    }

    return new vscode.McpHttpServerDefinition(
      'MongoDB MCP Server',
      vscode.Uri.parse(`${this.server.mcpHttpServer.serverAddress}/mcp`),
      this.server.headers,
    );
  }

  private async onActiveConnectionChanged(): Promise<void> {
    logger.debug(
      'Active connection changed, will switch connection manager to new connection',
      {
        connectionId: this.connectionController.getActiveConnectionId(),
        serverStarted: !!this.server,
      },
    );

    if (this.connectionController.getActiveConnectionId()) {
      void this.promptForMCPAutoStart();
    }

    if (this.server) {
      await this.switchConnectionManagerToCurrentConnection(
        this.server.connectionManager,
      );
    }
  }

  private async switchConnectionManagerToCurrentConnection(
    connectionManager: MCPConnectionManager,
  ): Promise<void> {
    try {
      const connectionId = this.connectionController.getActiveConnectionId();
      const mongoClientOptions =
        this.connectionController.getMongoClientConnectionOptions();

      const connectParams: MCPConnectParams | undefined =
        connectionId && mongoClientOptions
          ? {
              connectionId: connectionId,
              connectionString: mongoClientOptions.url,
              connectOptions: mongoClientOptions.options,
            }
          : undefined;
      await connectionManager.updateConnection(connectParams);
    } catch (error) {
      logger.error(
        'Error when attempting to switch connection for connection manager',
        error,
      );
    }
  }

  private getMCPAutoStartConfig<ConfigValue = MCPServerStartupConfig>():
    ConfigValue | undefined {
    return vscode.workspace
      .getConfiguration()
      .get<ConfigValue>('mdb.mcp.server');
  }

  private async setMCPAutoStartConfig(
    config: MCPServerStartupConfig,
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration()
      .update('mdb.mcp.server', config, true);
  }
}
