import { expect } from 'chai';

import {
  gracefullyDeserializeEjson,
  toDisplayString,
  InvalidBSONValue,
} from '../../../../views/data-browsing-app/gracefulEjsonDeserialize';

describe('gracefulEjsonDeserialize', function () {
  describe('gracefullyDeserializeEjson', function () {
    it('should deserialize a valid EJSON document', function () {
      const ejson = {
        _id: { $oid: '507f1f77bcf86cd799439011' },
        count: { $numberLong: '42' },
        name: 'hello',
      };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result._id).to.have.property('_bsontype', 'ObjectId');
      expect(result.count).to.have.property('_bsontype', 'Long');
      expect(result.name).to.equal('hello');
    });

    it('should substitute InvalidBSONValue for an invalid $numberLong', function () {
      const ejson = {
        good: { $numberLong: '42' },
        bad: { $numberLong: 'pineapple' },
      };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result.good).to.have.property('_bsontype', 'Long');
      expect(result.bad).to.be.instanceOf(InvalidBSONValue);
      expect((result.bad as InvalidBSONValue).typeName).to.equal('NumberLong');
    });

    it('should substitute InvalidBSONValue for an invalid $date', function () {
      const ejson = {
        good: { $date: '2024-01-01T00:00:00Z' },
        bad: { $date: 'pineapple' },
      };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result.good).to.be.instanceOf(Date);
      expect(result.bad).to.be.instanceOf(InvalidBSONValue);
      expect((result.bad as InvalidBSONValue).typeName).to.equal('Date');
    });

    it('should substitute InvalidBSONValue for an invalid $oid', function () {
      const ejson = { bad: { $oid: 'not-an-objectid' } };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result.bad).to.be.instanceOf(InvalidBSONValue);
      expect((result.bad as InvalidBSONValue).typeName).to.equal('Oid');
    });

    it('should substitute InvalidBSONValue for an invalid $numberDecimal', function () {
      const ejson = {
        good: { $numberDecimal: '3.14' },
        bad: { $numberDecimal: 'not-a-number' },
      };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result.good).to.have.property('_bsontype', 'Decimal128');
      expect(result.bad).to.be.instanceOf(InvalidBSONValue);
      expect((result.bad as InvalidBSONValue).typeName).to.equal(
        'NumberDecimal',
      );
    });

    it('should pass through regular objects with $-prefixed keys', function () {
      const ejson = {
        query: { $set: { x: 1 } },
      };
      const result = gracefullyDeserializeEjson(ejson);

      // $set is not an EJSON type wrapper, so it should be passed through
      // as a regular object.
      expect(result.query).to.not.be.instanceOf(InvalidBSONValue);
      expect(result.query).to.have.property('$set');
    });

    it('should handle nested documents with mixed valid/invalid values', function () {
      const ejson = {
        _id: { $oid: '507f1f77bcf86cd799439011' },
        nested: {
          ok: { $numberLong: '42' },
          bad: { $numberLong: 'NaN' },
          deep: {
            name: 'test',
            also_bad: { $date: 'garbage' },
          },
        },
      };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result._id).to.have.property('_bsontype', 'ObjectId');
      const nested = result.nested as Record<string, unknown>;
      expect(nested.ok).to.have.property('_bsontype', 'Long');
      expect(nested.bad).to.be.instanceOf(InvalidBSONValue);
      const deep = nested.deep as Record<string, unknown>;
      expect(deep.name).to.equal('test');
      expect(deep.also_bad).to.be.instanceOf(InvalidBSONValue);
    });

    it('should handle arrays with mixed valid/invalid values', function () {
      const ejson = {
        items: [{ $numberLong: '1' }, { $numberLong: 'bad' }, 'plain string'],
      };
      const result = gracefullyDeserializeEjson(ejson);

      const items = result.items as unknown[];
      expect(items[0]).to.have.property('_bsontype', 'Long');
      expect(items[1]).to.be.instanceOf(InvalidBSONValue);
      expect(items[2]).to.equal('plain string');
    });

    it('should handle primitives and nulls', function () {
      const ejson = {
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
      };
      const result = gracefullyDeserializeEjson(ejson);

      expect(result.str).to.equal('hello');
      expect(result.num).to.equal(42);
      expect(result.bool).to.equal(true);
      expect(result.nil).to.equal(null);
    });
  });

  describe('toDisplayString', function () {
    it('should render InvalidBSONValue as unquoted text', function () {
      const doc = gracefullyDeserializeEjson({
        bad: { $numberLong: 'pineapple' },
      });
      const output = toDisplayString(doc);

      // Should contain "Invalid NumberLong" without quotes around it
      expect(output).to.include('Invalid NumberLong');
      // Should NOT be quoted like a string
      expect(output).to.not.include("'Invalid NumberLong'");
      expect(output).to.not.include('"Invalid NumberLong"');
    });

    it('should render valid BSON types in shell syntax', function () {
      const doc = gracefullyDeserializeEjson({
        _id: { $oid: '507f1f77bcf86cd799439011' },
        count: { $numberLong: '42' },
      });
      const output = toDisplayString(doc);

      expect(output).to.include("ObjectId('507f1f77bcf86cd799439011')");
      expect(output).to.include("NumberLong('42')");
    });

    it('should render a mix of valid, invalid, and primitive values', function () {
      const doc = gracefullyDeserializeEjson({
        _id: { $oid: '507f1f77bcf86cd799439011' },
        bad: { $numberLong: 'NaN' },
        name: 'hello',
      });
      const output = toDisplayString(doc);

      expect(output).to.include("ObjectId('507f1f77bcf86cd799439011')");
      expect(output).to.include('Invalid NumberLong');
      expect(output).to.include("'hello'");
    });

    it('should render nested objects with proper indentation', function () {
      const doc = gracefullyDeserializeEjson({
        nested: {
          ok: { $numberLong: '42' },
          bad: { $date: 'garbage' },
        },
      });
      const output = toDisplayString(doc);

      expect(output).to.include('nested: {');
      expect(output).to.include("NumberLong('42')");
      expect(output).to.include('Invalid Date');
    });

    it('should render arrays', function () {
      const doc = gracefullyDeserializeEjson({
        items: [{ $numberLong: '1' }, { $numberLong: 'bad' }, 'plain'],
      });
      const output = toDisplayString(doc);

      expect(output).to.include("NumberLong('1')");
      expect(output).to.include('Invalid NumberLong');
      expect(output).to.include("'plain'");
    });

    it('should render empty objects and arrays', function () {
      const doc = gracefullyDeserializeEjson({
        emptyObj: {},
        emptyArr: [],
      });
      const output = toDisplayString(doc);

      // The formatter might represent these differently, but they should
      // not cause errors.
      expect(output).to.be.a('string');
      expect(output.length).to.be.greaterThan(0);
    });
  });
});
