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

export type McpServerStartupConfig = 'enabled' | 'disabled';

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

  private didChangeEmitter = new vscode.EventEmitter<void>();
  private server?: MCPServerInfo;
  private mcpConnectionManager?: MCPConnectionManager;

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

    if (this.shouldStartMCPServer()) {
      await this.startServer();
      void this.notifyOnFirstStart();
    }
  }

  public async startServer(): Promise<void> {
    try {
      // Stop an already running server if any
      await this.stopServer();

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
        const connectionManager = (this.mcpConnectionManager =
          new MCPConnectionManager({
            logger,
            getTelemetryAnonymousId: this.getTelemetryAnonymousId,
          }));
        await this.switchConnectionManagerToCurrentConnection();
        return connectionManager;
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
      await this.server?.runner.close();
      this.server = undefined;
      this.didChangeEmitter.fire();
    } catch (error) {
      logger.error('Error when attempting to close the MCP server', error);
    }
  }

  private async notifyOnFirstStart(): Promise<void> {
    try {
      if (!this.server) {
        // Server was never started so no need to notify
        return;
      }

      const serverStartConfig = this.getMCPAutoStartConfig();

      // If the config value is one of the following values means they are
      // intentional (either set by user or by this function itself) and we
      // should not notify in that case.
      const shouldNotNotify =
        serverStartConfig === 'enabled' || serverStartConfig === 'disabled';

      if (shouldNotNotify) {
        return;
      }

      // We set the auto start already to enabled to not prompt user again for
      // this on the next boot. We do it this way because chances are that the
      // user might not act on the notification in which case the final update
      // will never happen.
      await this.setMCPAutoStartConfig('enabled');
      let selectedServerStartConfig: McpServerStartupConfig = 'enabled';

      const prompt = await vscode.window.showInformationMessage(
        'MongoDB MCP server started automatically and will connect to your active connection. Would you like to keep or disable automatic startup?',
        'Keep',
        'Disable',
      );

      switch (prompt) {
        case 'Keep':
        default:
          // The default happens only when users explicity dismiss the
          // notification.
          selectedServerStartConfig = 'enabled';
          break;
        case 'Disable': {
          selectedServerStartConfig = 'disabled';
          await this.stopServer();
        }
      }

      await this.setMCPAutoStartConfig(selectedServerStartConfig);
    } catch (error) {
      logger.error(
        'Error while attempting to emit MCP server started notification',
        error,
      );
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
    if (!this.server) {
      return;
    }
    await this.switchConnectionManagerToCurrentConnection();
  }

  private async switchConnectionManagerToCurrentConnection(): Promise<void> {
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
    await this.mcpConnectionManager?.updateConnection(connectParams);
  }

  private shouldStartMCPServer(): boolean {
    return this.getMCPAutoStartConfig() !== 'disabled';
  }

  private getMCPAutoStartConfig(): McpServerStartupConfig | undefined {
    return vscode.workspace
      .getConfiguration('mdb')
      .get<McpServerStartupConfig>('mcp.server');
  }

  private async setMCPAutoStartConfig(
    config: McpServerStartupConfig,
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('mcp.server', config, true);
  }
}
