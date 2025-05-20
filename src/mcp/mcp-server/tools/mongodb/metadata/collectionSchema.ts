import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import { getSimplifiedSchema } from 'mongodb-schema';

export class CollectionSchemaTool extends MongoDBToolBase {
  protected name = 'collection-schema';
  protected description = 'Describe the schema for a collection';
  protected argsShape = DbOperationArgs;

  protected operationType: OperationType = 'metadata';

  protected async execute({
    database,
    collection,
  }: ToolArgs<typeof DbOperationArgs>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const documents = await provider.find(
      this.namespace(database, collection),
      {},
      { limit: 5 },
    );
    const schema = await getSimplifiedSchema(documents);

    const fieldsCount = Object.entries(schema).length;
    if (fieldsCount === 0) {
      return {
        content: [
          {
            text: `Could not deduce the schema for "${database}.${collection}". This may be because it doesn't exist or is empty.`,
            type: 'text',
          },
        ],
      };
    }

    return {
      content: [
        {
          text: `Found ${fieldsCount} fields in the schema for "${database}.${collection}"`,
          type: 'text',
        },
        {
          text: JSON.stringify(schema),
          type: 'text',
        },
      ],
    };
  }
}
