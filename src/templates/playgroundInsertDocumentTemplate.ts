import { createTemplate } from './templateHelpers';

const playgroundInsertDocumentTemplate = createTemplate(
  (databaseName, collectionName) => `/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use(${databaseName});

// Create a new document in the collection.
db.getCollection(${collectionName}).insertOne({

});
`,
);

export default playgroundInsertDocumentTemplate;
