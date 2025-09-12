import { mongoLogId } from 'mongodb-log-writer';

export const MCPLogIds = {
  ConnectError: mongoLogId(2_000_001),
  DisconnectError: mongoLogId(2_000_002),
  UpdateConnectionError: mongoLogId(2_000_003),
} as const;
