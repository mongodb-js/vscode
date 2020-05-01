import * as util from 'util';

const estraverse = require('estraverse');
const esprima = require('esprima');

export type CompletionNodes = {
  databaseName: string | null;
  collectionName: string | null;
  isObjectKey: boolean;
  isMemberExpression: boolean;
  isUseCallExpression: boolean;
  isDbCallExpression: boolean;
  hasDbCallExpression: boolean;
  isAggregationCursor: boolean;
  isFindCursor: boolean;
};

export class Visitor {
  _connection: any;

  constructor(connection: any) {
    this._connection = connection;
  }

  public visitAST(
    ast: object,
    position: { line: number; character: number }
  ): CompletionNodes {
    const nodes = this.getDefaultNodesValues();

    estraverse.traverse(ast, {
      enter: (node: any) => {
        this._connection.console.log(
          `ESPRIMA visit node ${util.inspect(node.type)}`
        );

        if (node.type === esprima.Syntax.CallExpression) {
          const isCurrentNode = this.checkIsCurrentNode(node, {
            line: position.line,
            character: position.character
          });

          if (this.checkIsUseCall(node) && isCurrentNode) {
            nodes.isUseCallExpression = true;
          }

          if (this.checkHasDatabaseName(node, position)) {
            nodes.databaseName = node.arguments[0].value;
          }
        }

        if (node.type === esprima.Syntax.MemberExpression) {
          const isCurrentNode = this.checkIsCurrentNode(node, {
            line: position.line,
            character: position.character - 2
          });

          if (this.checkHasDbCall(node) && isCurrentNode) {
            nodes.hasDbCallExpression = true;
          }

          if (node.object.type === esprima.Syntax.MemberExpression) {
            if (this.checkHasAggregationCall(node, position)) {
              nodes.isAggregationCursor = true;
            }

            if (this.checkHasFindCall(node, position)) {
              nodes.isFindCursor = true;
            }
          }

          if (
            node.object.type === esprima.Syntax.Identifier &&
            this.checkHasCollectionName(node, position)
          ) {
            const isCurrentNode = this.checkIsCurrentNode(node, {
              line: position.line,
              character: position.character - 3
            });

            nodes.collectionName = node.property.name
              ? node.property.name
              : node.property.value;

            if (isCurrentNode) {
              nodes.isMemberExpression = true;
            }
          }
        }

        if (node.type === esprima.Syntax.ExpressionStatement) {
          const isCurrentNode = this.checkIsCurrentNode(node, {
            line: position.line,
            character: position.character - 2
          });

          if (this.checkIsDbCall(node) && isCurrentNode) {
            nodes.isDbCallExpression = true;
          }
        }

        if (node.type === esprima.Syntax.ObjectExpression) {
          const isCurrentNode = this.checkIsCurrentNode(node, {
            line: position.line,
            character: position.character - 1
          });

          if (isCurrentNode) {
            nodes.isObjectKey = true;
          }
        }
      }
    });

    return nodes;
  }

  public getDefaultNodesValues() {
    return {
      databaseName: null,
      collectionName: null,
      isObjectKey: false,
      isMemberExpression: false,
      isUseCallExpression: false,
      isDbCallExpression: false,
      hasDbCallExpression: false,
      isAggregationCursor: false,
      isFindCursor: false
    };
  }

  private checkIsUseCall(node: any): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal
    ) {
      return true;
    }

    return false;
  }

  private checkIsDbCall(node: any): boolean {
    if (node.expression?.name === 'db') {
      return true;
    }

    return false;
  }

  private checkHasDbCall(node: any): boolean {
    if (node.object?.name === 'db') {
      return true;
    }

    return false;
  }

  private checkHasAggregationCall(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.property.name === 'aggregate' &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasFindCall(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.property.name === 'find' &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasDatabaseName(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasCollectionName(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.object.name === 'db' &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkIsCurrentNode(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    // Esprima counts lines from 1, when vscode counts position starting from 0
    const nodeStartLine = node.loc.start.line - 1;
    const nodeEndLine = node.loc.end.line - 1;
    // Do not count brackets
    const nodeStartCharacter = node.loc.start.column + 1;
    const nodeEndCharacter = node.loc.end.column - 1;
    const cursorLine = currentPosition.line;
    const cursorCharacter = currentPosition.character;

    if (
      (cursorLine > nodeStartLine && cursorLine < nodeEndLine) ||
      (cursorLine === nodeStartLine &&
        cursorCharacter >= nodeStartCharacter &&
        cursorCharacter <= nodeEndCharacter)
    ) {
      return true;
    }

    return false;
  }
}
