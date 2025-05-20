import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { AtlasToolBase } from '../atlasTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { Cluster } from '../../../common/atlas/cluster';
import { inspectCluster } from '../../../common/atlas/cluster';

export class InspectClusterTool extends AtlasToolBase {
  protected name = 'atlas-inspect-cluster';
  protected description = 'Inspect MongoDB Atlas cluster';
  protected operationType: OperationType = 'read';
  protected argsShape = {
    projectId: z.string().describe('Atlas project ID'),
    clusterName: z.string().describe('Atlas cluster name'),
  };

  protected async execute({
    projectId,
    clusterName,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const cluster = await inspectCluster(
      this.session.apiClient,
      projectId,
      clusterName,
    );

    return this.formatOutput(cluster);
  }

  private formatOutput(formattedCluster: Cluster): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Cluster Name | Cluster Type | Tier | State | MongoDB Version | Connection String
----------------|----------------|----------------|----------------|----------------|----------------
${formattedCluster.name || 'Unknown'} | ${formattedCluster.instanceType} | ${formattedCluster.instanceSize || 'N/A'} | ${formattedCluster.state || 'UNKNOWN'} | ${formattedCluster.mongoDBVersion || 'N/A'} | ${formattedCluster.connectionString || 'N/A'}`,
        },
      ],
    };
  }
}
