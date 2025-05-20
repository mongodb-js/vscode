import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import { EJSON } from 'bson';

export const AggregateArgs = {
  pipeline: z
    .array(z.record(z.string(), z.unknown()))
    .describe('An array of aggregation stages to execute'),
};

export class AggregateTool extends MongoDBToolBase {
  protected name = 'aggregate';
  protected description = 'Run an aggregation against a MongoDB collection';
  protected argsShape = {
    ...DbOperationArgs,
    ...AggregateArgs,
  };
  protected operationType: OperationType = 'read';

  protected async execute({
    database,
    collection,
    pipeline,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const documents = await provider.aggregate(
      this.namespace(database, collection),
      pipeline,
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
