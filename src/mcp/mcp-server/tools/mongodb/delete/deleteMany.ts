import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { Filter } from 'mongodb';
import type { Document } from 'mongodb';

export class DeleteManyTool extends MongoDBToolBase {
  protected name = 'delete-many';
  protected description =
    'Removes all documents that match the filter from a MongoDB collection';
  protected argsShape = {
    ...DbOperationArgs,
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'The query filter, specifying the deletion criteria. Matches the syntax of the filter argument of db.collection.deleteMany()',
      ),
  };
  protected operationType: OperationType = 'delete';

  protected async execute({
    database,
    collection,
    filter,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const result = await provider.deleteMany(
      this.namespace(database, collection),
      filter as Filter<Document>,
    );

    return {
      content: [
        {
          text: `Deleted \`${result.deletedCount}\` document(s) from collection "${collection}"`,
          type: 'text',
        },
      ],
    };
  }
}
