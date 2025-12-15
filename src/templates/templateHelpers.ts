/** Wraps a template function and escapes given string arguments. */
export function createTemplate<T extends (...args: string[]) => string>(
  templateBuilder: T,
): (...args: Parameters<T>) => string {
  return (...args: Parameters<T>) => {
    const escapedArgs = args.map((arg) => JSON.stringify(arg));

    return templateBuilder(...escapedArgs);
  };
}
