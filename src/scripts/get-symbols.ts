import fs = require('fs');
import path = require('path');

const SYNTAXES_DIR = path.resolve(__dirname, '../../src/syntaxes/');

const AGG_ACCUMULATORS = [
  '$addToSet',
  '$avg',
  '$first',
  '$last',
  '$max',
  '$min',
  '$push',
  '$stdDevPop',
  '$stdDevSamp',
  '$sum'
];

const AGG_CONVERTERS = [
  '$convert',
  '$ltrim',
  '$rtrim',
  '$toBool',
  '$toDate',
  '$toDecimal',
  '$toDouble',
  '$toInt',
  '$toLong',
  '$toObjectId',
  '$toString',
  '$trim'
];

const AGG_EXPRESSION_OPERATORS = [
  '$abs',
  '$add',
  '$allElementsTrue',
  '$and',
  '$anyElementTrue',
  '$arrayElemAt',
  '$arrayToObject',
  '$ceil',
  '$cmp',
  '$concat',
  '$concatArrays',
  '$cond',
  '$dateFromParts',
  '$dateFromString',
  '$dateToParts',
  '$dateToString',
  '$dayOfMonth',
  '$dayOfWeek',
  '$dayOfYear',
  '$divide',
  '$eq',
  '$exp',
  '$filter',
  '$floor',
  '$gt',
  '$gte',
  '$hour',
  '$ifNull',
  '$in',
  '$indexOfArray',
  '$indexOfBytes',
  '$indexOfCP',
  '$isArray',
  '$isoDayOfWeek',
  '$isoWeek',
  '$isoWeekYear',
  '$let',
  '$literal',
  '$lt',
  '$ln',
  '$log',
  '$log10',
  '$map',
  '$mergeObjects',
  '$meta',
  '$millisecond',
  '$minute',
  '$mod',
  '$month',
  '$multiply',
  '$new',
  '$not',
  '$objectToArray',
  '$or',
  '$pow',
  '$range',
  '$reduce',
  '$reverseArray',
  '$second',
  '$setDifference',
  '$setEquals',
  '$setIntersection',
  '$setIsSubset',
  '$setUnion',
  '$size',
  '$slice',
  '$split',
  '$sqrt',
  '$strcasecmp',
  '$strLenBytes',
  '$strLenCP',
  '$substr',
  '$substrBytes',
  '$substrCP',
  '$subtract',
  '$switch',
  '$toLower',
  '$toUpper',
  '$trunc',
  '$type',
  '$week',
  '$year',
  '$zip'
];

const AGG_QUERY_OPERATORS = [
  '$all',
  '$and',
  '$bitsAllClear',
  '$bitsAllSet',
  '$bitsAnyClear',
  '$bitsAnySet',
  '$comment',
  '$elemMatch',
  '$eq',
  '$exists',
  '$expr',
  '$geoIntersects',
  '$geoWithin',
  '$gt',
  '$gte',
  '$in',
  '$jsonSchema',
  '$lt',
  '$lte',
  '$mod',
  '$ne',
  '$near',
  '$nearSphere',
  '$nin',
  '$not',
  '$nor',
  '$or',
  '$regex',
  '$size',
  '$slice',
  '$text',
  '$type',
  '$where'
];

const AGG_STAGE_OPERATORS = [
  '$addFields',
  '$bucket',
  '$bucketAuto',
  '$collStats',
  '$count',
  '$facet',
  '$geoNear',
  '$graphLookup',
  '$group',
  '$indexStats',
  '$limit',
  '$lookup',
  '$match',
  '$out',
  '$project',
  '$redact',
  '$replaceRoot',
  '$sample',
  '$skip',
  '$sort',
  '$sortByCount',
  '$unwind'
];

const EXT_JSON = [
  '$binary',
  '$date',
  '$maxKey',
  '$minKey',
  '$numberDecimal',
  '$numberDouble',
  '$numberInt',
  '$numberLong',
  '$oid',
  '$regex',
  '$regularExpression',
  '$timestamp',
  '$undefined'
];

// Creates an array of unique values from a list of arrays
// the same way as lodash.union does.
const AGG_SYMBOLS = [
  ...new Set([
    ...AGG_ACCUMULATORS,
    ...AGG_CONVERTERS,
    ...AGG_EXPRESSION_OPERATORS,
    ...AGG_QUERY_OPERATORS,
    ...AGG_STAGE_OPERATORS,
    ...EXT_JSON
  ])
];

interface InjectionRepo {
  [key: string]: Record<string, any>;
}

interface AggSymbol {
  scopeName: string;
  injectionSelector: string;
  patterns: Array<any>;
  repository: InjectionRepo;
}

const result = {
  scopeName: 'agg-symbols.injection',
  injectionSelector: 'L:meta.objectliteral',
  patterns: [],
  repository: {}
} as AggSymbol;

AGG_SYMBOLS.forEach(item => {
  const value = item.substring(1);
  const keyword = `${value}-keyword`;

  result.patterns.push({
    include: `#${keyword}`
  });
  result.repository[keyword] = {
    match: `\\${item}\\b`,
    name: `keyword.${value}`
  };
});

// Create the `agg-symbols-injection.json` file with the agg symbols injection.
fs.unlink(`${SYNTAXES_DIR}/agg-symbols-injection.json`, unlinkFileError => {
  if (!unlinkFileError || unlinkFileError.code === 'ENOENT') {
    fs.writeFile(
      `${SYNTAXES_DIR}/agg-symbols-injection.json`,
      JSON.stringify(result, null, 2),
      'utf8',
      (writeFileError: Record<string, any> | null) => {
        if (writeFileError) {
          return console.log(
            'An error occured while writing to agg-symbols-injection.json',
            writeFileError
          );
        }

        console.log(
          `${SYNTAXES_DIR}/agg-symbols-injection.json file has been saved`
        );
      }
    );
  } else {
    return console.log(
      'An error occured while deleting agg-symbols-injection.json',
      unlinkFileError
    );
  }
});
