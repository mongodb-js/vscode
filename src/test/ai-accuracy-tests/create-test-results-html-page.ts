import { promises as fs } from 'fs';
import path from 'path';

export type TestResult = {
  Test: string;
  Type: string;
  'User Input': string;
  Namespace: string;
  Accuracy: number;
  Pass: '✗' | '✓';
  'Avg Execution Time (ms)': number;
  'Avg Prompt Tokens': number;
  'Avg Completion Tokens': number;
};

type TestOutput = {
  prompt: string;
  testType: string;
  outputs: string[];
};

export type TestOutputs = {
  [testName: string]: TestOutput;
};

function getTestResultsTable(testResults: TestResult[]): string {
  const headers = Object.keys(testResults[0])
    .map((key) => `<th>${key}</th>`)
    .join('');

  const resultRows = testResults
    .map((result) => {
      const row = Object.values(result)
        .map((value) => `<td>${value}</td>`)
        .join('');
      return `<tr>${row}</tr>`;
    })
    .join('');

  return `
    <table>
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        ${resultRows}
      </tbody>
    </table>
`;
}

function getTestOutputTables(testOutputs: TestOutputs): string {
  const outputTables = Object.entries(testOutputs)
    .map(([testName, output]) => {
      const outputRows = output.outputs
        .map((out) => `<tr><td>${out}</td></tr>`)
        .join('');
      return `
      <h2>${testName} <i>[${output.testType}]</i></h2>
      <p><strong>Prompt:</strong> ${output.prompt}</p>
      <table>
        <thead>
          <tr><th>Outputs</th></tr>
        </thead>
        <tbody>
          ${outputRows}
        </tbody>
      </table>
    `;
    })
    .join('');

  return outputTables;
}

export async function createTestResultsHTMLPage({
  testResults,
  testOutputs,
}: {
  testResults: TestResult[];
  testOutputs: TestOutputs;
}): Promise<string> {
  const htmlOutput = `<html>
  <head>
    <title>Test Results</title>
    <link rel="stylesheet" href="test-results-page-styles.css">
  </head>
  <body>
    <h1>Test Results</h1>
    ${getTestResultsTable(testResults)}
    <h1>Test Outputs</h1>
    ${getTestOutputTables(testOutputs)}
  </body>
</html>`;

  const htmlPageLocation = path.join(__dirname, 'test-results.html');
  await fs.writeFile(htmlPageLocation, htmlOutput);

  return htmlPageLocation;
}
