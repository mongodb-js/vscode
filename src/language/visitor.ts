import type * as babel from '@babel/core';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
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

type ObjectKey =
  | babel.types.ObjectProperty
  | babel.types.SpreadElement
  | babel.types.ObjectMethod;

export interface CompletionState {
  databaseName: string | null;
  collectionName: string | null;
  isObjectKey: boolean;
  isIdentifierObjectValue: boolean;
  isTextObjectValue: boolean;
  isStage: boolean;
  stageOperator: string | null;
  isCollectionSymbol: boolean;
  isUseCallExpression: boolean;
  isGlobalSymbol: boolean;
  isDbSymbol: boolean;
  isCollectionName: boolean;
  isAggregationCursor: boolean;
  isFindCursor: boolean;
}

export interface SignatureState {
  isFind: boolean;
  isAggregation: boolean;
}

export interface ExportToLanguageState {
  isObjectSelection: boolean;
  isArraySelection: boolean;
}

export interface NamespaceState {
  databaseName: string | null;
  collectionName: string | null;
}

export class Visitor {
  _state: CompletionState | SignatureState | ExportToLanguageState | {};
  _selection: VisitorSelection;

  constructor() {
    this._state = {};
    this._selection = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }

  _visitCallExpression(path: babel.NodePath): void {
    if (path.node.type !== 'CallExpression') {
      return;
    }

    this._checkIsFind(path.node);
    this._checkIsAggregation(path.node);
    this._checkIsBSONSelection(path.node);
    this._checkIsUseCall(path.node);
    this._checkIsCollectionNameAsCallExpression(path.node);
    this._checkHasDatabaseName(path.node);
  }

  _visitMemberExpression(path: babel.NodePath): void {
    if (path.node.type !== 'MemberExpression') {
      return;
    }

    this._checkHasAggregationCall(path.node);
    this._checkHasFindCall(path.node);
    this._checkIsCollectionSymbol(path.node);
    this._checkIsCollectionNameAsMemberExpression(path.node);
    this._checkHasCollectionName(path.node);
  }

  _visitExpressionStatement(path: babel.NodePath): void {
    if (path.node.type === 'ExpressionStatement') {
      this._checkIsGlobalSymbol(path.node);
      this._checkIsDbSymbol(path.node);
    }
  }

  _visitObjectExpression(path: babel.NodePath): void {
    if (path.node.type === 'ObjectExpression') {
      this._checkIsObjectKey(path.node);
      this._checkIsIdentifierObjectValue(path.node);
      this._checkIsTextObjectValue(path.node);
    }
  }

  _visitArrayExpression(path: babel.NodePath): void {
    if (path.node.type === 'ArrayExpression') {
      this._checkIsBSONSelection(path.node);
      this._checkIsStage(path.node);
      this._checkIsStageOperator(path);
    }
  }

  _visitVariableDeclarator(path: babel.NodePath): void {
    if (path.node.type === 'VariableDeclarator') {
      this._checkIsBSONSelection(path.node);
    }
  }

