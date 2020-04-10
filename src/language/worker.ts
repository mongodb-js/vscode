import { parentPort, workerData } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider, NodeOptions } from '@mongosh/service-provider-server';
import formatOutput from '../utils/formatOutput';

type EvaluationResult = {
  value: any;
  type?: string;
};

let serviceProvider: CliServiceProvider;

// Close mongoClient after each runtime evaluation
// to make sure that all resources are free and can be used with a new request.
// The mongoClient.close method closes the underlying connector,
// which in turn closes all open connections.
// Once called, this mongodb instance can no longer be used.
const cancelAll = (): void => {
  (serviceProvider as any).mongoClient.close(false);
  console.log('The call to the Node driver was cancelled');
}

const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: NodeOptions = {}
) => {
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
    const runtime: ElectronRuntime = new ElectronRuntime(serviceProvider);
    const result: EvaluationResult | string = await runtime.evaluate(codeToEvaluate);

    if (result) {
      return { result: formatOutput(result) };
    }

    return {};
  } catch (error) {
    console.log(error);

    return { error };
  } finally {
    cancelAll();
  }
}

// parentPort allows communication with the parent thread
(async () => {
  // Close mongo client
  parentPort?.on('message', (message) => {
    if (message === 'terminate') {
      parentPort?.postMessage(cancelAll());
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
