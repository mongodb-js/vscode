import {
  ErrorCodes,
  type ConnectionErrorHandler,
} from '@himanshusinghs/mongodb-mcp-server';
import type ConnectionController from '../connectionController';

export const createMCPConnectionErrorHandler = (
  connectionController: Pick<
    ConnectionController,
    'getSavedConnections' | 'getActiveConnectionName'
  >,
): ConnectionErrorHandler => {
  return (error) => {
    const activeConnectionName = connectionController.getActiveConnectionName();
    const availableConnections = connectionController
      .getSavedConnections()
      .map(({ name }) => ({ name }));

    const connectionGuidance: string[] = availableConnections.length
      ? [
          `Following connections are available in the Sidebar for the user to connect to: ${JSON.stringify(availableConnections)}. Note to LLM: Provide user with the list of connections available and ask them to select a connection in the Sidebar.`,
          'Note to LLM: Alternatively, if the user wish to establish a new MongoDB connection, then ask them to follow our official guide on the following link: https://www.mongodb.com/docs/mongodb-vscode/connect/#create-a-connection',
        ]
      : [
          'The user has no connections saved in their MongoDB Extension sidebar.',
          'Note to LLM: Ask the user to follow our official guide on the following link: https://www.mongodb.com/docs/mongodb-vscode/connect/#create-a-connection to connect to a MongoDB cluster.',
        ];

    switch (error.code) {
      case ErrorCodes.NotConnectedToMongoDB:
        return {
          errorHandled: true,
          result: {
            content: [
              {
                type: 'text',
                text: 'You need to connect to a MongoDB instance before you can access its data.',
              },
              ...connectionGuidance.map<{ type: 'text'; text: string }>(
                (text) => ({ type: 'text', text }),
              ),
            ],
          },
        };
      case ErrorCodes.MisconfiguredConnectionString: {
        const resolutionGuidance: string[] = [
          'Note to LLM: Ask the user to reconnect to the desired connection. If the problem persists even after that then advice them to raise an issue on the VSCode project board - https://github.com/mongodb-js/vscode/issues',
          ...connectionGuidance,
        ];
        return {
          errorHandled: true,
          result: {
            content: [
              {
                type: 'text',
                text: `MCP server is having trouble connecting to ${activeConnectionName ? activeConnectionName : 'the selected connection in the MongoDB VSCode extension'}.`,
              },
              ...resolutionGuidance.map<{ type: 'text'; text: string }>(
                (text) => ({ type: 'text', text }),
              ),
            ],
          },
        };
      }
      default:
        return {
          errorHandled: false,
        };
    }
  };
};
