import { createTemplate } from './templateHelpers';

const playgroundSearchTemplate = createTemplate(
  (databaseName, collectionName) => `/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use(${databaseName});

// Search for documents in the current collection.
db.getCollection(${collectionName})
  .find(
    {
      /*
      * Filter
      * fieldA: value or expression
      */
    },
    {
      /*
      * Projection
      * _id: 0, // exclude _id
      * fieldA: 1 // include field
      */
    }
  )
  .sort({
    /*
    * fieldA: 1 // ascending
    * fieldB: -1 // descending
    */
  });
`,
);

export default playgroundSearchTemplate;
