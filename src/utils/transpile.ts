import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import mongodbQueryParser from 'mongodb-query-parser';
import decomment from 'decomment';
import compiler from 'bson-transpilers';

export enum Language {
  JAVA = 'java',
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  CSHARP = 'csharp'
}

export function transpile (code: string, targetLanguage: Language) {
  // turn function () {} into 'function () {}'
  const parsed = mongodbQueryParser(decomment(code));
  code = mongodbQueryParser.toJSString(parsed);

  // idiomatic = false
  // driverSyntax = false
  return compiler.shell[targetLanguage].compile(code, false, false);
}


export function extractTranspilable (code: string):string[] {
  // return all {} or []
  const root = parse(code, {
    ecmaVersion: 6,
    ranges: true
  });

  const snippets : string[] = [];

  const visit = (node) => {
    const range = node.range;
    const snippet = code.slice(range[0], range[1]);
    snippets.push(snippet);
  };

  walk.recursive(root, {}, {
    ArrayExpression: visit,
    ObjectExpression: visit
  });

  return snippets;
}
