const template = `/* global sp */
// MongoDB Playground
// To disable this template go to Settings | MongoDB | Use Default Template For Playground.
// Make sure you are connected to enable completions and to be able to run a playground.
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.
// The result of the last command run in a playground is shown on the results panel.
// Use 'console.log()' to print to the debug output.
// For more documentation on playgrounds please refer to
// https://www.mongodb.com/docs/mongodb-vscode/playgrounds/

// A connection can be added in the Atlas UI or using the Atlas CLI.
// See the documentation linked below for more information.
// https://www.mongodb.com/docs/atlas/atlas-sp/manage-processing-instance/#add-a-connection-to-the-connection-registry
// List available connections
sp.listConnections();

// Use process to quickly test out the stream processing
sp.process([
  {
    $source: {
      connectionName: 'sample_stream_solar'
    }
  }
]);
`;

export default template;
