import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { Filter, Document } from 'mongodb';

export class UpdateManyTool extends MongoDBToolBase {
  protected name = 'update-many';
  protected description =
    'Updates all documents that match the specified filter for a collection';
  protected argsShape = {
    ...DbOperationArgs,
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'The selection criteria for the update, matching the syntax of the filter argument of db.collection.updateOne()',
      ),
    update: z
      .record(z.string(), z.unknown())
      .describe(
        'An update document describing the modifications to apply using update operator expressions',
      ),
    upsert: z
      .boolean()
      .optional()
      .describe(
        'Controls whether to insert a new document if no documents match the filter',
      ),
  };
  protected operationType: OperationType = 'update';

  protected async execute({
    database,
    collection,
    filter,
    update,
    upsert,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const result = await provider.updateMany(
      this.namespace(database, collection),
      filter as Filter<Document>,
      update,
      {
        upsert,
      },
    );

    let message = '';
    if (
      result.matchedCount === 0 &&
      result.modifiedCount === 0 &&
      result.upsertedCount === 0
    ) {
      message = 'No documents matched the filter.';
    } else {
      message = `Matched ${result.matchedCount} document(s).`;
      if (result.modifiedCount > 0) {
        message += ` Modified ${result.modifiedCount} document(s).`;
      }
      if (result.upsertedCount > 0) {
        message += ` Upserted ${result.upsertedCount} document with id: ${result.upsertedId?.toString()}.`;
      }
    }

    return {
      content: [
        {
          text: message,
          type: 'text',
        },
      ],
    };
  }
}
