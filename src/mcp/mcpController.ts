import * as vscode from 'vscode';
import type {
  LoggerType,
  LogLevel,
  LogPayload,
  UserConfig,
  ConnectionManagerFactoryFn,
  ConnectionManager,
} from 'mongodb-mcp-server';
import {
  defaultUserConfig,
  LoggerBase,
  StreamableHttpRunner,
  Keychain,
  registerGlobalSecretToRedact,
} from 'mongodb-mcp-server';
import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import type { MCPConnectParams } from './mcpConnectionManager';
import { MCPConnectionManager } from './mcpConnectionManager';
import { createMCPConnectionErrorHandler } from './mcpConnectionErrorHandler';
import { getMCPConfigFromVSCodeSettings } from './mcpConfig';
import { DEFAULT_TELEMETRY_APP_NAME } from '../connectionController';

export type MCPServerStartupConfig =
  | 'prompt'
  | 'autoStartEnabled'
  | 'autoStartDisabled';

class VSCodeMCPLogger extends LoggerBase {
  private readonly _logger = createLogger('mcp-server');
  protected type: LoggerType = 'console';
  protected logCore(level: LogLevel, payload: LogPayload): void {
    const logMethod = this.mapToMongoDBLogLevel(level);

    this._logger[logMethod](
      `${payload.id.__value} - ${payload.context}: ${payload.message}`,
      ...(payload.attributes ? [payload.attributes] : []),
    );
  }
}

const logger = createLogger('mcp-controller');

export type MCPServerInfo = {
  runner: StreamableHttpRunner;
  headers: Record<string, string>;
};

type MCPControllerConfig = {
  context: vscode.ExtensionContext;
  connectionController: ConnectionController;
  getTelemetryAnonymousId: () => string;
};

export class MCPController {
  private context: vscode.ExtensionContext;
  private connectionController: ConnectionController;
  private getTelemetryAnonymousId: () => string;
  private mcpConnectionManagers: MCPConnectionManager[] = [];

  private didChangeEmitter = new vscode.EventEmitter<void>();
  private server?: MCPServerInfo;

  constructor({
    context,
    connectionController,
    getTelemetryAnonymousId,
  }: MCPControllerConfig) {
    this.context = context;
    this.connectionController = connectionController;
    this.getTelemetryAnonymousId = getTelemetryAnonymousId;
  }

  public async activate(): Promise<void> {
    await this.migrateOldConfigToNewConfig(
      // At this point we don't know for certain if the "mdb.mcp.server" holds
      // one of the old values or something totally unknown so to keep cases
      // covered we consider the retrieved value unknown.
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
        // The previous logic would set the mdb.mcp.server to 'enabled' on
        // extension activate (with a notification) so we're assuming that this
        // value is not the result of explicit user action and hence mapping it
        // to 'prompt'.
        case 'ask':
        case 'enabled': {
          await this.setMCPAutoStartConfig('prompt');
          break;
        }

        // In the previous logic only 'disabled' value would've represented an
        // explicit user action which is why we preserve that and map it to new
        // disabled value.
        case 'disabled': {
          await this.setMCPAutoStartConfig('autoStartDisabled');
          break;
        }

        // Any other value is possible only if:
        // 1. user explicitly did the modification or,
        // 2. the old values were already migrated to the new values.
        // So we don't migrate in this case.
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

      // 'Start Once' action might confuse users if the server is already
      // running so we skip exposing this action in this particular case.
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
    try {
      if (this.server) {
        logger.info(
          'MCP server start requested. An MCP server is already running, will not start a new server.',
        );
        return;
      }

      const token = crypto.randomUUID();
      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
      };
      registerGlobalSecretToRedact(token, 'password');

      const mcpConfig = this.getMCPServerConfig(headers);

      logger.info('Starting MCP server with config', {
        ...mcpConfig,
        httpHeaders: '<redacted>',
        apiClientId: '<redacted>',
        apiClientSecret: '<redacted>',
      });

      const runner = new StreamableHttpRunner({
        userConfig: mcpConfig,
        createConnectionManager: (...params) =>
          this.createConnectionManager(...params),
        connectionErrorHandler: createMCPConnectionErrorHandler(
          this.connectionController,
        ),
        additionalLoggers: [new VSCodeMCPLogger(Keychain.root)],
        telemetryProperties: {
          hosting_mode: DEFAULT_TELEMETRY_APP_NAME,
        },
      });
      await runner.start();

      this.server = {
        runner,
        headers,
      };
      this.didChangeEmitter.fire();
    } catch (error) {
      // In case of errors we don't want VSCode extension process to crash so we
      // silence MCP start errors and instead log them for debugging.
      logger.error('Error when attempting to start MCP server', error);
    }
  }

  private getMCPServerConfig(headers: Record<string, string>): UserConfig {
    const vscodeConfiguredMCPConfig = getMCPConfigFromVSCodeSettings();

    return {
      ...defaultUserConfig,
      ...vscodeConfiguredMCPConfig,
      transport: 'http',
      httpPort: 0,
      httpHeaders: headers,
      disabledTools: Array.from(
        new Set([
          'connect',
          ...(vscodeConfiguredMCPConfig.disabledTools ?? []),
        ]),
      ),
      loggers: Array.from(
        new Set(['mcp', ...(vscodeConfiguredMCPConfig.loggers ?? [])]),
      ),
    };
  }

  private async createConnectionManager(
    this: MCPController,
    ...params: Parameters<ConnectionManagerFactoryFn>
  ): Promise<ConnectionManager> {
    const [{ logger: mcpLogger }] = params;
    const connectionManager = new MCPConnectionManager({
      logger: mcpLogger,
      getTelemetryAnonymousId: this.getTelemetryAnonymousId,
    });

    // Track this ConnectionManager instance for future connection updates
    this.mcpConnectionManagers.push(connectionManager);

    // Also set up listener on close event to perform a cleanup when the Client
    // closes connection to MCP server and eventually ConnectionManager shuts
    // down.
    connectionManager.events.on('close', (): void => {
      logger.debug('MCPConnectionManager closed. Performing cleanup', {
        connectionManagerClientName: connectionManager.clientName,
      });
      this.mcpConnectionManagers = this.mcpConnectionManagers.filter(
        (manager) => manager !== connectionManager,
      );
    });

    // The newly created ConnectionManager need to be brought up to date with
    // the current connection state.
    await this.switchConnectionManagerToCurrentConnection(connectionManager);
    return connectionManager;
  }

  public async stopServer(): Promise<void> {
    try {
      if (!this.server) {
        logger.info(
          'MCP server stop requested. No MCP server running, nothing to stop.',
        );
        return;
      }
      await this.server.runner.close();
      this.server = undefined;
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
      // Does not create a physical file, it only creates a URI from specified component parts.
      // An untitled file URI: untitled:/extensionPath/mongodb-mcp-config.json
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

      // Actually show the editor.
      // We open playgrounds by URI to use the secondary `mongodb` extension
      // as an identifier that distinguishes them from regular JS files.
      const document = await vscode.workspace.openTextDocument(documentUri);
      await vscode.languages.setTextDocumentLanguage(document, 'json');
      await vscode.window.showTextDocument(document);
      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a config document: ${error}`,
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
      vscode.Uri.parse(`${this.server.runner.serverAddress}/mcp`),
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

    await Promise.all(
      this.mcpConnectionManagers.map((manager) =>
        this.switchConnectionManagerToCurrentConnection(manager),
      ),
    );
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
    | ConfigValue
    | undefined {
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
