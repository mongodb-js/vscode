import { CliServiceProvider } from '@mongosh/service-provider-server';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { parentPort, workerData } from 'worker_threads';
import {
  PlaygroundResult,
  PlaygroundDebug,
  ShellExecuteAllResult,
  EvaluationResult,
} from '../types/playgroundType';
import { getContent, getLanguage } from '../utils/output';

// MongoClientOptions is the second argument of CliServiceProvider.connect(connectionStr, options)
type MongoClientOptions = NonNullable<
  Parameters<typeof CliServiceProvider['connect']>[1]
>;

type NotebookResult = PlaygroundResult & { mime?: string; options?: string };

let runtime: ElectronRuntime;

function injectContext(codeToEvaluate) {
  const ctx = [
    "const chart = (options) => ({ data: result.toArray(), mime: 'application/json+chart', options });",
  ];
  const injectableContex = ctx.map((expr) => expr.toString()).join('\n');
  return `${injectableContex}\n${codeToEvaluate}`;
}

const executeAll = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: MongoClientOptions
): Promise<{
  data?: ShellExecuteAllResult;
  error?: any;
  moduleName?: string;
}> => {
  try {
    // Instantiate a data service provider.
    //
    // TODO: update when `mongosh` will start to support cancellationToken.
    // See: https://github.com/mongodb/node-mongodb-native/commit/2014b7b/#diff-46fff96a6e12b2b0b904456571ce308fR132
    const serviceProvider: CliServiceProvider =
      await CliServiceProvider.connect(connectionString, connectionOptions);
    const outputLines: PlaygroundDebug = [];

    // Create a new instance of the runtime and evaluate code from a playground.
    if (!runtime) {
      runtime = new ElectronRuntime(serviceProvider);
    }

    runtime.setEvaluationListener({
      onPrint(values: EvaluationResult[]) {
        for (const { type, printable } of values) {
          outputLines.push({
            type,
            content: getContent({ type, printable }),
            namespace: null,
            language: null,
          });
        }
      },
    });

    const evalResult = await runtime.evaluate(injectContext(codeToEvaluate));
    const { source, type } = evalResult;
    let { printable } = evalResult;
    let mime;
    let options;

    if (printable?.mime) {
      mime = printable.mime;
      options = printable.options;
      printable = printable.data;
    }

    const namespace =
      source && source.namespace
        ? `${source.namespace.db}.${source.namespace.collection}`
        : null;
    const result: NotebookResult = {
      namespace,
      type: type ? type : typeof printable,
      content: getContent({ type, printable }),
      language: getLanguage({ type, printable }),
      mime,
      options,
    };

    return { data: { outputLines, result } };
  } catch (error) {
    let moduleName;

    if ((<any>error).code === 'MODULE_NOT_FOUND') {
      const str = (<any>error).message;
      const arr = str.split("'");

      if (arr.length > 2 && arr[0].includes('Cannot find module')) {
        moduleName = arr[1];
      }
    }
    return { error, moduleName };
  }
};

// eslint-disable-next-line complexity
const handleMessageFromParentPort = async ({
  name,
  data,
}: {
  name: string;
  data: any;
}): Promise<void> => {
  if (name === 'EXECUTE_NOTEBOOK') {
    parentPort?.postMessage(
      await executeAll(
        data.codeToEvaluate || workerData.codeToEvaluate,
        data.connectionString || workerData.connectionString,
        data.connectionOptions || workerData.connectionOptions
      )
    );
  }
};

// parentPort allows communication with the parent thread.
parentPort?.on('message', (message: any): void => {
  void handleMessageFromParentPort(message);
});
