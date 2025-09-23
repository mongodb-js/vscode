import * as vscode from 'vscode';
import type {
  LoggerType,
  LogLevel,
  LogPayload,
  UserConfig,
  ConnectionManagerFactoryFn,
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

  private didChangeEmitter = new vscode.EventEmitter<void>();
  private server?: MCPServerInfo;
  private mcpConnectionManager: MCPConnectionManager;
  private vsCodeMCPLogger: LoggerBase;

  constructor({
    context,
    connectionController,
    getTelemetryAnonymousId,
  }: MCPControllerConfig) {
    this.context = context;
    this.connectionController = connectionController;
    this.vsCodeMCPLogger = new VSCodeMCPLogger(Keychain.root);
    this.mcpConnectionManager = new MCPConnectionManager({
      logger: this.vsCodeMCPLogger,
      getTelemetryAnonymousId,
    });
  }

  public async activate(): Promise<void> {
    await this.migrateOldConfigToNewConfig(this.getMCPAutoStartConfig());
    await this.switchConnectionManagerToCurrentConnection();

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

    if (this.shouldPromptForAutoStart()) {
      void this.promptForMCPAutoStart();
    }

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
        // to 'prompt'
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

        // Any other value is possible only if user explicitly mentioned or when
        // if the values were already migrated it so we don't alter them.
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
      const promptResponse = await vscode.window.showInformationMessage(
        'Would you like to automatically start the MongoDB MCP server? When started, the MongoDB MCP Server will automatically connect to your active MongoDB instance.',
        'Yes',
        'Not now',
      );

      switch (promptResponse) {
        case 'Yes': {
          await this.setMCPAutoStartConfig('autoStartEnabled');
          await this.startServer();
          break;
        }

        case 'Not now': {
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

      const vscodeConfiguredMCPConfig = getMCPConfigFromVSCodeSettings();

      const mcpConfig: UserConfig = {
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

      logger.info('Starting MCP server with config', {
        ...mcpConfig,
        httpHeaders: '<redacted>',
        apiClientId: '<redacted>',
        apiClientSecret: '<redacted>',
      });

      const createConnectionManager: ConnectionManagerFactoryFn = async ({
        logger,
      }) => {
        this.mcpConnectionManager.setLogger(logger);
        return Promise.resolve(this.mcpConnectionManager);
      };

      const runner = new StreamableHttpRunner({
        userConfig: mcpConfig,
        createConnectionManager,
        connectionErrorHandler: createMCPConnectionErrorHandler(
          this.connectionController,
        ),
        additionalLoggers: [new VSCodeMCPLogger(Keychain.root)],
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
    logger.info(
      'Active connection changed, will switch connection manager to new connection',
      {
        connectionId: this.connectionController.getActiveConnectionId(),
        shouldPromptForAutoStart: this.shouldPromptForAutoStart(),
        serverStarted: !!this.server,
      },
    );

    if (
      this.connectionController.getActiveConnectionId() &&
      this.shouldPromptForAutoStart()
    ) {
      void this.promptForMCPAutoStart();
    }

    await this.switchConnectionManagerToCurrentConnection();
  }

  private async switchConnectionManagerToCurrentConnection(): Promise<void> {
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
      await this.mcpConnectionManager.updateConnection(connectParams);
    } catch (error) {
      logger.error('Error when attempting to switch connection', error);
    }
  }

  private shouldPromptForAutoStart(): boolean {
    const storedConfig = this.getMCPAutoStartConfig();
    return storedConfig === 'prompt';
  }

  private getMCPAutoStartConfig(): unknown {
    return vscode.workspace
      .getConfiguration()
      .get<unknown>('mdb.mcp.server', 'prompt');
  }

  private async setMCPAutoStartConfig(
    config: MCPServerStartupConfig,
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration()
      .update('mdb.mcp.server', config, true);
  }

  public get _test_isServerRunning(): boolean {
    return (
      this.server !== undefined &&
      this.server.runner instanceof StreamableHttpRunner
    );
  }

  public get _test_mcpConnectionManager(): MCPConnectionManager {
    return this.mcpConnectionManager;
  }
}
