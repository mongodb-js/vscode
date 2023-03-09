export default [
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '# MongoDB Indexes Notebook\n\n`db.collection.createIndex()` takes the following parameters:\n- `keys` is a document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field.\n- `options` are optional. A document that contains a set of options that controls the creation of the index. See [Options](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options-for-all-index-types) or details.',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value: "// The current database to use.\nuse('mongodbVSCodePlaygroundDB');",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '### Single Field Index\n\nFor an ascending [single field index](https://www.mongodb.com/docs/manual/core/index-single/), specify a value of `1`, for descending index, specify a value of `-1`. See',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "db.getCollection('sales').createIndex({\n  /* fieldA: 1, */\n}, {\n  /*\n   * background: true, // Ignored in 4.2+\n   * unique: false,\n   * name: 'some name',\n   * partialFilterExpression: {},\n   * sparse: false,\n   * expireAfterSeconds: 1000,\n   * collation: {},\n   */\n});",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '### Compound Index\n\nThe order of the fields listed in a [compound index](https://www.mongodb.com/docs/manual/core/index-compound/) is important. The index will contain references to documents sorted first by the values of the `fieldA` field and, within each value of the `fieldA` field, sorted by values of the `fieldB` field.',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "db.getCollection('sales').createIndex({\n  /* fieldA: 1, */\n  /* fieldB: -1, */\n});",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '### Wildcard Index\n\nTo create a [wildcard index](https://www.mongodb.com/docs/manual/core/index-wildcard/#wildcard-indexes) on all fields and subfields in a document, specify `{ "$**" : 1 }` as the index key. To create a wildcard index on a specific field and its subpaths by specifying the full path to that field as the index key and append `"$**"` to the path:',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "db.getCollection('sales').createIndex({\n  /* '$**': 1, // Wildcard index on all fields and subfields in a document */\n  /* 'path.to.field.$**': 1, // Wildcard index on a specific field and its subpaths */\n}, {\n  /* wildcardProjection: {}, */\n});",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value: '### Columnstore index\n\nCreate a columnstore index on one field.',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "db.getCollection('sales').createIndex({\n  /* '$**': 'columnstore', // Columnstore index on multiple specific field */\n  /* 'path.to.field.$**': 'columnstore', // Columnstore index on one field and all the subfields */\n}, {\n /* columnstoreProjection: {}, // Added in MongoDB 6.3 */\n});",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '### Text Index\n\nTo index a field that contains a string or an array of string elements use a [text index](https://www.mongodb.com/docs/manual/core/index-text/#create-text-index). Include the field and specify the string literal "text" in the index document.',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "db.getCollection('sales').createIndex({\n  /* fieldA: 'text', */\n  /* fieldB: 'text', */\n});",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '### Geospatial Index\n\nA [2dsphere index](https://www.mongodb.com/docs/manual/core/2dsphere/) supports queries that calculate geometries on an earth-like sphere. ',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "db.getCollection('sales').createIndex({\n  /* locationField: '2dsphere', */\n});",
    metadata: { editable: false },
  },
];
