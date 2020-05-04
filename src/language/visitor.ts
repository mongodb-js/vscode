import * as util from 'util';

const estraverse = require('estraverse');
const esprima = require('esprima');

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
  _connection: any;
  _state: CompletionState;
  _absoluteCharacter: number;

  constructor(connection: any) {
    this._connection = connection;
    this._state = this.getDefaultNodesValues();
    this._absoluteCharacter = 0;
  }

  private visitCallExpression(node: any): void {
    if (this.checkHasAggregationCall(node)) {
      this._state.isAggregationCursor = true;
    }

    if (this.checkHasFindCall(node)) {
      this._state.isFindCursor = true;
    }

    if (this.checkIsUseCall(node)) {
      this._state.isUseCallExpression = true;
    }

    if (this.checkHasDatabaseName(node)) {
      this._state.databaseName = node.arguments[0].value;
    }
  }

  private visitMemberExpression(node: any): void {
    if (this.checkIsCollectionName(node)) {
      this._state.isCollectionName = true;
    }

    if (this.checkIsShellMethod(node)) {
      this._state.isShellMethod = true;
    }

    if (this.checkHasCollectionName(node)) {
      this._state.collectionName = node.property.name
        ? node.property.name
        : node.property.value;
    }
  }

  private visitExpressionStatement(node: any): void {
    if (this.checkIsDbCall(node)) {
      this._state.isDbCallExpression = true;
    }
  }

  private visitObjectExpression(node: any): void {
    if (this.checkIsObjectKey(node)) {
      this._state.isObjectKey = true;
    }
  }

  private visitVariableDeclarator(node: any): void {
    if (this.checkIsDbCall(node)) {
      this._state.isDbCallExpression = true;
    }
  }

  public visitAST(ast: object, absoluteCharacter: number): CompletionState {
    this._state = this.getDefaultNodesValues();
    this._absoluteCharacter = absoluteCharacter;

    estraverse.traverse(ast, {
      enter: (node: any) => {
        switch (node.type) {
          case esprima.Syntax.CallExpression:
            this.visitCallExpression(node);
            break;
          case esprima.Syntax.MemberExpression:
            this.visitMemberExpression(node);
            break;
          case esprima.Syntax.ExpressionStatement:
            this.visitExpressionStatement(node);
            break;
          case esprima.Syntax.ObjectExpression:
            this.visitObjectExpression(node);
            break;
          case esprima.Syntax.VariableDeclarator:
            this.visitVariableDeclarator(node);
            break;
        }
      }
    });

    this._connection.console.log(
      `Completion state: ${util.inspect(this._state)}`
    );

    return this._state;
  }

  public getDefaultNodesValues() {
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

  private checkIsUseCall(node: any): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      (node.arguments[0].type === esprima.Syntax.Literal ||
        node.arguments[0].type === esprima.Syntax.TemplateLiteral) &&
      this._absoluteCharacter >= node.loc.start.column &&
      this._absoluteCharacter <= node.loc.end.column
    ) {
      return true;
    }

    return false;
  }

  private checkIsDbCall(node: any): boolean {
    if (
      (node.expression?.name === 'db' || node.init?.name === 'db') &&
      this._absoluteCharacter === node.loc.end.column + 1
    ) {
      return true;
    }

    return false;
  }

  private checkIsObjectKey(node: any): boolean {
    if (
      this._absoluteCharacter > node.loc.start.column + 1 &&
      this._absoluteCharacter < node.loc.end.column
    ) {
      return true;
    }

    return false;
  }

  private checkIsCollectionName(node: any): boolean {
    if (
      node.object?.name === 'db' &&
      this._absoluteCharacter === node.loc.start.column + 3
    ) {
      return true;
    }

    return false;
  }

  private checkHasAggregationCall(node: any): boolean {
    if (
      node.callee &&
      node.callee.object &&
      node.callee.object.object &&
      node.callee.object.object.name === 'db' &&
      node.callee.property &&
      node.callee.property.name === 'aggregate' &&
      this._absoluteCharacter === node.loc.end.column + 1
    ) {
      return true;
    }

    return false;
  }

  private checkHasFindCall(node: any): boolean {
    if (
      node.callee &&
      node.callee.object &&
      node.callee.object.object &&
      node.callee.object.object.name === 'db' &&
      node.callee.property &&
      node.callee.property.name === 'find' &&
      this._absoluteCharacter === node.loc.end.column + 1
    ) {
      return true;
    }

    return false;
  }

  private checkHasDatabaseName(node: any): boolean {
    if (
      node.callee &&
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal &&
      this._absoluteCharacter > node.loc.end.column
    ) {
      return true;
    }

    return false;
  }

  private checkHasCollectionName(node: any): boolean {
    if (
      node.object.type === esprima.Syntax.Identifier &&
      node.object &&
      node.object.name === 'db' &&
      this._absoluteCharacter > node.loc.end.column
    ) {
      return true;
    }

    return false;
  }

  private checkIsShellMethod(node: any): boolean {
    if (
      node.object &&
      node.object.name === 'db' &&
      node.property &&
      (node.property.name || node.property.value) &&
      this._absoluteCharacter === node.loc.end.column + 1
    ) {
      return true;
    }

    return false;
  }
}
