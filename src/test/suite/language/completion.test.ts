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

// function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
//   const start = new vscode.Position(sLine, sChar);
//   const end = new vscode.Position(eLine, eChar);
//   return new vscode.Range(start, end);
// }
