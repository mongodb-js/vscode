import type * as babel from '@babel/core';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { RemoteConsole } from 'vscode-languageserver/node';
import * as util from 'util';

const PLACEHOLDER = 'TRIGGER_CHARACTER';

export interface VisitorSelection {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface VisitorTextAndSelection {
  textFromEditor: string;
  selection: VisitorSelection;
}

export interface CompletionState {
  databaseName: string | null;
  collectionName: string | null;
  isObject: boolean;
  isArray: boolean;
  isObjectKey: boolean;
  isShellMethod: boolean;
  isUseCallExpression: boolean;
  isDbCallExpression: boolean;
  isCollectionName: boolean;
  isAggregationCursor: boolean;
  isFindCursor: boolean;
}

export class Visitor {
  _state: CompletionState;
  _selection: VisitorSelection;
  _console: RemoteConsole;

  constructor(console: RemoteConsole) {
    this._state = this._getDefaultNodesValues();
    this._selection = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
    this._console = console;
  }

  _visitCallExpression(node: babel.types.Node): void {
    if (node.type !== 'CallExpression') {
      return;
    }

    this._checkIsBSONSelection(node);
    this._checkIsUseCall(node);
    this._checkIsCollectionName(node);
    this._checkHasDatabaseName(node);
  }

  _visitMemberExpression(node: babel.types.Node): void {
    if (node.type !== 'MemberExpression') {
      return;
    }

    this._checkHasAggregationCall(node);
    this._checkHasFindCall(node);
    this._checkIsShellMethod(node);
    this._checkIsCollectionName(node);
    this._checkHasCollectionName(node);
  }

  _visitExpressionStatement(node: babel.types.Node): void {
    if (node.type === 'ExpressionStatement') {
      this._checkIsDbCall(node);
    }
  }

  _visitObjectExpression(node: babel.types.Node): void {
    if (node.type === 'ObjectExpression') {
      this._checkIsObjectKey(node);
    }
  }

  _visitArrayExpression(node: babel.types.Node): void {
    if (node.type === 'ArrayExpression') {
      this._checkIsBSONSelection(node);
    }
  }

  _visitVariableDeclarator(node: babel.types.Node): void {
    if (node.type === 'VariableDeclarator') {
      this._checkIsBSONSelection(node);
    }
  }

