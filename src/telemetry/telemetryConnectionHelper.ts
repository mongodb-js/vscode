import { MongoClient } from 'mongodb';
import { getCloudInfo } from 'mongodb-cloud-info';
import getMongoDBBuildInfo from 'mongodb-build-info';

import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import ConnectionModel from '../views/webview-app/connection-model/connection-model';

const { version } = require('../../package.json');

export type NewConnectionTelemetryEventProperties = {
  /* eslint-disable camelcase */
  is_atlas: boolean;
  is_localhost: boolean;
  is_data_lake: boolean;
  is_enterprise: boolean;
  is_public_cloud?: boolean;
  dl_version?: string;
  public_cloud_name?: string | null;
  is_genuine: boolean;
  non_genuine_server_name: string | null;
  server_version: string;
  server_arch: string;
  server_os: string;
  is_used_connect_screen: boolean;
  is_used_command_palette: boolean;
  is_used_saved_connection: boolean;
  vscode_mdb_extension_version: string;
  /* eslint-enable camelcase */
};

type CloudInfo = {
  isPublicCloud?: boolean;
  publicCloudName?: string | null;
};

const ATLAS_REGEX = /mongodb.net[:/]/i;
const LOCALHOST_REGEX = /(localhost|127\.0\.0\.1)/i;

const log = createLogger('connection telemetry helper');

async function getCloudInfoFromDataService(
  firstServerHostname: string
): Promise<CloudInfo> {
  try {
    const cloudInfo = await getCloudInfo(firstServerHostname);

    if (cloudInfo.isAws) {
      return {
        isPublicCloud: true,
        publicCloudName: 'aws'
      };
    }
    if (cloudInfo.isGcp) {
      return {
        isPublicCloud: true,
        publicCloudName: 'gcp'
      };
    }
    if (cloudInfo.isAzure) {
      return {
        isPublicCloud: true,
        publicCloudName: 'azure'
      };
    }

    return {
      isPublicCloud: false,
      publicCloudName: null
    };
  } catch (error) {
    log.error('TELEMETRY cloud info error', error);

    return {};
  }
}

/*
const buildInfo = await this.buildInfo();
    const topology = await this.getTopology();
    const { version } = require('../package.json');
    let cmdLineOpts = null;
    try {
      cmdLineOpts = await this.getCmdLineOpts();
      // eslint-disable-next-line no-empty
    } catch (e) {
    }

    const connectInfo = getConnectInfo(
      this.uri ? this.uri : '',
      version,
      buildInfo,
      cmdLineOpts,
      topology
    );

    return {
      buildInfo: buildInfo,
      topology: topology,
      extraInfo: connectInfo
    };

*/

async function getBuildInfo(dataService: MongoClient) {
  const result: any = await this.runCommandWithCheck(
    'admin',
    {
      buildInfo: 1
    },
    this.baseCmdOptions
  );
}

export async function getConnectionTelemetryProperties(
  connectionModel: ConnectionModel,
  dataService: MongoClient,
  connectionType: ConnectionTypes
): Promise<NewConnectionTelemetryEventProperties> {
  // dataService.instance({}, async (error: any, data: any) => {

  const firstServerHostname = dataService.client.model.hosts[0].host;
  const buildInfo = getBuildInfo;
  const cloudInfo = await getCloudInfoFromDataService(
    firstServerHostname
  );
  const nonGenuineServerName = data.genuineMongoDB.isGenuine
    ? null
    : data.genuineMongoDB.dbType;

  const { isDataLake, dlVersion } = getMongoDBBuildInfo.getDataLake(buildInfo);

  const connectionInfo = await dataService.db('admin').getConnectionInfo();

  /* eslint-disable @typescript-eslint/camelcase */
  const preparedProperties: NewConnectionTelemetryEventProperties = {
    is_atlas: !!data.client.s.url.match(ATLAS_REGEX),
    is_localhost: !!data.client.s.url.match(LOCALHOST_REGEX),
    is_data_lake: isDataLake,
    is_enterprise: data.build.enterprise_module,
    is_public_cloud: cloudInfo.isPublicCloud,
    dl_version: dlVersion,
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
      connectionType === ConnectionTypes.CONNECTION_ID,
    vscode_mdb_extension_version: version
  };
  /* eslint-enable @typescript-eslint/camelcase */

  return preparedProperties;
}
