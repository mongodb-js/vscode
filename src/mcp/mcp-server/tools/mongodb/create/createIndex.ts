import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { IndexDirection } from 'mongodb';

export class CreateIndexTool extends MongoDBToolBase {
  protected name = 'create-index';
  protected description = 'Create an index for a collection';
  protected argsShape = {
    ...DbOperationArgs,
    keys: z
      .record(z.string(), z.custom<IndexDirection>())
      .describe('The index definition'),
    name: z.string().optional().describe('The name of the index'),
  };

  protected operationType: OperationType = 'create';

  protected async execute({
    database,
    collection,
    keys,
    name,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();

    const index = await provider.createIndex(
      this.namespace(database, collection),
      keys,
      { name },
    );

    return {
      content: [
        {
          text: `Created the index "${index}" on collection "${collection}" in database "${database}"`,
          type: 'text',
        },
      ],
    };
  }
}
