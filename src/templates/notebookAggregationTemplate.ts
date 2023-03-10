export default [
  {
    kind: 1,
    languageId: 'markdown',
    value:
      '# MongoDB Aggregation Pipeline Notebook\n\nAn [aggregation pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/) consists of one or more stages that process documents:\n\n- Each stage performs an operation on the input documents. For example, a stage can filter documents, group documents, and calculate values.\n- The documents that are output from a stage are passed to the next stage.\n- An aggregation pipeline can return results for groups of documents. For example, return the total, average, maximum, and minimum values.',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "// The current namespace to use.\nuseNamespace('CURRENT_DATABASE.CURRENT_COLLECTION');",
    metadata: { editable: false },
  },
  {
    kind: 1,
    languageId: 'markdown',
    value:
      'Build your aggregation pipeline in the code cells below. Aggregation pipelines will run with the `db.collection.aggregate()` method.',
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "runStage({ $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } });",
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value:
      "runStage({ $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } });",
    metadata: { editable: false },
  },
  {
    kind: 2,
    languageId: 'javascript',
    value: "runStage({ $count: 'count' });",
    metadata: { editable: false },
  },
];
