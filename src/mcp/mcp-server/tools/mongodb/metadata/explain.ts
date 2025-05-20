import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';
import { z } from 'zod';
import type { Document, Filter } from 'mongodb';
import { ExplainVerbosity } from 'mongodb';
import { AggregateArgs } from '../read/aggregate';
import { FindArgs } from '../read/find';
import { CountArgs } from '../read/count';

export class ExplainTool extends MongoDBToolBase {
  protected name = 'explain';
  protected description =
    'Returns statistics describing the execution of the winning plan chosen by the query optimizer for the evaluated method';

  protected argsShape = {
    ...DbOperationArgs,
    method: z
      .array(
        z.union([
          z.object({
            name: z.literal('aggregate'),
            arguments: z.object(AggregateArgs),
          }),
          z.object({
            name: z.literal('find'),
            arguments: z.object(FindArgs),
          }),
          z.object({
            name: z.literal('count'),
            arguments: z.object(CountArgs),
          }),
        ]),
      )
      .describe('The method and its arguments to run'),
  };

  protected operationType: OperationType = 'metadata';

  static readonly defaultVerbosity = ExplainVerbosity.queryPlanner;

  protected async execute({
    database,
    collection,
    method: methods,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const method = methods[0];

    if (!method) {
      throw new Error(
        'No method provided. Expected one of the following: `aggregate`, `find`, or `count`',
      );
    }

    let result: Document;
    switch (method.name) {
      case 'aggregate': {
        const { pipeline } = method.arguments;
        result = await provider.explainAggregate(
          this.namespace(database, collection),
          pipeline,
          {},
          {
            explainVerbosity: ExplainTool.defaultVerbosity,
          },
        );
        break;
      }
      case 'find': {
        const { filter, ...rest } = method.arguments;
        result = await provider.explainFind(
          this.namespace(database, collection),
          filter as Filter<Document>,
          {
            ...rest,
          },
          {
            explainVerbosity: ExplainTool.defaultVerbosity,
          },
        );
        break;
      }
      case 'count': {
        throw new Error('not implemented yet');
        // const { query } = method.arguments;
        // result = await provider._crudClient.db(database).command({
        //   explain: {
        //     count: collection,
        //     query,
        //   },
        //   verbosity: ExplainTool.defaultVerbosity,
        // });
        // break;
      }
      default:
        throw new Error(
          `Unsupported method "${(method as any).name}". Expected one of the following: \`aggregate\`, \`find\`, or \`count\``,
        );
    }

    return {
      content: [
        {
          text: `Here is some information about the winning plan chosen by the query optimizer for running the given \`${method.name}\` operation in "${database}.${collection}". This information can be used to understand how the query was executed and to optimize the query performance.`,
          type: 'text',
        },
        {
          text: JSON.stringify(result),
          type: 'text',
        },
      ],
    };
  }
}
