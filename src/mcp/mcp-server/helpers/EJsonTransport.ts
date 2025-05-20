import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types';
import { EJSON } from 'bson';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

// This is almost a copy of ReadBuffer from @modelcontextprotocol/sdk
// but it uses EJSON.parse instead of JSON.parse to handle BSON types
export class EJsonReadBuffer {
  private _buffer?: Buffer;

  append(chunk: Buffer): void {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
  }

  readMessage(): JSONRPCMessage | null {
    if (!this._buffer) {
      return null;
    }

    const index = this._buffer.indexOf('\n');
    if (index === -1) {
      return null;
    }

    const line = this._buffer.toString('utf8', 0, index).replace(/\r$/, '');
    this._buffer = this._buffer.subarray(index + 1);

    // This is using EJSON.parse instead of JSON.parse to handle BSON types
    return JSONRPCMessageSchema.parse(EJSON.parse(line));
  }

  clear(): void {
    this._buffer = undefined;
  }
}

// This is a hacky workaround for https://github.com/mongodb-js/mongodb-mcp-server/issues/211
// The underlying issue is that StdioServerTransport uses JSON.parse to deserialize
// messages, but that doesn't handle bson types, such as ObjectId when serialized as EJSON.
//
// This function creates a StdioServerTransport and replaces the internal readBuffer with EJsonReadBuffer
// that uses EJson.parse instead.
export function createEJsonTransport(): StdioServerTransport {
  const server = new StdioServerTransport();
  (server as any)._readBuffer = new EJsonReadBuffer();

  return server;
}
