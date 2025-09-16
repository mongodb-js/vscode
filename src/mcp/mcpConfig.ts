import {
  type UserConfig,
  configurableProperties,
  defaultUserConfig,
} from 'mongodb-mcp-server';
import * as vscode from 'vscode';
import { createLogger } from '../logging';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../package.json');

const logger = createLogger('mcp-config');

// eslint-disable-next-line complexity
function mcpConfigValues(property: string, configuredValue: unknown): unknown {
  switch (property) {
    case 'apiBaseUrl':
    case 'apiClientId':
    case 'apiClientSecret':
    case 'exportsPath':
      return String(configuredValue).trim()
        ? configuredValue
        : defaultUserConfig[property];
    case 'disabledTools':
      return Array.isArray(configuredValue)
        ? configuredValue
        : defaultUserConfig.disabledTools;
    case 'readOnly':
    case 'indexCheck':
    case 'exportTimeoutMs':
    case 'exportCleanupIntervalMs':
    default:
      return configuredValue ?? defaultUserConfig[property];
  }
}

export function getMCPConfigFromVSCodeSettings(
  packageJsonConfiguredProperties: Record<string, unknown> = contributes
    ?.configuration?.properties ?? {},
  retrieveMCPConfiguration: () => vscode.WorkspaceConfiguration = (): vscode.WorkspaceConfiguration =>
    vscode.workspace.getConfiguration('mdb.mcp'),
): Partial<UserConfig> {
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
        mcpConfigValues(property, configuredValue),
      ];
    }),
  );
}
