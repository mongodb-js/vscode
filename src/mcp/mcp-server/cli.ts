#!/usr/bin/env node

import logger, { LogId } from './logger';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { config } from './config';
import { Session } from './session';
import { Server } from './server';
import { packageInfo } from './helpers/packageInfo';
import { Telemetry } from './telemetry/telemetry';
import { createEJsonTransport } from './helpers/EJsonTransport';

async function main() {
  const session = new Session({
    apiBaseUrl: config.apiBaseUrl,
    apiClientId: config.apiClientId,
    apiClientSecret: config.apiClientSecret,
  });
  const mcpServer = new McpServer({
    name: packageInfo.mcpServerName,
    version: packageInfo.version,
  });

  const telemetry = Telemetry.create(session, config);

  const server = new Server({
    mcpServer,
    session,
    telemetry,
    userConfig: config,
  });

  const transport = createEJsonTransport();

  await server.connect(transport);
}

main().catch((error) => {
  logger.emergency(
    LogId.serverStartFailure,
    'server',
    `Fatal error running server: ${error as string}`,
  );
  process.exit(1);
});
