import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';

export class CollectionStorageSizeTool extends MongoDBToolBase {
  protected name = 'collection-storage-size';
  protected description = 'Gets the size of the collection';
  protected argsShape = DbOperationArgs;

  protected operationType: OperationType = 'metadata';

  protected async execute({
    database,
    collection,
  }: ToolArgs<typeof DbOperationArgs>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const [{ value }] = (await provider.aggregate(
      this.namespace(database, collection),
      [
        { $collStats: { storageStats: {} } },
        { $group: { _id: null, value: { $sum: '$storageStats.size' } } },
      ],
    )) as [{ value: number }];

    const { units, value: scaledValue } =
      CollectionStorageSizeTool.getStats(value);

    return {
      content: [
        {
          text: `The size of "${database}.${collection}" is \`${scaledValue.toFixed(2)} ${units}\``,
          type: 'text',
        },
      ],
    };
  }

  protected handleError(
    error: unknown,
    args: ToolArgs<typeof this.argsShape>,
  ): Promise<CallToolResult> | CallToolResult {
    if (
      error instanceof Error &&
      'codeName' in error &&
      error.codeName === 'NamespaceNotFound'
    ) {
      return {
        content: [
          {
            text: `The size of "${args.database}.${args.collection}" cannot be determined because the collection does not exist.`,
            type: 'text',
          },
        ],
      };
    }

    return super.handleError(error, args);
  }

  private static getStats(value: number): { value: number; units: string } {
    const kb = 1024;
    const mb = kb * 1024;
    const gb = mb * 1024;

    if (value > gb) {
      return { value: value / gb, units: 'GB' };
    }

    if (value > mb) {
      return { value: value / mb, units: 'MB' };
    }
    if (value > kb) {
      return { value: value / kb, units: 'KB' };
    }
    return { value, units: 'bytes' };
  }
}
