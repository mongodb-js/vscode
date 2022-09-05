import { Binary, EJSON } from 'bson';

const docString =
  '{"_id":{"$oid":"57e193d7a9cc81b4027498b5"},"Symbol":"symbol","String":"string","Int32":{"$numberInt":"42"},"Int64":{"$numberLong":"42"},"Double":{"$numberDouble":"-1"},"Binary":{"$binary":{"base64":"o0w498Or7cijeBSpkquNtg==","subType":"03"}},"BinaryUserDefined":{"$binary":{"base64":"AQIDBAU=","subType":"80"}},"Code":{"$code":"function() {}"},"CodeWithScope":{"$code":"function() {}","$scope":{}},"Subdocument":{"foo":"bar"},"Array":[{"$numberInt":"1"},{"$numberInt":"2"},{"$numberInt":"3"},{"$numberInt":"4"},{"$numberInt":"5"}],"Timestamp":{"$timestamp":{"t":42,"i":1}},"Regex":{"$regularExpression":{"pattern":"pattern","options":""}},"DatetimeEpoch":{"$date":{"$numberLong":"0"}},"DatetimePositive":{"$date":{"$numberLong":"2147483647"}},"DatetimeNegative":{"$date":{"$numberLong":"-2147483648"}},"True":true,"False":false,"DBPointer":{"$ref":"collection","$id":{"$oid":"57e193d7a9cc81b4027498b1"}},"DBRef":{"$ref":"collection","$id":{"$oid":"57fd71e96e32ab4225b723fb"},"$db":"database"},"Minkey":{"$minKey":1},"Maxkey":{"$maxKey":1},"Null":null,"Undefined":null}';
export const documentWithAllBSONTypes = EJSON.parse(docString);

export const documentWithAllBsonTypesJsonified = `{
  "_id": "57e193d7a9cc81b4027498b5",
  "Symbol": "symbol",
  "String": "string",
  "Int32": 42,
  "Int64": 42,
  "Double": -1,
  "Binary": "o0w498Or7cijeBSpkquNtg==",
  "BinaryUserDefined": "AQIDBAU=",
  "Code": {
    "code": "function() {}"
  },
  "CodeWithScope": {
    "scope": {},
    "code": "function() {}"
  },
  "Subdocument": {
    "foo": "bar"
  },
  "Array": [
    1,
    2,
    3,
    4,
    5
  ],
  "Timestamp": "180388626433",
  "Regex": {},
  "DatetimeEpoch": "1970-01-01T00:00:00.000Z",
  "DatetimePositive": "1970-01-25T20:31:23.647Z",
  "DatetimeNegative": "1969-12-07T03:28:36.352Z",
  "True": true,
  "False": false,
  "DBPointer": {
    "$ref": "collection",
    "$id": "57e193d7a9cc81b4027498b1",
    "$db": ""
  },
  "DBRef": {
    "$ref": "collection",
    "$id": "57fd71e96e32ab4225b723fb",
    "$db": "database"
  },
  "Minkey": {
    "_bsontype": "MinKey"
  },
  "Maxkey": {
    "_bsontype": "MaxKey"
  },
  "Null": null,
  "Undefined": null
}`;

export const documentWithBinaryId = {
  _id: new Binary('a+b'),
};
export const documentWithBinaryIdString = JSON.stringify(
  documentWithBinaryId,
  null,
  2
);
