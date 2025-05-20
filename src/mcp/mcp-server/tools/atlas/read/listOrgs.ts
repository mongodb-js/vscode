import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { AtlasToolBase } from '../atlasTool';
import type { OperationType } from '../../tool';

export class ListOrganizationsTool extends AtlasToolBase {
  protected name = 'atlas-list-orgs';
  protected description = 'List MongoDB Atlas organizations';
  protected operationType: OperationType = 'read';
  protected argsShape = {};

  protected async execute(): Promise<CallToolResult> {
    const data = await this.session.apiClient.listOrganizations();

    if (!data?.results?.length) {
      throw new Error('No projects found in your MongoDB Atlas account.');
    }

    // Format projects as a table
    const output =
      `Organization Name | Organization ID
----------------| ----------------
` +
      data.results
        .map((org) => {
          return `${org.name} | ${org.id}`;
        })
        .join('\n');
    return {
      content: [{ type: 'text', text: output }],
    };
  }
}
