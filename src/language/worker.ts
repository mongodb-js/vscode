import { CliServiceProvider } from '@mongosh/service-provider-server';
import dns from 'node:dns';
import { EJSON } from 'bson';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { parentPort } from 'worker_threads';
import { ServerCommands } from './serverCommands';

// Adopting dns result order changes with Node v18 and vscode 1.82.0-insider update.
// Refs https://github.com/microsoft/vscode/issues/189805
dns.setDefaultResultOrder('ipv4first');

import type {
  ShellEvaluateResult,
  PlaygroundDebug,
  WorkerEvaluate,
  MongoClientOptions,
} from '../types/playgroundType';

interface EvaluationResult {
  printable: any;
  type: string | null;
}

const getContent = ({ type, printable }: EvaluationResult) => {
  if (type === 'Cursor' || type === 'AggregationCursor') {
    return JSON.parse(EJSON.stringify(printable.documents));
  }

  return typeof printable !== 'object' || printable === null
    ? printable
    : JSON.parse(EJSON.stringify(printable));
};

const getLanguage = (evaluationResult: EvaluationResult) => {
  const content = getContent(evaluationResult);

  if (typeof content === 'object' && content !== null) {
    return 'json';
  }

  return 'plaintext';
};

/**
 * Execute code from a playground.
 */
const execute = async (
  codeToEvaluate: string,
  connectionString: string,
  connectionOptions: MongoClientOptions
): Promise<{ data?: ShellEvaluateResult; error?: any }> => {
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

    return { data: { outputLines, result } };
  } catch (error) {
    return { error };
  } finally {
    await serviceProvider.close(true);
  }
};

const handleMessageFromParentPort = async ({ name, data }): Promise<void> => {
  if (name === ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND) {
    parentPort?.postMessage(
      await execute(
        data.codeToEvaluate,
        data.connectionString,
        data.connectionOptions
      )
    );
  }
};

// parentPort allows communication with the parent thread.
parentPort?.once(
  'message',
  (message: { name: string; data: WorkerEvaluate }): void => {
    void handleMessageFromParentPort(message);
  }
);
