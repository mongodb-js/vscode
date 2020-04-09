import { parentPort, workerData } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import formatOutput from '../utils/formatOutput';

type EvaluationResult = {
  value: any;
  type?: string;
};

let serviceProvider;

const executeAll = async (codeToEvaluate, connectionString, connectionOptions = {}) => {
  try {
    // Instantiate a data service provider
    //
    // TODO: update when `mongosh` start support cancellationToken
    // See: https://github.com/mongodb/node-mongodb-native/commit/2014b7b/#diff-46fff96a6e12b2b0b904456571ce308fR132
    serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

    // Create a new instance of the runtime and run scripts
    const runtime = new ElectronRuntime(serviceProvider);
    const result: EvaluationResult | string = await runtime.evaluate(codeToEvaluate);

    // Close mongoClient after each runtime evaluation
    // to make sure that all resources are free and can be used with a new request.
    // The mongoClient.close method closes the underlying connector,
    // which in turn closes all open connections.
    // Once called, this mongodb instance can no longer be used.
    (serviceProvider as any).mongoClient.close(false);

    if (result) {
      return { result: formatOutput(result) };
    }

    return {};
  } catch (error) {
    console.log(error);

    return { error };
  }
}

function cancelAll() {
  // Close mongoClient to free resources
  (serviceProvider as any).mongoClient.close(false);

  return { message: 'The call to the Node driver was cancelled', result: null };
}

// parentPort allows communication with the parent thread
(async () => {
  parentPort?.once('message', async (message) => {
    if (message === 'terminate') {
      parentPort?.postMessage(await cancelAll());
    }
  });

  // Send data back to the parent thread
  parentPort?.postMessage(
    await executeAll(
      workerData.codeToEvaluate,
      workerData.connectionString,
      workerData.connectionOptions
    )
  );
})();
