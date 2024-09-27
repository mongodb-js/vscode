// Exported here so that the accuracy tests can use it without
// needing to define all of the testing types the main tests have.
export function asyncIterableFromArray<T>(array: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): {
      next(): Promise<IteratorResult<T, boolean>>;
    } {
      let index = 0;
      return {
        next(): Promise<{
          value: any;
          done: boolean;
        }> {
          if (index < array.length) {
            const value = array[index++];
            return Promise.resolve({ value, done: false });
          }

          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}
