import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { AtlasToolBase } from '../atlasTool';
import type { ToolArgs, OperationType } from '../../tool';
import type {
  PaginatedClusterDescription20240805,
  PaginatedOrgGroupView,
  Group,
  PaginatedFlexClusters20241113,
} from '../../../common/atlas/openapi';
import {
  formatCluster,
  formatFlexCluster,
} from '../../../common/atlas/cluster';

export class ListClustersTool extends AtlasToolBase {
  protected name = 'atlas-list-clusters';
  protected description = 'List MongoDB Atlas clusters';
  protected operationType: OperationType = 'read';
  protected argsShape = {
    projectId: z
      .string()
      .describe('Atlas project ID to filter clusters')
      .optional(),
  };

  protected async execute({
    projectId,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    if (!projectId) {
      const data = await this.session.apiClient.listClustersForAllProjects();

      return this.formatAllClustersTable(data);
    }
    const project = await this.session.apiClient.getProject({
      params: {
        path: {
          groupId: projectId,
        },
      },
    });

    if (!project?.id) {
      throw new Error(`Project with ID "${projectId}" not found.`);
    }

    const data = await this.session.apiClient.listClusters({
      params: {
        path: {
          groupId: project.id || '',
        },
      },
    });

    return this.formatClustersTable(project, data);
  }

  private formatAllClustersTable(
    clusters?: PaginatedOrgGroupView,
  ): CallToolResult {
    if (!clusters?.results?.length) {
      throw new Error('No clusters found.');
    }
    const formattedClusters = clusters.results
      .map((result) => {
        return (result.clusters || []).map((cluster) => {
          return { ...result, ...cluster, clusters: undefined };
        });
      })
      .flat();
    if (!formattedClusters.length) {
      throw new Error('No clusters found.');
    }
    const rows = formattedClusters
      .map((cluster) => {
        return `${cluster.groupName} (${cluster.groupId}) | ${cluster.name}`;
      })
      .join('\n');
    return {
      content: [
        {
          type: 'text',
          text: `Project | Cluster Name
----------------|----------------
${rows}`,
        },
      ],
    };
  }

  private formatClustersTable(
    project: Group,
    clusters?: PaginatedClusterDescription20240805,
    flexClusters?: PaginatedFlexClusters20241113,
  ): CallToolResult {
    // Check if both traditional clusters and flex clusters are absent
    if (!clusters?.results?.length && !flexClusters?.results?.length) {
      throw new Error('No clusters found.');
    }
    const formattedClusters =
      clusters?.results?.map((cluster) => formatCluster(cluster)) || [];
    const formattedFlexClusters =
      flexClusters?.results?.map((cluster) => formatFlexCluster(cluster)) || [];
    const rows = [...formattedClusters, ...formattedFlexClusters]
      .map((formattedCluster) => {
        return `${formattedCluster.name || 'Unknown'} | ${formattedCluster.instanceType} | ${formattedCluster.instanceSize || 'N/A'} | ${formattedCluster.state || 'UNKNOWN'} | ${formattedCluster.mongoDBVersion || 'N/A'} | ${formattedCluster.connectionString || 'N/A'}`;
      })
      .join('\n');
    return {
      content: [
        {
          type: 'text',
          text: `Here are your MongoDB Atlas clusters in project "${project.name}" (${project.id}):`,
        },
        {
          type: 'text',
          text: `Cluster Name | Cluster Type | Tier | State | MongoDB Version | Connection String
----------------|----------------|----------------|----------------|----------------|----------------
${rows}`,
        },
      ],
    };
  }
}
