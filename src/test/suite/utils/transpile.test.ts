import { expect } from 'chai';
import { Language, transpile, extractTranspilable } from '../../../utils/transpile';

const BASIC_EXAMPLE = '[{}]';

const COMPLEX_EXAMPLE = `
[
   { $addFields:
      {
        isFound:
            { $function:
               {
                  body: function(name) {
                     return hex_md5(name) == "15b0a220baa16331e8d80e15367677ad"
                  },
                  args: [ "$name" ],
                  lang: "js"
               }
            },
         message:
            { $function:
               {
                  body: function(name, scores) {
                     let total = Array.sum(scores);
                     return \`Hello \${name}.  Your total score is \${total}.\`
                  },
                  args: [ "$name", "$scores"],
                  lang: "js"
               }
            }
       }
    }
]
`;

function fix(code) {
  // bson-transpilers emits code that sometimes has a space at the end of a
  // line which is hard to compare against
  return code.replace(/ $/mg, '');
}

suite('transpile()', () => {
  test('can transpile to python', () => {
    expect(transpile(BASIC_EXAMPLE, Language.PYTHON)).to.equal(`[
    {}
]`);
    expect(fix(transpile(COMPLEX_EXAMPLE, Language.PYTHON))).to.equal(`[
    {
        '$addFields': {
            'isFound': {
                '$function': {
                    'body': 'function(name) {\\n                     return hex_md5(name) == \\"15b0a220baa16331e8d80e15367677ad\\"\\n                  }',
                    'args': [
                        '$name'
                    ],
                    'lang': 'js'
                }
            },
            'message': {
                '$function': {
                    'body': 'function(name, scores) {\\n                     let total = Array.sum(scores);\\n                     return \`Hello \${name}.  Your total score is \${total}.\`\\n                  }',
                    'args': [
                        '$name', '$scores'
                    ],
                    'lang': 'js'
                }
            }
        }
    }
]`);
  });

  test('can transpile to java', () => {
    expect(transpile(BASIC_EXAMPLE, Language.JAVA)).to.equal('Arrays.asList(new Document())');
    expect(fix(transpile(COMPLEX_EXAMPLE, Language.JAVA))).to.equal(`Arrays.asList(new Document("$addFields",
    new Document("isFound",
    new Document("$function",
    new Document("body", "function(name) {\\n                     return hex_md5(name) == \\"15b0a220baa16331e8d80e15367677ad\\"\\n                  }")
                    .append("args", Arrays.asList("$name"))
                    .append("lang", "js")))
            .append("message",
    new Document("$function",
    new Document("body", "function(name, scores) {\\n                     let total = Array.sum(scores);\\n                     return \`Hello \${name}.  Your total score is \${total}.\`\\n                  }")
                    .append("args", Arrays.asList("$name", "$scores"))
                    .append("lang", "js")))))`);
  });

  test('can transpile to javascript', () => {
    expect(transpile(BASIC_EXAMPLE, Language.JAVASCRIPT)).to.equal(`[
  {}
]`);
    expect(fix(transpile(COMPLEX_EXAMPLE, Language.JAVASCRIPT))).to.equal(`[
  {
    '$addFields': {
      'isFound': {
        '$function': {
          'body': 'function(name) {\\n                     return hex_md5(name) == "15b0a220baa16331e8d80e15367677ad"\\n                  }',
          'args': [
            '$name'
          ],
          'lang': 'js'
        }
      },
      'message': {
        '$function': {
          'body': 'function(name, scores) {\\n                     let total = Array.sum(scores);\\n                     return \`Hello \${name}.  Your total score is \${total}.\`\\n                  }',
          'args': [
            '$name', '$scores'
          ],
          'lang': 'js'
        }
      }
    }
  }
]`);
  });

  test('can transpile to csharp', () => {
    expect(transpile(BASIC_EXAMPLE, Language.CSHARP)).to.equal(`new BsonArray
{
    new BsonDocument()
}`);
    expect(fix(transpile(COMPLEX_EXAMPLE, Language.CSHARP))).to.equal(`new BsonArray
{
    new BsonDocument("$addFields",
    new BsonDocument
        {
            { "isFound",
    new BsonDocument("$function",
    new BsonDocument
                {
                    { "body", "function(name) {\\n                     return hex_md5(name) == \\"15b0a220baa16331e8d80e15367677ad\\"\\n                  }" },
                    { "args",
    new BsonArray
                    {
                        "$name"
                    } },
                    { "lang", "js" }
                }) },
            { "message",
    new BsonDocument("$function",
    new BsonDocument
                {
                    { "body", "function(name, scores) {\\n                     let total = Array.sum(scores);\\n                     return \`Hello \${name}.  Your total score is \${total}.\`\\n                  }" },
                    { "args",
    new BsonArray
                    {
                        "$name",
                        "$scores"
                    } },
                    { "lang", "js" }
                }) }
        })
}`);
  });
});

suite('extractTranspilable()', () => {
  it('can extract []', () => {
    const results = extractTranspilable(`db.players.aggregate(${COMPLEX_EXAMPLE});`);
    expect(results).to.deep.equal([`[
   { $addFields:
      {
        isFound:
            { $function:
               {
                  body: function(name) {
                     return hex_md5(name) == \"15b0a220baa16331e8d80e15367677ad\"
                  },
                  args: [ \"$name\" ],
                  lang: \"js\"
               }
            },
         message:
            { $function:
               {
                  body: function(name, scores) {
                     let total = Array.sum(scores);
                     return \`Hello \${name}.  Your total score is \${total}.\`
                  },
                  args: [ \"$name\", \"$scores\"],
                  lang: \"js\"
               }
            }
       }
    }
]`]);
  });

  it('can extract {}', () => {
    const results = extractTranspilable('db.bios.find({ _id: 5 })');
    expect(results).to.deep.equal(['{ _id: 5 }']);
  });

  it('can find nothing', () => {
    const results = extractTranspilable('const foo = "";');
    expect(results).to.deep.equal([]);
  });

  it('can find multiple things', () => {
    const results = extractTranspilable(`
db.players.aggregate(${COMPLEX_EXAMPLE});
db.bios.find({ _id: 5 });
`);
    expect(results).to.have.length(2);
  });
});
