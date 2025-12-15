export function waitFor(condition: () => boolean, timeout = 10): Promise<void> {
  return new Promise<void>((resolve) => {
    const testInterval = setInterval(() => {
      if (condition()) {
        clearInterval(testInterval);
        resolve();
      }
    }, timeout);
  });
}
