import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { MongoDBToolBase } from '../mongodbTool';
import type { OperationType } from '../../tool';

export class ListDatabasesTool extends MongoDBToolBase {
  protected name = 'list-databases';
  protected description = 'List all databases for a MongoDB connection';
  protected argsShape = {};

  protected operationType: OperationType = 'metadata';

  protected async execute(): Promise<CallToolResult> {
    const provider = await this.ensureConnected();
    const dbs = await provider.listDatabases();

    return {
      content: dbs.map((db) => {
        return {
          text: `Name: ${db.name}, Size: ${db.storage_size} bytes`,
          type: 'text',
        };
      }),
    };
  }
}
