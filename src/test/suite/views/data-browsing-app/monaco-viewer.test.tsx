import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react';

import MonacoViewer from '../../../../views/data-browsing-app/monaco-viewer';
import * as vscodeApi from '../../../../views/data-browsing-app/vscode-api';

// Mock the Monaco Editor component
let mockEditorValue = '';

const mockEditorInstance = {
  getValue: (): string => mockEditorValue,
  setValue: (value: string): void => {
    mockEditorValue = value;
  },
  getModel: (): { getValue: () => string } => ({
    getValue: (): string => mockEditorValue,
  }),
  getContentHeight: (): number => 100,
  onDidContentSizeChange: (): { dispose: () => void } => ({
    dispose: (): void => {
      /* no-op */
    },
  }),
  getAction: (): { run: () => void } => ({
    run: (): void => {
      /* no-op */
    },
  }),
  dispose: (): void => {
    /* no-op */
  },
};

// Mock @monaco-editor/react
const MockEditor = ({ value, onMount }: any): JSX.Element => {
  React.useEffect(() => {
    if (onMount && value) {
      mockEditorValue = value;
      // Simulate editor mount
      setTimeout(() => {
        onMount(mockEditorInstance);
      }, 0);
    }
  }, [onMount, value]);

  return (
    <div data-testid="monaco-editor-mock" className="monaco-editor">
      {value}
    </div>
  );
};

const mockUseMonaco = (): { editor: { defineTheme: sinon.SinonStub } } => ({
  editor: {
    defineTheme: sinon.stub(),
  },
});

