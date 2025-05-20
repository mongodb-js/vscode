import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';

export class DropCollectionTool extends MongoDBToolBase {
  protected name = 'drop-collection';
  protected description =
    'Removes a collection or view from the database. The method also removes any indexes associated with the dropped collection.';
  protected argsShape = {
    ...DbOperationArgs,
  };
  protected operationType: OperationType = 'delete';

  protected async execute({
    database,
    collection,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const result = await provider.dropCollection(
      this.namespace(database, collection),
    );

    return {
      content: [
        {
          text: `${result ? 'Successfully dropped' : 'Failed to drop'} collection "${collection}" from database "${database}"`,
          type: 'text',
        },
      ],
    };
  }
}
