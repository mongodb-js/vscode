import * as vscode from 'vscode';

export default [
  {
    kind: vscode.NotebookCellKind.Markup,
    languageId: 'markdown',
    value: `# MongoDB Notebook

The [MongoDB Playgrounds](https://www.mongodb.com/docs/mongodb-vscode/playgrounds/) are JavaScript environments where you can prototype queries, aggregations, and MongoDB commands with helpful syntax highlighting.

Documents are individual records in a MongoDB collection and are the basic unit of data in MongoDB.`,
  },
  {
    kind: vscode.NotebookCellKind.Code,
    languageId: 'javascript',
    value: `const documents = [
  { '_id': 1, 'item': 'abc', 'price': 10, 'quantity': 2, 'date': new Date('2014-03-01T08:00:00Z') },
  { '_id': 2, 'item': 'jkl', 'price': 20, 'quantity': 1, 'date': new Date('2014-03-01T09:00:00Z') },
  { '_id': 3, 'item': 'xyz', 'price': 5, 'quantity': 10, 'date': new Date('2014-03-15T09:00:00Z') },
  { '_id': 4, 'item': 'xyz', 'price': 5, 'quantity':  20, 'date': new Date('2014-04-04T11:21:39.736Z') },
  { '_id': 5, 'item': 'abc', 'price': 10, 'quantity': 10, 'date': new Date('2014-04-04T21:23:13.331Z') },
  { '_id': 6, 'item': 'def', 'price': 7.5, 'quantity': 5, 'date': new Date('2015-06-04T05:08:13Z') },
  { '_id': 7, 'item': 'def', 'price': 7.5, 'quantity': 10, 'date': new Date('2015-09-10T08:43:00Z') },
  { '_id': 8, 'item': 'abc', 'price': 10, 'quantity': 5, 'date': new Date('2016-02-06T20:20:13Z') },
];`,
  },
  {
    kind: vscode.NotebookCellKind.Markup,
    languageId: 'markdown',
    value: `You can use a MongoDB Playground to perform [CRUD](https://www.mongodb.com/docs/mongodb-vscode/crud-ops/) (create, read, update, and delete) operations on documents.

> To run a playground, you must connect to a MongoDB deployment using MongoDB for VS Code.`,
  },
  {
    kind: vscode.NotebookCellKind.Code,
    languageId: 'javascript',
    value: `use('mongodbVSCodePlaygroundDB');

db.sales.drop(); // Delete a collection.
db.sales.insertMany(documents); // Create many documents in the collection.
db.sales.updateMany({ 'item' : 'abc' }, { $set: { price: 100 }}); // Updates all documents that match the filter.

const modifiedDocuments = db.sales.find(); // Read many documents that match the filter.

console.log(modifiedDocuments);`,
  },
  {
    kind: vscode.NotebookCellKind.Markup,
    languageId: 'markdown',
    value: 'You can run [aggregation pipelines](https://www.mongodb.com/docs/mongodb-vscode/run-agg-pipelines/) on your collections. Aggregation pipelines consist of [stages](https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/#aggregation-pipeline-stages) that process your data and return computed results.',
  },
  {
    kind: vscode.NotebookCellKind.Code,
    languageId: 'javascript',
    value: `const aggregation = [
  { $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } },
  { $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } }
];

console.log(db.sales.aggregate(aggregation));`,
  },
];
