import ConnectionString from 'mongodb-connection-string-url';

export const getDBFromConnectionString = (
  connectionString: string,
): string | null => {
  try {
    const connectionStringOb = new ConnectionString(connectionString);
    return connectionStringOb.pathname !== '/'
      ? connectionStringOb.pathname.substring(1)
      : null;
  } catch {
    return null;
  }
};
