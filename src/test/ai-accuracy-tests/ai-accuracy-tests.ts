/* eslint-disable no-console */
import { expect } from 'chai';
import { MongoClient } from 'mongodb';
import { execFile as callbackExecFile } from 'child_process';
import { MongoCluster } from 'mongodb-runner';
import path from 'path';
import util from 'util';
import os from 'os';
import * as vscode from 'vscode';

import { loadFixturesToDB, reloadFixture } from './fixtures/fixture-loader';
import type { Fixtures } from './fixtures/fixture-loader';
import { AIBackend } from './ai-backend';
import type { ChatCompletion } from './ai-backend';
import {
  createTestResultsHTMLPage,
  type TestOutputs,
  type TestResult,
} from './create-test-results-html-page';
import { runCodeInMessage } from './assertions';
import { Prompts } from '../../participant/prompts';
import type { PromptResult } from '../../participant/prompts/promptBase';

const numberOfRunsPerTest = 1;

// When true, we will log the entire prompt we send to the model for each test.
const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';

type AssertProps = {
  responseContent: string;
  connectionString: string;
  fixtures: Fixtures;
  mongoClient: MongoClient;
};

type TestCase = {
  testCase: string;
  type: 'generic' | 'query' | 'namespace';
  userInput: string;
  // Some tests can edit the documents in a collection.
  // As we want tests to run in isolation this flag will cause the fixture
  // to be reloaded on each run of the tests so subsequent tests are not impacted.
  reloadFixtureOnEachRun?: boolean;
  databaseName?: string;
  collectionName?: string;
  includeSampleDocuments?: boolean;
  accuracyThresholdOverride?: number;
  assertResult: (props: AssertProps) => Promise<void> | void;
  only?: boolean; // Translates to mocha's it.only so only this test will run.
};

const namespaceTestCases: TestCase[] = [
  {
    testCase: 'Namespace included in query',
    type: 'namespace',
    userInput:
      'How many documents are in the tempReadings collection in the pools database?',
    assertResult: ({ responseContent }: AssertProps): void => {
      const namespace =
        Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(
          responseContent
        );

      expect(namespace.databaseName).to.equal('pools');
      expect(namespace.collectionName).to.equal('tempReadings');
    },
  },
  {
    testCase: 'No namespace included in basic query',
    type: 'namespace',
    userInput: 'How many documents are in the collection?',
    assertResult: ({ responseContent }: AssertProps): void => {
      const namespace =
        Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(
          responseContent
        );

      expect(namespace.databaseName).to.equal(undefined);
      expect(namespace.collectionName).to.equal(undefined);
    },
  },
  {
    testCase: 'Only collection mentioned in query',
    type: 'namespace',
    userInput:
      'How do I create a new user with read write permissions on the orders collection?',
    assertResult: ({ responseContent }: AssertProps): void => {
      const namespace =
        Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(
          responseContent
        );

      expect(namespace.databaseName).to.equal(undefined);
      expect(namespace.collectionName).to.equal('orders');
    },
  },
  {
    testCase: 'Only database mentioned in query',
    type: 'namespace',
    userInput:
      'How do I create a new user with read write permissions on the orders db?',
    assertResult: ({ responseContent }: AssertProps): void => {
      const namespace =
        Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(
          responseContent
        );

      expect(namespace.databaseName).to.equal('orders');
      expect(namespace.collectionName).to.equal(undefined);
    },
  },
];

