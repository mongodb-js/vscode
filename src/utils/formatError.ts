export default (err: any, message?: string): {
  name?: string;
  message: string;
  stack?: string;
} => {
  if (err instanceof Error) {
    return err;
  } else if (typeof err === 'string') {
    return { message: err };
  } else if (err) {
    return { message: err.toString() };
  } else if (message) {
    return { message };
  }
  return { message: 'Unknown error.' };
};
