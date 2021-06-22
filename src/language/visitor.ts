import type * as babel from '@babel/core';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

const PLACEHOLDER = 'TRIGGER_CHARACTER';

export type CompletionState = {
  databaseName: string | null;
  collectionName: string | null;
  isObjectKey: boolean;
  isShellMethod: boolean;
  isUseCallExpression: boolean;
  isDbCallExpression: boolean;
  isCollectionName: boolean;
  isAggregationCursor: boolean;
  isFindCursor: boolean;
};

export class Visitor {
  _state: CompletionState;
  _position: { line: number; character: number };

  constructor() {
    this._state = this._getDefaultNodesValues();
    this._position = { line: 0, character: 0 };
  }

  _visitCallExpression(node: babel.types.CallExpression): void {
    if (this._checkIsUseCall(node)) {
      this._state.isUseCallExpression = true;
    }

    if (this._checkIsCollectionName(node)) {
      this._state.isCollectionName = true;
    }

    if (this._checkHasDatabaseName(node)) {
      this._state.databaseName = (node.arguments[0] as babel.types.StringLiteral).value;
    }
  }

  _visitMemberExpression(node: babel.types.MemberExpression): void {
    if (this._checkHasAggregationCall(node)) {
      this._state.isAggregationCursor = true;
    }

    if (this._checkHasFindCall(node)) {
      this._state.isFindCursor = true;
    }

    if (this._checkIsShellMethod(node)) {
      this._state.isShellMethod = true;
    }

    if (this._checkIsCollectionName(node)) {
      this._state.isCollectionName = true;
    }

    if (this._checkHasCollectionName(node)) {
      this._state.collectionName = ((node.object as babel.types.MemberExpression).property as babel.types.Identifier).name;
    }
  }

  _visitExpressionStatement(node: babel.types.ExpressionStatement): void {
    if (this._checkIsDbCall(node)) {
      this._state.isDbCallExpression = true;
    }
  }

  _visitObjectExpression(node: babel.types.ObjectExpression): void {
    if (this._checkIsObjectKey(node)) {
      this._state.isObjectKey = true;
    }
  }

  _handleTriggerCharacter(
    textFromEditor: string,
    position: { line: number; character: number }
  ): string {
    const textLines = textFromEditor.split('\n');
    // Text before the current character
    const prefix =
      position.character === 0
        ? ''
        : textLines[position.line].slice(0, position.character);
    // Text after the current character
    const postfix =
      position.character === 0
        ? textLines[position.line]
        : textLines[position.line].slice(position.character);

    // Use a placeholder to handle a trigger dot
    // and track of the current character position
    // TODO: check the absolute character position
    textLines[position.line] = `${prefix}${PLACEHOLDER}${postfix}`;

    return textLines.join('\n');
  }

  parseAST(
    textFromEditor: string,
    position: { line: number; character: number }
  ): CompletionState {
    this._state = this._getDefaultNodesValues();
    this._position = position;

    const textWithPlaceholder = this._handleTriggerCharacter(
      textFromEditor,
      position
    );
    let ast: any;

    try {
      ast = parser.parse(textWithPlaceholder, {
        // Parse in strict mode and allow module declarations
        sourceType: 'module'
      });
    } catch (error) {
      return this._state;
    }

    traverse(ast, {
      enter: (path: babel.NodePath) => {
        switch (path.node.type) {
          case 'CallExpression':
            this._visitCallExpression(path.node);
            break;
          case 'MemberExpression':
            this._visitMemberExpression(path.node);
            break;
          case 'ExpressionStatement':
            this._visitExpressionStatement(path.node);
            break;
          case 'ObjectExpression':
            this._visitObjectExpression(path.node);
            break;
          default:
            break;
        }
      }
    });

    return this._state;
  }

  _getDefaultNodesValues() {
    return {
      databaseName: null,
      collectionName: null,
      isObjectKey: false,
      isShellMethod: false,
      isUseCallExpression: false,
      isDbCallExpression: false,
      isCollectionName: false,
      isAggregationCursor: false,
      isFindCursor: false
    };
  }

  // eslint-disable-next-line complexity
  _checkIsUseCall(node: babel.types.CallExpression): boolean {
    if (
      (node.callee.type === 'Identifier' &&
        node.callee.name === 'use' &&
        node.arguments &&
        node.arguments.length === 1 &&
        node.arguments[0].type === 'StringLiteral' &&
        node.arguments[0].value.includes(PLACEHOLDER)) ||
      (node.arguments &&
        node.arguments.length === 1 &&
        node.arguments[0].type === 'TemplateLiteral' &&
        node.arguments[0].quasis &&
        node.arguments[0].quasis.length === 1 &&
        node.arguments[0].quasis[0].value?.raw &&
        node.arguments[0].quasis[0].value?.raw.includes(PLACEHOLDER))
    ) {
      return true;
    }

    return false;
  }

  _checkIsDbCall(node: babel.types.ExpressionStatement): boolean {
    if (
      node.expression.type === 'MemberExpression' &&
      node.expression.object.type === 'Identifier' &&
      node.expression.object.name === 'db'
    ) {
      return true;
    }

    return false;
  }

  _checkIsObjectKey(node: babel.types.ObjectExpression): boolean {
    if (
      node.properties.find(
        (item: any) => !!(item.key.name && item.key.name.includes(PLACEHOLDER))
      )
    ) {
      return true;
    }

    return false;
  }

  // eslint-disable-next-line complexity
  _checkIsCollectionName(node: babel.types.CallExpression | babel.types.MemberExpression): boolean {
    if (
      (node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        node.object.name === 'db' &&
        node.property.type === 'Identifier' &&
        node.property.name.includes(PLACEHOLDER)) ||
      (node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        this._checkIsCollectionName(node.callee))
    ) {
      return true;
    }

    return false;
  }

  _checkHasAggregationCall(node: babel.types.MemberExpression): boolean {
    if (
      node.object.type === 'CallExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      node.object.callee.type === 'MemberExpression' &&
      !node.object.callee.computed &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'aggregate'
    ) {
      return true;
    }

    return false;
  }

  _checkHasFindCall(node: babel.types.MemberExpression): boolean {
    if (
      node.object.type === 'CallExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      node.object.callee.type === 'MemberExpression' &&
      !node.object.callee.computed &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'find'
    ) {
      return true;
    }

    return false;
  }

  _checkHasDatabaseName(node: babel.types.CallExpression): boolean {
    if (
      node.callee.type === 'Identifier' &&
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'StringLiteral' &&
      node.loc &&
      (this._position.line > node.loc.end.line - 1 ||
        (this._position.line === node.loc.end.line - 1 &&
          this._position.character >= node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  _checkHasCollectionName(node: babel.types.MemberExpression): boolean {
    if (
      node.object.type === 'MemberExpression' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'db'
    ) {
      return true;
    }

    return false;
  }

  _checkIsShellMethod(node: babel.types.MemberExpression): boolean {
    if (
      node.object.type === 'MemberExpression' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'db' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER)
    ) {
      return true;
    }

    return false;
  }
}
