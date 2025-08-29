import sinon from 'sinon';
import { afterEach, beforeEach } from 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { LoggerBase } from '@himanshusinghs/mongodb-mcp-server';
import type { ConnectionStateErrored } from '@himanshusinghs/mongodb-mcp-server';
import type { DevtoolsConnectOptions } from '@mongosh/service-provider-node-driver';
import { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';
import { MCPConnectionManager } from '../../../mcp/mcpConnectionManager';

chai.use(chaiAsPromised);

const sandbox = sinon.createSandbox();
suite.only('MCPConnectionManager Test Suite', function () {
  let mcpConnectionManager: MCPConnectionManager;
  let fakeServiceProvider: NodeDriverServiceProvider;

  beforeEach(() => {
    mcpConnectionManager = new MCPConnectionManager({
      error: () => {},
      warning: () => {},
    } as unknown as LoggerBase);
    fakeServiceProvider = {
      runCommand: (() =>
        Promise.resolve({})) as NodeDriverServiceProvider['runCommand'],
      close: (() => Promise.resolve()) as NodeDriverServiceProvider['close'],
    } as NodeDriverServiceProvider;
    sandbox
      .stub(NodeDriverServiceProvider, 'connect')
      .resolves(fakeServiceProvider);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  suite('#connect', function () {
    test('should throw an error', async function () {
      await expect(mcpConnectionManager.connect()).to.be.rejected;
    });
  });

  suite('#connectToVSCodeConnection', function () {
    test('should connect successfully and update the state', async function () {
      const newState = await mcpConnectionManager.connectToVSCodeConnection({
        connectionId: '1',
        connectionString: 'mongodb://localhost:27017',
        connectOptions: {} as unknown as DevtoolsConnectOptions,
      });

      expect(newState.tag).to.equal('connected');
      expect(mcpConnectionManager.currentConnectionState.tag).to.equal(
        'connected',
      );
    });

    test('should update the state when there is an error', async function () {
      fakeServiceProvider.runCommand = (() =>
        Promise.reject(
          new Error('Bad error'),
        )) as NodeDriverServiceProvider['runCommand'];
      const newState = (await mcpConnectionManager.connectToVSCodeConnection({
        connectionId: '1',
        connectionString: 'mongodb://localhost:27017',
        connectOptions: {} as unknown as DevtoolsConnectOptions,
      })) as ConnectionStateErrored;

      expect(newState.tag).to.equal('errored');
      expect(newState.errorReason).to.equal('Bad error');
      expect(mcpConnectionManager.currentConnectionState.tag).to.equal(
        'errored',
      );
      expect(
        (mcpConnectionManager.currentConnectionState as ConnectionStateErrored)
          .errorReason,
      ).to.equal('Bad error');
    });
  });

  suite('#disconnect', function () {
    test('should disconnect successfully and update the state', async function () {
      const newState = await mcpConnectionManager.connectToVSCodeConnection({
        connectionId: '1',
        connectionString: 'mongodb://localhost:27017',
        connectOptions: {} as unknown as DevtoolsConnectOptions,
      });

      expect(newState.tag).to.equal('connected');

      const nextState = await mcpConnectionManager.disconnect();
      expect(nextState.tag).to.equal('disconnected');
      expect(mcpConnectionManager.currentConnectionState.tag).to.equal(
        'disconnected',
      );
      expect((mcpConnectionManager as any).activeConnection).to.be.null;
    });

    test('should attempt to disconnect and on failure clear out the state', async function () {
      fakeServiceProvider.close = (() =>
        Promise.reject(
          new Error('Bad close error'),
        )) as NodeDriverServiceProvider['close'];
      const newState = await mcpConnectionManager.connectToVSCodeConnection({
        connectionId: '1',
        connectionString: 'mongodb://localhost:27017',
        connectOptions: {} as unknown as DevtoolsConnectOptions,
      });

      expect(newState.tag).to.equal('connected');

      const nextState = await mcpConnectionManager.disconnect();
      expect(nextState.tag).to.equal('disconnected');
      expect(mcpConnectionManager.currentConnectionState.tag).to.equal(
        'disconnected',
      );
      expect((mcpConnectionManager as any).activeConnection).to.be.null;
    });
  });

  suite('#updateConnection', function () {
    suite('when not connected to any connection', function () {
      test('should do nothing when invoked for a disconnected connection', async function () {
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');
        await mcpConnectionManager.updateConnection(undefined);

        expect(connectSpy).to.not.be.called;
        expect(disconnectSpy).to.not.be.called;
      });

      test('should switch to error state when invoked for an Atlas streams connection', async function () {
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');
        await mcpConnectionManager.updateConnection({
          connectionId: '1',
          connectionString:
            'mongodb://admin:catscatscats@atlas-stream-64ba1372b2a9f1545031f34d-gkumd.virginia-usa.a.query.mongodb.net/',
          connectOptions: {} as DevtoolsConnectOptions,
        });

        expect(connectSpy).to.not.be.called;
        expect(disconnectSpy).to.be.called;
        expect(mcpConnectionManager.currentConnectionState.tag).to.equal(
          'errored',
        );
        expect(
          (
            mcpConnectionManager.currentConnectionState as ConnectionStateErrored
          ).errorReason,
        ).to.equal(
          'MongoDB MCP server does not support connecting to Atlas Streams',
        );
      });

      test('should connect to the connection when invoked for a newly connected connection', async function () {
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');
        await mcpConnectionManager.updateConnection({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        expect(disconnectSpy).to.be.called;
        expect(connectSpy).to.be.calledWithExactly({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });
      });
    });

    suite('when already connected to a connection', function () {
      test('should do nothing when invoked for the already connected connection', async function () {
        await mcpConnectionManager.connectToVSCodeConnection({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        // now we setup spies
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');
        await mcpConnectionManager.updateConnection({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        expect(connectSpy).to.not.be.called;
        expect(disconnectSpy).to.not.be.called;
      });

      test('should disconnect and return early when invoked for a disconnected connection', async function () {
        await mcpConnectionManager.connectToVSCodeConnection({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        // now we setup spies
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');
        await mcpConnectionManager.updateConnection(undefined);

        expect(connectSpy).to.not.be.called;
        expect(disconnectSpy).to.be.called;
      });

      test('should switch to error state when invoked for an Atlas streams connection', async function () {
        await mcpConnectionManager.connectToVSCodeConnection({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        // now we setup spies
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');

        // update connection
        await mcpConnectionManager.updateConnection({
          connectionId: '2',
          connectionString:
            'mongodb://admin:catscatscats@atlas-stream-64ba1372b2a9f1545031f34d-gkumd.virginia-usa.a.query.mongodb.net/',
          connectOptions: {} as DevtoolsConnectOptions,
        });

        expect(disconnectSpy).to.be.called;
        expect(connectSpy).to.not.be.called;
        expect(mcpConnectionManager.currentConnectionState.tag).to.equal(
          'errored',
        );
        expect(
          (
            mcpConnectionManager.currentConnectionState as ConnectionStateErrored
          ).errorReason,
        ).to.equal(
          'MongoDB MCP server does not support connecting to Atlas Streams',
        );
      });

      test('should disconnect and attempt to connect to the new connection when invoked for a different connection', async function () {
        await mcpConnectionManager.connectToVSCodeConnection({
          connectionId: '1',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        // now we setup spies
        const connectSpy = sandbox.spy(
          mcpConnectionManager,
          'connectToVSCodeConnection',
        );
        const disconnectSpy = sandbox.spy(mcpConnectionManager, 'disconnect');
        await mcpConnectionManager.updateConnection({
          connectionId: '2',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });

        expect(disconnectSpy).to.be.called;
        expect(connectSpy).to.be.calledWithExactly({
          connectionId: '2',
          connectionString: 'mongodb://localhost:27017',
          connectOptions: {} as unknown as DevtoolsConnectOptions,
        });
      });
    });
  });
});
