import getBuildInfo from 'mongodb-build-info';

import { ConnectionTypes } from '../connectionController';
import { DataServiceType } from '../types/dataServiceType';

const ATLAS_REGEX = /mongodb.net[:/]/i;
const LOCALHOST_REGEX = /(localhost|127\.0\.0\.1)/i;

export type CloudInfo = {
  isAws: boolean;
  isGcp: boolean;
  isAzure: boolean;
};

export type NewConnectionTelemetryEventProperties = {
  /* eslint-disable camelcase */
  // ^ Segment data is camel case :')
  is_atlas: boolean;
  is_localhost: boolean;
  is_data_lake: boolean;
  is_enterprise: boolean;
  is_public_cloud?: boolean;
  public_cloud_name?: string | null;
  is_genuine: boolean;
  non_genuine_server_name: string | null;
  server_version?: string;
  server_arch: string | null;
  server_os: string | null;
  is_used_connect_screen: boolean;
  is_used_command_palette: boolean;
  is_used_saved_connection: boolean;
  /* eslint-enable camelcase */
};

// /**
//  * Get currently known topology information.
//  */
// getTopology(): Topology | undefined {
//   return this.mongoClient.topology;
// }

export async function getConnectionTelemetryEventProperties(
  // uri: string,
  // mongoshVersion: string,
  // buildInfo: any,
  // cmdLineOpts: any,
  // topology: any,
  dataService: DataServiceType,
  cloudInfo: CloudInfo,
  connectionType: ConnectionTypes
): NewConnectionTelemetryEventProperties {
  // const { isGenuine: is_genuine, serverName: non_genuine_server_name } =
  //   getBuildInfo.getGenuineMongoDB(buildInfo, cmdLineOpts);
  // const { isDataLake: is_data_lake, dlVersion: dl_version }
  //   = getBuildInfo.getDataLake(buildInfo);

  // // get this information from topology rather than cmdLineOpts, since not all
  // // connections are able to run getCmdLineOpts command
  // const auth_type = topology.s.credentials
  //   ? topology.s.credentials.mechanism : null;
  // const { serverOs: server_os, serverArch: server_arch }
  //   = getBuildInfo.getBuildEnv(buildInfo);

  // return {
  //   is_atlas: getBuildInfo.isAtlas(uri),
  //   is_localhost: getBuildInfo.isLocalhost(uri),
  //   server_version: buildInfo.version,
  //   node_version: process.version,
  //   mongosh_version: mongoshVersion,
  //   server_os,
  //   uri,
  //   server_arch,
  //   is_enterprise: getBuildInfo.isEnterprise(buildInfo),
  //   auth_type,
  //   is_data_lake,
  //   dl_version,
  //   is_genuine,
  //   non_genuine_server_name
  // };

    // buildInfo try/catch can be removed after MONGOCRYPT-308
    let buildInfo;
    try {
      buildInfo = await this.runCommandWithCheck('admin', {
        buildInfo: 1
      }, this.baseCmdOptions);
    } catch (e) {
      if (e.message.includes('not supported for auto encryption')) {
        const options = { ...this.currentClientOptions };
        delete options.autoEncryption;
        const unencrypted =
          await this.getNewConnection(
            (this.uri as ConnectionString).toString(),
            options);
        try {
          return await unencrypted.getConnectionInfo();
        } finally {
          await unencrypted.close(true);
        }
      }
    }
    const topology = this.getTopology() as Topology;
    const { version } = require('../package.json');
    let cmdLineOpts = null;
    try {
      cmdLineOpts = await this.runCommandWithCheck('admin', {
        getCmdLineOpts: 1
      }, this.baseCmdOptions);
      // eslint-disable-next-line no-empty
    } catch (e) {
    }

  const nonGenuineServerName = data.genuineMongoDB.isGenuine
    ? null
    : data.genuineMongoDB.dbType;
  const properties = {
    is_atlas: !!ATLAS_REGEX.exec(data.client.s.url),
    is_localhost: !!LOCALHOST_REGEX.exec(data.client.s.url),
    is_data_lake: data.dataLake.isDataLake,
    is_enterprise: data.build.enterprise_module,
    is_public_cloud: cloudInfo.isPublicCloud,
    public_cloud_name: cloudInfo.publicCloudName,
    is_genuine: data.genuineMongoDB.isGenuine,
    non_genuine_server_name: nonGenuineServerName,
    server_version: data.build.version,
    server_arch: data.build.raw.buildEnvironment.target_arch,
    server_os: data.build.raw.buildEnvironment.target_os,
    is_used_connect_screen:
      connectionType === ConnectionTypes.CONNECTION_FORM,
    is_used_command_palette:
      connectionType === ConnectionTypes.CONNECTION_STRING,
    is_used_saved_connection:
      connectionType === ConnectionTypes.CONNECTION_ID
  };

  return properties;
}
