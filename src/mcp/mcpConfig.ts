import { type UserConfig, UserConfigSchema } from 'mongodb-mcp-server';
import * as vscode from 'vscode';
import { createLogger } from '../logging';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../package.json');

const logger = createLogger('mcp-config');
const defaultUserConfig = UserConfigSchema.parse({});

export function getMCPConfigFromVSCodeSettings(
  packageJsonConfiguredProperties: Record<string, unknown> = contributes
    ?.configuration?.properties ?? {},
  retrieveMCPConfiguration: () => vscode.WorkspaceConfiguration = (): vscode.WorkspaceConfiguration =>
    vscode.workspace.getConfiguration('mdb.mcp'),
): Partial<UserConfig> {
  const configurableProperties = new Set(Object.keys(UserConfigSchema.shape));

  // We're attempting to:
  // 1. Use only the config values for MCP server exposed by VSCode config
  // 2. Use only the config values that are relevant for MCP server (all mcp
  //    config exposed by VSCode does contain some irrelevant config as well,
  //    such as `server`)
  const vscConfiguredProperties = Object.keys(packageJsonConfiguredProperties)
    .filter((key) => key.startsWith('mdb.mcp'))
    .map((key) => key.replace(/^mdb\.mcp\./, ''))
    .filter((property) => configurableProperties.has(property));

  logger.debug('Will retrieve MCP config for the following properties', {
    vscConfiguredProperties,
  });

  const mcpConfiguration = retrieveMCPConfiguration();
  return Object.fromEntries(
    vscConfiguredProperties.map((property) => {
      const configuredValue = mcpConfiguration.get(property);
      return [
        property,
        // Most of the MCP config, if not all, consists of non-null configs and it is
        // possible for a VSCode config to have a null value edited directly in the
        // settings file which is why to safeguard against incorrect values we map
        // them at-least to the expected defaults.
        mcpConfigValues(property as keyof UserConfig, configuredValue),
      ];
    }),
  );
}

// eslint-disable-next-line complexity
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
