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
  if (
    typeof error?.name === 'string' &&
    typeof error?.message === 'string' &&
    typeof error?.stack === 'string'
  ) {
    return error;
  }

  const customError: PrintableError = {
    message: 'Unknown error.',
  };

  if (typeof error === 'string') {
    customError.message = error;
  } else if (error) {
    customError.message = error.toString();
  } else if (extra?.message) {
    customError.message = extra?.message;
  }

  if (extra?.code) {
    customError.code = extra?.code;
  }

  return customError;
};
