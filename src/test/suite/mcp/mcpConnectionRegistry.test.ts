import { expect } from 'chai';
import type { Keychain } from '@mongodb-js/mcp-core';
import type { ConnectionManager } from '@mongodb-js/mcp-tools-mongodb';
import { VSCodeConnectionRegistry } from '../../../mcp/mcpConnectionRegistry';

const keychain = {
  redact: (value: unknown): unknown => value,
} as unknown as Keychain;

function createRegistry(): VSCodeConnectionRegistry {
  const manager = {
    clientName: 'test',
    currentConnectionState: { tag: 'disconnected' },
    disconnect: (): Promise<{ tag: 'disconnected' }> =>
      Promise.resolve({ tag: 'disconnected' }),
    connect: (): Promise<{ tag: 'disconnected' }> =>
      Promise.resolve({ tag: 'disconnected' }),
    close: (): Promise<void> => Promise.resolve(),
  } as unknown as ConnectionManager;

  return new VSCodeConnectionRegistry({ manager, keychain });
}

suite('VSCodeConnectionRegistry', function () {
  suite('#find', function () {
    test('returns the active connection when no predicate is given', async function () {
      const entries = await createRegistry().find();

      expect(entries).to.have.lengthOf(1);
    });

    test('returns the active connection when the predicate matches', async function () {
      const entries = await createRegistry().find(() => true);

      expect(entries).to.have.lengthOf(1);
    });

    test('returns no connections when the predicate rejects', async function () {
      const entries = await createRegistry().find(() => false);

      expect(entries).to.deep.equal([]);
    });
  });
});
