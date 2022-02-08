export default (error: any, message?: string): {
  name?: string;
  message: string;
  stack?: string;
} => {
  if (typeof error?.name === 'string' && typeof error?.message === 'string' && typeof error?.stack === 'string') {
    return error;
  } else if (typeof error === 'string') {
    return { message: error };
  } else if (error) {
    return { message: error.toString() };
  } else if (message) {
    return { message };
  }
  return { message: 'Unknown error.' };
};
