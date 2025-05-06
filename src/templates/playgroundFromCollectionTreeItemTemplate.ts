import { createTemplate } from './templateHelpers';

export const playgroundFromCollectionTreeItemTemplate = createTemplate(
  (databaseName, collectionName) => `// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use(${databaseName});

// Find a document in a collection.
db.getCollection(${collectionName}).findOne({

});
`,
);
