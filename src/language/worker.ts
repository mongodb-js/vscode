import { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { parentPort } from 'worker_threads';
import { ServerCommands } from './serverCommands';

import type {
  ShellEvaluateResult,
  WorkerEvaluate,
  MongoClientOptions,
} from '../types/playgroundType';
import util from 'util';
import { getEJSON } from '../utils/ejson';

interface EvaluationResult {
  printable: any;
  type: string | null;
}

const getContent = ({ type, printable }: EvaluationResult): any => {
  if (type === 'Cursor' || type === 'AggregationCursor') {
    return getEJSON(printable.documents);
  }

  return typeof printable !== 'object' || printable === null
    ? printable
    : getEJSON(printable);
};

export const getLanguage = (content: any): 'json' | 'plaintext' => {
  if (typeof content === 'object' && content !== null) {
    return 'json';
  }

  return 'plaintext';
};

type ExecuteCodeOptions = {
  codeToEvaluate: string;
  connectionString: string;
  connectionOptions: MongoClientOptions;
  onPrint?: (values: EvaluationResult[]) => void;
  filePath?: string;
};

function handleEvalPrint(values: EvaluationResult[]): void {
  parentPort?.postMessage({
    name: ServerCommands.SHOW_CONSOLE_OUTPUT,
    payload: values.map((v) => {
      return typeof v.printable === 'string'
        ? v.printable
        : util.inspect(v.printable);
    }),
  });
}

/**
 * Execute code from a playground.
 */
export const execute = async ({
  codeToEvaluate,
  onPrint = handleEvalPrint,
  connectionString,
  connectionOptions,
  filePath,
}: ExecuteCodeOptions): Promise<{
  data: ShellEvaluateResult | null;
  error?: any;
}> => {
  const serviceProvider = await NodeDriverServiceProvider.connect(
    connectionString,
    connectionOptions
  );

  try {
    // Create a new instance of the runtime for each playground evaluation.
    const runtime = new ElectronRuntime(serviceProvider);

    // Collect console.log() output.
    runtime.setEvaluationListener({
      onPrint,
    });

    // In order to support local require directly from the file where code lives, we can not wrap the
    // whole code in a function for two reasons:
    // 1. We need to return the response and can not simply add return. And
    // 2. We can not use eval to evaluate the *codeToEvaluate* as mongosh async-rewriter can’t see into the eval.
    // We are also not directly concatenating the require with the code either due to "use strict"
    if (filePath) {
      await runtime.evaluate(`(function () {
        globalThis.require = require('module').createRequire(${JSON.stringify(
          filePath
        )});
      } ())`);
    }

    // Evaluate a playground content.
    const { source, type, printable } = await runtime.evaluate(codeToEvaluate);
    const namespace =
      source && source.namespace
        ? `${source.namespace.db}.${source.namespace.collection}`
        : undefined;

    // The RPC protocol can't handle functions and it wouldn't make sense to return them anyway. Since just
    // declaring a function doesn't execute it, the best thing we can do is return undefined, similarly to
    // what we do when there's no return value from the script.
    const rpcSafePrintable =
      typeof printable !== 'function' ? printable : undefined;

    // Prepare a playground result.
    const content = getContent({ type, printable: rpcSafePrintable });
    const result = {
      namespace,
      type: type ? type : typeof rpcSafePrintable,
      content,
      language: getLanguage(content),
    };

    return { data: { result } };
  } catch (error) {
    return { error, data: null };
  } finally {
    await serviceProvider.close(true);
  }
};

const handleMessageFromParentPort = async ({ name, data }): Promise<void> => {
  if (name === ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND) {
    parentPort?.postMessage({
      name: ServerCommands.CODE_EXECUTION_RESULT,
      payload: await execute(data),
    });
  }
};

// parentPort allows communication with the parent thread.
parentPort?.once(
  'message',
  (message: { name: string; data: WorkerEvaluate }): void => {
    void handleMessageFromParentPort(message);
  }
);
