import { expect } from 'chai';
import { MongoClient } from 'mongodb';
import { execFile as callbackExecFile } from 'child_process';
import { MongoCluster } from 'mongodb-runner';
import path from 'path';
import util from 'util';
import os from 'os';

import { loadFixturesToDB } from './fixtures/fixture-loader';
import type { Fixtures } from './fixtures/fixture-loader';
import { AIBackend } from './ai-backend';
import { GenericPrompt } from '../../participant/prompts/generic';
import { QueryPrompt } from '../../participant/prompts/query';
import * as vscode from 'vscode';

const numberOfRunsPerTest = 5;

type TestCase = {
  testCase: string;
  type: 'generic' | 'query';
  userInput: string;
  databaseName?: string;
  collectionName?: string;
  accuracyThresholdOverride?: number;
  assertResult: (responseContent: string) => Promise<void> | void;
  only?: boolean; // Translates to mocha's it.only so only this test will run.
};

const testCases: TestCase[] = [
  {
    testCase: 'Basic generic question',
    type: 'generic',
    userInput: 'What is MongoDB?',
    assertResult: (response: string) => {
      expect(response).to.have.length.greaterThan(5);
    },
  },
  {
    testCase: 'Basic query',
    type: 'query',
    userInput: 'Example input 2',
    assertResult: () => {},
    only: true,
  },
  {
    testCase: 'Date query',
    type: 'query',
    userInput: 'Example input 3',
    assertResult: () => {},
  },
];

const projectRoot = path.join(__dirname, '..', '..', '..');

const execFile = util.promisify(callbackExecFile);

const TEST_RESULTS_DB = 'test_generative_ai_accuracy_evergreen';
const TEST_RESULTS_COL = 'evergreen_runs';

const DEFAULT_ATTEMPTS_PER_TEST = 2;
const ATTEMPTS_PER_TEST = process.env.AI_TESTS_ATTEMPTS_PER_TEST
  ? +process.env.AI_TESTS_ATTEMPTS_PER_TEST
  : DEFAULT_ATTEMPTS_PER_TEST;

type TestResult = {
  Test: string;
  Type: string;
  'User Input': string;
  Namespace: string;
  Accuracy: number;
  Pass: '✗' | '✓';
  'Avg Execution Time (ms)': number;
  'Avg Prompt Tokens': number;
  'Avg Completion Tokens': number;
};

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
}) {
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

async function runTest({
  testCase,
  aiBackend,
}: {
  testCase: TestCase;
  aiBackend: AIBackend;
}) {
  await new Promise((resolve) => setTimeout(resolve, 5));

  console.log('run test for test case', testCase.testCase);
  // testCase

  const chatCompletion = await aiBackend.runAIChatCompletionGeneration({
    messages: [
      ...(testCase.type === 'generic'
        ? GenericPrompt.buildMessages({
            request: {
              prompt: testCase.userInput,
            },
            context: {
              history: [],
            },
          })
        : QueryPrompt.buildMessages({
            request: {
              prompt: testCase.userInput,
            },
            context: {
              history: [],
            },
          })),
    ].map((message) => ({
      ...message,
      role:
        message.role === vscode.LanguageModelChatMessageRole.User
          ? 'user'
          : 'assistant',
    })),
  });

  // return 'did run the test';
  return chatCompletion;
}

describe('AI Accuracy Tests', function () {
  let cluster: MongoCluster;
  let mongoClient: MongoClient;
  let fixtures: Fixtures = {};
  let anyFailedAccuracyThreshold = false;
  let startTime;
  let aiBackend;

  const results: TestResult[] = [];

  before(async function () {
    console.log('Starting setup for AI accuracy tests...');

    const startupStartTime = Date.now();

    cluster = await MongoCluster.start({
      tmpDir: os.tmpdir(),
      topology: 'standalone',
    });

    mongoClient = new MongoClient(cluster.connectionString);

    fixtures = await loadFixturesToDB({
      mongoClient,
    });

    aiBackend = new AIBackend('openai');

    console.log(`Setup complete in ${Date.now() - startupStartTime}`);
    console.log('Starting AI accuracy tests...');
    startTime = Date.now();
  });

  after(async function () {
    console.log('Finished AI accuracy tests.');
    console.log('Results:', results);

    console.table(results, [
      'Type',
      'User Input',
      'Namespace',
      'Accuracy',
      'Time Elapsed (MS)',
      'Prompt Tokens',
      'Completion Tokens',
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
  });

  for (const testCase of testCases) {
    const testFunction = testCase.only ? it.only : it;
    const accuracyThreshold = testCase.accuracyThresholdOverride ?? 0.8;

    testFunction(
      `should pass for input: "${testCase.userInput}" if average accuracy is above threshold`,
      // eslint-disable-next-line no-loop-func
      async function () {
        const testRunDidSucceed: boolean[] = [];
        const successFullRunStats: {
          promptTokens: number;
          completionTokens: number;
          executionTimeMS: number;
        }[] = [];

        for (let i = 0; i < numberOfRunsPerTest; i++) {
          let success = false;
          const startTime = Date.now();
          try {
            const responseContent = await runTest({
              testCase,
              aiBackend,
            });
            await testCase.assertResult(responseContent.content);

            successFullRunStats.push({
              completionTokens: responseContent.usageStats.completionTokens,
              promptTokens: responseContent.usageStats.promptTokens,
              executionTimeMS: Date.now() - startTime,
            });
            success = true;
          } catch (err) {
            console.log(
              `Test run of ${testCase.testCase}. ${i} of ${numberOfRunsPerTest} failed with error: `
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

        // Assert that the average accuracy for this input is above the threshold
        expect(averageAccuracy).to.be.at.least(
          accuracyThreshold,
          `Average accuracy (${averageAccuracy}) for input "${testCase.userInput}" is below the threshold (${accuracyThreshold})`
        );
      }
    );
  }
});
