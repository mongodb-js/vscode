import fs = require('fs');
import path = require('path');

const STAGE_OPERATORS = require('mongodb-ace-autocompleter').STAGE_OPERATORS;
const config = require(path.resolve(__dirname, '../../package.json'));
const SNIPPETS_DIR = path.resolve(__dirname, '../../src/snippets/');

const snippetTemplate = (
  prefix: string,
  description: string,
  snippet: string,
  comment?: string
): { prefix: string; body: Array<string>; description: string } => {
  const body = snippet.split('\n');

  body[0] = `${prefix}: ${body[0]}`;

  return {
    prefix,
    body: comment ? [...comment.split('\n'), ...body] : [...body],
    description
  };
};

const snippets = STAGE_OPERATORS.reduce(
  (
    prev: any,
    curr: {
      label: string;
      name: string;
      description: string;
      snippet: string;
      comment?: string;
    }
  ) => {
    prev[`MongoDB Aggregations ${curr.name}`] = snippetTemplate(
      curr.label,
      curr.description,
      curr.snippet,
      curr.comment
    );
    return prev;
  },
  {}
);

fs.mkdir(SNIPPETS_DIR, (mkdirError: any) => {
  if (!mkdirError || (mkdirError && mkdirError.code === 'EEXIST')) {
    fs.writeFile(
      `${SNIPPETS_DIR}/stage-autocompleter.json`,
      JSON.stringify(snippets, null, 2),
      'utf8',
      (writeFileError: Record<string, any> | null) => {
        if (writeFileError) {
          return console.log(
            'An error occured while writing to stage-autocompleter.json',
            writeFileError
          );
        }

        console.log(
          `${SNIPPETS_DIR}/stage-autocompleter.json file has been saved`
        );

        const readme = `Generated from mongodb-ace-autocompleter@${config.devDependencies['mongodb-ace-autocompleter']}`;

        fs.writeFile(
          `${SNIPPETS_DIR}/README.md`,
          readme,
          'utf8',
          (writeReadmeError: Record<string, any> | null) => {
            if (writeReadmeError) {
              return console.log(
                'An error occured while writing to README.md',
                writeReadmeError
              );
            }

            console.log(readme);
          }
        );
      }
    );
  } else {
    return console.log(mkdirError);
  }
});
