import { parentPort, workerData } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider, NodeOptions } from '@mongosh/service-provider-server';
import formatOutput from '../utils/formatOutput';

type EvaluationResult = {
  value: any;
  type?: string;
};

const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: NodeOptions = {}
) => {
  try {
    // Instantiate a data service provider
    //
    // TODO: update when `mongosh` will start to support cancellationToken
    // See: https://github.com/mongodb/node-mongodb-native/commit/2014b7b/#diff-46fff96a6e12b2b0b904456571ce308fR132
    const serviceProvider: CliServiceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

    // Create a new instance of the runtime and run scripts
    const runtime: ElectronRuntime = new ElectronRuntime(serviceProvider);
    const result: EvaluationResult | string = await runtime.evaluate(codeToEvaluate);

    return [null, result ? formatOutput(result) : null];
  } catch (error) {
    console.log(error);

    return [error];
  }
}

// parentPort allows communication with the parent thread
(async () => {
  parentPort?.postMessage(
    await executeAll(
      workerData.codeToEvaluate,
      workerData.connectionString,
      workerData.connectionOptions
    )
  );
})();
