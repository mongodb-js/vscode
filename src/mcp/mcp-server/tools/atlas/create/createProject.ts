import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { AtlasToolBase } from '../atlasTool';
import type { ToolArgs, OperationType } from '../../tool';
import type { Group } from '../../../common/atlas/openapi';

export class CreateProjectTool extends AtlasToolBase {
  protected name = 'atlas-create-project';
  protected description = 'Create a MongoDB Atlas project';
  protected operationType: OperationType = 'create';
  protected argsShape = {
    projectName: z.string().optional().describe('Name for the new project'),
    organizationId: z
      .string()
      .optional()
      .describe('Organization ID for the new project'),
  };

  protected async execute({
    projectName,
    organizationId,
  }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
    let assumedOrg = false;

    if (!projectName) {
      projectName = 'Atlas Project';
    }

    if (!organizationId) {
      try {
        const organizations = await this.session.apiClient.listOrganizations();
        if (!organizations?.results?.length) {
          throw new Error(
            'No organizations were found in your MongoDB Atlas account. Please create an organization first.',
          );
        }
        organizationId = organizations.results[0].id;
        assumedOrg = true;
      } catch {
        throw new Error(
          'Could not search for organizations in your MongoDB Atlas account, please provide an organization ID or create one first.',
        );
      }
    }

    const input = {
      name: projectName,
      orgId: organizationId,
    } as Group;

    const group = await this.session.apiClient.createProject({
      body: input,
    });

    if (!group?.id) {
      throw new Error('Failed to create project');
    }

    return {
      content: [
        {
          type: 'text',
          text: `Project "${projectName}" created successfully${assumedOrg ? ` (using organizationId ${organizationId}).` : ''}.`,
        },
      ],
    };
  }
}
