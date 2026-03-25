import _ from 'lodash';
import { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { parentPort } from 'worker_threads';
import util from 'util';
import { EJSON } from 'bson';

import { ServerCommand } from './serverCommands';
import type {
  ShellEvaluateResult,
  MongoClientOptions,
} from '../types/playgroundType';
import { getEJSON } from '../utils/ejson';
import type { DocumentViewAndEditFormat } from '../editors/types';
import { isSafeQueryResult } from '../editors/result-utils';
import { deserializeBSON, serializeBSON } from './serializer';

interface EvaluationResult {
  printable: any;
  type: string | null;
}
interface EvaluationResultWithExpectedFormat extends EvaluationResult {
  expectedFormat: DocumentViewAndEditFormat;
}

type SerializableError = {
  name: string;
  message: string;
  stack?: string;
};

const getContent = ({
  type,
  printable,
  expectedFormat,
}: EvaluationResultWithExpectedFormat): unknown => {
  if (type === 'Cursor' || type === 'AggregationCursor') {
    if (expectedFormat === 'shell') {
      // We serialize the documents to send them over to the main
      // extension to show the results.
      return EJSON.serialize(printable.documents, { relaxed: false });
    }
    return getEJSON(printable.documents);
  }

  if (typeof printable !== 'object' || printable === null) {
    return printable;
  }

  return expectedFormat === 'shell'
    ? EJSON.serialize(printable, { relaxed: false })
    : getEJSON(printable);
};

export const getLanguage = (
  content: unknown,
  expectedFormat: DocumentViewAndEditFormat,
): 'json' | 'plaintext' | 'shell' => {
  if (typeof content === 'object' && content !== null) {
    return expectedFormat === 'shell' ? 'shell' : 'json';
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
  error?: SerializableError;
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
    const evaluationResult = await runtime.evaluate(codeToEvaluate);
    const { source, type, printable, constructionOptions } = evaluationResult;
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
      constructionOptions,
    };

    return { data: { result } };
  } catch (error) {
    const serializableError: SerializableError = {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    };
    return { error: serializableError, data: null };
  } finally {
    await serviceProvider.close();
  }
};

type ExecuteCodeFromPlaygroundResult = {
  data: ShellEvaluateResult | null;
  error?: SerializableError;
};

type MessageFromParentPort = {
  name: string;
  data: string;
};

type HandleMessageDeps = {
  executeFn?: typeof execute;
  isSafeQueryResultFn?: typeof isSafeQueryResult;
  postMessageFn?: (message: { name: string; payload: string }) => void;
};

function stripConstructionOptions(
  payload: ExecuteCodeFromPlaygroundResult,
): ExecuteCodeFromPlaygroundResult {
  const clone = _.cloneDeep(payload);
  if (clone.data?.result?.constructionOptions) {
    delete clone.data?.result?.constructionOptions;
  }
  return clone;
}

export const handleMessageFromParentPort = async (
  { name, data: _data }: MessageFromParentPort,
  {
    executeFn = execute,
    isSafeQueryResultFn = isSafeQueryResult,
    postMessageFn = (message) => parentPort?.postMessage(message),
  }: HandleMessageDeps = {},
): Promise<void> => {
  const data = deserializeBSON(_data);
  if (name === ServerCommand.executeCodeFromPlayground) {
    const result = await executeFn(data);
    // .map() cannot be cloned by  so just strip the constructionOptions and
    // then it won't be opened in the data browser and this result gets the
    // usual fallback experience
    const safeResult =
      result.data?.result && isSafeQueryResultFn(result.data.result)
        ? result
        : stripConstructionOptions(result);
    postMessageFn({
      name: ServerCommand.codeExecutionResult,
      payload: serializeBSON(safeResult),
    });
  }
};

// parentPort allows communication with the parent thread.
parentPort?.once('message', (message: MessageFromParentPort): void => {
  void handleMessageFromParentPort(message);
});
