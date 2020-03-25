// /* eslint-disable @typescript-eslint/no-use-before-define */
// import * as vscode from 'vscode';
// import * as assert from 'assert';
// import { getDocUri, activate } from './helper';

// describe.skip('Should do completion', () => {
//   let docUri;
//   before(() => {
//     docUri = getDocUri('test.mongodb');
//   });

//   it('Completes JS/TS in mongodb file', async () => {
//     await testCompletion(docUri, new vscode.Position(0, 0), {
//       items: [
//         { label: 'JavaScript', kind: vscode.CompletionItemKind.Text },
//         { label: 'TypeScript', kind: vscode.CompletionItemKind.Text }
//       ]
//     });
//   });
// });

// async function testCompletion(
//   docUri: vscode.Uri,
//   position: vscode.Position,
//   expectedCompletionList: vscode.CompletionList
// ) {
//   await activate(docUri);

//   // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
//   const actualCompletionList = (await vscode.commands.executeCommand(
//     'vscode.executeCompletionItemProvider',
//     docUri,
//     position
//   )) as vscode.CompletionList;

//   assert.equal(
//     actualCompletionList.items.length,
//     expectedCompletionList.items.length
//   );
//   expectedCompletionList.items.forEach((expectedItem, i) => {
//     const actualItem = actualCompletionList.items[i];
//     assert.equal(actualItem.label, expectedItem.label);
//     assert.equal(actualItem.kind, expectedItem.kind);
//   });
// }
// /* eslint-disable @typescript-eslint/no-use-before-define */
// import * as vscode from 'vscode';
// import * as assert from 'assert';
// import { getDocUri, activate } from './helper';

// describe.skip('Should get diagnostics', () => {
//   let docUri;
//   before(() => {
//     docUri = getDocUri('diagnostics.mongodb');
//   });
//   it.skip('Diagnoses uppercase texts', async () => {
//     await testDiagnostics(docUri, [
//       {
//         message: 'ANY is all uppercase.',
//         range: toRange(0, 0, 0, 3),
//         severity: vscode.DiagnosticSeverity.Warning,
//         source: 'ex'
//       },
//       {
//         message: 'ANY is all uppercase.',
//         range: toRange(0, 14, 0, 17),
//         severity: vscode.DiagnosticSeverity.Warning,
//         source: 'ex'
//       },
//       {
//         message: 'OS is all uppercase.',
//         range: toRange(0, 18, 0, 20),
//         severity: vscode.DiagnosticSeverity.Warning,
//         source: 'ex'
//       }
//     ]);
//   });
// });

// function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
//   const start = new vscode.Position(sLine, sChar);
//   const end = new vscode.Position(eLine, eChar);
//   return new vscode.Range(start, end);
// }

// async function testDiagnostics(
//   docUri: vscode.Uri,
//   expectedDiagnostics: vscode.Diagnostic[]
// ) {
//   await activate(docUri);

//   const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

//   assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

//   expectedDiagnostics.forEach((expectedDiagnostic, i) => {
//     const actualDiagnostic = actualDiagnostics[i];
//     assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
//     assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
//     assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
//   });
// }
