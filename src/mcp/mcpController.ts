import * as vscode from 'vscode';
import type {
  LoggerType,
  LogLevel,
  LogPayload,
  UserConfig,
  ConnectionManagerFactoryFn,
} from '@himanshusinghs/mongodb-mcp-server';
import {
  defaultUserConfig,
  LoggerBase,
  StreamableHttpRunner,
} from '@himanshusinghs/mongodb-mcp-server';
import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import type { MCPConnectParams } from './mcpConnectionManager';
import { MCPConnectionManager } from './mcpConnectionManager';
import { createMCPConnectionErrorHandler } from './mcpConnectionErrorHandler';

type mcpServerStartupConfig = 'ask' | 'enabled' | 'disabled';

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

export type MCPServerInfo = {
  runner: StreamableHttpRunner;
  headers: Record<string, string>;
};
export class MCPController {
  private didChangeEmitter = new vscode.EventEmitter<void>();
  private server?: MCPServerInfo;
  private mcpConnectionManager?: MCPConnectionManager;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly connectionController: ConnectionController,
  ) {
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
  }

  public activate(): Promise<void> {
    this.connectionController.addEventListener(
      'ACTIVE_CONNECTION_CHANGED',
      () => {
        void this.onActiveConnectionChanged();
      },
    );

    return Promise.resolve();
  }

  public async startServer(): Promise<void> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${crypto.randomUUID()}`,
    };

    const mcpConfig: UserConfig = {
      ...defaultUserConfig,
      httpPort: 0,
      httpHeaders: headers,
      disabledTools: ['connect'],
      loggers: ['mcp'],
    };

    const createConnectionManager: ConnectionManagerFactoryFn = async ({
      logger,
    }) => {
      const connectionManager = (this.mcpConnectionManager =
        new MCPConnectionManager(logger));
      await this.switchConnectionManagerToCurrentConnection();
      return connectionManager;
    };

    const runner = new StreamableHttpRunner({
      userConfig: mcpConfig,
      createConnectionManager,
      connectionErrorHandler: createMCPConnectionErrorHandler(
        this.connectionController,
      ),
      additionalLoggers: [new VSCodeMCPLogger()],
    });
    await runner.start();

    this.server = {
      runner,
      headers,
    };
    this.didChangeEmitter.fire();
  }

  public async stopServer(): Promise<void> {
    await this.server?.runner.close();
    this.server = undefined;
    this.didChangeEmitter.fire();
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
    if (this.server) {
      await this.switchConnectionManagerToCurrentConnection();
      return;
    }

    if (!this.connectionController.getActiveConnectionId()) {
      // No connection, don't prompt the user
      return;
    }

    const serverStartConfig = vscode.workspace
      .getConfiguration('mdb')
      .get<mcpServerStartupConfig>('mcp.server');

    let shouldStartServer = false;
    switch (serverStartConfig) {
      case 'enabled':
        shouldStartServer = true;
        break;
      case 'disabled':
        break;
      default:
        const prompt = await vscode.window.showInformationMessage(
          'Do you want to start the MongoDB MCP server automatically when connected to MongoDB?',
          'Yes',
          'No',
        );

        switch (prompt) {
          case 'Yes':
            shouldStartServer = true;
            break;
          case 'No':
            shouldStartServer = false;
            break;
          default:
            // User canceled/dismissed the notification - don't do anything.
            return;
        }

        await vscode.workspace
          .getConfiguration('mdb')
          .update(
            'mcp.server',
            shouldStartServer ? 'enabled' : 'disabled',
            true,
          );
    }

    if (shouldStartServer) {
      await this.startServer();
    }
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
}
