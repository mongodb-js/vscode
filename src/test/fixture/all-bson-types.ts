import {
  BSONRegExp,
  Binary,
  Code,
  DBRef,
  Decimal128,
  Double,
  Int32,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
  UUID,
  BSONSymbol,
} from 'bson';

export const allBsonTypes = {
  _id: new ObjectId('642d766b7300158b1f22e972'),
  double: new Double(1.2), // Double, 1, double
  doubleThatIsAlsoAnInteger: new Double(1), // Double, 1, double
  string: 'pineapple', // String, 2, string
  object: { key: 'value' }, // Object, 3, object
  array: [1, 2, 3], // Array, 4, array
  binData: new Binary(Buffer.from([1, 2, 3])), // Binary data, 5, binData
  // Undefined, 6, undefined (deprecated)
  objectId: new ObjectId('642d766c7300158b1f22e975'), // ObjectId, 7, objectId
  boolean: true, // Boolean, 8, boolean
  date: new Date('2023-04-05T13:25:08.445Z'), // Date, 9, date
  null: null, // Null, 10, null
  regex: new BSONRegExp('pattern', 'i'), // Regular Expression, 11, regex
  // DBPointer, 12, dbPointer (deprecated)
  javascript: new Code('function() {}'), // JavaScript, 13, javascript
  symbol: new BSONSymbol('symbol'), // Symbol, 14, symbol (deprecated)
  javascriptWithScope: new Code('function() {}', { foo: 1, bar: 'a' }), // JavaScript code with scope 15 "javascriptWithScope" Deprecated in MongoDB 4.4.
  int: new Int32(12345), // 32-bit integer, 16, "int"
  timestamp: new Timestamp(new Long('7218556297505931265')), // Timestamp, 17, timestamp
  long: new Long('123456789123456789'), // 64-bit integer, 18, long
  decimal: new Decimal128(
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
  ), // Decimal128, 19, decimal
  minKey: new MinKey(), // Min key, -1, minKey
  maxKey: new MaxKey(), // Max key, 127, maxKey

  binaries: {
    generic: new Binary(Buffer.from([1, 2, 3]), 0), // 0
    functionData: new Binary(Buffer.from('//8='), 1), // 1
    binaryOld: new Binary(Buffer.from('//8='), 2), // 2
    uuidOld: new Binary(Buffer.from('c//SZESzTGmQ6OfR38A11A=='), 3), // 3
    uuid: new UUID('AAAAAAAA-AAAA-4AAA-AAAA-AAAAAAAAAAAA'), // 4
    md5: new Binary(Buffer.from('c//SZESzTGmQ6OfR38A11A=='), 5), // 5
    encrypted: new Binary(Buffer.from('c//SZESzTGmQ6OfR38A11A=='), 6), // 6
    compressedTimeSeries: new Binary(
      Buffer.from(
        'CQCKW/8XjAEAAIfx//////////H/////////AQAAAAAAAABfAAAAAAAAAAEAAAAAAAAAAgAAAAAAAAAHAAAAAAAAAA4AAAAAAAAAAA==',
        'base64',
      ),
      7,
    ), // 7
    custom: new Binary(Buffer.from('//8='), 128), // 128
  },

  dbRef: new DBRef('namespace', new ObjectId('642d76b4b7ebfab15d3c4a78')), // not actually a separate type, just a convention
};

