import { inspect as utilInspect } from 'util';

type EvaluationResult = {
  value: any;
  type?: string;
};

const inspect = (output): any => {
  return utilInspect(output, {
    customInspect: true,
    depth: 1000,
    breakLength: 0
  });
};

const formatSimpleType = (output): any => {
  if (typeof output === 'string') {
    return output;
  }

  return inspect(output);
};

const formatError = (error): any => {
  return inspect(error);
};

const formatCursor = (value): any => {
  if (!value.length) {
    return '';
  }

  return inspect(value);
};

const formatCursorIterationResult = (value): any => {
  if (!value.length) {
    return 'No cursor';
  }

  return inspect(value);
};

const formatHelp = (value): any => {
  let helpMenu = '';

  if (value.help) {
    helpMenu += `\n${value.help}\n\n`;
  }

  (value.attr || []).forEach((method) => {
    if (method.name && method.description) {
      let formatted = `    ${method.name}`;
      const extraSpaces = 47 - formatted.length;
      formatted += `${' '.repeat(extraSpaces)}${method.description}`;
      helpMenu += `${formatted}\n`;
    }
  });

  if (value.docs) {
    helpMenu += `\nFor more information on mongosh usage:" ${value.docs}`;
  }

  return helpMenu;
};

const formatOutput = (evaluationResult: EvaluationResult): string => {
  const { value, type } = evaluationResult;

  if (type === 'Cursor') {
    return formatCursor(value);
  }

  if (type === 'CursorIterationResult') {
    return formatCursorIterationResult(value);
  }

  if (type === 'Help') {
    return formatHelp(value);
  }

  if (type === 'Error') {
    return formatError(value);
  }

  return formatSimpleType(value);
};

export default formatOutput;
