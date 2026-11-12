import { type UserConfig, UserConfigSchema } from '@mongodb-js/mcp-cli';
import type { ServerMetadata } from '@mongodb-js/mcp-types';
import * as vscode from 'vscode';
import { createLogger } from '../logging';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contributes, dependencies } = require('../../package.json');

/** Version is read from the pinned `@mongodb-js/mcp-*` dependency so it can't drift. */
export const MCP_SERVER_METADATA: ServerMetadata = {
  mcpServerName: 'mongodb-mcp-server',
  version: dependencies['@mongodb-js/mcp-cli'],
  engines: { node: '^22.20.0 || >=24' },
};

const logger = createLogger('mcp-config');

export function getMCPConfigFromVSCodeSettings(
  packageJsonConfiguredProperties: Record<string, unknown> = contributes
    ?.configuration?.properties ?? {},
  retrieveMCPConfiguration: () => vscode.WorkspaceConfiguration = (): vscode.WorkspaceConfiguration =>
    vscode.workspace.getConfiguration('mdb.mcp'),
): Partial<UserConfig> {
  const configurableProperties = Object.keys(UserConfigSchema.shape);

  // Keep only MCP-relevant keys; the VSCode config also exposes non-MCP keys such as `server`.
  const vscConfiguredProperties = Object.keys(packageJsonConfiguredProperties)
    .filter((key) => key.startsWith('mdb.mcp'))
    .map((key) => key.replace(/^mdb\.mcp\./, ''))
    .filter((property) => configurableProperties.includes(property));

  logger.debug('Will retrieve MCP config for the following properties', {
    vscConfiguredProperties,
  });

  const mcpConfiguration = retrieveMCPConfiguration();
  return Object.fromEntries(
    vscConfiguredProperties.map((property) => {
      const configuredValue = mcpConfiguration.get(property);
      return [
        property,
        // A null can be written directly in settings, so fall back to the expected default.
        mcpConfigValues(property as keyof UserConfig, configuredValue),
      ];
    }),
  );
}

const defaultUserConfig = UserConfigSchema.parse({});

function mcpConfigValues(
  property: keyof UserConfig,
  configuredValue: unknown,
): unknown {
  switch (property) {
    case 'apiBaseUrl':
    case 'apiClientId':
    case 'apiClientSecret':
    case 'exportsPath': {
      const trimmedValue = String(configuredValue).trim();
      return typeof configuredValue === 'string' && !!trimmedValue
        ? trimmedValue
        : defaultUserConfig[property];
    }
    case 'disabledTools':
      return Array.isArray(configuredValue)
        ? configuredValue
        : defaultUserConfig[property];
    case 'readOnly':
    case 'indexCheck':
    case 'exportTimeoutMs':
    case 'exportCleanupIntervalMs':
    default:
      return configuredValue ?? defaultUserConfig[property];
  }
}
