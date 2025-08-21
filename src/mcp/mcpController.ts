import * as vscode from 'vscode';

type ServerInfo = {
  headers: { [key: string]: string };
  port: number;
  host: string;
  protocol: 'http' | 'https';
};

export class MCPController {
  private didChangeEmitter = new vscode.EventEmitter<void>();
  private server: ServerInfo | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.context.subscriptions.push(
      vscode.lm.registerMcpServerDefinitionProvider('mongodb', {
        onDidChangeMcpServerDefinitions: this.didChangeEmitter.event,
        provideMcpServerDefinitions: () => {
          const servers: vscode.McpServerDefinition[] = [];
          if (this.server) {
            servers.push(
              new vscode.McpHttpServerDefinition(
                'MongoDB MCP Server',
                vscode.Uri.parse(
                  `${this.server.protocol}://${this.server.host}:${this.server.port}`,
                ),
                this.server.headers,
              ),
            );
          }

          return servers;
        },
        resolveMcpServerDefinition: (server: vscode.McpServerDefinition) => {
          return server;
        },
      }),
    );
  }

  public startServer(): Promise<void> {
    // Simulate starting a server and setting the server info.
    this.server = {
      headers: { Authorization: 'Bearer 123' },
      port: 3000,
      host: 'localhost',
      protocol: 'http',
    };
    this.didChangeEmitter.fire();

    return Promise.resolve();
  }

  public stopServer(): Promise<void> {
    this.server = undefined;
    this.didChangeEmitter.fire();
    return Promise.resolve();
  }
}
