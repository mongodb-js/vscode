import { CliServiceProvider } from '@mongosh/service-provider-server';
import { CompletionItemKind } from 'vscode-languageserver/node';
import { Document } from 'bson';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import parseSchema from 'mongodb-schema';
import { parentPort, workerData } from 'worker_threads';

import {
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

const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: MongoClientOptions
): Promise<ShellExecuteAllResult> => {
  const serviceProvider = await CliServiceProvider.connect(
    connectionString,
    connectionOptions
  );

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

    return { outputLines, result };
  } catch (error) {
    throw error;
  } finally {
    await serviceProvider.close(true);
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
    const schema = await parseSchema(documents);

    if (!schema || !schema.fields) {
      return [];
    }

    const fields = schema.fields.map((item) => ({
      label: item.name,
      kind: CompletionItemKind.Field,
      preselect: true,
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
