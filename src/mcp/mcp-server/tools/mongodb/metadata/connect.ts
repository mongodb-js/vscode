import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import assert from 'assert';
import type { UserConfig } from '../../../config';
import type { Telemetry } from '../../../telemetry/telemetry';
import type { Session } from '../../../session';

const disconnectedSchema = z
  .object({
    connectionString: z
      .string()
      .describe(
        'MongoDB connection string (in the mongodb:// or mongodb+srv:// format)',
      ),
  })
  .describe('Options for connecting to MongoDB.');

const connectedSchema = z
  .object({
    connectionString: z
      .string()
      .optional()
      .describe(
        'MongoDB connection string to switch to (in the mongodb:// or mongodb+srv:// format)',
      ),
  })
  .describe(
    'Options for switching the current MongoDB connection. If a connection string is not provided, the connection string from the config will be used.',
  );

const connectedName = 'switch-connection' as const;
const disconnectedName = 'connect' as const;

const connectedDescription =
  "Switch to a different MongoDB connection. If the user has configured a connection string or has previously called the connect tool, a connection is already established and there's no need to call this tool unless the user has explicitly requested to switch to a new instance.";
const disconnectedDescription = 'Connect to a MongoDB instance';

export class ConnectTool extends MongoDBToolBase {
  protected name: typeof connectedName | typeof disconnectedName =
    disconnectedName;
  protected description:
    | typeof connectedDescription
    | typeof disconnectedDescription = disconnectedDescription;

  // Here the default is empty just to trigger registration, but we're going to override it with the correct
  // schema in the register method.
  protected argsShape = {
    connectionString: z.string().optional(),
  };

  protected operationType: OperationType = 'metadata';

  constructor(session: Session, config: UserConfig, telemetry: Telemetry) {
    super(session, config, telemetry);
    session.on('connect', () => {
      this.updateMetadata();
    });
  }

  protected async execute({
    connectionString,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    switch (this.name) {
      case disconnectedName:
        assert(connectionString, 'Connection string is required');
        break;
      case connectedName:
        connectionString ??= this.config.connectionString;
        assert(
          connectionString,
          'Cannot switch to a new connection because no connection string was provided and no default connection string is configured.',
        );
        break;
      default:
        throw new Error(
          `Unexpected tool name: ${this.name}. Expected either "${disconnectedName}" or "${connectedName}".`,
        );
    }

    await this.connectToMongoDB(connectionString);
    this.updateMetadata();
    return {
      content: [{ type: 'text', text: 'Successfully connected to MongoDB.' }],
    };
  }

  public register(server: McpServer): void {
    super.register(server);

    this.updateMetadata();
  }

  private updateMetadata(): void {
    if (this.config.connectionString || this.session.serviceProvider) {
      this.update?.({
        name: connectedName,
        description: connectedDescription,
        inputSchema: connectedSchema,
      });
    } else {
      this.update?.({
        name: disconnectedName,
        description: disconnectedDescription,
        inputSchema: disconnectedSchema,
      });
    }
  }
}
