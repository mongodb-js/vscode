import * as vscode from 'vscode';
import * as chai from 'chai';
import chaiFs = require('chai-fs');
import chaiJsonSchema = require('chai-json-schema');

chai.use(chaiFs);
chai.use(chaiJsonSchema);

const expect = chai.expect;
const SNIPPETS_DIR = `${__dirname}/../../../../resources/snippets/`;
const SNIPPETS_FILE = `${SNIPPETS_DIR}stage-autocompleter.json`;

const STAGE_LABELS = [
  'MongoDB Aggregations $addFields',
  'MongoDB Aggregations $bucket',
  'MongoDB Aggregations $bucketAuto',
  'MongoDB Aggregations $collStats',
  'MongoDB Aggregations $count',
  'MongoDB Aggregations $facet',
  'MongoDB Aggregations $geoNear',
  'MongoDB Aggregations $graphLookup',
  'MongoDB Aggregations $group',
  'MongoDB Aggregations $indexStats',
  'MongoDB Aggregations $limit',
  'MongoDB Aggregations $lookup',
  'MongoDB Aggregations $match',
  'MongoDB Aggregations $merge',
  'MongoDB Aggregations $out',
  'MongoDB Aggregations $project',
  'MongoDB Aggregations $redact',
  'MongoDB Aggregations $replaceWith',
  'MongoDB Aggregations $replaceRoot',
  'MongoDB Aggregations $sample',
  'MongoDB Aggregations $searchBeta',
  'MongoDB Aggregations $set',
  'MongoDB Aggregations $skip',
  'MongoDB Aggregations $sort',
  'MongoDB Aggregations $sortByCount',
  'MongoDB Aggregations $unset',
  'MongoDB Aggregations $unwind'
];

suite('Stage Autocompleter Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('checks that stage-autocompleter.json exists and includes JSON with prefix, body and description', () => {
    const properties: any = {};

    STAGE_LABELS.forEach((prop: string) => {
      properties[prop] = {
        type: 'object',
        properties: { prefix: 'string', body: 'array', description: 'string' }
      };
    });

    const jsonSchema = {
      type: 'object',
      properties
    };

    expect(SNIPPETS_DIR).to.be.a.path();
    expect(SNIPPETS_FILE)
      .to.be.a.file()
      .with.json.using.schema(jsonSchema);
  });
});
