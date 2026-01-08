import React from 'react';
import { expect } from 'chai';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import DocumentTreeView from '../../../../views/data-browsing-app/document-tree-view';

describe('DocumentTreeView test suite', function () {
  afterEach(function () {
    cleanup();
  });

  describe('Basic rendering', function () {
    it('should render a simple document with string field', function () {
      const doc = { name: 'Test' };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"name"')).to.exist;
      expect(screen.getByText('"Test"')).to.exist;
    });

    it('should render a document with number field', function () {
      const doc = { count: 42 };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"count"')).to.exist;
      expect(screen.getByText('42')).to.exist;
    });

    it('should render a document with boolean field', function () {
      const doc = { active: true };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"active"')).to.exist;
      expect(screen.getByText('true')).to.exist;
    });

    it('should render a document with null field', function () {
      const doc = { empty: null };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"empty"')).to.exist;
      expect(screen.getByText('null')).to.exist;
    });

    it('should render a document with multiple fields', function () {
      const doc = { name: 'Test', count: 10, active: false };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"name"')).to.exist;
      expect(screen.getByText('"count"')).to.exist;
      expect(screen.getByText('"active"')).to.exist;
    });
  });

  describe('ObjectId handling', function () {
    it('should render ObjectId with EJSON format correctly', function () {
      const doc = { _id: { $oid: '507f1f77bcf86cd799439011' } };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"_id"')).to.exist;
      expect(screen.getByText("ObjectId('507f1f77bcf86cd799439011')")).to.exist;
    });

    it('should render string _id correctly', function () {
      const doc = { _id: 'simple-id' };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"_id"')).to.exist;
      expect(screen.getByText('"simple-id"')).to.exist;
    });
  });

  describe('Nested objects', function () {
    it('should render nested object as collapsed by default', function () {
      const doc = { person: { name: 'John', age: 30 } };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"person"')).to.exist;
      expect(screen.getByText('Object (2)')).to.exist;
    });

    it('should expand nested object when clicked', function () {
      const doc = { person: { name: 'John' } };
      render(<DocumentTreeView document={doc} />);

      // Initially shows collapsed state
      expect(screen.getByText('Object (1)')).to.exist;

      // Click to expand - find the row and click it
      const personRow = screen.getByText('"person"').closest('div');
      if (personRow?.parentElement) {
        fireEvent.click(personRow.parentElement);
      }

      // After expanding, should show the open brace and nested content
      expect(screen.getByText('{')).to.exist;
    });
  });

  describe('Arrays', function () {
    it('should render array as collapsed by default', function () {
      const doc = { items: ['a', 'b', 'c'] };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('"items"')).to.exist;
      expect(screen.getByText('Array [3]')).to.exist;
    });

    it('should expand array when clicked', function () {
      const doc = { items: ['apple'] };
      render(<DocumentTreeView document={doc} />);

      // Initially shows collapsed state
      expect(screen.getByText('Array [1]')).to.exist;

      // Click to expand - find the row and click it
      const itemsRow = screen.getByText('"items"').closest('div');
      if (itemsRow?.parentElement) {
        fireEvent.click(itemsRow.parentElement);
      }

      // After expanding, should show the open bracket
      expect(screen.getByText('[')).to.exist;
    });
  });

  describe('Caret expansion toggle', function () {
    it('should show expand caret for objects', function () {
      const doc = { nested: { field: 'value' } };
      render(<DocumentTreeView document={doc} />);
      // Look for the caret character
      expect(screen.getByText('›')).to.exist;
    });

    it('should show expand caret for arrays', function () {
      const doc = { list: [1, 2, 3] };
      render(<DocumentTreeView document={doc} />);
      expect(screen.getByText('›')).to.exist;
    });

    it('should not show expand caret for primitive values', function () {
      const doc = { simple: 'value' };
      render(<DocumentTreeView document={doc} />);
      // Should not have a caret - querySelector returns null
      const carets = screen.queryAllByText('›');
      expect(carets.length).to.equal(0);
    });
  });
});

