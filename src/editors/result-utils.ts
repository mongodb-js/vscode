import type {
  PlaygroundRunCursorResult,
  PlaygroundRunResult,
} from '../types/playgroundType';

export function isSafeQueryResult(
  result: PlaygroundRunResult,
): result is PlaygroundRunCursorResult {
  if (!result.constructionOptions) {
    return false;
  }

  if (result.constructionOptions.chains) {
    for (const chain of result.constructionOptions.chains) {
      if (chain.method === 'map') {
        // map doesn't work because we'd be passing a function back and forth
        // across process boundaries, getting it serialized and deserialized.
        return false;
      }
    }
  }

  if (result.constructionOptions.options.method === 'aggregate') {
    for (const stage of result.constructionOptions.options.args[2]) {
      if (stage.$merge || stage.$out) {
        // other than the fact that navigating through the results of $out and
        // $merge would be non-sensical, we also can't append a stage like $skip
        // or $limit after it.
        return false;
      }
    }
  }

  return true;
}
