import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { createLogger } from './logging';
import type { MCPController } from './mcp/mcpController';

// TODO: If mongodb-mcp-server exposed a callback like onServerCreated
// we could move all of this into ClaudeCommandsController
// and delete StreamableHttpRunnerWithPrompts entirely.
// Cleaner, but needs upstream API support that doesn't exist today.

// Inside registerMongoDBPrompts there's an even cleaner option:
// after super.createServerForRequest() the MCP SDK's McpServer already has all tools
// registered in its internal _registeredTools map, each entry having name, description,
// and a JSON Schema for inputs. We can iterate that instead of AllTools.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AllTools } = require('mongodb-mcp-server/tools') as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AllTools: Array<{
    toolName: string;
    category: string;
    operationType: string;
    new (p: any): { description: string };
  }>;
};

const log = createLogger('claudeCommandsController');

const CLAUDE_CODE_EXTENSION_ID = 'anthropic.claude-code';
const MCP_SERVER_NAME = 'mongodb';

function isClaudeCodeInstalled(): boolean {
  return !!vscode.extensions.getExtension(CLAUDE_CODE_EXTENSION_ID);
}

export class ClaudeCommandsController {
  private mcpController: MCPController;

  constructor(mcpController: MCPController) {
    this.mcpController = mcpController;
  }

  activate(): void {
    // Claude Code reads .mcp.json from workspace roots to discover MCP servers.
    // We write/update it whenever the in-process HTTP server starts, and remove
    // the mongodb entry when it stops. No connection string is written — the
    // running server manages the active VS Code connection internally.
    // Slash commands come from MCP prompts registered in StreamableHttpRunnerWithPrompts.

    // Case 1: workspace already open + server already running.
    if (isClaudeCodeInstalled() && this.mcpController.isServerRunning()) {
      for (const folder of this._fileFolders()) {
        this._syncFolder(folder.uri.fsPath);
      }
    }

    // Case 2: server starts or stops later ("Start Once" or deferred auto-start).
    this.mcpController.onDidChangeServer(() => {
      if (!isClaudeCodeInstalled()) return;
      for (const folder of this._fileFolders()) {
        this._syncFolder(folder.uri.fsPath);
      }
    });

    // Case 3: new workspace folder added while server is already running.
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      if (!isClaudeCodeInstalled() || !this.mcpController.isServerRunning()) {
        return;
      }
      for (const folder of event.added) {
        if (folder.uri.scheme === 'file') {
          this._syncFolder(folder.uri.fsPath);
        }
      }
    });
  }

  private _fileFolders(): readonly vscode.WorkspaceFolder[] {
    return (
      vscode.workspace.workspaceFolders?.filter(
        (f) => f.uri.scheme === 'file',
      ) ?? []
    );
  }

  private _syncFolder(folderPath: string): void {
    const httpConfig = this.mcpController.getServerHttpConfig();
    if (httpConfig) {
      this._writeMcpJson(folderPath, httpConfig);
      this._writeCommandsToFolder(folderPath);
    } else {
      this._removeMcpJsonEntry(folderPath);
    }
  }

  private _writeCommandsToFolder(folderPath: string): void {
    const commandsDir = path.join(folderPath, '.claude', 'commands');
    try {
      fs.mkdirSync(commandsDir, { recursive: true });
    } catch (err) {
      log.warn('Could not create .claude/commands directory', {
        commandsDir,
        err,
      });
      return;
    }
    for (const ToolClass of AllTools) {
      try {
        const filePath = path.join(commandsDir, ToolClass.toolName + '.md');
        if (fs.existsSync(filePath)) continue;
        // description is a hardcoded string in each subclass constructor body and does not use any constructor params
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { description } = new (ToolClass as any)({
          name: ToolClass.toolName,
          category: ToolClass.category,
          operationType: ToolClass.operationType,
          session: {},
          config: {},
          telemetry: {},
          elicitation: {},
          metrics: {},
        }) as { description: string };
        fs.writeFileSync(filePath, String(description) + '\n', 'utf8');
      } catch (err) {
        log.warn('Could not write command file', {
          tool: ToolClass.toolName,
          err,
        });
      }
    }
    log.info('Wrote MongoDB slash command files', { commandsDir });
  }

  private _writeMcpJson(
    folderPath: string,
    httpConfig: { url: string; headers: Record<string, string> },
  ): void {
    const mcpJsonPath = path.join(folderPath, '.mcp.json');

    let config: { mcpServers?: Record<string, unknown> } = {};
    try {
      if (fs.existsSync(mcpJsonPath)) {
        config = JSON.parse(
          fs.readFileSync(mcpJsonPath, 'utf8'),
        ) as typeof config;
      }
    } catch (err) {
      log.warn(
        'Could not read existing .mcp.json, will overwrite mongodb entry',
        { err },
      );
    }

    config.mcpServers ??= {};
    config.mcpServers[MCP_SERVER_NAME] = {
      type: 'http',
      url: httpConfig.url,
      headers: httpConfig.headers,
    };

    try {
      fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n', {
        encoding: 'utf8',
        mode: 0o600,
      });
      log.info('Wrote MongoDB MCP server config to .mcp.json', { mcpJsonPath });
    } catch (err) {
      log.error('Failed to write .mcp.json', { mcpJsonPath, err });
      return;
    }

    this._ensureGitignore(folderPath, '.mcp.json');
  }

  private _removeMcpJsonEntry(folderPath: string): void {
    const mcpJsonPath = path.join(folderPath, '.mcp.json');
    if (!fs.existsSync(mcpJsonPath)) return;

    let config: { mcpServers?: Record<string, unknown> };
    try {
      config = JSON.parse(
        fs.readFileSync(mcpJsonPath, 'utf8'),
      ) as typeof config;
    } catch (err) {
      log.warn('Could not parse .mcp.json on server stop', {
        mcpJsonPath,
        err,
      });
      return;
    }

    if (!config.mcpServers?.[MCP_SERVER_NAME]) return;

    delete config.mcpServers[MCP_SERVER_NAME];

    try {
      if (Object.keys(config.mcpServers).length === 0) {
        fs.unlinkSync(mcpJsonPath);
        log.info('Removed .mcp.json (no remaining MCP servers)', {
          mcpJsonPath,
        });
      } else {
        fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n', {
          encoding: 'utf8',
          mode: 0o600,
        });
        log.info('Removed mongodb entry from .mcp.json', { mcpJsonPath });
      }
    } catch (err) {
      log.error('Failed to update .mcp.json on server stop', {
        mcpJsonPath,
        err,
      });
    }
  }

  private _ensureGitignore(folderPath: string, entry: string): void {
    const gitignorePath = path.join(folderPath, '.gitignore');
    try {
      const existing = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, 'utf8')
        : '';
      if (existing.split('\n').some((l) => l.trim() === entry)) return;
      const separator = existing.length && !existing.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(gitignorePath, `${separator}${entry}\n`, 'utf8');
      log.info('Added .mcp.json to .gitignore', { gitignorePath });
    } catch (err) {
      log.warn('Could not update .gitignore', { gitignorePath, err });
    }
  }
}
