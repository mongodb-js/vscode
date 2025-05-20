// import packageJson from "../../package.json" with { type: "json" };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../../../package.json');

export const packageInfo = {
  version: packageJson.version,
  mcpServerName: 'MongoDB MCP Server',
};
