import { CliServiceProvider } from '@mongosh/service-provider-server';
import { EJSON } from 'bson';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { Document } from '@mongosh/service-provider-core';
import parseSchema from 'mongodb-schema';
import { parentPort, workerData } from 'worker_threads';

// MongoClientOptions is the second argument of CliServiceProvider.connect(connectionStr, options).
type MongoClientOptions = NonNullable<
  Parameters<typeof CliServiceProvider['connect']>[1]
>;

import type {
  PlaygroundDebug,
  ShellExecuteAllResult,
} from '../types/playgroundType';
import { ServerCommands } from './serverCommands';

interface EvaluationResult {
  printable: any;
  type: string | null;
}

const getContent = ({ type, printable }: EvaluationResult) => {
  if (type === 'Cursor' || type === 'AggregationCursor') {
    return JSON.parse(EJSON.stringify(printable.documents));
  }

  return typeof printable !== 'object' || printable === null
    ? printable
    : JSON.parse(EJSON.stringify(printable));
};

const getLanguage = (evaluationResult: EvaluationResult) => {
  const content = getContent(evaluationResult);

  if (typeof content === 'object' && content !== null) {
    return 'json';
  }

  return 'plaintext';
};

/**
 * Execute all content from a playground.
 * @public
 */
const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: MongoClientOptions
): Promise<[unknown, ShellExecuteAllResult?]> => {
  let serviceProvider: CliServiceProvider;

  try {
    serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );
  } catch (error) {
    return [error];
  }

  try {
    // Create a new instance of the runtime for each playground evaluation.
    const runtime = new ElectronRuntime(serviceProvider);
    const outputLines: PlaygroundDebug = [];

    // Collect console.log() output.
    runtime.setEvaluationListener({
      onPrint(values: EvaluationResult[]) {
        for (const { type, printable } of values) {
          outputLines.push({
            type,
            content: printable,
            namespace: null,
            language: null,
          });
        }
      },
    });

    // Evaluate a playground content.
    const { source, type, printable } = await runtime.evaluate(codeToEvaluate);
    const namespace =
      source && source.namespace
        ? `${source.namespace.db}.${source.namespace.collection}`
        : null;

    // Prepare a playground result.
    const result = {
      namespace,
      type: type ? type : typeof printable,
      content: getContent({ type, printable }),
      language: getLanguage({ type, printable }),
    };

    return [null, { outputLines, result }];
  } catch (error) {
    return [error];
  } finally {
    await serviceProvider.close(true);
  }
};

/**
 * Get field names for autocomplete.
 * @public
 */
const getFieldsFromSchema = async (
  connectionString: string,
  connectionOptions: MongoClientOptions,
  databaseName: string,
  collectionName: string
): Promise<[unknown, string[]?]> => {
  let serviceProvider: CliServiceProvider;
  let result: string[] = [];

  try {
    serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );
  } catch (error) {
    return [error];
  }

  try {
    const documents = await serviceProvider
      .find(databaseName, collectionName, {}, { limit: 1 })
      .toArray();

    if (documents.length) {
      const schema = await parseSchema(documents);
      result = schema?.fields ? schema.fields.map((item) => item.name) : [];
    }
  } catch (error) {
    /* Squelch find and parse documents error */
  }

  await serviceProvider.close(true);
  return [null, result];
};

/**
 * Get database names for autocomplete.
 * @public
 */
const getListDatabases = async (
  connectionString: string,
  connectionOptions: MongoClientOptions
): Promise<[unknown, Document[]?]> => {
  let serviceProvider: CliServiceProvider;
  let result: Document[] = [];

  try {
    serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );
  } catch (error) {
    return [error];
  }

  try {
    // TODO: There is a mistake in the service provider interface
    // Use `admin` as arguments to get list of dbs
    // and remove it later when `mongosh` will merge a fix.
    const documents = await serviceProvider.listDatabases('admin');
    result = documents.databases ? documents.databases : [];
  } catch (error) {
    /* Squelch list databases error */
  }

  await serviceProvider.close(true);
  return [null, result];
};

/**
 * Get collection names for autocomplete.
 * @public
 */
const getListCollections = async (
  connectionString: string,
  connectionOptions: MongoClientOptions,
  databaseName: string
): Promise<[unknown, Document[]?]> => {
  let serviceProvider: CliServiceProvider;
  let result: Document[] = [];

  try {
    serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );
  } catch (error) {
    return [error];
  }

  try {
    const documents = await serviceProvider.listCollections(databaseName);
    result = documents ? documents : [];
  } catch (error) {
    /* Squelch list collections error */
  }

  await serviceProvider.close(true);
  return [null, result];
};

const handleMessageFromParentPort = async (message: string): Promise<void> => {
  if (message === ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND) {
    parentPort?.postMessage(
      await executeAll(
        workerData.codeToEvaluate,
        workerData.connectionString,
        workerData.connectionOptions
      )
    );
  }

  if (message === ServerCommands.GET_FIELDS_FROM_SCHEMA) {
    parentPort?.postMessage(
      await getFieldsFromSchema(
        workerData.connectionString,
        workerData.connectionOptions,
        workerData.databaseName,
        workerData.collectionName
      )
    );
  }

  if (message === ServerCommands.GET_LIST_DATABASES) {
    parentPort?.postMessage(
      await getListDatabases(
        workerData.connectionString,
        workerData.connectionOptions
      )
    );
  }

  if (message === ServerCommands.GET_LIST_COLLECTIONS) {
    parentPort?.postMessage(
      await getListCollections(
        workerData.connectionString,
        workerData.connectionOptions,
        workerData.databaseName
      )
    );
  }
};

// parentPort allows communication with the parent thread.
parentPort?.once('message', (message: string): void => {
  void handleMessageFromParentPort(message);
});
