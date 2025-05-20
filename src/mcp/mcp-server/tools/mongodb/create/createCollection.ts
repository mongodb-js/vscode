import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { OperationType, ToolArgs } from '../../tool';

export class CreateCollectionTool extends MongoDBToolBase {
  protected name = 'create-collection';
  protected description =
    "Creates a new collection in a database. If the database doesn't exist, it will be created automatically.";
  protected argsShape = DbOperationArgs;

  protected operationType: OperationType = 'create';

  protected async execute({
    collection,
    database,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    await provider.createCollection(this.namespace(database, collection), {});

    return {
      content: [
        {
          type: 'text',
          text: `Collection "${collection}" created in database "${database}".`,
        },
      ],
    };
  }
}