export const allBsonTypesShellSyntax = `{
  _id: ObjectId('642d766b7300158b1f22e972'),
  'double': Double('1.2'),
  doubleThatIsAlsoAnInteger: Double('1'),
  string: 'pineapple',
  object: {
    key: 'value'
  },
  array: [
    NumberInt('1'),
    NumberInt('2'),
    NumberInt('3')
  ],
  binData: BinData(0, 'AQID'),
  objectId: ObjectId('642d766c7300158b1f22e975'),
  'boolean': true,
  date: ISODate('2023-04-05T13:25:08.445Z'),
  null: null,
  regex: RegExp("pattern", 'i'),
  javascript: Code('function() {}'),
  symbol: {
    value: 'symbol'
  },
  javascriptWithScope: Code('function() {}',{"foo":1,"bar":"a"}),
  'int': NumberInt('12345'),
  timestamp: Timestamp({ t: 1680701109, i: 1 }),
  'long': NumberLong('123456789123456789'),
  decimal: NumberDecimal('5.477284286264328586719275128128001E-4088'),
  minKey: MinKey(),
  maxKey: MaxKey(),
  binaries: {
    generic: BinData(0, 'AQID'),
    functionData: BinData(1, 'Ly84PQ=='),
    binaryOld: BinData(2, 'Ly84PQ=='),
    uuidOld: BinData(3, 'Yy8vU1pFU3pUR21RNk9mUjM4QTExQT09'),
    uuid: UUID('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
    md5: BinData(5, 'Yy8vU1pFU3pUR21RNk9mUjM4QTExQT09'),
    encrypted: BinData(6, 'Yy8vU1pFU3pUR21RNk9mUjM4QTExQT09'),
    compressedTimeSeries: BinData(7, 'CQCKW/8XjAEAAIfx//////////H/////////AQAAAAAAAABfAAAAAAAAAAEAAAAAAAAAAgAAAAAAAAAHAAAAAAAAAA4AAAAAAAAAAA=='),
    custom: BinData(128, 'Ly84PQ==')
  },
  dbRef: DBRef('namespace', '642d76b4b7ebfab15d3c4a78')
}`;

export const allBSONTypesStringifiedEJSON = `{
  "_id": {
    "$oid": "642d766b7300158b1f22e972"
  },
  "double": {
    "$numberDouble": "1.2"
  },
  "doubleThatIsAlsoAnInteger": {
    "$numberDouble": "1.0"
  },
  "string": "pineapple",
  "object": {
    "key": "value"
  },
  "array": [
    {
      "$numberInt": "1"
    },
    {
      "$numberInt": "2"
    },
    {
      "$numberInt": "3"
    }
  ],
  "binData": {
    "$binary": {
      "base64": "AQID",
      "subType": "00"
    }
  },
  "objectId": {
    "$oid": "642d766c7300158b1f22e975"
  },
  "boolean": true,
  "date": {
    "$date": {
      "$numberLong": "1680701108445"
    }
  },
  "null": null,
  "regex": {
    "$regularExpression": {
      "pattern": "pattern",
      "options": "i"
    }
  },
  "javascript": {
    "$code": "function() {}"
  },
  "symbol": {
    "$symbol": "symbol"
  },
  "javascriptWithScope": {
    "$code": "function() {}",
    "$scope": {
      "foo": {
        "$numberInt": "1"
      },
      "bar": "a"
    }
  },
  "int": {
    "$numberInt": "12345"
  },
  "timestamp": {
    "$timestamp": {
      "t": 1680701109,
      "i": 1
    }
  },
  "long": {
    "$numberLong": "123456789123456789"
  },
  "decimal": {
    "$numberDecimal": "5.477284286264328586719275128128001E-4088"
  },
  "minKey": {
    "$minKey": 1
  },
  "maxKey": {
    "$maxKey": 1
  },
  "binaries": {
    "generic": {
      "$binary": {
        "base64": "AQID",
        "subType": "00"
      }
    },
    "functionData": {
      "$binary": {
        "base64": "Ly84PQ==",
        "subType": "01"
      }
    },
    "binaryOld": {
      "$binary": {
        "base64": "Ly84PQ==",
        "subType": "02"
      }
    },
    "uuidOld": {
      "$binary": {
        "base64": "Yy8vU1pFU3pUR21RNk9mUjM4QTExQT09",
        "subType": "03"
      }
    },
    "uuid": {
      "$uuid": "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
    },
    "md5": {
      "$binary": {
        "base64": "Yy8vU1pFU3pUR21RNk9mUjM4QTExQT09",
        "subType": "05"
      }
    },
    "encrypted": {
      "$binary": {
        "base64": "Yy8vU1pFU3pUR21RNk9mUjM4QTExQT09",
        "subType": "06"
      }
    },
    "compressedTimeSeries": {
      "$binary": {
        "base64": "CQCKW/8XjAEAAIfx//////////H/////////AQAAAAAAAABfAAAAAAAAAAEAAAAAAAAAAgAAAAAAAAAHAAAAAAAAAA4AAAAAAAAAAA==",
        "subType": "07"
      }
    },
    "custom": {
      "$binary": {
        "base64": "Ly84PQ==",
        "subType": "80"
      }
    }
  },
  "dbRef": {
    "$ref": "namespace",
    "$id": {
      "$oid": "642d76b4b7ebfab15d3c4a78"
    }
  }
}`;
