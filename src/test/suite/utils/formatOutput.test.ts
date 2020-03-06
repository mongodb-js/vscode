import formatOutput from '../../../utils/formatOutput';
import { expect } from 'chai';

const stripAnsiColors = (str) => str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');

suite('Format Output Test Suite', () => {
  suite('when the result is a string', () => {
    test('returns the output', () => {
      expect(formatOutput({ value: 'test' })).to.equal('test');
    });
  });

  suite('when the result is an object', () => {
    test('returns the inspection', () => {
      expect(formatOutput({ value: 2 })).to.include('2');
    });
  });

  suite('when the result is a Cursor', () => {
    suite('when the Cursor is not empty', () => {
      test('returns the inspection', () => {
        const output = stripAnsiColors(formatOutput({
          value: [{ doc: 1 }, { doc: 2 }],
          type: 'Cursor'
        }));

        expect(output).to.include('doc: 1');
        expect(output).to.include('doc: 2');
      });
    });

    suite('when the Cursor is empty', () => {
      test('returns an empty string', () => {
        const output = stripAnsiColors(formatOutput({
          value: [],
          type: 'Cursor'
        }));

        expect(output).to.equal('');
      });
    });
  });

  suite('when the result is a CursorIterationResult', () => {
    suite('when the CursorIterationResult is not empty', () => {
      test('returns the inspection', () => {
        const output = stripAnsiColors(formatOutput({
          value: [{ doc: 1 }, { doc: 2 }],
          type: 'CursorIterationResult'
        }));

        expect(output).to.include('doc: 1');
        expect(output).to.include('doc: 2');
      });
    });

    suite('when the CursorIterationResult is empty', () => {
      test('returns "No cursor"', () => {
        const output = stripAnsiColors(formatOutput({
          value: [],
          type: 'CursorIterationResult'
        }));

        expect(output).to.equal('No cursor');
      });
    });
  });

  suite('when the result is an Help', () => {
    test('returns the help text', () => {
      const output = stripAnsiColors(formatOutput({
        value: {
          help: 'Some help text'
        },
        type: 'Help'
      }));

      expect(output).to.contain('Some help text');
    });
  });
});

