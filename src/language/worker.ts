import { CliServiceProvider } from '@mongosh/service-provider-server';
import { CompletionItemKind } from 'vscode-languageserver/node';
import { Document } from 'bson';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { promisify } from 'util';
import parseSchema = require('mongodb-schema');
import { parentPort, workerData } from 'worker_threads';
import {
  PlaygroundResult,
  PlaygroundDebug,
  ShellExecuteAllResult,
  EvaluationResult,
} from '../types/playgroundType';
import { ServerCommands } from './serverCommands';
import { getContent, getLanguage } from '../utils/output';

// MongoClientOptions is the second argument of CliServiceProvider.connect(connectionStr, options)
type MongoClientOptions = NonNullable<
  Parameters<typeof CliServiceProvider['connect']>[1]
>;

type WorkerResult = ShellExecuteAllResult;
type WorkerError = any | null;

const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: MongoClientOptions
): Promise<[WorkerError, WorkerResult?]> => {
  try {
    // Instantiate a data service provider.
    //
    // TODO: update when `mongosh` will start to support cancellationToken.
    // See: https://github.com/mongodb/node-mongodb-native/commit/2014b7b/#diff-46fff96a6e12b2b0b904456571ce308fR132
    const serviceProvider: CliServiceProvider =
      await CliServiceProvider.connect(connectionString, connectionOptions);
    const outputLines: PlaygroundDebug = [];

    // Create a new instance of the runtime and evaluate code from a playground.
    const runtime = new ElectronRuntime(serviceProvider);

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
    const { source, type, printable } = await runtime.evaluate(codeToEvaluate);
    const namespace =
      source && source.namespace
        ? `${source.namespace.db}.${source.namespace.collection}`
        : null;
    const result: PlaygroundResult = {
      namespace,
      type: type ? type : typeof printable,
      content: getContent({ type, printable }),
      language: getLanguage({ type, printable }),
    };

    return [null, { outputLines, result }];
  } catch (error) {
    return [error];
  }
};

const findAndParse = async (
  serviceProvider: CliServiceProvider,
  databaseName: string,
  collectionName: string
) => {
  const documents = await serviceProvider
    .find(databaseName, collectionName, {}, { limit: 1 })
    .toArray();

  if (documents.length === 0) {
    return [];
  }

  try {
    const runParseSchema = promisify(parseSchema);
    const schema = await runParseSchema(documents);

    if (!schema || !schema.fields) {
      return [];
    }

    const fields = schema.fields.map((item) => ({
      label: item.name,
      kind: CompletionItemKind.Field,
    }));

    return fields;
  } catch (parseError) {
    return [];
  }
};

const getFieldsFromSchema = async (
  connectionString: string,
  connectionOptions: any,
  databaseName: string,
  collectionName: string
): Promise<any> => {
  try {
    const serviceProvider: CliServiceProvider =
      await CliServiceProvider.connect(connectionString, connectionOptions);

    const result = await findAndParse(
      serviceProvider,
      databaseName,
      collectionName
    );

    return [null, result];
  } catch (error) {
    return [error];
  }
};

const prepareCompletionItems = (result: Document) => {
  if (!result) {
    return [];
  }

  return result.databases.map((item) => ({
    label: item.name,
    kind: CompletionItemKind.Value,
  }));
};

const getListDatabases = async (
  connectionString: string,
  connectionOptions: any
) => {
  try {
    const serviceProvider: CliServiceProvider =
      await CliServiceProvider.connect(connectionString, connectionOptions);

    // TODO: There is a mistake in the service provider interface
    // Use `admin` as arguments to get list of dbs
    // and remove it later when `mongosh` will merge a fix.
    const result = await serviceProvider.listDatabases('admin');
    const databases = prepareCompletionItems(result);

    return [null, databases];
  } catch (error) {
    return [error];
  }
};

const getListCollections = async (
  connectionString: string,
  connectionOptions: any,
  databaseName: string
) => {
  try {
    const serviceProvider: CliServiceProvider =
      await CliServiceProvider.connect(connectionString, connectionOptions);
    const result = await serviceProvider.listCollections(databaseName);
    const collections = result ? result : [];

    return [null, collections];
  } catch (error) {
    return [error];
  }
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