  _visitObjectProperty(node: babel.types.Node): void {
    if (node.type === 'ObjectProperty') {
      this._checkIsBSONSelection(node);
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

  parseASTWithPlaceholder(
    textFromEditor: string,
    position: { line: number; character: number }
  ): CompletionState {
    const selection: VisitorSelection = {
      start: position,
      end: { line: 0, character: 0 },
    };

    textFromEditor = this._handleTriggerCharacter(textFromEditor, position);

    return this.parseAST({ textFromEditor, selection });
  }

  parseAST({
    textFromEditor,
    selection,
  }: VisitorTextAndSelection): CompletionState {
    let ast: any;

    this._state = this._getDefaultNodesValues();
    this._selection = selection;

    try {
      ast = parser.parse(textFromEditor, {
        // Parse in strict mode and allow module declarations
        sourceType: 'module',
      });
    } catch (error) {
      this._console.error(`parseAST error: ${util.inspect(error)}`);
      return this._state;
    }

    traverse(ast, {
      enter: (path: babel.NodePath) => {
        this._visitCallExpression(path.node);
        this._visitMemberExpression(path.node);
        this._visitExpressionStatement(path.node);
        this._visitObjectExpression(path.node);
        this._visitArrayExpression(path.node);
        this._visitVariableDeclarator(path.node);
        this._visitObjectProperty(path.node);
      },
    });

    return this._state;
  }

  _getDefaultNodesValues() {
    return {
      databaseName: null,
      collectionName: null,
      isObject: false,
      isArray: false,
      isObjectKey: false,
      isShellMethod: false,
      isUseCallExpression: false,
      isDbCallExpression: false,
      isCollectionName: false,
      isAggregationCursor: false,
      isFindCursor: false,
    };
  }

  _checkIsUseCallAsSimpleString(node: babel.types.CallExpression): void {
    if (
      node.callee.type === 'Identifier' &&
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'StringLiteral' &&
      node.arguments[0].value.includes(PLACEHOLDER)
    ) {
      this._state.isUseCallExpression = true;
    }
  }

  _checkIsUseCallAsTemplate(node: babel.types.CallExpression): void {
    if (
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'TemplateLiteral' &&
      node.arguments[0].quasis &&
      node.arguments[0].quasis.length === 1 &&
      node.arguments[0].quasis[0].value?.raw &&
      node.arguments[0].quasis[0].value?.raw.includes(PLACEHOLDER)
    ) {
      this._state.isUseCallExpression = true;
    }
  }

  _checkIsUseCall(node: babel.types.CallExpression): void {
    this._checkIsUseCallAsSimpleString(node);
    this._checkIsUseCallAsTemplate(node);
  }

  _checkIsDbCall(node: babel.types.ExpressionStatement): void {
    if (
      node.expression.type === 'MemberExpression' &&
      node.expression.object.type === 'Identifier' &&
      node.expression.object.name === 'db'
    ) {
      this._state.isDbCallExpression = true;
    }
  }

  _checkIsObjectKey(node: babel.types.ObjectExpression): void {
    this._state.isObjectKey = !!node.properties.find(
      (item: any) => !!(item.key.name && item.key.name.includes(PLACEHOLDER))
    );
  }

  _isParentAroundSelection(node: babel.types.Node): boolean {
    if (
      node.loc?.start?.line &&
      (node.loc.start.line - 1 < this._selection.start?.line ||
        (node.loc.start.line - 1 === this._selection.start?.line &&
          node.loc.start.column < this._selection.start?.character)) &&
      node.loc?.end?.line &&
      (node.loc.end.line - 1 > this._selection.end?.line ||
        (node.loc.end.line - 1 === this._selection.end?.line &&
          node.loc.end.column > this._selection.end?.character))
    ) {
      return true;
    }

    return false;
  }

  _isObjectPropBeforeSelection(node: babel.types.ObjectProperty): boolean {
    if (
      node.key.loc?.end &&
      (node.key.loc?.end.line - 1 < this._selection.start?.line ||
        (node.key.loc?.end.line - 1 === this._selection.start?.line &&
          node.key.loc?.end.column < this._selection.start?.character))
    ) {
      return true;
    }

    return false;
  }

  _isVariableIdentifierBeforeSelection(
    node: babel.types.VariableDeclarator
  ): boolean {
    if (
      node.id.loc?.end &&
      (node.id.loc?.end.line - 1 < this._selection.start?.line ||
        (node.id.loc?.end.line - 1 === this._selection.start?.line &&
          node.id.loc?.end.column < this._selection.start?.character))
    ) {
      return true;
    }

    return false;
  }

  _isWithinSelection(node: babel.types.Node): boolean {
    if (
      node.loc?.start?.line &&
      node.loc.start.line - 1 === this._selection.start?.line &&
      node.loc?.start?.column &&
      node.loc.start.column >= this._selection.start?.character &&
      node.loc?.end?.line &&
      node.loc.end.line - 1 === this._selection.end?.line &&
      node.loc?.end?.column &&
      node.loc.end.column <= this._selection.end?.character
    ) {
      return true;
    }

    return false;
  }

  _checkIsArrayWithinSelection(node: babel.types.Node): void {
    if (node.type === 'ArrayExpression' && this._isWithinSelection(node)) {
      this._state.isArray = true;
    }
  }

  _checkIsObjectWithinSelection(node: babel.types.Node): void {
    if (node.type === 'ObjectExpression' && this._isWithinSelection(node)) {
      this._state.isObject = true;
    }
  }

  _checkIsBSONSelectionInArray(node: babel.types.Node): void {
    if (
      node.type === 'ArrayExpression' &&
      node.elements &&
      this._isParentAroundSelection(node)
    ) {
      node.elements.forEach((item) => {
        if (item) {
          this._checkIsObjectWithinSelection(item);
          this._checkIsArrayWithinSelection(item);
        }
      });
    }
  }

  _checkIsBSONSelectionInFunction(node: babel.types.Node): void {
    if (
      node.type === 'CallExpression' &&
      node.arguments &&
      this._isParentAroundSelection(node)
    ) {
      node.arguments.forEach((item) => {
        if (item) {
          this._checkIsObjectWithinSelection(item);
          this._checkIsArrayWithinSelection(item);
        }
      });
    }
  }

  _checkIsBSONSelectionInVariable(node: babel.types.Node) {
    if (
      node.type === 'VariableDeclarator' &&
      node.init &&
      this._isVariableIdentifierBeforeSelection(node)
    ) {
      this._checkIsObjectWithinSelection(node.init);
      this._checkIsArrayWithinSelection(node.init);
    }
  }

  _checkIsBSONSelectionInObject(node: babel.types.Node) {
    if (
      node.type === 'ObjectProperty' &&
      node.value &&
      this._isObjectPropBeforeSelection(node)
    ) {
      this._checkIsObjectWithinSelection(node.value);
      this._checkIsArrayWithinSelection(node.value);
    }
  }

  _checkIsBSONSelection(node: babel.types.Node): void {
    this._checkIsBSONSelectionInFunction(node);
    this._checkIsBSONSelectionInArray(node);
    this._checkIsBSONSelectionInVariable(node);
    this._checkIsBSONSelectionInObject(node);
  }

  _checkIsCollectionNameAsMemberExpression(node: babel.types.Node): void {
    if (
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'db' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER)
    ) {
      this._state.isCollectionName = true;
    }
  }

  _checkIsCollectionNameAsCallExpression(node: babel.types.Node): void {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression'
    ) {
      this._checkIsCollectionName(node.callee);
    }
  }

  _checkIsCollectionName(
    node: babel.types.CallExpression | babel.types.MemberExpression
  ): void {
    this._checkIsCollectionNameAsMemberExpression(node);
    this._checkIsCollectionNameAsCallExpression(node);
  }

  _checkHasAggregationCall(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'CallExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      node.object.callee.type === 'MemberExpression' &&
      !node.object.callee.computed &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'aggregate'
    ) {
      this._state.isAggregationCursor = true;
    }
  }

  _checkHasFindCall(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'CallExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      node.object.callee.type === 'MemberExpression' &&
      !node.object.callee.computed &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'find'
    ) {
      this._state.isFindCursor = true;
    }
  }

  _checkHasDatabaseName(node: babel.types.CallExpression): void {
    if (
      node.callee.type === 'Identifier' &&
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'StringLiteral' &&
      node.loc &&
      (this._selection.start.line > node.loc.end.line - 1 ||
        (this._selection.start.line === node.loc.end.line - 1 &&
          this._selection.start.character >= node.loc.end.column))
    ) {
      this._state.databaseName = node.arguments[0].value;
    }
  }

  _checkHasCollectionName(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'MemberExpression' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'db'
    ) {
      this._state.collectionName = (
        node.object.property as babel.types.Identifier
      ).name;
    }
  }

  _checkIsShellMethod(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'MemberExpression' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'db' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER)
    ) {
      this._state.isShellMethod = true;
    }
  }
}
