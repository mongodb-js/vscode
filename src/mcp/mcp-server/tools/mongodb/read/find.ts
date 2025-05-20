import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { Filter, SortDirection, Document } from 'mongodb';
import { EJSON } from 'bson';

export const FindArgs = {
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'The query filter, matching the syntax of the query argument of db.collection.find()',
    ),
  projection: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'The projection, matching the syntax of the projection argument of db.collection.find()',
    ),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe('The maximum number of documents to return'),
  sort: z
    .record(z.string(), z.custom<SortDirection>())
    .optional()
    .describe(
      'A document, describing the sort order, matching the syntax of the sort argument of cursor.sort()',
    ),
};

export class FindTool extends MongoDBToolBase {
  protected name = 'find';
  protected description = 'Run a find query against a MongoDB collection';
  protected argsShape = {
    ...DbOperationArgs,
    ...FindArgs,
  };
  protected operationType: OperationType = 'read';

  protected async execute({
    database,
    collection,
    filter,
    projection,
    limit,
    sort,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const documents = await provider.find(
      this.namespace(database, collection),
      filter as Filter<Document>,
      {
        projection,
        limit,
        sort,
      },
    );

    const content: Array<{ text: string; type: 'text' }> = [
      {
        text: `Found ${documents.length} documents in the collection "${collection}":`,
        type: 'text',
      },
      ...documents.map((doc) => {
        return {
          text: EJSON.stringify(doc),
          type: 'text',
        } as { text: string; type: 'text' };
      }),
    ];

    return {
      content,
    };
  }
}
