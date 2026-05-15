import * as fs from 'fs';
import * as os from 'os';
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
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');

function isClaudeCodeInstalled(): boolean {
  return !!vscode.extensions.getExtension(CLAUDE_CODE_EXTENSION_ID);
}

export class ClaudeCommandsController {
  private mcpController: MCPController;
  private _currentMcpServerName: string | null = null;

  constructor(mcpController: MCPController) {
    this.mcpController = mcpController;
  }

  activate(): void {
    // Claude Code reads ~/.claude.json for user-level MCP servers and
    // ~/.claude/commands/*.md for global slash commands.
    // We write/update both whenever the in-process HTTP server starts and
    // remove our entries when it stops. The server name is suffixed with the
    // port so multiple VS Code windows each own a distinct entry.

    if (isClaudeCodeInstalled() && this.mcpController.isServerRunning()) {
      this._syncGlobal();
    }

    this.mcpController.onDidChangeServer(() => {
      if (!isClaudeCodeInstalled()) return;
      this._syncGlobal();
    });
  }

  private _getMcpServerName(url: string): string {
    try {
      const port = new URL(url).port;
      return port ? `mongodb-${port}` : 'mongodb';
    } catch {
      return 'mongodb';
    }
  }

  private _syncGlobal(): void {
    const httpConfig = this.mcpController.getServerHttpConfig();
    if (httpConfig) {
      this._writeGlobalMcpJson(httpConfig);
      this._writeGlobalCommands();
    } else {
      this._removeGlobalMcpJsonEntry();
      this._removeGlobalCommands();
    }
  }

  private _writeGlobalMcpJson(httpConfig: {
    url: string;
    headers: Record<string, string>;
  }): void {
    const serverName = this._getMcpServerName(httpConfig.url);
    this._currentMcpServerName = serverName;

    let config: { mcpServers?: Record<string, unknown> } = {};
    try {
      if (fs.existsSync(CLAUDE_JSON_PATH)) {
        config = JSON.parse(
          fs.readFileSync(CLAUDE_JSON_PATH, 'utf8'),
        ) as typeof config;
      }
    } catch (err) {
      log.warn('Could not read ~/.claude.json, will overwrite mongodb entry', {
        err,
      });
    }

    config.mcpServers ??= {};
    config.mcpServers[serverName] = {
      type: 'http',
      url: httpConfig.url,
      headers: httpConfig.headers,
    };

    try {
      fs.writeFileSync(
        CLAUDE_JSON_PATH,
        JSON.stringify(config, null, 2) + '\n',
        {
          encoding: 'utf8',
          mode: 0o600,
        },
      );
      log.info('Wrote MongoDB MCP server config to ~/.claude.json', {
        serverName,
      });
    } catch (err) {
      log.error('Failed to write ~/.claude.json', { err });
    }
  }

  private _removeGlobalMcpJsonEntry(): void {
    const serverName = this._currentMcpServerName;
    if (!serverName || !fs.existsSync(CLAUDE_JSON_PATH)) return;

    let config: { mcpServers?: Record<string, unknown> };
    try {
      config = JSON.parse(
        fs.readFileSync(CLAUDE_JSON_PATH, 'utf8'),
      ) as typeof config;
    } catch (err) {
      log.warn('Could not parse ~/.claude.json on server stop', { err });
      return;
    }

    if (!config.mcpServers?.[serverName]) return;

    delete config.mcpServers[serverName];
    this._currentMcpServerName = null;

    try {
      fs.writeFileSync(
        CLAUDE_JSON_PATH,
        JSON.stringify(config, null, 2) + '\n',
        {
          encoding: 'utf8',
          mode: 0o600,
        },
      );
      log.info('Removed mongodb entry from ~/.claude.json', { serverName });
    } catch (err) {
      log.error('Failed to update ~/.claude.json on server stop', { err });
    }
  }

  private _writeGlobalCommands(): void {
    const commandsDir = path.join(CLAUDE_DIR, 'commands');
    try {
      fs.mkdirSync(commandsDir, { recursive: true });
    } catch (err) {
      log.warn('Could not create ~/.claude/commands directory', {
        commandsDir,
        err,
      });
      return;
    }
    for (const ToolClass of AllTools) {
      try {
        const filePath = path.join(
          commandsDir,
          'mongodb-' + ToolClass.toolName + '.md',
        );
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

  private _removeGlobalCommands(): void {
    const commandsDir = path.join(CLAUDE_DIR, 'commands');
    for (const ToolClass of AllTools) {
      try {
        const filePath = path.join(
          commandsDir,
          'mongodb-' + ToolClass.toolName + '.md',
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        log.warn('Could not remove command file', {
          tool: ToolClass.toolName,
          err,
        });
      }
    }
    log.info('Removed MongoDB slash command files', { commandsDir });
  }

  public reset(): void {
    this._removeGlobalMcpJsonEntry();
    this._removeGlobalCommands();
    if (this.mcpController.isServerRunning()) {
      this._syncGlobal();
    }
    void vscode.window.showInformationMessage(
      'MongoDB MCP Server Tools have been reset.',
    );
  }
}