const queryTestCases: TestCase[] = [
  {
    testCase: 'Basic query',
    type: 'query',
    databaseName: 'UFO',
    collectionName: 'sightings',
    userInput: 'How many documents are in the collection?',
    assertResult: async ({
      responseContent,
      connectionString,
    }: AssertProps): Promise<void> => {
      const result = await runCodeInMessage(responseContent, connectionString);

      const totalResponse = `${result.printOutput.join('')}${
        result.data?.result?.content
      }`;

      const number = totalResponse.match(/\d+/);
      expect(number?.[0]).to.equal('5');
    },
  },
  {
    testCase: 'Slightly complex updateOne',
    type: 'query',
    databaseName: 'CookBook',
    collectionName: 'recipes',
    reloadFixtureOnEachRun: true,
    userInput:
      "Update the Beef Wellington recipe to have its preparation time 150 minutes and set the difficulty level to 'Very Hard'",
    assertResult: async ({
      responseContent,
      connectionString,
      mongoClient,
      fixtures,
    }: AssertProps): Promise<void> => {
      const documentsBefore = await mongoClient
        .db('CookBook')
        .collection('recipes')
        .find()
        .toArray();
      expect(documentsBefore).to.deep.equal(
        fixtures.CookBook.recipes.documents
      );

      await runCodeInMessage(responseContent, connectionString);
      const documents = await mongoClient
        .db('CookBook')
        .collection('recipes')
        .find()
        .toArray();

      expect(documents).to.deep.equal(
        fixtures.CookBook.recipes.documents.map((doc) => {
          if (doc.title === 'Beef Wellington') {
            return {
              ...doc,
              preparationTime: 150,
              difficulty: 'Very Hard',
            };
          }
          return doc;
        })
      );
    },
  },
  {
    testCase: 'Aggregation with averaging and filtering',
    type: 'query',
    databaseName: 'pets',
    collectionName: 'competition-results',
    userInput:
      'What is the average score for dogs competing in the best costume category? Put it in a field called "avgScore"',
    assertResult: async ({
      responseContent,
      connectionString,
    }: AssertProps): Promise<void> => {
      const output = await runCodeInMessage(responseContent, connectionString);

      expect(output.data?.result?.content[0]).to.deep.equal({
        avgScore: 9.3,
      });
    },
  },
  {
    testCase: 'Create an index',
    type: 'query',
    databaseName: 'FarmData',
    collectionName: 'Pineapples',
    reloadFixtureOnEachRun: true,
    userInput:
      'How to index the harvested date and sweetness to speed up requests for sweet pineapples harvested after a specific date?',
    assertResult: async ({
      responseContent,
      connectionString,
      mongoClient,
    }: AssertProps): Promise<void> => {
      const indexesBefore = await mongoClient
        .db('FarmData')
        .collection('Pineapples')
        .listIndexes()
        .toArray();
      expect(indexesBefore.length).to.equal(1);
      await runCodeInMessage(responseContent, connectionString);

      const indexes = await mongoClient
        .db('FarmData')
        .collection('Pineapples')
        .listIndexes()
        .toArray();

      expect(indexes.length).to.equal(2);
      expect(
        indexes.filter((index) => index.name !== '_id_')[0]?.key
      ).to.have.keys(['harvestedDate', 'sweetnessScale']);
    },
  },
  {
    testCase: 'Aggregation with an or or $in, with sample docs',
    type: 'query',
    databaseName: 'Antiques',
    collectionName: 'items',
    includeSampleDocuments: true,
    userInput:
      'which collectors specialize only in mint items? and are located in London or New York? an array of their names in a field called collectors',
    assertResult: async ({
      responseContent,
      connectionString,
    }: AssertProps): Promise<void> => {
      const output = await runCodeInMessage(responseContent, connectionString);

      expect(output.data?.result?.content?.[0].collectors).to.have.lengthOf(2);
      expect(output.data?.result?.content[0].collectors).to.include('John Doe');
      expect(output.data?.result?.content[0].collectors).to.include('Monkey');
    },
  },
];

const testCases: TestCase[] = [...namespaceTestCases, ...queryTestCases];

const projectRoot = path.join(__dirname, '..', '..', '..');

const execFile = util.promisify(callbackExecFile);

const TEST_RESULTS_DB = 'test_generative_ai_accuracy_evergreen';
const TEST_RESULTS_COL = 'evergreen_runs';

const DEFAULT_ATTEMPTS_PER_TEST = 2;
const ATTEMPTS_PER_TEST = process.env.AI_TESTS_ATTEMPTS_PER_TEST
  ? +process.env.AI_TESTS_ATTEMPTS_PER_TEST
  : DEFAULT_ATTEMPTS_PER_TEST;

/**
 * Insert the generative ai results to a db
 * so we can track how they perform overtime.
 */
