import * as util from 'util';

const estraverse = require('estraverse');
const esprima = require('esprima');

export type CompletionState = {
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
  _state: CompletionState;
  _position: { line: number; character: number };

  constructor(connection: any) {
    this._connection = connection;
    this._state = this.getDefaultNodesValues();
    this._position = { line: 0, character: 0 };
  }

  private visitCallExpression(node: any): void {
    const isCurrentNode = this.checkIsCurrentNode(node, {
      line: this._position.line,
      character: this._position.character
    });

    if (this.checkIsUseCall(node) && isCurrentNode) {
      this._state.isUseCallExpression = true;
    }

    if (this.checkHasDatabaseName(node)) {
      this._state.databaseName = node.arguments[0].value;
    }
  }

  private visitMemberExpression(node: any): void {
    const isCurrentNode = this.checkIsCurrentNode(node, {
      line: this._position.line,
      character: this._position.character - 2 // Prev character without `)`
    });

    if (this.checkHasDbCall(node) && isCurrentNode) {
      this._state.hasDbCallExpression = true;
    }

    if (node.object.type === esprima.Syntax.MemberExpression) {
      if (this.checkHasAggregationCall(node, this._position)) {
        this._state.isAggregationCursor = true;
      }

      if (this.checkHasFindCall(node)) {
        this._state.isFindCursor = true;
      }
    }

    if (
      node.object.type === esprima.Syntax.Identifier &&
      this.checkHasCollectionName(node)
    ) {
      const isCurrentNode = this.checkIsCurrentNode(node, {
        line: this._position.line,
        character: this._position.character - 3 // Prev character without `.(`
      });

      if (isCurrentNode) {
        this._state.isMemberExpression = true;
      }

      this._state.collectionName = node.property.name
        ? node.property.name
        : node.property.value;
    }
  }

  private visitExpressionStatement(node: any): void {
    const isCurrentNode = this.checkIsCurrentNode(node, {
      line: this._position.line,
      character: this._position.character - 2 // Prev character without `.`
    });

    if (this.checkIsDbCall(node) && isCurrentNode) {
      this._state.isDbCallExpression = true;
    }
  }

  private visitObjectExpression(node: any): void {
    const isCurrentNode = this.checkIsCurrentNode(node, {
      line: this._position.line,
      character: this._position.character - 1 // Prev character
    });

    if (isCurrentNode) {
      this._state.isObjectKey = true;
    }
  }

  public visitAST(
    ast: object,
    position: { line: number; character: number }
  ): CompletionState {
    this._state = this.getDefaultNodesValues();
    this._position = position;

    estraverse.traverse(ast, {
      enter: (node: any) => {
        this._connection.console.log(
          `ESPRIMA visit node ${util.inspect(node.type)}`
        );

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
        }
      }
    });

    return this._state;
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

  private checkHasFindCall(node: any): boolean {
    if (
      node.property.name === 'find' &&
      (this._position.line >= node.loc.start.line ||
        (this._position.line === node.loc.start.line - 1 &&
          this._position.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasDatabaseName(node: any): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal &&
      (this._position.line >= node.loc.start.line ||
        (this._position.line === node.loc.start.line - 1 &&
          this._position.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasCollectionName(node: any): boolean {
    if (
      node.object.name === 'db' &&
      (this._position.line >= node.loc.start.line ||
        (this._position.line === node.loc.start.line - 1 &&
          this._position.character > node.loc.end.column))
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
    const currentLine = currentPosition.line;
    const currentCharacter = currentPosition.character;

    if (
      (currentLine > nodeStartLine && currentLine < nodeEndLine) ||
      (currentLine === nodeStartLine &&
        currentCharacter >= nodeStartCharacter &&
        currentCharacter <= nodeEndCharacter)
    ) {
      return true;
    }

    return false;
  }
}
