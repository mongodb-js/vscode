import * as vscode from 'vscode';
import express from 'express';
import type * as http from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { ObjectId } from 'bson';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { Telemetry } from './mcp-server/telemetry/telemetry';
import { type UserConfig } from './mcp-server/config';
import { Session } from './mcp-server/session';
import { Server } from './mcp-server/server';

import * as path from 'path';
import * as os from 'os';
import type ConnectionController from '../connectionController';
import { DataServiceEventTypes } from '../connectionController';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require('../../package.json');

export default class MCPController {
  private _expressServer?: http.Server;
  private _mcpServer?: Server;
  private _transports: { [sessionId: string]: StreamableHTTPServerTransport } =
    {};

  private _serverAddress?: string;

  public didChangeEmitter = new vscode.EventEmitter<void>();

  constructor(private connectionController: ConnectionController) {
    connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        if (this._mcpServer) {
          this._mcpServer.session.serviceProvider =
            connectionController.getActiveDataService() ?? undefined;
        }
      },
    );
  }

  public get mcpServerDefinition(): any | undefined {
    if (!this._serverAddress) {
      return undefined;
    }

    return new (vscode as any).McpHttpServerDefinition(
      'MongoDB MCP Server',
      vscode.Uri.parse(this._serverAddress),
    );
  }

  public async stopServer(): Promise<void> {
    await this._mcpServer?.close();
    this._transports = {};

    if (this._expressServer) {
      await new Promise<void>((resolve, reject) => {
        this._expressServer?.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    this._transports = {};
    this._expressServer = undefined;
    this._mcpServer = undefined;
    this._serverAddress = undefined;
    this.didChangeEmitter.fire();
  }

  public async startServer(): Promise<void> {
    const mcpServerPort = vscode.workspace
      .getConfiguration('mdb')
      .get('mcpServerPort', 62227);

    this._serverAddress = await this.setupExpressServer(mcpServerPort);
    this.didChangeEmitter.fire();
  }

  public async restartServer(): Promise<void> {
    await this.stopServer();
    await this.startServer();
  }

  private async setupExpressServer(port: number): Promise<string> {
    const app = express();
    app.use(express.json());
    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && this._transports[sessionId]) {
        // Reuse existing transport
        transport = this._transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => new ObjectId().toString(),
          onsessioninitialized: (sessionId: string): void => {
            // Store the transport by session ID
            this._transports[sessionId] = transport;
          },
        });

        // Clean up transport when closed
        transport.onclose = (): void => {
          if (transport.sessionId) {
            delete this._transports[transport.sessionId];
          }
        };

        if (!this._mcpServer) {
          const userConfig: UserConfig = {
            apiBaseUrl: 'https://cloud.mongodb.com/',
            logPath: this.getLogPath(),
            connectOptions: {
              readConcern: 'local',
              readPreference: 'secondaryPreferred',
              writeConcern: 'majority',
              timeoutMS: 30000,
            },
            disabledTools: [],
            telemetry: 'enabled',
            readOnly: false,
          };

          const session = new Session({
            apiBaseUrl: userConfig.apiBaseUrl,
            // TODO: find a way to enable Atlas tools
          });

          const mcpServer = new McpServer({
            name: packageJSON.name,
            version: packageJSON.version,
          });

          const telemetry = Telemetry.create(session, userConfig);

          this._mcpServer = new Server({
            mcpServer,
            session,
            telemetry,
            userConfig,
          });

          if (this.connectionController.getActiveDataService()) {
            this._mcpServer.session.serviceProvider =
              this.connectionController.getActiveDataService() ?? undefined;
          }
        }

        await this._mcpServer.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    });

    const handleSessionRequest = (
      req: express.Request,
      res: express.Response,
    ): Promise<void> => {
      const sessionId = req.headers['mcp-session-id'];
      if (typeof sessionId === 'string') {
        const transport = this._transports[sessionId];
        if (transport) {
          return transport.handleRequest(req, res);
        }
      }

      res.status(400).send('Invalid or missing session ID');
      return Promise.resolve();
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);

    return new Promise((resolve, reject) => {
      this._expressServer = app.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(`http://localhost:${port}/mcp`);
        }
      });
    });
  }

  private getLogPath(): string {
    const localDataPath =
      process.platform === 'win32'
        ? path.join(
            process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(),
            'mongodb',
          )
        : path.join(os.homedir(), '.mongodb');
    const logPath = path.join(localDataPath, 'mongodb-mcp', '.app-logs');
    return logPath;
  }
}
