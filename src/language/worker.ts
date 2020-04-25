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

type EvaluationResult = {
  value: any;
  type?: string;
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

    // Create a new instance of the runtime and evaluate code from a playground.
    const runtime: ElectronRuntime = new ElectronRuntime(serviceProvider);
    const result: EvaluationResult | string = await runtime.evaluate(
      codeToEvaluate
    );

    return [null, result ? formatOutput(result) : null];
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
    let documents;

    try {
      documents = await serviceProvider
        .find(
          databaseName,
          collectionName,
          {},
          { limit: 1, projection: { _id: 0 } }
        )
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
  connectionString,
  connectionOptions,
  databaseName,
  collectionName
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
  }
);
