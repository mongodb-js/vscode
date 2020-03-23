const template: string = `// Select the database to use.
use('test');

// Run a find command.
db.myCollection.find({ foo: 'bar' });

// Run an aggregation.
const agg = [
  { $match: { foo: 'bar' } }
];

db.myCollection.aggregate(agg);
`;

export default template;
