const estraverse = require('estraverse');
const esprima = require('esprima');

export type CompletionNodes = {
  databaseName: string | null;
  collectionName: string | null;
  isObjectKey: boolean;
  isMemberExpression: boolean;
  isUseCallExpression: boolean;
  isDbCallExpression: boolean;
  dbCallPosition: { line: number; character: number };
  isAggregationCursor: boolean;
  isFindCursor: boolean;
};

export class Visitor {
  constructor() {}

  public getDefaultNodesValues() {
    return {
      databaseName: null,
      collectionName: null,
      isObjectKey: false,
      isMemberExpression: false,
      isUseCallExpression: false,
      isDbCallExpression: false,
      isAggregationCursor: false,
      isFindCursor: false,
      dbCallPosition: { line: 0, character: 0 }
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
    if (node.expression.name === 'db') {
      return true;
    }

    return false;
  }

  private checkHasAggregationCall(node: any): boolean {
    if (node.property.name === 'aggregate') {
      return true;
    }

    return false;
  }

  private checkHasFindCall(node: any): boolean {
    if (node.property.name === 'find') {
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

  public visitAST(
    ast: object,
    position: { line: number; character: number }
  ): CompletionNodes {
    const nodes = this.getDefaultNodesValues();

    estraverse.traverse(ast, {
      enter: (node) => {
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
          if (node.object.type === esprima.Syntax.MemberExpression) {
            if (this.checkHasAggregationCall(node)) {
              nodes.isAggregationCursor = true;
            }

            if (this.checkHasFindCall(node)) {
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
            nodes.dbCallPosition = position;
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
}
