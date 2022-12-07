const template = `// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('CURRENT_DATABASE');

// Create a new document in the collection.
db.getCollection('CURRENT_COLLECTION').insertOne(DOCUMENT_CONTENTS);
`;

export default template;
