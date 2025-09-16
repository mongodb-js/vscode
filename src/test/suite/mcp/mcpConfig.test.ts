import type * as vscode from 'vscode';
import { expect } from 'chai';
import { getMCPConfigFromVSCodeSettings } from '../../../mcp/mcpConfig';

const vscMCPConfig = {
  'mdb.mcp.apiBaseUrl': 'https://cloud.mongodb.com/',
  'mdb.mcp.apiClientId': '',
  'mdb.mcp.apiClientSecret': '',
  'mdb.mcp.disabledTools': ['connect'],
  'mdb.mcp.readOnly': false,
  'mdb.mcp.indexCheck': false,
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

suite('MCPConfig test suite', () => {
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
    expect(output.readOnly).to.be.false;
  });

  test('should return empty object if packageJsonConfiguredProperties resolves to empty object', () => {
    expect(
      getMCPConfigFromVSCodeSettings({}, getDefaultVSCodeConfigForMCP),
    ).to.deep.equal({});
  });
});
