import type { ExtensionContext } from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ext {
  export let context: ExtensionContext;
}

export function getImagesPath(): string {
  return ext.context.asAbsolutePath('images');
}
