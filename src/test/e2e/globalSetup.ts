import { downloadAndUnzipVSCode } from '@vscode/test-electron';

// Resolve the VS Code build before any test starts.
export default async function globalSetup(): Promise<void> {
  await downloadAndUnzipVSCode('insiders');
}
