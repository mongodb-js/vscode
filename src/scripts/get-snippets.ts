const fs = require('fs');
const STAGE_OPERATORS = require('mongodb-ace-autocompleter').STAGE_OPERATORS;
const SNIPPETS_DIR = `${__dirname}/../snippets`;

const snippetTemplate = (
  prefix: string,
  description: string,
  snippet: string,
  comment?: string
) => {
  return {
    prefix,
    body: comment
      ? [...comment.split('\n'), ...snippet.split('\n')]
      : [...snippet.split('\n')],
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
      (writeFileError: Object) => {
        if (writeFileError) {
          return console.log(
            'An error occured while writing to stage-autocompleter.json',
            writeFileError
          );
        }

        console.log('stage-autocompleter.json file has been saved');
      }
    );
  } else {
    return console.log(mkdirError);
  }
});