async function pushResultsToDB({
  results,
  anyFailedAccuracyThreshold,
  runTimeMS,
  httpErrors,
}: {
  results: TestResult[];
  anyFailedAccuracyThreshold: boolean;
  runTimeMS: number;
  httpErrors: number;
}): Promise<void> {
  const client = new MongoClient(
    process.env.AI_ACCURACY_RESULTS_MONGODB_CONNECTION_STRING || ''
  );

  try {
    const database = client.db(TEST_RESULTS_DB);
    const collection = database.collection(TEST_RESULTS_COL);

    const gitCommitHash = await execFile('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
    });

    const doc = {
      gitHash: gitCommitHash.stdout.trim(),
      completedAt: new Date(),
      attemptsPerTest: ATTEMPTS_PER_TEST,
      anyFailedAccuracyThreshold,
      httpErrors,
      totalRunTimeMS: runTimeMS, // Total elapsed time including timeouts to avoid rate limit.
      results: results.map((result) => {
        const { 'Avg Execution Time (ms)': runTimeMS, Pass, ...rest } = result;
        return {
          runTimeMS,
          Pass: Pass === '✓',
          ...rest,
        };
      }),
    };

    await collection.insertOne(doc);
  } finally {
    await client.close();
  }
}

const buildMessages = async ({
  testCase,
  fixtures,
}: {
  testCase: TestCase;
  fixtures: Fixtures;
}): Promise<PromptResult> => {
  switch (testCase.type) {
    case 'generic':
      return await Prompts.generic.buildMessages({
        request: { prompt: testCase.userInput },
        context: { history: [] },
        connectionNames: [],
      });

    case 'query':
      return await Prompts.query.buildMessages({
        request: { prompt: testCase.userInput },
        context: { history: [] },
        databaseName: testCase.databaseName ?? 'test',
        collectionName: testCase.collectionName ?? 'test',
        connectionNames: [],
        ...(fixtures[testCase.databaseName as string]?.[
          testCase.collectionName as string
        ]?.schema
          ? {
              schema:
                fixtures[testCase.databaseName as string]?.[
                  testCase.collectionName as string
                ]?.schema,
            }
          : {}),
        ...(testCase.includeSampleDocuments
          ? {
              sampleDocuments: fixtures[testCase.databaseName as string][
                testCase.collectionName as string
              ].documents.slice(0, 3),
            }
          : {}),
      });

    case 'namespace':
      return Prompts.namespace.buildMessages({
        request: { prompt: testCase.userInput },
        context: { history: [] },
        connectionNames: [],
      });

    default:
      throw new Error(`Unknown test case type: ${testCase.type}`);
  }
};

async function runTest({
  testCase,
  aiBackend,
  fixtures,
}: {
  testCase: TestCase;
  aiBackend: AIBackend;
  fixtures: Fixtures;
}): Promise<ChatCompletion> {
  const { messages } = await buildMessages({
    testCase,
    fixtures,
  });
  if (DEBUG_PROMPTS) {
    console.log('Messages to send to chat completion:');
    console.log(messages);
  }
  const chatCompletion = await aiBackend.runAIChatCompletionGeneration({
    messages: messages.map((message) => ({
      ...message,
      role:
        message.role === vscode.LanguageModelChatMessageRole.User
          ? 'user'
          : 'assistant',
    })),
  });

  return chatCompletion;
}

