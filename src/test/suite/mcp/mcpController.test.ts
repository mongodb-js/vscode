import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { afterEach, beforeEach } from 'mocha';
import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ExtensionContextStub } from '../stubs';
import { MCPController } from '../../../mcp/mcpController';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TelemetryService } from '../../../telemetry';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { waitFor } from '../waitFor';

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createConnectedMCPClient(
  clientName: string,
  mcpController: MCPController,
): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
  closeClient: () => Promise<void>;
}> {
  const httpServerDefinition: vscode.McpHttpServerDefinition = (
    mcpController as any
  ).getServerConfig();
  expect(httpServerDefinition).to.not.be.undefined;
  const { uri, headers } = httpServerDefinition;
  const transport = new StreamableHTTPClientTransport(new URL(uri.toString()), {
    requestInit: {
      headers: headers,
    },
  });
  const client = new Client({ name: clientName, version: '1.0.0' });
  await client.connect(transport);
  return {
    client,
    transport,
    async closeClient(): Promise<void> {
      await transport.terminateSession();
      await client.close();
    },
  };
}

const sandbox = sinon.createSandbox();
suite('MCPController test suite', function () {
  this.timeout(10_000);
  let connectionController: ConnectionController;
  let mcpController: MCPController;

  let mcpAutoStartValue: string | null | undefined;
  let getConfigurationStub: SinonStub;
  let updateConfigurationStub: SinonStub;

  let showInformationSelection: string | undefined;
  let showInformationMessageStub: SinonStub;
  let showInformationCalledNotification: Promise<void>;

  let startServerStub: SinonStub;
  let startServerCalledNotification: Promise<void>;

  let stopServerStub: SinonStub;

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

    mcpController = new MCPController({
      context: extensionContext,
      connectionController: connectionController,
      getTelemetryAnonymousId: (): string => '1FOO',
    });

    // GetConfiguration Stubs
    mcpAutoStartValue = undefined;
    getConfigurationStub = sandbox.stub().callsFake((key) => {
      if (key === 'mdb.mcp.server') {
        return mcpAutoStartValue;
      }
    });
    updateConfigurationStub = sandbox.stub().callsFake((key, value) => {
      mcpAutoStartValue = value;
    });
    const fakeGetConfiguration = sandbox.fake.returns({
      get: getConfigurationStub,
      update: updateConfigurationStub,
    });
    sandbox.replace(vscode.workspace, 'getConfiguration', fakeGetConfiguration);

    // Show information message stubs
    showInformationSelection = undefined;
    let notifyInformationMessageVisible: (() => void) | undefined;
    showInformationCalledNotification = new Promise<void>((resolve) => {
      notifyInformationMessageVisible = resolve;
    });
    showInformationMessageStub = sandbox
      .stub(vscode.window, 'showInformationMessage')
      .callsFake(((): Promise<string | undefined> => {
        notifyInformationMessageVisible?.();
        return Promise.resolve(showInformationSelection);
      }) as unknown as any);

    // Other spies
    let notifyStartServerCalled: (() => void) | undefined;
    startServerCalledNotification = new Promise<void>((resolve) => {
      notifyStartServerCalled = resolve;
    });
    const originalStartServer = mcpController.startServer.bind(mcpController);
    startServerStub = sandbox
      .stub(mcpController, 'startServer')
      .callsFake((...args) => {
        notifyStartServerCalled?.();
        return originalStartServer(...args);
      });

    const originalStopServer = mcpController.stopServer.bind(mcpController);
    stopServerStub = sandbox
      .stub(mcpController, 'stopServer')
      .callsFake((...args) => {
        return originalStopServer(...args);
      });
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
    connectionController.clearAllConnections();
  });

  suite('on extension activate', function () {
    for (const { storedValue, migratedValue, expectMigration } of [
      { storedValue: 'ask', migratedValue: 'prompt', expectMigration: true },
      {
        storedValue: 'enabled',
        migratedValue: 'prompt',
        expectMigration: true,
      },
      {
        storedValue: 'prompt',
        migratedValue: 'prompt',
        expectMigration: false,
      },
    ]) {
      // eslint-disable-next-line no-loop-func
      suite(`if stored config "${storedValue}"`, function () {
        const testName = expectMigration
          ? `should migrate the stored value to "${migratedValue}", not show any auto start config popups and not start the server`
          : 'should keep the stored value as it is, not show any auto-start config popups and not start the server';

        test(testName, async function () {
          mcpAutoStartValue = storedValue;
          await mcpController.activate();

          // Update configuration is called anyways
          if (expectMigration) {
            expect(updateConfigurationStub).to.be.calledWithExactly(
              'mdb.mcp.server',
              migratedValue,
              true,
            );
            expect(mcpAutoStartValue).to.equal(migratedValue);
          } else {
            expect(updateConfigurationStub).to.not.be.called;
            expect(mcpAutoStartValue).to.equal(storedValue);
          }

          expect(showInformationMessageStub).to.not.be.called;

          // A small timeout to ensure the background tasks did happen
          await timeout(10);
          expect(startServerStub).to.not.be.called;
          // Open server config will return false when server is not already running
          expect(await mcpController.openServerConfig()).to.be.false;
        });
      });
    }

    suite('if stored config "autoStartEnabled"', function () {
      test('should keep the stored value as it is, not show any auto-start config popups and start the server', async function () {
        mcpAutoStartValue = 'autoStartEnabled';
        await mcpController.activate();

        // A small timeout to ensure the background tasks did happen
        await timeout(10);
        expect(startServerStub).to.be.called;
        // Open server config will return true when server is running
        expect(await mcpController.openServerConfig()).to.be.true;

        // no popup shown
        expect(showInformationMessageStub).to.not.be.called;
      });
    });

    for (const storedValue of ['anything-else', null]) {
      // eslint-disable-next-line no-loop-func
      suite(`if stored config "${storedValue ?? 'null'}"`, function () {
        test('should keep the stored value as it is, not show any auto-start config popups and not start the server', async function () {
          mcpAutoStartValue = storedValue;
          await mcpController.activate();

          expect(updateConfigurationStub).to.not.be.called;

          // A small timeout to ensure the background tasks did happen
          await timeout(10);
          expect(startServerStub).to.not.be.called;
          // Open server config will return true when server is running
          expect(await mcpController.openServerConfig()).to.be.false;

          // no popup shown
          expect(showInformationMessageStub).to.not.be.called;
        });
      });
    }

    for (const { storedValue, migratedValue, expectMigration } of [
      {
        storedValue: 'disabled',
        migratedValue: 'autoStartDisabled',
        expectMigration: true,
      },
      {
        storedValue: 'autoStartDisabled',
        migratedValue: 'autoStartDisabled',
        expectMigration: false,
      },
    ]) {
      // eslint-disable-next-line no-loop-func
      suite(`if stored config "${storedValue}"`, function () {
        const testName = expectMigration
          ? `should migrate the stored value to "${migratedValue}", not show any auto start config popups and not start the server`
          : 'should keep the stored value as it is, not show any auto-start config popups and not start the server';

        test(testName, async function () {
          mcpAutoStartValue = storedValue;
          await mcpController.activate();

          if (expectMigration) {
            expect(updateConfigurationStub).to.be.calledWithExactly(
              'mdb.mcp.server',
              migratedValue,
              true,
            );
            expect(mcpAutoStartValue).to.equal(migratedValue);
          }

          // A small timeout to ensure the background tasks did happen
          await timeout(10);
          expect(startServerStub).to.not.be.called;
          // Open server config will return true when server is running
          expect(await mcpController.openServerConfig()).to.be.false;

          // no popup shown
          expect(showInformationMessageStub).to.not.be.called;
        });
      });
    }
  });

  suite('autostart config popup', function () {
    suite('popup visibility', function () {
      suite('if server is running and a connection is connected', function () {
        for (const storedValue of ['ask', 'enabled', 'prompt']) {
          // eslint-disable-next-line no-loop-func
          suite(`if stored config is "${storedValue}"`, function () {
            test('should show the auto start config prompt with two action buttons', async function () {
              mcpAutoStartValue = storedValue;
              await mcpController.activate();
              await timeout(10);

              await mcpController.startServer();

              await connectionController.addNewConnectionStringAndConnect({
                connectionString: TEST_DATABASE_URI,
              });
              await timeout(10);

              await showInformationCalledNotification;
              expect(showInformationMessageStub).to.be.calledWithExactly(
                'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
                'Auto-Start',
                'Never',
              );
            });
          });
        }
      });

      suite(
        'if server is not running and a connection is connected',
        function () {
          for (const storedValue of ['ask', 'enabled', 'prompt']) {
            // eslint-disable-next-line no-loop-func
            suite(`if stored config is "${storedValue}"`, function () {
              test('should show the auto start config prompt with three action buttons', async function () {
                mcpAutoStartValue = storedValue;
                await mcpController.activate();
                await timeout(10);

                await connectionController.addNewConnectionStringAndConnect({
                  connectionString: TEST_DATABASE_URI,
                });
                await timeout(10);

                await showInformationCalledNotification;
                expect(showInformationMessageStub).to.be.calledWithExactly(
                  'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
                  'Auto-Start',
                  'Start Once',
                  'Never',
                );
              });
            });
          }
        },
      );

      suite(
        'regardless of server state, if a connection is disconnected',
        function () {
          for (const storedValue of ['ask', 'enabled', 'prompt']) {
            // eslint-disable-next-line no-loop-func
            suite(`if stored config is "${storedValue}"`, function () {
              test('should not show the auto start config prompt', async function () {
                mcpAutoStartValue = storedValue;
                await mcpController.activate();
                await timeout(10);

                await mcpController.startServer();

                await connectionController.addNewConnectionStringAndConnect({
                  connectionString: TEST_DATABASE_URI,
                });
                await timeout(10);

                expect(showInformationMessageStub).to.be.calledWithExactly(
                  'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
                  'Auto-Start',
                  'Never',
                );

                await connectionController.disconnect();
                await timeout(10);
                // Only once and that too from before.
                expect(showInformationMessageStub).to.be.calledWithExactly(
                  'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
                  'Auto-Start',
                  'Never',
                );
              });
            });
          }
        },
      );
    });

    suite('popup actions', function () {
      suite('when user clicks on "Auto-Start"', function () {
        test('should start the server and configure MCP server to auto-start', async function () {
          mcpAutoStartValue = 'prompt';
          showInformationSelection = 'Auto-Start';
          await mcpController.activate();

          await connectionController.addNewConnectionStringAndConnect({
            connectionString: TEST_DATABASE_URI,
          });

          await showInformationCalledNotification;
          expect(showInformationMessageStub).to.be.calledWithExactly(
            'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
            'Auto-Start',
            'Start Once',
            'Never',
          );

          await timeout(10);
          // Server should've been started by now after popup selection
          expect(startServerStub).to.have.been.called;
          expect(await mcpController.openServerConfig()).to.be.true;

          expect(updateConfigurationStub).to.have.been.calledWithExactly(
            'mdb.mcp.server',
            'autoStartEnabled',
            true,
          );
          expect(mcpAutoStartValue).to.equal('autoStartEnabled');
        });
      });

      suite('when user clicks on "Start Once"', function () {
        test('should start the server once and not configure MCP server auto-start', async function () {
          mcpAutoStartValue = 'prompt';
          showInformationSelection = 'Start Once';
          await mcpController.activate();

          await connectionController.addNewConnectionStringAndConnect({
            connectionString: TEST_DATABASE_URI,
          });

          await showInformationCalledNotification;
          expect(showInformationMessageStub).to.be.calledWithExactly(
            'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
            'Auto-Start',
            'Start Once',
            'Never',
          );

          await timeout(10);
          // Server should've been started by now after popup selection
          expect(startServerStub).to.have.been.called;
          expect(await mcpController.openServerConfig()).to.be.true;

          expect(updateConfigurationStub).to.not.have.been.called;
          expect(mcpAutoStartValue).to.equal('prompt');
        });
      });

      suite('when user clicks on "Never"', function () {
        test('should not start the server and configure MCP server to never auto-start', async function () {
          mcpAutoStartValue = 'prompt';
          showInformationSelection = 'Never';
          await mcpController.activate();

          await connectionController.addNewConnectionStringAndConnect({
            connectionString: TEST_DATABASE_URI,
          });

          await showInformationCalledNotification;
          expect(showInformationMessageStub).to.be.calledWithExactly(
            'Would you like to automatically start the MongoDB MCP server for a streamlined experience? When started, the server will automatically connect to your active MongoDB instance.',
            'Auto-Start',
            'Start Once',
            'Never',
          );

          await timeout(10);
          // Server should've been started by now
          expect(startServerStub).to.not.have.been.called;
          expect(await mcpController.openServerConfig()).to.be.false;

          expect(updateConfigurationStub).to.have.been.calledWithExactly(
            'mdb.mcp.server',
            'autoStartDisabled',
            true,
          );
          expect(mcpAutoStartValue).to.equal('autoStartDisabled');
        });
      });
    });
  });

  suite('MCP commands handlers', function () {
    suite('when MCP server is not running', function () {
      test('"startServer" should start the server', async function () {
        mcpAutoStartValue = 'autoStartDisabled';
        await mcpController.activate();
        // Server is not running
        expect(await mcpController.openServerConfig()).to.be.false;

        await mcpController.startServer();
        // Assert no side effects or attempt to close previous runs
        expect(stopServerStub).to.not.have.been.called;
        expect(await mcpController.openServerConfig()).to.be.true;
      });

      test('"stopServer" should do nothing', async function () {
        mcpAutoStartValue = 'autoStartDisabled';
        await mcpController.activate();
        // Server not running
        expect(await mcpController.openServerConfig()).to.be.false;

        await mcpController.stopServer();
        // Server not running
        expect(await mcpController.openServerConfig()).to.be.false;
      });
    });

    suite('when MCP server is running', function () {
      test('"startServer" should do nothing', async function () {
        mcpAutoStartValue = 'autoStartEnabled';
        await mcpController.activate();
        // Assert no side effects or attempt to close previous runs
        expect(stopServerStub).to.not.have.been.called;
        expect(await mcpController.openServerConfig()).to.be.true;

        await mcpController.startServer();
        // Assert no side effects or attempt to close previous runs
        expect(stopServerStub).to.not.have.been.called;
        expect(await mcpController.openServerConfig()).to.be.true;
      });

      test('"stopServer" should stop the server', async function () {
        mcpAutoStartValue = 'autoStartEnabled';
        await mcpController.activate();
        // Server is running
        expect(await mcpController.openServerConfig()).to.be.true;

        await mcpController.stopServer();
        // Not anymore
        expect(await mcpController.openServerConfig()).to.be.false;
      });
    });
  });

  suite('clients connection handling', function () {
    suite('when there is an active connection in VSCode', function () {
      test('connected clients should be able to query mongodb', async function () {
        mcpAutoStartValue = 'autoStartEnabled';
        // Connect already
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
        await mcpController.activate();

        const { client: firstClient } = await createConnectedMCPClient(
          'firstClient',
          mcpController,
        );
        const { client: secondClient } = await createConnectedMCPClient(
          'secondClient',
          mcpController,
        );

        const [firstResponse, secondResponse] = await Promise.all([
          firstClient.callTool({
            name: 'list-databases',
            arguments: {},
          }),
          secondClient.callTool({
            name: 'list-databases',
            arguments: {},
          }),
        ]);

        expect(JSON.stringify(firstResponse.content)).to.contain(
          'Found 3 databases',
        );
        expect(JSON.stringify(secondResponse.content)).to.contain(
          'Found 3 databases',
        );
      });
    });

    suite(
      'when connection state changes from connected to disconnected',
      function () {
        test('connected clients should get responded with no connection response', async function () {
          mcpAutoStartValue = 'autoStartEnabled';
          // Connect already
          await connectionController.addNewConnectionStringAndConnect({
            connectionString: TEST_DATABASE_URI,
          });
          await mcpController.activate();

          const { client: firstClient } = await createConnectedMCPClient(
            'firstClient',
            mcpController,
          );
          const { client: secondClient } = await createConnectedMCPClient(
            'secondClient',
            mcpController,
          );

          let [firstResponse, secondResponse] = await Promise.all([
            firstClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
            secondClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
          ]);

          expect(JSON.stringify(firstResponse.content)).to.contain(
            'Found 3 databases',
          );
          expect(JSON.stringify(secondResponse.content)).to.contain(
            'Found 3 databases',
          );

          // Now disconnect
          await connectionController.disconnect();

          // Next call should respond back with disconnected content
          [firstResponse, secondResponse] = await Promise.all([
            firstClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
            secondClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
          ]);

          expect(JSON.stringify(firstResponse.content)).to.contain(
            'You need to connect to a MongoDB instance before you can access its data.',
          );
          expect(JSON.stringify(secondResponse.content)).to.contain(
            'You need to connect to a MongoDB instance before you can access its data.',
          );
        });
      },
    );

    suite(
      'when connection state changes from disconnected to connected',
      function () {
        test('connected clients should be able to query mongodb', async function () {
          mcpAutoStartValue = 'autoStartEnabled';

          await mcpController.activate();

          const { client: firstClient } = await createConnectedMCPClient(
            'firstClient',
            mcpController,
          );
          const { client: secondClient } = await createConnectedMCPClient(
            'secondClient',
            mcpController,
          );

          let [firstResponse, secondResponse] = await Promise.all([
            firstClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
            secondClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
          ]);

          expect(JSON.stringify(firstResponse.content)).to.contain(
            'You need to connect to a MongoDB instance before you can access its data.',
          );
          expect(JSON.stringify(secondResponse.content)).to.contain(
            'You need to connect to a MongoDB instance before you can access its data.',
          );

          // Now connect
          await connectionController.addNewConnectionStringAndConnect({
            connectionString: TEST_DATABASE_URI,
          });

          // A little timeout
          await timeout(100);

          // Next call should respond back with disconnected content
          [firstResponse, secondResponse] = await Promise.all([
            firstClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
            secondClient.callTool({
              name: 'list-databases',
              arguments: {},
            }),
          ]);

          expect(JSON.stringify(firstResponse.content)).to.contain(
            'Found 3 databases',
          );
          expect(JSON.stringify(secondResponse.content)).to.contain(
            'Found 3 databases',
          );
        });
      },
    );

    suite('when MCP server shuts down', function () {
      test('should terminate individual client connections and clear up the internal connection manager state', async function () {
        mcpAutoStartValue = 'autoStartEnabled';
        // Connect already in VSCode
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
        await mcpController.activate();
        await timeout(100);

        // Construct our MCP clients connected to the VSCode MCP
        const { client: firstClient } = await createConnectedMCPClient(
          'firstClient',
          mcpController,
        );
        const { client: secondClient } = await createConnectedMCPClient(
          'secondClient',
          mcpController,
        );

        // Both clients are connected so both should be able to query MCP server
        let [firstClientResponse, secondClientResponse] = await Promise.all([
          firstClient.callTool({
            name: 'list-databases',
            arguments: {},
          }),
          secondClient.callTool({
            name: 'list-databases',
            arguments: {},
          }),
        ]);

        expect(JSON.stringify(firstClientResponse.content)).to.contain(
          'Found 3 databases',
        );
        expect(JSON.stringify(secondClientResponse.content)).to.contain(
          'Found 3 databases',
        );
        // There should be 2 connection managers for the two clients we created
        await waitFor(
          () => (mcpController as any).mcpConnectionManagers.length === 2,
        );

        // MCP server shuts down
        await mcpController.stopServer();

        [firstClientResponse, secondClientResponse] = await Promise.all([
          firstClient
            .callTool({ name: 'list-databases', arguments: {} })
            .catch((error) => error.message),
          secondClient
            .callTool({ name: 'list-databases', arguments: {} })
            .catch((error) => error.message),
        ]);
        // fetch would fail because server is not running
        expect(firstClientResponse).to.contain('fetch failed');
        expect(secondClientResponse).to.contain('fetch failed');

        // Cleanup that we are expecting
        await waitFor(
          () => (mcpController as any).mcpConnectionManagers.length === 0,
        );
      });
    });

    test('different clients should have their own connection state and not overstep each other', async function () {
      mcpAutoStartValue = 'autoStartEnabled';
      // Connect already in VSCode
      await connectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });
      await mcpController.activate();

      // Construct our MCP clients connected to the VSCode MCP
      const { client: firstClient } = await createConnectedMCPClient(
        'firstClient',
        mcpController,
      );
      const { client: secondClient, closeClient: closeSecondClient } =
        await createConnectedMCPClient('secondClient', mcpController);

      // Both clients are connected so both should be able to query MCP server
      let [firstResponse, secondResponse] = await Promise.all([
        firstClient.callTool({
          name: 'list-databases',
          arguments: {},
        }),
        secondClient.callTool({
          name: 'list-databases',
          arguments: {},
        }),
      ]);

      expect(JSON.stringify(firstResponse.content)).to.contain(
        'Found 3 databases',
      );
      expect(JSON.stringify(secondResponse.content)).to.contain(
        'Found 3 databases',
      );

      // Closing second client to test that it clears up and not affect the
      // first client
      await closeSecondClient();
      await waitFor(() => {
        return (mcpController as any).mcpConnectionManagers.length === 1;
      });

      // Second client is closed but the first should still get a response
      [firstResponse, secondResponse] = await Promise.all([
        firstClient.callTool({
          name: 'list-databases',
          arguments: {},
        }),
        secondClient
          .callTool({
            name: 'list-databases',
            arguments: {},
          })
          .catch((error) => error.message),
      ]);
      // Only first client responds with actual tool response
      expect(JSON.stringify(firstResponse.content)).to.contain(
        'Found 3 databases',
      );
      expect(secondResponse).to.contain('Not connected');

      // Another state change from VSCode
      await connectionController.disconnect();

      // A small timeout
      await timeout(10);

      // Second client is closed so that should respond with the error message
      // but the first client should get the disconnected response.
      [firstResponse, secondResponse] = await Promise.all([
        firstClient.callTool({
          name: 'list-databases',
          arguments: {},
        }),
        secondClient
          .callTool({
            name: 'list-databases',
            arguments: {},
          })
          .catch((error) => error.message),
      ]);
      // Only first client responds with actual tool response
      expect(JSON.stringify(firstResponse.content)).to.contain(
        'You need to connect to a MongoDB instance before you can access its data.',
      );
      expect(secondResponse).to.contain('Not connected');
    });
  });

  suite('#openServerConfig', function () {
    suite('when the server is not running', function () {
      test('should notify that server is not running', async function () {
        const showErrorMessageSpy = sandbox.spy(
          vscode.window,
          'showErrorMessage',
        );
        expect(await mcpController.openServerConfig()).to.equal(false);
        expect(showErrorMessageSpy).to.be.calledWith(
          'MongoDB MCP Server is not running. Start the server by running "MDB: Start MCP Server" in the command palette.',
        );
      });
    });

    suite('when the server is running', function () {
      test('should open the document with the server config', async function () {
        mcpAutoStartValue = 'autoStartEnabled';

        const showTextDocumentStub = sandbox.spy(
          vscode.window,
          'showTextDocument',
        );

        // Start the controller and listen to events
        await mcpController.activate();

        // Add a connection
        await connectionController.addNewConnectionStringAndConnect({
          connectionString: TEST_DATABASE_URI,
        });
        await startServerCalledNotification;
        expect(await mcpController.openServerConfig()).to.equal(true);
        expect(showTextDocumentStub).to.be.called;
      });
    });
  });
});
