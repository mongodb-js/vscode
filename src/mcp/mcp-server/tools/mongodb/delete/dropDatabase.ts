import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';

export class DropDatabaseTool extends MongoDBToolBase {
  protected name = 'drop-database';
  protected description =
    'Removes the specified database, deleting the associated data files';
  protected argsShape = {
    database: DbOperationArgs.database,
  };
  protected operationType: OperationType = 'delete';

  protected async execute({
    database,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const result = await provider.dropDatabase(database);

    return {
      content: [
        {
          text: `${result ? 'Successfully dropped' : 'Failed to drop'} database "${database}"`,
          type: 'text',
        },
      ],
    };
  }
}
