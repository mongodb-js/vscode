import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { AtlasToolBase } from '../atlasTool';
import type { ToolArgs, OperationType } from '../../tool';

export class InspectAccessListTool extends AtlasToolBase {
  protected name = 'atlas-inspect-access-list';
  protected description =
    'Inspect Ip/CIDR ranges with access to your MongoDB Atlas clusters.';
  protected operationType: OperationType = 'read';
  protected argsShape = {
    projectId: z.string().describe('Atlas project ID'),
  };

  protected async execute({
    projectId,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const accessList = await this.session.apiClient.listProjectIpAccessLists({
      params: {
        path: {
          groupId: projectId,
        },
      },
    });

    if (!accessList?.results?.length) {
      throw new Error('No access list entries found.');
    }

    return {
      content: [
        {
          type: 'text',
          text: `IP ADDRESS | CIDR | COMMENT
------|------|------
${(accessList.results || [])
  .map((entry) => {
    return `${entry.ipAddress} | ${entry.cidrBlock} | ${entry.comment}`;
  })
  .join('\n')}`,
        },
      ],
    };
  }
}
