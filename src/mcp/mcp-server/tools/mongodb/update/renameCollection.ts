import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { DbOperationArgs, MongoDBToolBase } from '../mongodbTool';
import type { ToolArgs, OperationType } from '../../tool';

export class RenameCollectionTool extends MongoDBToolBase {
  protected name = 'rename-collection';
  protected description = 'Renames a collection in a MongoDB database';
  protected argsShape = {
    ...DbOperationArgs,
    newName: z.string().describe('The new name for the collection'),
    dropTarget: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, drops the target collection if it exists'),
  };
  protected operationType: OperationType = 'update';

  protected async execute({
    database,
    collection,
    newName,
    dropTarget,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const provider = await this.ensureConnected();

    console.log(dropTarget);

    const result = await provider.renameCollection(
      this.namespace(database, collection),
      newName,
    );

    return {
      content: [
        {
          text: `Collection "${collection}" renamed to "${result.collectionName}" in database "${database}".`,
          type: 'text',
        },
      ],
    };
  }

  protected handleError(
    error: unknown,
    args: ToolArgs<typeof this.argsShape>,
  ): Promise<CallToolResult> | CallToolResult {
    if (error instanceof Error && 'codeName' in error) {
      switch (error.codeName) {
        case 'NamespaceNotFound':
          return {
            content: [
              {
                text: `Cannot rename "${args.database}.${args.collection}" because it doesn't exist.`,
                type: 'text',
              },
            ],
          };
        case 'NamespaceExists':
          return {
            content: [
              {
                text: `Cannot rename "${args.database}.${args.collection}" to "${args.newName}" because the target collection already exists. If you want to overwrite it, set the "dropTarget" argument to true.`,
                type: 'text',
              },
            ],
          };
        default:
          break;
      }
    }

    return super.handleError(error, args);
  }
}
