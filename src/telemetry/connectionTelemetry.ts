import type { DataService } from 'mongodb-data-service';
import { getCloudInfo } from 'mongodb-cloud-info';
import mongoDBBuildInfo from 'mongodb-build-info';
import resolveMongodbSrv from 'resolve-mongodb-srv';

import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import ConnectionString from 'mongodb-connection-string-url';
import type { TopologyType } from 'mongodb';

const log = createLogger('connection telemetry helper');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

export type NewConnectionTelemetryEventProperties = {
  auth_strategy?: string;
  is_atlas?: boolean;
  is_local_atlas?: boolean;
  atlas_hostname?: string | null;
  is_data_lake?: boolean;
  is_enterprise?: boolean;
  dl_version?: string | null;
  is_genuine?: boolean;
  non_genuine_server_name?: string | null;
  server_version?: string;
  server_arch?: string;
  server_os_family?: string;
  is_used_connect_screen?: boolean;
  is_used_command_palette?: boolean;
  is_used_saved_connection?: boolean;
  vscode_mdb_extension_version?: string;
  topology_type?: TopologyType;
} & HostInformation;

export type HostInformation = {
  is_localhost?: boolean;
  is_atlas_url?: boolean;
  is_do_url?: boolean; // Is digital ocean url.
  is_public_cloud?: boolean;
  public_cloud_name?: string;
};

async function getHostnameForConnection(
  connectionStringData: ConnectionString
): Promise<string | null> {
  if (connectionStringData.isSRV) {
    const uri = await resolveMongodbSrv(connectionStringData.toString()).catch(
      () => null
    );
    if (!uri) {
      return null;
    }
    connectionStringData = new ConnectionString(uri, {
      looseValidation: true,
    });
  }

  const [hostname] = (connectionStringData.hosts[0] ?? '').split(':');
  return hostname;
}

async function getPublicCloudInfo(host: string): Promise<{
  public_cloud_name?: string;
  is_public_cloud?: boolean;
}> {
  try {
    const { isAws, isAzure, isGcp } = await getCloudInfo(host);
    let publicCloudName;

    if (isAws) {
      publicCloudName = 'AWS';
    } else if (isAzure) {
      publicCloudName = 'Azure';
    } else if (isGcp) {
      publicCloudName = 'GCP';
    }

    if (publicCloudName === undefined) {
      return { is_public_cloud: false };
    }

    return {
      is_public_cloud: true,
      public_cloud_name: publicCloudName,
    };
  } catch (err) {
    return {};
  }
}

async function getHostInformation(
  host: string | null
): Promise<HostInformation> {
  if (!host) {
    return {
      is_do_url: false,
      is_atlas_url: false,
      is_localhost: false,
    };
  }

  if (mongoDBBuildInfo.isLocalhost(host)) {
    return {
      is_public_cloud: false,
      is_do_url: false,
      is_atlas_url: false,
      is_localhost: true,
    };
  }

  if (mongoDBBuildInfo.isDigitalOcean(host)) {
    return {
      is_localhost: false,
      is_public_cloud: false,
      is_atlas_url: false,
      is_do_url: true,
    };
  }

  const publicCloudInfo = await getPublicCloudInfo(host);

  return {
    is_localhost: false,
    is_do_url: false,
    is_atlas_url: mongoDBBuildInfo.isAtlas(host),
    ...publicCloudInfo,
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
    const authMechanism = connectionString.searchParams.get('authMechanism');
    const username = connectionString.username ? 'DEFAULT' : 'NONE';
    const authStrategy = authMechanism ?? username;
    const resolvedHostname = await getHostnameForConnection(connectionString);
    const { dataLake, genuineMongoDB, host, build, isAtlas, isLocalAtlas } =
      await dataService.instance();
    const atlasHostname = isAtlas ? resolvedHostname : null;

    preparedProperties = {
      ...preparedProperties,
      ...(await getHostInformation(resolvedHostname)),
      auth_strategy: authStrategy,
      is_atlas: isAtlas,
      atlas_hostname: atlasHostname,
      is_local_atlas: isLocalAtlas,
      is_data_lake: dataLake.isDataLake,
      dl_version: dataLake.version,
      is_enterprise: build.isEnterprise,
      is_genuine: genuineMongoDB.isGenuine,
      non_genuine_server_name: genuineMongoDB.dbType,
      server_version: build.version,
      server_arch: host.arch,
      server_os_family: host.os_family,
      topology_type: dataService.getCurrentTopologyType(),
    };
  } catch (error) {
    log.error('Getting connection telemetry properties failed', error);
  }

  return preparedProperties;
}
