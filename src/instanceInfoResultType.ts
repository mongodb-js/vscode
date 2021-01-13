/* eslint-disable camelcase */
export type InstanceInfoResult = {
  client: {
    s: {
      url: string;
    }
  },
  build: {
    enterprise_module: boolean;
    version?: string;
    raw: {
      buildEnvironment: {
        target_arch: string | null;
        target_os: string | null;
      }
    }
  },
  dataLake: {
    isDataLake: boolean;
  },
  genuineMongoDB: {
    isGenuine: boolean;
    dbType: string;
  }
};
