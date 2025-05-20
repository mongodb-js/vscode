import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { AtlasToolBase } from '../atlasTool';
import type { OperationType } from '../../tool';
import { z } from 'zod';
import type { ToolArgs } from '../../tool';

export class ListProjectsTool extends AtlasToolBase {
  protected name = 'atlas-list-projects';
  protected description = 'List MongoDB Atlas projects';
  protected operationType: OperationType = 'read';
  protected argsShape = {
    orgId: z
      .string()
      .describe('Atlas organization ID to filter projects')
      .optional(),
  };

  protected async execute({
    orgId,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    const orgData = await this.session.apiClient.listOrganizations();

    if (!orgData?.results?.length) {
      throw new Error('No organizations found in your MongoDB Atlas account.');
    }

    const orgs: Record<string, string> = orgData.results
      .map((org) => [org.id || '', org.name])
      .reduce((acc, [id, name]) => ({ ...acc, [id]: name }), {});

    const data = orgId
      ? await this.session.apiClient.listOrganizationProjects({
          params: {
            path: {
              orgId,
            },
          },
        })
      : await this.session.apiClient.listProjects();

    if (!data?.results?.length) {
      throw new Error('No projects found in your MongoDB Atlas account.');
    }

    // Format projects as a table
    const rows = data.results
      .map((project) => {
        const createdAt = project.created
          ? new Date(project.created).toLocaleString()
          : 'N/A';
        return `${project.name} | ${project.id} | ${orgs[project.orgId]} | ${project.orgId} | ${createdAt}`;
      })
      .join('\n');
    const formattedProjects = `Project Name | Project ID | Organization Name | Organization ID | Created At
----------------| ----------------| ----------------| ----------------| ----------------
${rows}`;
    return {
      content: [{ type: 'text', text: formattedProjects }],
    };
  }
}
