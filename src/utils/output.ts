import { EJSON } from 'bson';

import type { EvaluationResult } from '../types/playgroundType';

export const getContent = ({ type, printable }: EvaluationResult) => {
  if (type === 'Cursor' || type === 'AggregationCursor') {
    return JSON.parse(EJSON.stringify(printable.documents));
  }

  return typeof printable !== 'object' || printable === null
    ? printable
    : JSON.parse(EJSON.stringify(printable));
};

export const getLanguage = (evaluationResult: EvaluationResult) => {
  const content = getContent(evaluationResult);

  if (typeof content === 'object' && content !== null) {
    return 'json';
  }

  return 'plaintext';
};
