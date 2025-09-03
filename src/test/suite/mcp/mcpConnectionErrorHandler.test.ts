import { expect } from 'chai';
import { beforeEach } from 'mocha';
import { createMCPConnectionErrorHandler } from '../../../mcp/mcpConnectionErrorHandler';
import ConnectionController from '../../../connectionController';
import { ExtensionContextStub } from '../stubs';
import { StorageController } from '../../../storage';
import { TelemetryService } from '../../../telemetry';
import { StatusView } from '../../../views';
import type {
  ConnectionErrorHandled,
  ConnectionErrorHandlerContext,
} from '@himanshusinghs/mongodb-mcp-server';
import { ErrorCodes } from '@himanshusinghs/mongodb-mcp-server';

class MongoDBError extends Error {
  constructor(
    public code:
      | ErrorCodes.NotConnectedToMongoDB
      | ErrorCodes.MisconfiguredConnectionString,
    message: string,
  ) {
    super(message);
  }
}

suite('mcpConnectionErrorHandler suite', () => {
  let connectionController: ConnectionController;
  beforeEach(() => {
    const extensionContext = new ExtensionContextStub();
    const testStorageController = new StorageController(extensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContext,
    );
    connectionController = new ConnectionController({
      statusView: new StatusView(extensionContext),
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
  });

  test('should handle NotConnectedToMongoDB error', () => {
    const handler = createMCPConnectionErrorHandler(connectionController);
    const result = handler(
      new MongoDBError(
        ErrorCodes.NotConnectedToMongoDB,
        'Not connected to MongoDB',
      ),
      {} as ConnectionErrorHandlerContext,
    ) as ConnectionErrorHandled;

    expect(result.errorHandled).to.be.true;
    expect(result.result.content).to.deep.contain({
      type: 'text',
      text: 'You need to connect to a MongoDB instance before you can access its data.',
    });
  });

  test('should handle MisconfiguredConnectionString error', () => {
    const handler = createMCPConnectionErrorHandler(connectionController);
    const result = handler(
      new MongoDBError(
        ErrorCodes.MisconfiguredConnectionString,
        'Misconfigured MongoDB string',
      ),
      {} as ConnectionErrorHandlerContext,
    ) as ConnectionErrorHandled;

    expect(result.errorHandled).to.be.true;
    expect(result.result.content).to.deep.contain({
      type: 'text',
      text: 'MCP server is having trouble connecting to the selected connection in the MongoDB VSCode extension.',
    });
  });

  test('should not handle any other errors', () => {
    const handler = createMCPConnectionErrorHandler(connectionController);
    expect(
      handler(
        new MongoDBError(ErrorCodes.ForbiddenCollscan as any, 'Some error'),
        {} as any,
      ),
    ).to.deep.equal({
      errorHandled: false,
    });
    expect(handler(new Error('Some error') as any, {} as any)).to.deep.equal({
      errorHandled: false,
    });
  });
});