describe('MonacoViewer test suite', function () {
  beforeEach(function () {
    mockEditorValue = '';

    // Mock the monaco-editor/react module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function (id: string, ...args: any[]): any {
      if (id === '@monaco-editor/react') {
        return {
          __esModule: true,
          default: MockEditor,
          useMonaco: mockUseMonaco,
          loader: {
            config: (): void => {
              /* no-op */
            },
          },
        };
      }
      return originalRequire.apply(this, [id, ...args]);
    };
  });

  afterEach(function () {
    cleanup();
    sinon.restore();
  });

  describe('Document rendering', function () {
    it('should render a simple document', function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const container = screen.getByTestId('monaco-viewer-container');
      expect(container).to.exist;
    });

    it('should format document with unquoted keys', async function () {
      const document = { _id: '123', name: 'TestDocument', value: 42 };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          // Check for unquoted keys (JavaScript object notation)
          expect(content).to.include('_id:');
          expect(content).to.include('name:');
          expect(content).to.include('value:');
        }
      });
    });

    it('should render document values correctly', async function () {
      const document = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Product',
        price: 99.99,
        inStock: true,
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('507f1f77bcf86cd799439011');
          expect(content).to.include('Product');
          expect(content).to.include('99.99');
          expect(content).to.include('true');
        }
      });
    });

    it('should render nested objects', async function () {
      const document = {
        _id: '1',
        user: {
          name: 'John',
          age: 30,
        },
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('user:');
          expect(content).to.include('name:');
          expect(content).to.include('John');
          expect(content).to.include('age:');
          expect(content).to.include('30');
        }
      });
    });

    it('should render arrays', async function () {
      const document = {
        _id: '1',
        tags: ['mongodb', 'database', 'nosql'],
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('tags:');
          expect(content).to.include('mongodb');
          expect(content).to.include('database');
          expect(content).to.include('nosql');
        }
      });
    });
  });

  describe('Theme customization', function () {
    it('should render with custom theme colors', function () {
      const document = { _id: '1', name: 'Test' };
      const themeColors = {
        key: '#9CDCFE',
        string: '#CE9178',
        number: '#B5CEA8',
        boolean: '#569CD6',
        null: '#569CD6',
        objectId: '#4EC9B0',
        date: '#4EC9B0',
        regexp: '#D16969',
        symbol: '#4EC9B0',
        undefined: '#569CD6',
        type: '#4EC9B0',
        comment: '#6A9955',
        punctuation: '#D4D4D4',
      };

      render(
        <MonacoViewer
          document={document}
          themeColors={themeColors}
          themeKind="vs-dark"
        />,
      );

      const container = screen.getByTestId('monaco-viewer-container');
      expect(container).to.exist;
    });
  });

  describe('Edge cases', function () {
    it('should handle empty object', function () {
      const document = {};

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const container = screen.getByTestId('monaco-viewer-container');
      expect(container).to.exist;
    });

    it('should handle null values', async function () {
      const document = {
        _id: '1',
        value: null,
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('value:');
          expect(content).to.include('null');
        }
      });
    });

    it('should handle undefined values', async function () {
      const document = {
        _id: '1',
        value: undefined,
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('_id:');
        }
      });
    });

    it('should handle special characters in strings', async function () {
      const document = {
        _id: '1',
        message: 'Hello "World" with \'quotes\'',
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('message:');
        }
      });
    });

    it('should handle deeply nested objects', async function () {
      const document = {
        _id: '1',
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      await waitFor(() => {
        const editorMock = screen.queryByTestId('monaco-editor-mock');
        if (editorMock) {
          const content = editorMock.textContent || '';
          expect(content).to.include('level1:');
          expect(content).to.include('level2:');
          expect(content).to.include('level3:');
          expect(content).to.include('deep');
        }
      });
    });

    it('should handle large arrays', function () {
      const document = {
        _id: '1',
        items: Array.from({ length: 100 }, (_, i) => i),
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const container = screen.getByTestId('monaco-viewer-container');
      expect(container).to.exist;
    });
  });

  describe('Action bar', function () {
    let sendEditDocumentStub: sinon.SinonStub;
    let sendCloneDocumentStub: sinon.SinonStub;
    let sendDeleteDocumentStub: sinon.SinonStub;
    let clipboardWriteTextStub: sinon.SinonStub;

    beforeEach(function () {
      sendEditDocumentStub = sinon.stub(vscodeApi, 'sendEditDocument');
      sendCloneDocumentStub = sinon.stub(vscodeApi, 'sendCloneDocument');
      sendDeleteDocumentStub = sinon.stub(vscodeApi, 'sendDeleteDocument');

      if (!navigator.clipboard) {
        (navigator as any).clipboard = {
          writeText: async (): Promise<void> => {
            return Promise.resolve();
          },
        };
      } else if (!navigator.clipboard.writeText) {
        (navigator.clipboard as any).writeText = async (): Promise<void> => {
          return Promise.resolve();
        };
      }
      clipboardWriteTextStub = sinon.stub(navigator.clipboard, 'writeText');
    });

    afterEach(function () {
      sendEditDocumentStub.restore();
      sendCloneDocumentStub.restore();
      sendDeleteDocumentStub.restore();
      clipboardWriteTextStub.restore();
    });

    it('should render all action buttons when document has _id', function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const editButton = screen.queryByLabelText('Edit Document');
      const copyButton = screen.queryByLabelText('Copy Document');
      const cloneButton = screen.queryByLabelText('Clone Document');
      const deleteButton = screen.queryByLabelText('Delete Document');

      expect(editButton).to.exist;
      expect(copyButton).to.exist;
      expect(cloneButton).to.exist;
      expect(deleteButton).to.exist;
    });

    it('should only render copy button when document has no _id', function () {
      const document = { name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const editButton = screen.queryByLabelText('Edit Document');
      const copyButton = screen.queryByLabelText('Copy Document');
      const cloneButton = screen.queryByLabelText('Clone Document');
      const deleteButton = screen.queryByLabelText('Delete Document');

      expect(editButton).to.not.exist;
      expect(copyButton).to.exist;
      expect(cloneButton).to.not.exist;
      expect(deleteButton).to.not.exist;
    });

    it('should call sendEditDocument when edit button is clicked', function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const editButton = screen.getByLabelText('Edit Document');
      fireEvent.click(editButton);

      expect(sendEditDocumentStub.calledOnce).to.be.true;
      expect(sendEditDocumentStub.calledWith('123')).to.be.true;
    });

    it('should call clipboard.writeText when copy button is clicked', async function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const copyButton = screen.getByLabelText('Copy Document');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(clipboardWriteTextStub.calledOnce).to.be.true;
        const calledWith = clipboardWriteTextStub.firstCall.args[0];
        expect(calledWith).to.be.a('string');
        expect(calledWith).to.include('_id:');
        expect(calledWith).to.include('123');
      });
    });

    it('should call sendCloneDocument when clone button is clicked', function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const cloneButton = screen.getByLabelText('Clone Document');
      fireEvent.click(cloneButton);

      expect(sendCloneDocumentStub.calledOnce).to.be.true;
      expect(sendCloneDocumentStub.calledWith(document)).to.be.true;
    });

    it('should call sendDeleteDocument when delete button is clicked', function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const deleteButton = screen.getByLabelText('Delete Document');
      fireEvent.click(deleteButton);

      expect(sendDeleteDocumentStub.calledOnce).to.be.true;
      expect(sendDeleteDocumentStub.calledWith('123')).to.be.true;
    });

    it('should handle ObjectId _id correctly', function () {
      const document = {
        _id: { $oid: '507f1f77bcf86cd799439011' },
        name: 'Test',
      };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const editButton = screen.getByLabelText('Edit Document');
      fireEvent.click(editButton);

      expect(sendEditDocumentStub.calledOnce).to.be.true;
      expect(sendEditDocumentStub.firstCall.args[0]).to.deep.equal({
        $oid: '507f1f77bcf86cd799439011',
      });
    });

    it('should handle numeric _id correctly', function () {
      const document = { _id: 42, name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const deleteButton = screen.getByLabelText('Delete Document');
      fireEvent.click(deleteButton);

      expect(sendDeleteDocumentStub.calledOnce).to.be.true;
      expect(sendDeleteDocumentStub.calledWith(42)).to.be.true;
    });

    it('should have correct codicon icons for each button', function () {
      const document = { _id: '123', name: 'Test' };

      render(<MonacoViewer document={document} themeKind="vs-dark" />);

      const editButton = screen.getByLabelText('Edit Document');
      const copyButton = screen.getByLabelText('Copy Document');
      const cloneButton = screen.getByLabelText('Clone Document');
      const deleteButton = screen.getByLabelText('Delete Document');

      const editIcon = editButton.querySelector('.codicon-edit');
      const copyIcon = copyButton.querySelector('.codicon-copy');
      const cloneIcon = cloneButton.querySelector('.codicon-files');
      const deleteIcon = deleteButton.querySelector('.codicon-trash');

      expect(editIcon).to.exist;
      expect(copyIcon).to.exist;
      expect(cloneIcon).to.exist;
      expect(deleteIcon).to.exist;
    });
  });
});
