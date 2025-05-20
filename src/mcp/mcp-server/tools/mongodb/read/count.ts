import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import { z } from 'zod';
import type { Filter, Document } from 'mongodb';

export const CountArgs = {
  query: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'The query filter to count documents. Matches the syntax of the filter argument of db.collection.count()',
    ),
};

export class CountTool extends MongoDBToolBase {
  protected name = 'count';
  protected description =
    'Gets the number of documents in a MongoDB collection';
  protected argsShape = {
    ...DbOperationArgs,
    ...CountArgs,
  };

  protected operationType: OperationType = 'read';

  protected async execute({
    database,
    collection,
    query,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const count = await provider.count(
      this.namespace(database, collection),
      query as Filter<Document>,
    );

    return {
      content: [
        {
          text: `Found ${count} documents in the collection "${collection}"`,
          type: 'text',
        },
      ],
    };
  }
}
