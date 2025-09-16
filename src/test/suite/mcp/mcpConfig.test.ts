import type * as vscode from 'vscode';
import { expect } from 'chai';
import { getMCPConfigFromVSCodeSettings } from '../../../mcp/mcpConfig';

const vscMCPConfig = {
  'mdb.mcp.apiBaseUrl': 'https://cloud.mongodb.com/',
  'mdb.mcp.apiClientId': '',
  'mdb.mcp.apiClientSecret': '',
  'mdb.mcp.disabledTools': ['connect'],
  'mdb.mcp.readOnly': true, // note that we changed it to true
  'mdb.mcp.indexCheck': null, // note that this is null
  'mdb.mcp.server': 'ask',
  'mdb.mcp.exportsPath': '', // note that this is not modified
  'mdb.mcp.exportTimeoutMs': null, // note that this is set to null
  'mdb.mcp.exportCleanupIntervalMs': 0, // not that this is set to 0
} as const;

const getDefaultVSCodeConfigForMCP = (): vscode.WorkspaceConfiguration =>
  ({
    get(key: string) {
      return vscMCPConfig[`mdb.mcp.${key}`];
    },
    has(key: string) {
      return `mdb.mcp.${key}` in vscMCPConfig;
    },
  }) as unknown as vscode.WorkspaceConfiguration;

suite.only('MCPConfig test suite', () => {
  test('normal calls with package.json properties should return expected MCP config from the configured VSCode config', () => {
    const output = getMCPConfigFromVSCodeSettings(
      undefined,
      getDefaultVSCodeConfigForMCP,
    );
    expect(Object.keys(output)).to.not.contain('server');
    expect(output.apiBaseUrl).to.equal('https://cloud.mongodb.com/');
    expect(output.apiClientId).to.be.undefined;
    expect(output.apiClientSecret).to.be.undefined;
    expect(output.disabledTools).to.deep.equal(['connect']);
    expect(output.exportCleanupIntervalMs).to.equal(0);
    expect(output.exportTimeoutMs).to.equal(300000);
    expect(output.exportsPath?.endsWith('exports')).to.be.true;
    expect(output.indexCheck).to.be.false;
    expect(output.readOnly).to.be.true;
  });

  test('should return empty object if packageJsonConfiguredProperties resolves to empty object', () => {
    expect(
      getMCPConfigFromVSCodeSettings({}, getDefaultVSCodeConfigForMCP),
    ).to.deep.equal({});
  });

  suite('mcpConfigValues edge cases', () => {
    test('should handle non-string values for string properties', () => {
      const mockConfig = {
        'mdb.mcp.apiBaseUrl': 42,
        'mdb.mcp.apiClientId': true,
        'mdb.mcp.apiClientSecret': {},
        'mdb.mcp.exportsPath': [],
      };

      const getMockConfig = (): vscode.WorkspaceConfiguration =>
        ({
          get(key: string) {
            return mockConfig[`mdb.mcp.${key}`];
          },
          has(key: string) {
            return `mdb.mcp.${key}` in mockConfig;
          },
        }) as unknown as vscode.WorkspaceConfiguration;

      const output = getMCPConfigFromVSCodeSettings(undefined, getMockConfig);

      // All should fall back to defaults since they're not valid strings
      expect(output.apiBaseUrl).to.equal('https://cloud.mongodb.com/');
      expect(output.apiClientId).to.be.undefined;
      expect(output.apiClientSecret).to.be.undefined;
      expect(output.exportsPath?.endsWith('exports')).to.be.true;
    });

    test('should handle whitespace-only string values', () => {
      const mockConfig = {
        'mdb.mcp.apiBaseUrl': '   ',
        'mdb.mcp.apiClientId': '\t\t',
        'mdb.mcp.apiClientSecret': '\n\n',
        'mdb.mcp.exportsPath': '',
      };

      const getMockConfig = (): vscode.WorkspaceConfiguration =>
        ({
          get(key: string) {
            return mockConfig[`mdb.mcp.${key}`];
          },
          has(key: string) {
            return `mdb.mcp.${key}` in mockConfig;
          },
        }) as unknown as vscode.WorkspaceConfiguration;

      const output = getMCPConfigFromVSCodeSettings(undefined, getMockConfig);

      // All should fall back to defaults since trimmed values are empty
      expect(output.apiBaseUrl).to.equal('https://cloud.mongodb.com/');
      expect(output.apiClientId).to.be.undefined;
      expect(output.apiClientSecret).to.be.undefined;
      expect(output.exportsPath?.endsWith('exports')).to.be.true;
    });

    test('should properly trim and return valid string values', () => {
      const mockConfig = {
        'mdb.mcp.apiBaseUrl': '  https://custom.mongodb.com  ',
        'mdb.mcp.apiClientId': '\tcustom-client-id\t',
        'mdb.mcp.apiClientSecret': '\ncustom-secret\n',
        'mdb.mcp.exportsPath': '  /custom/path  ',
      };

      const getMockConfig = (): vscode.WorkspaceConfiguration =>
        ({
          get(key: string) {
            return mockConfig[`mdb.mcp.${key}`];
          },
          has(key: string) {
            return `mdb.mcp.${key}` in mockConfig;
          },
        }) as unknown as vscode.WorkspaceConfiguration;

      const output = getMCPConfigFromVSCodeSettings(undefined, getMockConfig);

      // Should return the trimmed original values
      expect(output.apiBaseUrl).to.equal('https://custom.mongodb.com');
      expect(output.apiClientId).to.equal('custom-client-id');
      expect(output.apiClientSecret).to.equal('custom-secret');
      expect(output.exportsPath).to.equal('/custom/path');
    });

    test('should handle non-array values for disabledTools', () => {
      const mockConfig = {
        'mdb.mcp.disabledTools': 'not-an-array',
      };

      const getMockConfig = (): vscode.WorkspaceConfiguration =>
        ({
          get(key: string) {
            return mockConfig[`mdb.mcp.${key}`];
          },
          has(key: string) {
            return `mdb.mcp.${key}` in mockConfig;
          },
        }) as unknown as vscode.WorkspaceConfiguration;

      const output = getMCPConfigFromVSCodeSettings(undefined, getMockConfig);

      // Should fall back to default disabledTools array
      expect(output.disabledTools).to.be.an('array');
      expect(output.disabledTools).to.deep.equal([]);
    });
  });
});
