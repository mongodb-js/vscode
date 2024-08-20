import { expect } from 'chai';
import { MongoClient } from 'mongodb';
import { execFile as callbackExecFile } from 'child_process';
import { MongoCluster } from 'mongodb-runner';
import path from 'path';
import util from 'util';
import os from 'os';
import * as vscode from 'vscode';

import { loadFixturesToDB } from './fixtures/fixture-loader';
import type { Fixtures } from './fixtures/fixture-loader';
import { AIBackend } from './ai-backend';
import { GenericPrompt } from '../../participant/prompts/generic';
import { QueryPrompt } from '../../participant/prompts/query';
import {
  createTestResultsHTMLPage,
  type TestOutputs,
  type TestResult,
} from './create-test-results-html-page';
import { NamespacePrompt } from '../../participant/prompts/namespace';
import { runCodeInMessage } from './assertions';

const numberOfRunsPerTest = 1;

type AssertProps = {
  responseContent: string;
  connectionString: string;
  fixtures: Fixtures;
};

type TestCase = {
  testCase: string;
  type: 'generic' | 'query' | 'namespace';
  userInput: string;
  databaseName?: string;
  collectionName?: string;
  accuracyThresholdOverride?: number;
  assertResult: (props: AssertProps) => Promise<void> | void;
  only?: boolean; // Translates to mocha's it.only so only this test will run.
};

const testCases: TestCase[] = [
  {
    testCase: 'Basic query',
    type: 'query',
    databaseName: 'UFO',
    collectionName: 'sightings',
    userInput: 'How many documents are in the collection?',
    assertResult: async ({
      responseContent,
      connectionString,
    }: AssertProps) => {
      const result = await runCodeInMessage(responseContent, connectionString);

      const totalResponse = `${result.printOutput.join('')}${
        result.data?.result?.content
      }`;

      const number = totalResponse.match(/\d+/);
      expect(number?.[0]).to.equal('5');
    },
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

const buildMessages = (testCase: TestCase) => {
  switch (testCase.type) {
    case 'generic':
      return GenericPrompt.buildMessages({
        request: { prompt: testCase.userInput },
        context: { history: [] },
      });

    case 'query':
      return QueryPrompt.buildMessages({
        request: { prompt: testCase.userInput },
        context: { history: [] },
        databaseName: testCase.databaseName,
        collectionName: testCase.collectionName,
      });

    case 'namespace':
      return NamespacePrompt.buildMessages({
        request: { prompt: testCase.userInput },
        context: { history: [] },
      });

    default:
      throw new Error(`Unknown test case type: ${testCase.type}`);
  }
};

async function runTest({
  testCase,
  aiBackend,
}: {
  testCase: TestCase;
  aiBackend: AIBackend;
}) {
  const messages = buildMessages(testCase);
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
          outputs: [],
        };

        for (let i = 0; i < numberOfRunsPerTest; i++) {
          let success = false;
          const startTime = Date.now();
          try {
            const responseContent = await runTest({
              testCase,
              aiBackend,
            });
            testOutputs[testCase.testCase].outputs.push(
              responseContent.content
            );
            await testCase.assertResult({
              responseContent: responseContent.content,
              connectionString,
              fixtures,
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

        // Assert that the average accuracy for this input is above the threshold
        expect(averageAccuracy).to.be.at.least(
          accuracyThreshold,
          `Average accuracy (${averageAccuracy}) for input "${testCase.userInput}" is below the threshold (${accuracyThreshold})`
        );
      }
    );
  }
});
