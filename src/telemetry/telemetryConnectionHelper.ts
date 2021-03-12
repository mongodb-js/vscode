import { Document, MongoClient } from 'mongodb';
import { getCloudInfo } from 'mongodb-cloud-info';
import mongoDBBuildInfo from 'mongodb-build-info';

import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import ConnectionModel, { buildConnectionStringFromConnectionModel } from '../views/webview-app/connection-model/connection-model';

const { version } = require('../../package.json');

export type NewConnectionTelemetryEventProperties = {
  /* eslint-disable camelcase */
  auth_strategy: string;
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

const log = createLogger('connection telemetry helper');

async function getCloudInfoFromDataService(
  firstServerHostname: string
): Promise<CloudInfo> {
  try {
    const cloudInfo: {
      isAws?: boolean,
      isAzure?: boolean,
      isGcp?: boolean
    } = await getCloudInfo(firstServerHostname);

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

export async function getConnectionTelemetryProperties(
  dataService: MongoClient,
  model: ConnectionModel,
  connectionType: ConnectionTypes
): Promise<NewConnectionTelemetryEventProperties> {
  const adminDb = dataService.db('admin');

  // buildInfo doesn't require any privileges to run, so if it fails,
  // something went wrong and we should throw the error.
  const buildInfo = await adminDb.command({
    buildInfo: 1
  });

  const cloudInfo = await getCloudInfoFromDataService(
    model.hosts[0].host
  );

  let cmdLineOpts: null | Document = null;
  try {
    cmdLineOpts = await adminDb.command({
      getCmdLineOpts: 1
    });
  } catch (e) { /* Silently continue when can't retrieve command line opts. */ }

  const {
    isGenuine,
    serverName: nonGenuineServerName
  } = mongoDBBuildInfo.getGenuineMongoDB(buildInfo, cmdLineOpts);
  const {
    isDataLake,
    dlVersion
  } = mongoDBBuildInfo.getDataLake(buildInfo);

  const {
    serverOs,
    serverArch
  } = mongoDBBuildInfo.getBuildEnv(buildInfo);

  const uri = buildConnectionStringFromConnectionModel(model);

  /* eslint-disable camelcase */
  const preparedProperties: NewConnectionTelemetryEventProperties = {
    auth_strategy: model.authStrategy,
    is_atlas: mongoDBBuildInfo.isAtlas(uri),
    is_localhost: mongoDBBuildInfo.isLocalhost(uri),
    is_data_lake: isDataLake,
    is_enterprise: mongoDBBuildInfo.isEnterprise(buildInfo),
    is_public_cloud: cloudInfo.isPublicCloud,
    dl_version: dlVersion,
    public_cloud_name: cloudInfo.publicCloudName,
    is_genuine: isGenuine,
    non_genuine_server_name: nonGenuineServerName,
    server_version: buildInfo.version,
    server_arch: serverArch,
    server_os: serverOs,
    is_used_connect_screen:
      connectionType === ConnectionTypes.CONNECTION_FORM,
    is_used_command_palette:
      connectionType === ConnectionTypes.CONNECTION_STRING,
    is_used_saved_connection:
      connectionType === ConnectionTypes.CONNECTION_ID,
    vscode_mdb_extension_version: version
  };
  /* eslint-enable camelcase */

  return preparedProperties;
}
