import { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { parentPort } from 'worker_threads';
import util from 'util';

import { ServerCommand } from './serverCommands';
import type {
  ShellEvaluateResult,
  WorkerEvaluate,
  MongoClientOptions,
} from '../types/playgroundType';
import { getEJSON } from '../utils/ejson';
import type { DocumentViewAndEditFormat } from '../editors/types';

interface EvaluationResult {
  printable: any;
  type: string | null;
}
interface EvaluationResultWithExpectedFormat extends EvaluationResult {
  expectedFormat: DocumentViewAndEditFormat;
}

const getContent = ({
  type,
  printable,
  expectedFormat,
}: EvaluationResultWithExpectedFormat): unknown => {
  if (type === 'Cursor' || type === 'AggregationCursor') {
    if (expectedFormat === 'shell') {
      console.log('printable.documents', printable.documents);
      return printable.documents;
    }
    return getEJSON(printable.documents);
  }

  if (
    expectedFormat === 'shell' ||
    typeof printable !== 'object' ||
    printable === null
  ) {
    return printable;
  }

  return getEJSON(printable);
};

export const getLanguage = (
  content: unknown,
  expectedFormat: DocumentViewAndEditFormat,
): 'json' | 'plaintext' | 'javascript' => {
  if (typeof content === 'object' && content !== null) {
    return expectedFormat === 'shell' ? 'javascript' : 'json';
  }

  return 'plaintext';
};

type ExecuteCodeOptions = {
  codeToEvaluate: string;
  connectionString: string;
  connectionOptions: MongoClientOptions;
  expectedFormat: DocumentViewAndEditFormat;
  onPrint?: (values: EvaluationResult[]) => void;
  filePath?: string;
};

function handleEvalPrint(values: EvaluationResult[]): void {
  parentPort?.postMessage({
    name: ServerCommand.showConsoleOutput,
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
  expectedFormat,
  connectionString,
  connectionOptions,
  filePath,
}: ExecuteCodeOptions): Promise<{
  data: ShellEvaluateResult | null;
  error?: Error;
}> => {
  const serviceProvider = await NodeDriverServiceProvider.connect(
    connectionString,
    connectionOptions,
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
          filePath,
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
    const content = getContent({
      expectedFormat,
      type,
      printable: rpcSafePrintable,
    });
    const result = {
      namespace,
      type: type ? type : typeof rpcSafePrintable,
      content,
      language: getLanguage(content, expectedFormat),
    };

    return { data: { result } };
  } catch (error) {
    return { error: error as Error, data: null };
  } finally {
    await serviceProvider.close();
  }
};

const handleMessageFromParentPort = async ({ name, data }): Promise<void> => {
  if (name === ServerCommand.executeCodeFromPlayground) {
    parentPort?.postMessage({
      name: ServerCommand.codeExecutionResult,
      payload: await execute(data),
    });
  }
};

// parentPort allows communication with the parent thread.
parentPort?.once(
  'message',
  (message: { name: string; data: WorkerEvaluate }): void => {
    void handleMessageFromParentPort(message);
  },
);