describe('AI Accuracy Tests', function () {
  let cluster: MongoCluster;
  let mongoClient: MongoClient;
  let fixtures: Fixtures = {};
  let anyFailedAccuracyThreshold = false;
  let startTime;
  let aiBackend;
  let connectionString: string;

  const results: TestResult[] = [];
  const testOutputs: TestOutputs = {};

  this.timeout(60_000 /* 1 min */);

  before(async function () {
    console.log('Starting setup for AI accuracy tests...');

    const startupStartTime = Date.now();

    cluster = await MongoCluster.start({
      tmpDir: os.tmpdir(),
      topology: 'standalone',
    });
    console.log('Started a test cluster:', cluster.connectionString);
    connectionString = cluster.connectionString;

    mongoClient = new MongoClient(cluster.connectionString);

    fixtures = await loadFixturesToDB({
      mongoClient,
    });

    aiBackend = new AIBackend('openai');

    console.log(`Test setup complete in ${Date.now() - startupStartTime}ms.`);
    console.log('Starting AI accuracy tests...');
    startTime = Date.now();
  });

  after(async function () {
    console.log('Finished AI accuracy tests.');
    console.log('Results:', results);

    console.table(results, [
      'Type',
      'Test',
      'Namespace',
      'Accuracy',
      'Avg Execution Time (ms)',
      'Avg Prompt Tokens',
      'Avg Completion Tokens',
      'Pass',
    ]);

    if (process.env.AI_ACCURACY_RESULTS_MONGODB_CONNECTION_STRING) {
      await pushResultsToDB({
        results,
        anyFailedAccuracyThreshold,
        httpErrors: 0, // TODO
        runTimeMS: Date.now() - startTime,
      });
    }

    await mongoClient?.close();
    await cluster?.close();

    const htmlPageLocation = await createTestResultsHTMLPage({
      testResults: results,
      testOutputs,
    });
    console.log('View prompts and responses here:');
    console.log(htmlPageLocation);
  });

  for (const testCase of testCases) {
    const testFunction = testCase.only ? it.only : it;

    testFunction(
      `should pass for input: "${testCase.userInput}" if average accuracy is above threshold`,
      // eslint-disable-next-line no-loop-func
      async function () {
        console.log(`Starting test run of ${testCase.testCase}.`);

        const testRunDidSucceed: boolean[] = [];
        const successFullRunStats: {
          promptTokens: number;
          completionTokens: number;
          executionTimeMS: number;
        }[] = [];
        const accuracyThreshold = testCase.accuracyThresholdOverride ?? 0.8;
        testOutputs[testCase.testCase] = {
          prompt: testCase.userInput,
          testType: testCase.type,
          outputs: [],
        };

        for (let i = 0; i < numberOfRunsPerTest; i++) {
          let success = false;

          if (testCase.reloadFixtureOnEachRun) {
            await reloadFixture({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              db: testCase.databaseName!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              coll: testCase.collectionName!,
              mongoClient,
              fixtures,
            });
          }

          const startTime = Date.now();
          try {
            const responseContent = await runTest({
              testCase,
              aiBackend,
              fixtures,
            });
            testOutputs[testCase.testCase].outputs.push(
              responseContent.content
            );
            await testCase.assertResult({
              responseContent: responseContent.content,
              connectionString,
              fixtures,
              mongoClient,
            });

            successFullRunStats.push({
              completionTokens: responseContent.usageStats.completionTokens,
              promptTokens: responseContent.usageStats.promptTokens,
              executionTimeMS: Date.now() - startTime,
            });
            success = true;

            console.log(
              `Test run of ${testCase.testCase}. Run ${i} of ${numberOfRunsPerTest} succeeded`
            );
          } catch (err) {
            console.log(
              `Test run of ${testCase.testCase}. Run ${i} of ${numberOfRunsPerTest} failed with error:`,
              err
            );
          }

          testRunDidSucceed.push(success);
        }

        const averageAccuracy =
          testRunDidSucceed.reduce((a, b) => a + (b ? 1 : 0), 0) /
          testRunDidSucceed.length;
        const didFail = averageAccuracy < accuracyThreshold;

        anyFailedAccuracyThreshold = anyFailedAccuracyThreshold || didFail;

        results.push({
          Test: testCase.testCase,
          Type: testCase.type,
          'User Input': testCase.userInput.slice(0, 100),
          Namespace: testCase.collectionName
            ? `${testCase.databaseName}.${testCase.collectionName}`
            : '',
          Accuracy: averageAccuracy,
          Pass: didFail ? '✗' : '✓',
          'Avg Execution Time (ms)':
            successFullRunStats.length > 0
              ? successFullRunStats.reduce((a, b) => a + b.executionTimeMS, 0) /
                successFullRunStats.length
              : 0,
          'Avg Prompt Tokens':
            successFullRunStats.length > 0
              ? successFullRunStats.reduce((a, b) => a + b.promptTokens, 0) /
                successFullRunStats.length
              : 0,
          'Avg Completion Tokens':
            successFullRunStats.length > 0
              ? successFullRunStats.reduce(
                  (a, b) => a + b.completionTokens,
                  0
                ) / successFullRunStats.length
              : 0,
        });

        expect(averageAccuracy).to.be.at.least(
          accuracyThreshold,
          `Average accuracy (${averageAccuracy}) for input "${testCase.userInput}" is below the threshold (${accuracyThreshold})`
        );
      }
    );
  }
});
