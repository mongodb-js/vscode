import type { z, AnyZodObject } from 'zod';
import { type ZodRawShape, type ZodNever } from 'zod';
import type {
  McpServer,
  RegisteredTool,
  ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { Session } from '../session';
import logger, { LogId } from '../logger';
import type { Telemetry } from '../telemetry/telemetry';
import { type ToolEvent } from '../telemetry/types';
import type { UserConfig } from '../config';

export type ToolArgs<Args extends ZodRawShape> = z.objectOutputType<
  Args,
  ZodNever
>;

export type OperationType =
  | 'metadata'
  | 'read'
  | 'create'
  | 'delete'
  | 'update';
export type ToolCategory = 'mongodb' | 'atlas';
export type TelemetryToolMetadata = {
  projectId?: string;
  orgId?: string;
};

export abstract class ToolBase {
  protected abstract name: string;

  protected abstract category: ToolCategory;

  protected abstract operationType: OperationType;

  protected abstract description: string;

  protected abstract argsShape: ZodRawShape;

  protected abstract execute(
    ...args: Parameters<ToolCallback<typeof this.argsShape>>
  ): Promise<CallToolResult>;

  constructor(
    protected readonly session: Session,
    protected readonly config: UserConfig,
    protected readonly telemetry: Telemetry,
  ) {}

  public register(server: McpServer): void {
    if (!this.verifyAllowed()) {
      return;
    }

    const callback: ToolCallback<typeof this.argsShape> = async (...args) => {
      const startTime = Date.now();
      try {
        logger.debug(
          LogId.toolExecute,
          'tool',
          `Executing ${this.name} with args: ${JSON.stringify(args)}`,
        );

        const result = await this.execute(...args);
        await this.emitToolEvent(startTime, result, ...args).catch(() => {});
        return result;
      } catch (error: unknown) {
        logger.error(
          LogId.toolExecuteFailure,
          'tool',
          `Error executing ${this.name}: ${error as string}`,
        );
        const toolResult = await this.handleError(
          error,
          args[0] as ToolArgs<typeof this.argsShape>,
        );
        await this.emitToolEvent(startTime, toolResult, ...args).catch(
          () => {},
        );
        return toolResult;
      }
    };

    server.tool(this.name, this.description, this.argsShape, callback);

    // This is very similar to RegisteredTool.update, but without the bugs around the name.
    // In the upstream update method, the name is captured in the closure and not updated when
    // the tool name changes. This means that you only get one name update before things end up
    // in a broken state.
    this.update = (updates: {
      name?: string;
      description?: string;
      inputSchema?: AnyZodObject;
    }) => {
      const tools = (server as any)._registeredTools as {
        [toolName: string]: RegisteredTool;
      };
      const existingTool = tools[this.name];

      if (updates.name && updates.name !== this.name) {
        delete tools[this.name];
        this.name = updates.name;
        tools[this.name] = existingTool;
      }

      if (updates.description) {
        existingTool.description = updates.description;
        this.description = updates.description;
      }

      if (updates.inputSchema) {
        existingTool.inputSchema = updates.inputSchema;
      }

      server.sendToolListChanged();
    };
  }

  protected update?: (updates: {
    name?: string;
    description?: string;
    inputSchema?: AnyZodObject;
  }) => void;

  // Checks if a tool is allowed to run based on the config
  protected verifyAllowed(): boolean {
    let errorClarification: string | undefined;

    // Check read-only mode first
    if (
      this.config.readOnly &&
      !['read', 'metadata'].includes(this.operationType)
    ) {
      errorClarification = `read-only mode is enabled, its operation type, \`${this.operationType}\`,`;
    } else if (this.config.disabledTools.includes(this.category)) {
      errorClarification = `its category, \`${this.category}\`,`;
    } else if (this.config.disabledTools.includes(this.operationType)) {
      errorClarification = `its operation type, \`${this.operationType}\`,`;
    } else if (this.config.disabledTools.includes(this.name)) {
      errorClarification = 'it';
    }

    if (errorClarification) {
      logger.debug(
        LogId.toolDisabled,
        'tool',
        `Prevented registration of ${this.name} because ${errorClarification} is disabled in the config`,
      );

      return false;
    }

    return true;
  }

  // This method is intended to be overridden by subclasses to handle errors
  protected handleError(
    error: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    args: ToolArgs<typeof this.argsShape>,
  ): Promise<CallToolResult> | CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Error running ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }

  protected abstract resolveTelemetryMetadata(
    ...args: Parameters<ToolCallback<typeof this.argsShape>>
  ): TelemetryToolMetadata;

  /**
   * Creates and emits a tool telemetry event
   * @param startTime - Start time in milliseconds
   * @param result - Whether the command succeeded or failed
   * @param args - The arguments passed to the tool
   */
  private async emitToolEvent(
    startTime: number,
    result: CallToolResult,
    ...args: Parameters<ToolCallback<typeof this.argsShape>>
  ): Promise<void> {
    if (!this.telemetry.isTelemetryEnabled()) {
      return;
    }
    const duration = Date.now() - startTime;
    const metadata = this.resolveTelemetryMetadata(...args);
    const event: ToolEvent = {
      timestamp: new Date().toISOString(),
      source: 'mdbmcp',
      properties: {
        command: this.name,
        category: this.category,
        component: 'tool',
        duration_ms: duration,
        result: result.isError ? 'failure' : 'success',
      },
    };

    if (metadata?.orgId) {
      event.properties.org_id = metadata.orgId;
    }

    if (metadata?.projectId) {
      event.properties.project_id = metadata.projectId;
    }

    await this.telemetry.emitEvents([event]);
  }
}
