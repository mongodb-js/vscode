// This is a stateful streaming implementation of the Knuth-Morris-Pratt algorithm
// for substring search. It supports being invoked with multiple fragments of the
// haystack and is capable of finding matches spanning multiple fragments.
class StreamingKMP {
  public needle: string;
  private _lookupVector: number[];

  // In cases where we are fed a string that has a suffix that matches a prefix
  // of the needle, we're storing the index in the needle which we last matched.
  // Then when we get a new haystack, we start matching from that needle.
  private _lastMatchingIndex = 0;

  constructor(needle: string) {
    this.needle = needle;
    this._lookupVector = this._createLookupVector();
  }

  private _createLookupVector(): number[] {
    const vector = new Array<number>(this.needle.length);
    let j = 0;
    vector[0] = 0;

    for (let i = 1; i < this.needle.length; i++) {
      while (j > 0 && this.needle[i] !== this.needle[j]) {
        j = vector[j - 1];
      }

      if (this.needle[i] === this.needle[j]) {
        j++;
      }

      vector[i] = j;
    }

    return vector;
  }

  // Returns the index in the haystackFragment **after** the needle.
  // This is done because the match may have occurred over multiple fragments,
  // so the index of the needle start would be negative.
  public match(haystackFragment: string): number {
    let j = this._lastMatchingIndex; // index in needle
    let i = 0; // index in haystack

    while (i < haystackFragment.length) {
      if (haystackFragment[i] === this.needle[j]) {
        i++;
        j++;
      }

      if (j === this.needle.length) {
        this._lastMatchingIndex = 0;
        return i;
      }

      if (
        i < haystackFragment.length &&
        haystackFragment[i] !== this.needle[j]
      ) {
        if (j !== 0) {
          j = this._lookupVector[j - 1];
        } else {
          i++;
        }
      }
    }

    this._lastMatchingIndex = j;
    return -1;
  }

  public reset(): void {
    this._lastMatchingIndex = 0;
  }
}

class FragmentMatcher {
  private _startMatcher: StreamingKMP;
  private _endMatcher: StreamingKMP;
  private _matchedContent?: string;
  private _onContentMatched: (content: string) => void;

  constructor({
    identifier,
    onContentMatched,
  }: {
    identifier: {
      start: string;
      end: string;
    };
    onContentMatched: (content: string) => void;
  }) {
    this._startMatcher = new StreamingKMP(identifier.start);
    this._endMatcher = new StreamingKMP(identifier.end);
    this._onContentMatched = onContentMatched;
  }

  private _contentMatched(): void {
    const content = this._matchedContent;
    if (content !== undefined) {
      // Strip the trailing end identifier from the matched content
      this._onContentMatched(
        content.slice(0, content.length - this._endMatcher.needle.length)
      );
    }

    this._matchedContent = undefined;
    this._startMatcher.reset();
    this._endMatcher.reset();
  }

  public process(fragment: string): void {
    if (this._matchedContent === undefined) {
      // We haven't matched the start identifier yet, so try and do that
      const startIndex = this._startMatcher.match(fragment);
      if (startIndex !== -1) {
        // We found a match for the start identifier - update `_matchedContent` to an empty string
        // and recursively call `process` with the remainder of the fragment.
        this._matchedContent = '';
        this.process(fragment.slice(startIndex));
      }
    } else {
      const endIndex = this._endMatcher.match(fragment);
      if (endIndex !== -1) {
        // We've matched the end - emit the matched content and continue processing the partial fragment
        this._matchedContent += fragment.slice(0, endIndex);
        this._contentMatched();
        this.process(fragment.slice(endIndex));
      } else {
        // We haven't matched the end yet - append the fragment to the matched content and wait
        // for a future fragment to contain the end identifier.
        this._matchedContent += fragment;
      }
    }
  }
}

/**
 * This function, provided a stream of text fragments, will stream the
 * content to the provided stream and call the onStreamIdentifier function
 * when an identifier is streamed. This is useful for inserting code actions
 * into a chat response, whenever a code block has been written.
 */
export async function processStreamWithIdentifiers({
  processStreamFragment,
  onStreamIdentifier,
  inputIterable,
  identifier,
}: {
  processStreamFragment: (fragment: string) => void;
  onStreamIdentifier: (content: string) => void;
  inputIterable: AsyncIterable<string>;
  identifier: {
    start: string;
    end: string;
  };
}): Promise<void> {
  const fragmentMatcher = new FragmentMatcher({
    identifier,
    onContentMatched: onStreamIdentifier,
  });

  for await (const fragment of inputIterable) {
    processStreamFragment(fragment);
    fragmentMatcher.process(fragment);
  }
}
