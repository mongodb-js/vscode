const template = `// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('CURRENT_DATABASE');

// Create a new index in the collection.
// 'ensureIndex' checks to see if the index already exists
// before creating it, to avoid duplicates.
db.getCollection('CURRENT_COLLECTION')
  .ensureIndex(
    {
      /**
       * Define the index.
       * key: string | object
       * fieldName: 1 // Create an ascending index on field 'fieldName'.
       */
    }, {
      /**
       * Optional index options.
       * unique: false // Creates an unique index.
       * background: false // Creates the index in the background, yielding whenever possible.
       */
    }
  );
`;

export default template;
