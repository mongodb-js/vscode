import type { ExtensionContext } from 'vscode';

export const ext = {
  context: undefined as unknown as ExtensionContext,
};

export function getImagesPath(): string {
  return ext.context.asAbsolutePath('images');
}
