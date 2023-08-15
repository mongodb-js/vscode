import type { ExtensionContext } from 'vscode';
import type { KeytarInterface } from './utils/keytar';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ext {
  export let context: ExtensionContext;
  export let keytarModule: KeytarInterface | undefined;
}

export function getImagesPath(): string {
  return ext.context.asAbsolutePath('images');
}