  _visitObjectProperty(path: babel.NodePath): void {
    if (path.node.type === 'ObjectProperty') {
      this._checkIsBSONSelection(path.node);
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

  parseASTForCompletion(
    textFromEditor: string,
    position: { line: number; character: number }
  ): CompletionState {
    const selection: VisitorSelection = {
      start: position,
      end: { line: 0, character: 0 },
    };

    this._state = this._getDefaultsForCompletion();
    textFromEditor = this._handleTriggerCharacter(textFromEditor, position);

    this.parseAST({ textFromEditor, selection });

    return this._state as CompletionState;
  }

  parseASTWForSignatureHelp(
    textFromEditor: string,
    position: { line: number; character: number }
  ): SignatureState {
    const selection: VisitorSelection = {
      start: position,
      end: { line: 0, character: 0 },
    };

    this._state = this._getDefaultsForSignatureHelp();
    textFromEditor = this._handleTriggerCharacter(textFromEditor, position);

    this.parseAST({ textFromEditor, selection });

    return this._state as SignatureState;
  }

  parseASTForExportToLanguage(params): ExportToLanguageState {
    this._state = this._getDefaultsForExportToLanguagep();
    this.parseAST(params);
    return this._state as ExportToLanguageState;
  }

  parseASTForNamespace(params): NamespaceState {
    this._state = this._getDefaultsForNamespace();
    this.parseAST(params);
    return this._state as NamespaceState;
  }

  parseAST({ textFromEditor, selection }: VisitorTextAndSelection) {
    this._selection = selection;

    let ast;
    try {
      ast = parser.parse(textFromEditor, {
        // Parse in strict mode and allow module declarations
        sourceType: 'module',
      });
    } catch (error) {
      console.error(`parseAST error: ${util.inspect(error)}`);
    }

    traverse(ast, {
      enter: (path: babel.NodePath) => {
        this._visitCallExpression(path);
        this._visitMemberExpression(path);
        this._visitExpressionStatement(path);
        this._visitObjectExpression(path);
        this._visitArrayExpression(path);
        this._visitVariableDeclarator(path);
        this._visitObjectProperty(path);
      },
    });
  }

  _getDefaultsForCompletion() {
    return {
      databaseName: null,
      collectionName: null,
      isObjectSelection: false,
      isArraySelection: false,
      isObjectKey: false,
      isIdentifierObjectValue: false,
      isTextObjectValue: false,
      isStage: false,
      isFind: false,
      isAggregation: false,
      stageOperator: null,
      isCollectionSymbol: false,
      isUseCallExpression: false,
      isGlobalSymbol: false,
      isDbSymbol: false,
      isCollectionName: false,
      isAggregationCursor: false,
      isFindCursor: false,
    };
  }

  _getDefaultsForSignatureHelp() {
    return {
      isFind: false,
      isAggregation: false,
    };
  }

  _getDefaultsForExportToLanguagep() {
    return {
      isArraySelection: false,
      isObjectSelection: false,
    };
  }

  _getDefaultsForNamespace() {
    return {
      databaseName: null,
      collectionName: null,
    };
  }

  _checkIsUseCallAsSimpleString(node: babel.types.CallExpression): void {
    if (
      node.callee.type === 'Identifier' &&
      node.callee.name === 'use' &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'StringLiteral' &&
      node.arguments[0].value.includes(PLACEHOLDER) &&
      'isUseCallExpression' in this._state
    ) {
      this._state.isUseCallExpression = true;
    }
  }

  _checkIsUseCallAsTemplate(node: babel.types.CallExpression): void {
    if (
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'TemplateLiteral' &&
      node.arguments[0].quasis.length === 1 &&
      node.arguments[0].quasis[0].value?.raw &&
      node.arguments[0].quasis[0].value?.raw.includes(PLACEHOLDER) &&
      'isUseCallExpression' in this._state
    ) {
      this._state.isUseCallExpression = true;
    }
  }

  _checkIsUseCall(node: babel.types.CallExpression): void {
    this._checkIsUseCallAsSimpleString(node);
    this._checkIsUseCallAsTemplate(node);
  }

  _checkIsGlobalSymbol(node: babel.types.ExpressionStatement): void {
    if (
      node.expression.type === 'Identifier' &&
      node.expression.name.includes('TRIGGER_CHARACTER') &&
      'isGlobalSymbol' in this._state
    ) {
      this._state.isGlobalSymbol = true;
    }
  }

  _checkIsDbSymbol(node: babel.types.ExpressionStatement): void {
    if (
      node.expression.type === 'MemberExpression' &&
      node.expression.object.type === 'Identifier' &&
      node.expression.object.name === 'db' &&
      'isDbSymbol' in this._state
    ) {
      this._state.isDbSymbol = true;
    }
  }

  _checkIsObjectKey(node: babel.types.ObjectExpression): void {
    node.properties.find((item: ObjectKey) => {
      if (
        item.type === 'ObjectProperty' &&
        item.key.type === 'Identifier' &&
        item.key.name.includes(PLACEHOLDER) &&
        'isObjectKey' in this._state
      ) {
        this._state.isObjectKey = true;
      }
    });
  }

  _checkIsIdentifierObjectValue(node: babel.types.ObjectExpression): void {
    node.properties.find((item: ObjectKey) => {
      if (
        item.type === 'ObjectProperty' &&
        item.value.type === 'Identifier' &&
        item.value.name.includes(PLACEHOLDER) &&
        'isIdentifierObjectValue' in this._state
      ) {
        this._state.isIdentifierObjectValue = true;
      }
    });
  }

  _checkIsTextObjectValue(node: babel.types.ObjectExpression): void {
    node.properties.find((item: ObjectKey) => {
      if (
        ((item.type === 'ObjectProperty' &&
          item.value.type === 'StringLiteral' &&
          item.value.value.includes(PLACEHOLDER)) ||
          (item.type === 'ObjectProperty' &&
            item.value.type === 'TemplateLiteral' &&
            item.value?.quasis.length === 1 &&
            item.value.quasis[0].value?.raw.includes(PLACEHOLDER))) &&
        'isTextObjectValue' in this._state
      ) {
        this._state.isTextObjectValue = true;
      }
    });
  }

  _checkIsFind(node: babel.types.CallExpression) {
    if (
      node.callee.type === 'MemberExpression' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'find' &&
      this._isWithinFunctionCall(node) &&
      'isFind' in this._state
    ) {
      this._state.isFind = true;
    }
  }

  _checkIsAggregation(node: babel.types.CallExpression): void {
    if (
      node.callee.type === 'MemberExpression' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'aggregate' &&
      this._isWithinFunctionCall(node) &&
      'isAggregation' in this._state
    ) {
      this._state.isAggregation = true;
    }
  }

  _checkIsStage(node: babel.types.ArrayExpression): void {
    if (node.elements) {
      node.elements.forEach((item) => {
        if (item?.type === 'ObjectExpression') {
          item.properties.find((item: ObjectKey) => {
            if (
              item.type === 'ObjectProperty' &&
              item.key.type === 'Identifier' &&
              item.key.name.includes(PLACEHOLDER) &&
              'isStage' in this._state
            ) {
              this._state.isStage = true;
            }
          });
        }
      });
    }
  }

  _checkIsStageOperator(path: babel.NodePath): void {
    if (path.node.type === 'ArrayExpression' && path.node.elements) {
      path.node.elements.forEach((item) => {
        if (item?.type === 'ObjectExpression') {
          item.properties.find((item: ObjectKey) => {
            if (
              item.type === 'ObjectProperty' &&
              item.key.type === 'Identifier' &&
              item.value.type === 'ObjectExpression'
            ) {
              const name = item.key.name;
              path.scope.traverse(item, {
                enter: (path: babel.NodePath) => {
                  if (
                    path.node.type === 'ObjectProperty' &&
                    path.node.key.type === 'Identifier' &&
                    path.node.key.name.includes(PLACEHOLDER) &&
                    'stageOperator' in this._state
                  ) {
                    this._state.stageOperator = name;
                  }
                },
              });
            }
          });
        }
      });
    }
  }

  _isParentAroundSelection(
    node: babel.types.ArrayExpression | babel.types.CallExpression
  ): boolean {
    if (
      node.loc?.start?.line &&
      (node.loc.start.line - 1 < this._selection.start.line ||
        (node.loc.start.line - 1 === this._selection.start.line &&
          node.loc.start.column < this._selection.start.character)) &&
      node.loc.end.line &&
      (node.loc.end.line - 1 > this._selection.end.line ||
        (node.loc.end.line - 1 === this._selection.end.line &&
          node.loc.end.column > this._selection.end.character))
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

  _isWithinSelection(
    node: babel.types.ArrayExpression | babel.types.ObjectExpression
  ): boolean {
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

  _isWithinFunctionCall(node: babel.types.CallExpression): boolean {
    if (
      node.loc &&
      ((node.loc.start.line < this._selection.start.line &&
        node.loc.end.line > this._selection.start.line + 1) ||
        (node.loc.start.line === this._selection.start.line &&
          node.loc.start.column <= this._selection.start.character) ||
        (node.loc.end.line === this._selection.start.line + 1 &&
          node.loc.end.column >= this._selection.start.character))
    ) {
      return true;
    }

    return false;
  }

  _checkIsArrayWithinSelection(node: babel.types.Node): void {
    if (
      node.type === 'ArrayExpression' &&
      this._isWithinSelection(node) &&
      'isArraySelection' in this._state
    ) {
      this._state.isArraySelection = true;
    }
  }

  _checkIsObjectWithinSelection(node: babel.types.Node): void {
    if (
      node.type === 'ObjectExpression' &&
      this._isWithinSelection(node) &&
      'isObjectSelection' in this._state
    ) {
      this._state.isObjectSelection = true;
    }
  }

  _checkIsBSONSelectionInArray(node: babel.types.Node): void {
    if (
      node.type === 'ArrayExpression' &&
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
    if (node.type === 'CallExpression' && this._isParentAroundSelection(node)) {
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

  _checkIsCollectionNameAsMemberExpression(
    node: babel.types.MemberExpression
  ): void {
    if (
      node.object.type === 'Identifier' &&
      node.object.name === 'db' &&
      ((node.property.type === 'Identifier' &&
        node.property.name.includes(PLACEHOLDER)) ||
        (node.property.type === 'StringLiteral' &&
          node.property.value.includes(PLACEHOLDER))) &&
      'isCollectionName' in this._state
    ) {
      this._state.isCollectionName = true;
    }
  }

  _checkGetCollectionAsSimpleString(node: babel.types.CallExpression): void {
    if (
      node.arguments[0].type === 'StringLiteral' &&
      node.arguments[0].value.includes(PLACEHOLDER) &&
      'isCollectionName' in this._state
    ) {
      this._state.isCollectionName = true;
    }
  }

  _checkGetCollectionAsTemplate(node: babel.types.CallExpression): void {
    if (
      node.arguments[0].type === 'TemplateLiteral' &&
      node.arguments[0].quasis.length === 1 &&
      node.arguments[0].quasis[0].value.raw.includes(PLACEHOLDER) &&
      'isCollectionName' in this._state
    ) {
      this._state.isCollectionName = true;
    }
  }

  _checkIsCollectionNameAsCallExpression(
    node: babel.types.CallExpression
  ): void {
    if (
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'db' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'getCollection' &&
      node.arguments.length === 1
    ) {
      this._checkGetCollectionAsSimpleString(node);
      this._checkGetCollectionAsTemplate(node);
    }
  }

  _checkHasAggregationCall(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'CallExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      node.object.callee.type === 'MemberExpression' &&
      !node.object.callee.computed &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'aggregate' &&
      'isAggregationCursor' in this._state
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
      node.object.callee.property.name === 'find' &&
      'isFindCursor' in this._state
    ) {
      this._state.isFindCursor = true;
    }
  }

  _checkHasDatabaseName(node: babel.types.CallExpression): void {
    if (
      node.callee.type === 'Identifier' &&
      node.callee.name === 'use' &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'StringLiteral' &&
      node.loc &&
      (this._selection.start.line > node.loc.end.line - 1 ||
        (this._selection.start.line === node.loc.end.line - 1 &&
          this._selection.start.character >= node.loc.end.column)) &&
      'databaseName' in this._state
    ) {
      this._state.databaseName = node.arguments[0].value;
    }
  }

  _checkHasCollectionNameMemberExpression(
    node: babel.types.MemberExpression
  ): void {
    if (
      node.object.type === 'MemberExpression' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'db'
    ) {
      if (
        node.object.property.type === 'Identifier' &&
        'collectionName' in this._state
      ) {
        this._state.collectionName = node.object.property.name;
      } else if (
        node.object.property.type === 'StringLiteral' &&
        'collectionName' in this._state
      ) {
        this._state.collectionName = node.object.property.value;
      }
    }
  }

  _checkHasCollectionNameCallExpression(node: babel.types.MemberExpression) {
    if (
      node.object.type === 'CallExpression' &&
      node.object.callee.type === 'MemberExpression' &&
      node.object.callee.object.type === 'Identifier' &&
      node.object.callee.object.name === 'db' &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'getCollection' &&
      node.object.arguments.length === 1 &&
      node.object.arguments[0].type === 'StringLiteral' &&
      'collectionName' in this._state
    ) {
      this._state.collectionName = node.object.arguments[0].value;
    }
  }

  _checkHasCollectionName(node: babel.types.MemberExpression): void {
    this._checkHasCollectionNameMemberExpression(node);
    this._checkHasCollectionNameCallExpression(node);
  }

  _checkIsCollectionMemberExpression(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'MemberExpression' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'db' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      'isCollectionSymbol' in this._state
    ) {
      this._state.isCollectionSymbol = true;
    }
  }

  _checkIsCollectionCallExpression(node: babel.types.MemberExpression): void {
    if (
      node.object.type === 'CallExpression' &&
      node.object.callee.type === 'MemberExpression' &&
      node.object.callee.object.type === 'Identifier' &&
      node.object.callee.object.name === 'db' &&
      node.object.callee.property.type === 'Identifier' &&
      node.object.callee.property.name === 'getCollection' &&
      node.property.type === 'Identifier' &&
      node.property.name.includes(PLACEHOLDER) &&
      'isCollectionSymbol' in this._state
    ) {
      this._state.isCollectionSymbol = true;
    }
  }

  _checkIsCollectionSymbol(node: babel.types.MemberExpression): void {
    this._checkIsCollectionMemberExpression(node);
    this._checkIsCollectionCallExpression(node);
  }
}
