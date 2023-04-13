import { CompletionItemKind } from 'vscode-languageserver/node';

const enum Kind {
  alias = 'alias',
  callSignature = 'call',
  class = 'class',
  const = 'const',
  constructorImplementation = 'constructor',
  constructSignature = 'construct',
  directory = 'directory',
  enum = 'enum',
  enumMember = 'enum member',
  externalModuleName = 'external module name',
  function = 'function',
  indexSignature = 'index',
  interface = 'interface',
  keyword = 'keyword',
  let = 'let',
  localFunction = 'local function',
  localVariable = 'local var',
  method = 'method',
  memberGetAccessor = 'getter',
  memberSetAccessor = 'setter',
  memberVariable = 'property',
  module = 'module',
  primitiveType = 'primitive type',
  script = 'script',
  type = 'type',
  variable = 'var',
  warning = 'warning',
  string = 'string',
  parameter = 'parameter',
  typeParameter = 'type parameter',
}

export const convertKind = (kind: string): CompletionItemKind => {
  switch (kind) {
    case Kind.primitiveType:
    case Kind.keyword:
      return CompletionItemKind.Keyword;

    case Kind.const:
    case Kind.let:
    case Kind.variable:
    case Kind.localVariable:
    case Kind.alias:
    case Kind.parameter:
      return CompletionItemKind.Variable;

    case Kind.memberVariable:
    case Kind.memberGetAccessor:
    case Kind.memberSetAccessor:
      return CompletionItemKind.Field;

    case Kind.function:
    case Kind.localFunction:
      return CompletionItemKind.Function;

    case Kind.method:
    case Kind.constructSignature:
    case Kind.callSignature:
    case Kind.indexSignature:
      return CompletionItemKind.Method;

    case Kind.enum:
      return CompletionItemKind.Enum;

    case Kind.enumMember:
      return CompletionItemKind.EnumMember;

    case Kind.module:
    case Kind.externalModuleName:
      return CompletionItemKind.Module;

    case Kind.class:
    case Kind.type:
      return CompletionItemKind.Class;

    case Kind.interface:
      return CompletionItemKind.Interface;

    case Kind.warning:
      return CompletionItemKind.Text;

    case Kind.script:
      return CompletionItemKind.File;

    case Kind.directory:
      return CompletionItemKind.Folder;

    case Kind.string:
      return CompletionItemKind.Constant;

    default:
      return CompletionItemKind.Property;
  }
};
