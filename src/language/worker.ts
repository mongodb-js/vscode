import { parentPort, workerData } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import {
  CliServiceProvider,
  NodeOptions
} from '@mongosh/service-provider-server';
import formatOutput from '../utils/formatOutput';
import parseSchema = require('mongodb-schema');
import { ServerCommands } from './serverCommands';
import { CompletionItemKind } from 'vscode-languageserver';
import type { OutputItem } from '../utils/types';

type EvaluationResult = {
  printable: any;
  type: string | null;
};
type WorkerResult = any;
type WorkerError = any | null;

const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: NodeOptions
): Promise<[WorkerError, WorkerResult?]> => {
  try {
    // Instantiate a data service provider.
    //
    // TODO: update when `mongosh` will start to support cancellationToken.
    // See: https://github.com/mongodb/node-mongodb-native/commit/2014b7b/#diff-46fff96a6e12b2b0b904456571ce308fR132
    const serviceProvider: CliServiceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

    const outputLines: OutputItem[] = [];
    // Create a new instance of the runtime and evaluate code from a playground.
    const runtime: ElectronRuntime = new ElectronRuntime(serviceProvider);
    runtime.setEvaluationListener({
      onPrint(values: EvaluationResult[]) {
        for (const { type, printable } of values) {
          outputLines.push({
            type,
            content: printable
          });
        }
      }
    });
    const { type, printable } = await runtime.evaluate(
      codeToEvaluate
    );
    const result = {
      type,
      content: printable
    };

    return [null, { outputLines, result }];
  } catch (error) {
    return [error];
  }
};

const findAndParse = (
  serviceProvider: CliServiceProvider,
  databaseName: string,
  collectionName: string
): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    let documents: Array<any>;

    try {
      documents = await serviceProvider
        .find(databaseName, collectionName, {}, { limit: 1 })
        .toArray();
    } catch (error) {
      return reject(error);
    }

    if (documents.length === 0) {
      return resolve([]);
    }

    parseSchema(documents, (error: Error | undefined, schema) => {
      if (error) {
        return reject(documents);
      }

      if (!schema || !schema.fields) {
        return resolve([]);
      }

      const fields = schema.fields.map((item) => ({
        label: item.name,
        kind: CompletionItemKind.Field
      }));

      return resolve(fields);
    });
  });
};

const getFieldsFromSchema = async (
  connectionString: string,
  connectionOptions: any,
  databaseName: string,
  collectionName: string
): Promise<any> => {
  try {
    const serviceProvider: CliServiceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

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

const getListDatabases = async (
  connectionString: string,
  connectionOptions: any
) => {
  try {
    const serviceProvider: CliServiceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

    // TODO: There is a mistake in the service provider interface
    // Use `admin` as arguments to get list of dbs
    // and remove it later when `mongosh` will merge a fix
    const result = await serviceProvider.listDatabases('admin');
    const databases = result
      ? result.databases.map((item) => ({
          label: item.name,
          kind: CompletionItemKind.Value
        }))
      : [];

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
    const serviceProvider: CliServiceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );
    const result = await serviceProvider.listCollections(databaseName);
    const collections = result ? result : [];

    return [null, collections];
  } catch (error) {
    return [error];
  }
};

// parentPort allows communication with the parent thread.
parentPort?.once(
  'message',
  async (message: string): Promise<any> => {
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
  }
);
