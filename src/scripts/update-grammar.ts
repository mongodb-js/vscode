import fs = require('fs');
import https = require('https');
import path = require('path');

const mongodbGrammar =
  'https://raw.githubusercontent.com/mongodb-js/vscode-mongodb-language/master/syntaxes/mongodb.tmLanguage.json';

const file = fs.createWriteStream(
  path.resolve('./src/syntaxes/mongodb.tmLanguage.json')
);

https
  .get(mongodbGrammar, (res) => {
    console.log(
      'mongodb.tmLanguage.json file was downloaded from mongodb-js/vscode-mongodb-language'
    );
    console.log('statusCode:', res.statusCode);
    res.pipe(file);
  })
  .on('error', (error) => {
    console.log(
      'An error occured while downloading mongodb.tmLanguage.json',
      error
    );
  });
