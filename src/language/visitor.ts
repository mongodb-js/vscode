import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

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
  _position: { line: number; character: number };
  _placeholder: string;

  constructor() {
    this._state = this.getDefaultNodesValues();
    this._position = { line: 0, character: 0 };
    this._placeholder = 'TRIGGER_CHARACTER';
  }

  private visitCallExpression(node: any): void {
    if (this.checkIsUseCall(node)) {
      this._state.isUseCallExpression = true;
    }

    if (this.checkIsCollectionName(node)) {
      this._state.isCollectionName = true;
    }

    if (this.checkHasDatabaseName(node)) {
      this._state.databaseName = node.arguments[0].value;
    }
  }

  private visitMemberExpression(node: any): void {
    if (this.checkHasAggregationCall(node)) {
      this._state.isAggregationCursor = true;
    }

    if (this.checkHasFindCall(node)) {
      this._state.isFindCursor = true;
    }

    if (this.checkIsShellMethod(node)) {
      this._state.isShellMethod = true;
    }

    if (this.checkIsCollectionName(node)) {
      this._state.isCollectionName = true;
    }

    if (this.checkHasCollectionName(node)) {
      this._state.collectionName = node.object.property.name;
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

  private handleTriggerCharacter(
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
    textLines[position.line] = `${prefix}${this._placeholder}${postfix}`;

    return textLines.join('\n');
  }

  public parseAST(
    textFromEditor: string,
    position: { line: number; character: number }
  ): CompletionState {
    this._state = this.getDefaultNodesValues();
    this._position = position;

    const textWithPlaceholder = this.handleTriggerCharacter(
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

    const self = this;

    traverse(ast, {
      enter(path) {
        switch (path.node.type) {
          case 'CallExpression':
            self.visitCallExpression(path.node);
            break;
          case 'MemberExpression':
            self.visitMemberExpression(path.node);
            break;
          case 'ExpressionStatement':
            self.visitExpressionStatement(path.node);
            break;
          case 'ObjectExpression':
            self.visitObjectExpression(path.node);
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
      (node.callee.name === 'use' &&
        node.arguments &&
        node.arguments.length === 1 &&
        node.arguments[0] &&
        node.arguments[0].type === 'StringLiteral' &&
        node.arguments[0].value &&
        node.arguments[0].value.includes(this._placeholder)) ||
      (node.arguments &&
        node.arguments.length === 1 &&
        node.arguments[0] &&
        node.arguments[0].type === 'TemplateLiteral' &&
        node.arguments[0].quasis &&
        node.arguments[0].quasis.length === 1 &&
        node.arguments[0].quasis[0].value?.raw &&
        node.arguments[0].quasis[0].value?.raw.includes(this._placeholder))
    ) {
      return true;
    }

    return false;
  }

  private checkIsDbCall(node: any): boolean {
    if (
      node.expression &&
      node.expression.object &&
      node.expression.object.name === 'db'
    ) {
      return true;
    }

    return false;
  }

  private checkIsObjectKey(node: any): boolean {
    if (
      node.properties.find(
        (item) => item.key.name && item.key.name.includes(this._placeholder)
      )
    ) {
      return true;
    }

    return false;
  }

  private checkIsCollectionName(node: any): boolean {
    if (
      (node.object &&
        node.object.name === 'db' &&
        node.property &&
        node.property.name &&
        node.property.name.includes(this._placeholder)) ||
      (node.callee &&
        node.callee.object &&
        node.callee.object.object &&
        node.callee.object.object.name === 'db' &&
        node.callee.object.property.name &&
        node.callee.object.property.name.includes(this._placeholder) &&
        node.callee.property)
    ) {
      return true;
    }

    return false;
  }

  private checkHasAggregationCall(node: any): boolean {
    if (
      node.object &&
      node.object.type === 'CallExpression' &&
      node.property.name &&
      node.property.name.includes(this._placeholder) &&
      node.object.callee &&
      node.object.callee.property.name === 'aggregate'
    ) {
      return true;
    }

    return false;
  }

  private checkHasFindCall(node: any): boolean {
    if (
      node.object &&
      node.object.type === 'CallExpression' &&
      node.property.name &&
      node.property.name.includes(this._placeholder) &&
      node.object.callee &&
      node.object.callee.property.name === 'find'
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
      node.arguments[0] &&
      node.arguments[0].type === 'StringLiteral' &&
      (this._position.line > node.loc.end.line - 1 ||
        (this._position.line === node.loc.end.line - 1 &&
          this._position.character >= node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasCollectionName(node: any): boolean {
    if (
      node.object.object &&
      node.object.object.name === 'db' &&
      node.object.property
    ) {
      return true;
    }

    return false;
  }

  private checkIsShellMethod(node: any): boolean {
    if (
      node.object.object &&
      node.object.object.name === 'db' &&
      node.property.name &&
      node.property.name.includes(this._placeholder)
    ) {
      return true;
    }

    return false;
  }
}
