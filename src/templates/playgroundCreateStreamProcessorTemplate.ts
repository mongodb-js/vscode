const template = `/* global sp */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// create a new stream processor
/* sp.createStreamProcessor('newStreamProcessor', [
  {
    $source: {
      "connectionName": "myKafka",
      "topic": "source"
    }
  },
  {
    $match: { temperature: 46 }
  },
  {
    $emit: {
      "connectionName": "mySink",
      "topic" : "target",
    }
  }
]); */

// More information on the \`createStreamProcessor\` command can be found at:
// https://www.mongodb.com/docs/atlas/atlas-sp/manage-stream-processor/#create-a-stream-processor
`;

export default template;
