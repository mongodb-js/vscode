const template = `// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('CURRENT_DATABASE');

// Create a new index in the collection.
db.getCollection('CURRENT_COLLECTION')
  .createIndex(
    {
      /*
       * Keys
       *
       * Normal index
       * fieldA:  1, //ascending
       * fieldB: -1  //descending
       *
       * Wildcard index
       * '$**': 1, //wildcard index on all fields and subfields in a document
       * 'path.to.field.$**': 1 //wildcard index on a specific field and its subpaths
       *
       * Columnstore index //added in MongoDB 6.3
       * '$**': "columnstore", //columnstore index on multiple specific field
       * 'path.to.field.$**': "columnstore", //columnstore index on one field and all the subfields
       *
       * Text index
       * fieldA: 'text',
       * fieldB: 'text'
       *
       * Geospatial Index
       * locationField: '2dsphere'
       *
       * Hashed Index
       * fieldA: 'hashed'
       */
    }, {
      /*
       * Options (https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options-for-all-index-types)
       *
       * background: true, //ignored in 4.2+
       * unique: false,
       * name: 'some name',
       * partialFilterExpression: {},
       * sparse: false,
       * expireAfterSeconds: TTL,
       * collation: {},
       * wildcardProjection: {},
       * columnstoreProjection: {} //added in MongoDB 6.3
       */
    }
  );
`;

export default template;
