import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import { EJSON } from 'bson';

export class DbStatsTool extends MongoDBToolBase {
  protected name = 'db-stats';
  protected description =
    'Returns statistics that reflect the use state of a single database';
  protected argsShape = {
    database: DbOperationArgs.database,
  };

  protected operationType: OperationType = 'metadata';

  protected async execute({
    database,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const result = await provider.databaseStats(database);

    return {
      content: [
        {
          text: `Statistics for database ${database}`,
          type: 'text',
        },
        {
          text: EJSON.stringify(result),
          type: 'text',
        },
      ],
    };
  }
}
