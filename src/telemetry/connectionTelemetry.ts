import { DataService } from 'mongodb-data-service';
import { getCloudInfo } from 'mongodb-cloud-info';
import mongoDBBuildInfo from 'mongodb-build-info';

import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';

const log = createLogger('connection telemetry helper');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

export type NewConnectionTelemetryEventProperties = {
  auth_strategy?: string;
  is_atlas?: boolean;
  is_localhost?: boolean;
  is_data_lake?: boolean;
  is_enterprise?: boolean;
  is_public_cloud?: boolean;
  dl_version?: string | null;
  public_cloud_name?: string | null;
  is_genuine?: boolean;
  non_genuine_server_name?: string | null;
  server_version?: string;
  server_arch?: string;
  server_os?: string;
  is_used_connect_screen?: boolean;
  is_used_command_palette?: boolean;
  is_used_saved_connection?: boolean;
  vscode_mdb_extension_version?: string;
};

type CloudInfo = {
  isPublicCloud?: boolean;
  publicCloudName?: string | null;
};

async function getCloudInfoFromDataService(
  firstServerHostname: string
): Promise<CloudInfo> {
  const cloudInfo: {
    isAws?: boolean;
    isAzure?: boolean;
    isGcp?: boolean;
  } = await getCloudInfo(firstServerHostname);

  if (cloudInfo.isAws) {
    return {
      isPublicCloud: true,
      publicCloudName: 'aws',
    };
  }
  if (cloudInfo.isGcp) {
    return {
      isPublicCloud: true,
      publicCloudName: 'gcp',
    };
  }
  if (cloudInfo.isAzure) {
    return {
      isPublicCloud: true,
      publicCloudName: 'azure',
    };
  }

  return {
    isPublicCloud: false,
    publicCloudName: null,
  };
}

export async function getConnectionTelemetryProperties(
  dataService: DataService,
  connectionType: ConnectionTypes
): Promise<NewConnectionTelemetryEventProperties> {
  let preparedProperties: NewConnectionTelemetryEventProperties = {
    is_used_connect_screen: connectionType === ConnectionTypes.CONNECTION_FORM,
    is_used_command_palette:
      connectionType === ConnectionTypes.CONNECTION_STRING,
    is_used_saved_connection: connectionType === ConnectionTypes.CONNECTION_ID,
    vscode_mdb_extension_version: version,
  };

  try {
    const connectionString = dataService.getConnectionString();
    const firstHost = connectionString.hosts[0] || '';
    const [hostname] = firstHost.split(':');
    const authMechanism = connectionString.searchParams.get('authMechanism');
    const username = connectionString.username ? 'DEFAULT' : 'NONE';
    const authStrategy = authMechanism ?? username;

    const [instance, cloudInfo] = await Promise.all([
      dataService.instance(),
      getCloudInfoFromDataService(hostname),
    ]);

    preparedProperties = {
      ...preparedProperties,
      auth_strategy: authStrategy,
      is_atlas: mongoDBBuildInfo.isAtlas(connectionString.toString()),
      is_localhost: mongoDBBuildInfo.isLocalhost(connectionString.toString()),
      is_data_lake: instance.dataLake.isDataLake,
      is_enterprise: instance.build.isEnterprise,
      is_public_cloud: cloudInfo.isPublicCloud,
      dl_version: instance.dataLake.version,
      public_cloud_name: cloudInfo.publicCloudName,
      is_genuine: instance.genuineMongoDB.isGenuine,
      non_genuine_server_name: instance.genuineMongoDB.dbType,
      server_version: instance.build.version,
      server_arch: instance.host.arch,
      server_os: instance.host.os,
    };
  } catch (error) {
    log.error('Getting connection telemetry properties failed', error);
  }

  return preparedProperties;
}
