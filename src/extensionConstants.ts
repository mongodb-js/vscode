import { ExtensionContext } from 'vscode';

export namespace ext {
  export let context: ExtensionContext;
}

export function getImagesPath(): string {
  return ext.context.asAbsolutePath('images');
}
