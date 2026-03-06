import { expect } from 'chai';
import { BSON } from 'bson';

import { deserializeBSON, serializeBSON } from '../../../language/serializer';

suite('Serializer Test Suite', function () {
  test('serializes and deserializes nested plain objects', function () {
    const value = {
      name: 'pineapple',
      count: 3,
      active: true,
      nested: {
        list: [1, 'two', false, null],
      },
    };

    const data = serializeBSON(value);

    expect(data).to.be.a('string');
    expect(() => Buffer.from(data, 'base64')).to.not.throw();
    expect(deserializeBSON(data)).to.deep.equal(value);
  });

  test('round-trips primitive values', function () {
    const values = ['hello', 42, true, null];

    for (const value of values) {
      const data = serializeBSON(value);
      expect(deserializeBSON(data)).to.equal(value);
    }
  });

  test('round-trips bson values', function () {
    const value = {
      _id: new BSON.ObjectId('65f1d4be76adcc6c6f0e11d4'),
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      decimal: BSON.Decimal128.fromString('123.45'),
    };

    const data = serializeBSON(value);
    const deserialized = deserializeBSON(data);

    expect(deserialized._id.toHexString()).to.equal(value._id.toHexString());
    expect(deserialized.createdAt).to.deep.equal(value.createdAt);
    expect(deserialized.decimal.toString()).to.equal(value.decimal.toString());
  });
});
