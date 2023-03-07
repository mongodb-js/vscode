export interface PrintableError {
  message: string;
  name?: string;
  code?: string;
  stack?: string;
}

export default (
  error: any,
  extra?: { message?: string; code?: string }
): PrintableError => {
  const customError: PrintableError = {
    message: 'Unknown error.',
  };

  if (typeof error?.message === 'string') {
    customError.message = error?.message;
  } else if (typeof error === 'string') {
    customError.message = error;
  } else if (error) {
    customError.message = error.toString();
  } else if (extra?.message) {
    customError.message = extra?.message;
  }

  if (typeof error?.name === 'string') {
    customError.name = error?.name;
  }

  if (typeof error?.stack === 'string') {
    customError.stack = error?.stack;
  }

  if (typeof error?.code === 'string') {
    customError.code = error?.code;
  } else if (extra?.code) {
    customError.code = extra?.code;
  }

  return customError;
};
