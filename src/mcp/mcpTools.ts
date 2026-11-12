import type { AnyToolClass, ZodRawShape } from '@mongodb-js/mcp-core';
import { AtlasTools } from '@mongodb-js/mcp-tools-atlas';
import { AtlasLocalTools } from '@mongodb-js/mcp-tools-atlas-local';
import { AssistantTools } from '@mongodb-js/mcp-tools-assistant';
import { MongoDBTools } from '@mongodb-js/mcp-tools-mongodb';
import type { ToolExecutionContext } from '@mongodb-js/mcp-types';
import { VSCODE_CONNECTION_ID } from './mcpConnectionRegistry';

const CONNECTION_ID_ARG = 'connectionId';

type AnyToolConstructor = new (arg: any) => any;

function hasConnectionIdArg(shape: ZodRawShape): boolean {
  return CONNECTION_ID_ARG in shape;
}

/**
 * Hides `connectionId` from the schema and injects the extension's active
 * connection before the tool runs, so the agent never has to pass one.
 */
function withActiveVSCodeConnection(Tool: AnyToolClass): AnyToolClass {
  const Base = Tool as unknown as AnyToolConstructor;

  class VSCodeConnectionTool extends Base {
    public argsShape(): ZodRawShape {
      const shape = super.argsShape() as ZodRawShape;
      if (!hasConnectionIdArg(shape)) {
        return shape;
      }

      const { [CONNECTION_ID_ARG]: _connectionId, ...rest } = shape;
      return rest;
    }

    protected execute(
      args: Record<string, unknown>,
      context: ToolExecutionContext,
    ): Promise<unknown> {
      const shape = super.argsShape() as ZodRawShape;
      const toolArgs = hasConnectionIdArg(shape)
        ? { ...args, [CONNECTION_ID_ARG]: VSCODE_CONNECTION_ID }
        : args;
      return super.execute(toolArgs, context);
    }
  }

  return VSCodeConnectionTool as unknown as AnyToolClass;
}

/** The full v3 tool set, scoped to the VSCode extension's active connection. */
export const MCPTools: AnyToolClass[] = [
  ...MongoDBTools,
  ...AtlasTools,
  ...AtlasLocalTools,
  ...AssistantTools,
].map(withActiveVSCodeConnection);
