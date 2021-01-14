import * as vscode from 'vscode';
import { createLogger } from '../logging';
import SegmentAnalytics from 'analytics-node';
import * as path from 'path';
import { config } from 'dotenv';
import { StorageController } from '../storage';
import { ConnectionTypes } from '../connectionController';
import { getCloudInfo } from 'mongodb-cloud-info';
import { DataServiceType } from '../dataServiceType';
import type { ExecuteAllResult, CloudInfoResult } from '../utils/types';
import type { InstanceInfoResult } from '../instanceInfoResultType';
import { ConnectionModelType } from '../connectionModelType';
import fs from 'fs';
import * as util from 'util';

export enum DocumentSource {
  DOCUMENT_SOURCE_TREEVIEW = 'treeview',
  DOCUMENT_SOURCE_PLAYGROUND = 'playground'
}

const log = createLogger('telemetry');

const ATLAS_REGEX = /mongodb.net[:/]/i;
const LOCALHOST_REGEX = /(localhost|127\.0\.0\.1)/i;

type PlaygroundTelemetryEventProperties = {
  type: string | null;
  partial: boolean;
  error: boolean;
};

type SegmentProperties = {
  event: string;
  userId: string;
  properties?: any;
};

type CloudInfo = {
  isPublicCloud?: boolean;
  publicCloudName?: string | null;
};

type LinkClickedTelemetryEventProperties = {
  screen: string;
  link_id: string; // eslint-disable-line camelcase
};

type ExtensionCommandRunTelemetryEventProperties = {
  command: string;
};

type NewConnectionTelemetryEventProperties = {
  /* eslint-disable camelcase */
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

type DocumentUpdatedTelemetryEventProperties = {
  source: string;
  success: boolean;
};

type DocumentEditedTelemetryEventProperties = {
  source: string;
};

export type TelemetryEventProperties =
  | PlaygroundTelemetryEventProperties
  | LinkClickedTelemetryEventProperties
  | ExtensionCommandRunTelemetryEventProperties
  | NewConnectionTelemetryEventProperties
  | DocumentUpdatedTelemetryEventProperties
  | DocumentEditedTelemetryEventProperties;

export enum TelemetryEventTypes {
  PLAYGROUND_CODE_EXECUTED = 'Playground Code Executed',
  EXTENSION_LINK_CLICKED = 'Link Clicked',
  EXTENSION_COMMAND_RUN = 'Command Run',
  NEW_CONNECTION = 'New Connection',
  PLAYGROUND_SAVED = 'Playground Saved',
  PLAYGROUND_LOADED = 'Playground Loaded',
  DOCUMENT_UPDATED = 'Document Updated',
  DOCUMENT_EDITED = 'Document Edited'
}

/**
 * This controller manages telemetry.
 */
export default class TelemetryService {
  _context: vscode.ExtensionContext;
  _shouldTrackTelemetry: boolean; // When tests run the extension, we don't want to track telemetry.
  _segmentAnalytics?: SegmentAnalytics;
  _segmentUserID: string; // The user uuid from the global storage.
  _segmentKey?: string; // The segment API write key.

  constructor(
    storageController: StorageController,
    context: vscode.ExtensionContext,
    shouldTrackTelemetry?: boolean
  ) {
    this._context = context;
    this._shouldTrackTelemetry = shouldTrackTelemetry || false;
    this._segmentUserID = storageController.getUserID();
    this._segmentKey = this._readSegmentKey();

    vscode.workspace.onDidOpenTextDocument((document) => {
      if (
        document &&
        document.languageId === 'mongodb' &&
        document.uri.scheme === 'file'
      ) {
        this.trackPlaygroundLoaded();
      }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document && document.languageId === 'mongodb') {
        this.trackPlaygroundSaved();
      }
    });
  }

  _readSegmentKey(): string | undefined {
    config({ path: path.join(this._context.extensionPath, '.env') });

    try {
      const segmentKeyFileLocation = path.join(
        this._context.extensionPath,
        './constants.json'
      );
      // eslint-disable-next-line no-sync
      const constantsFile = fs.readFileSync(segmentKeyFileLocation).toString();
      const constants = JSON.parse(constantsFile) as { segmentKey: string };

      log.info('TELEMETRY key received', typeof constants.segmentKey);

      return constants.segmentKey;
    } catch (error) {
      log.error('TELEMETRY key error', error);

      return;
    }
  }

  activateSegmentAnalytics(): void {
    if (this._segmentKey) {
      this._segmentAnalytics = new SegmentAnalytics(this._segmentKey, {
        // Segment batches messages and flushes asynchronously to the server.
        // The flushAt is a number of messages to enqueue before flushing.
        // For the development mode we want to flush every submitted message.
        // Otherwise, we use 20 that is the default libraries' value.
        flushAt: process.env.MODE === 'development' ? 1 : 20,
        // The number of milliseconds to wait
        // before flushing the queue automatically.
        flushInterval: 10000 // 10 seconds is the default libraries' value.
      });

      this._segmentAnalytics.identify({ userId: this._segmentUserID });
    }
  }

  deactivate(): void {
    // Flush on demand to make sure that nothing is left in the queue.
    this._segmentAnalytics?.flush();
  }

  // Checks user settings and extension running mode
  // to determine whether or not we should track telemetry.
  private isTelemetryFeatureEnabled(): boolean {
    // If tests run the extension we do not track telemetry.
    if (this._shouldTrackTelemetry !== true) {
      return false;
    }

    const telemetryEnabledByUser = vscode.workspace
      .getConfiguration('mdb')
      .get('sendTelemetry');

    // If the user disabled it in config do not track telemetry.
    if (telemetryEnabledByUser === false) {
      return false;
    }

    // Otherwise tracking telemetry is allowed.
    return true;
  }

  track(
    eventType: TelemetryEventTypes,
    properties?: TelemetryEventProperties
  ): void {
    if (this.isTelemetryFeatureEnabled()) {
      const segmentProperties: SegmentProperties = {
        event: eventType,
        userId: this._segmentUserID
      };

      if (properties) {
        segmentProperties.properties = properties;
      }

      log.info('TELEMETRY track', segmentProperties);

      this._segmentAnalytics?.track(segmentProperties, (error: any) => {
        if (error) {
          log.error('TELEMETRY track error', error);
        }

        log.info('TELEMETRY track done');
      });
    }
  }

  private async getCloudInfoFromDataService(
    firstServerHostname: string
  ): Promise<CloudInfo> {
    if (!this.isTelemetryFeatureEnabled()) {
      return {};
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const cloudInfo: CloudInfoResult = (await getCloudInfo(firstServerHostname)) as CloudInfoResult;

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

  async trackNewConnection(
    dataService: DataServiceType,
    connectionType: ConnectionTypes
  ): Promise<void> {
    const instance = util.promisify(dataService.instance.bind(dataService));

    try {
      const data = await instance({}) as InstanceInfoResult;
      const dataServiceClient = dataService.client as { model: ConnectionModelType };

      if (data) {
        const firstServerHostname = dataServiceClient.model.hosts[0].host;
        const cloudInfo = await this.getCloudInfoFromDataService(
          firstServerHostname
        );
        const nonGenuineServerName = data.genuineMongoDB.isGenuine
          ? null
          : data.genuineMongoDB.dbType;
        const preparedProperties = {
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

        this.track(TelemetryEventTypes.NEW_CONNECTION, preparedProperties);
      }
    } catch (error) {
      log.error('TELEMETRY track new connection', error);
    }
  }

  trackCommandRun(command: string): void {
    this.track(TelemetryEventTypes.EXTENSION_COMMAND_RUN, { command });
  }

  getPlaygroundResultType(res: ExecuteAllResult): string {
    if (!res || !res.result || !res.result.type) {
      return 'other';
    }

    const shellApiType = res.result.type.toLocaleLowerCase();

    // See: https://github.com/mongodb-js/mongosh/blob/master/packages/shell-api/src/shell-api.js
    if (shellApiType.includes('insert')) {
      return 'insert';
    }
    if (shellApiType.includes('update')) {
      return 'update';
    }
    if (shellApiType.includes('delete')) {
      return 'delete';
    }
    if (shellApiType.includes('aggregation')) {
      return 'aggregation';
    }
    if (shellApiType.includes('cursor')) {
      return 'query';
    }

    return 'other';
  }

  trackPlaygroundCodeExecuted(
    result: ExecuteAllResult,
    partial: boolean,
    error: boolean
  ): void {
    this.track(TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED, {
      type: result ? this.getPlaygroundResultType(result) : null,
      partial,
      error
    });
  }

  trackLinkClicked(screen: string, linkId: string): void {
    this.track(TelemetryEventTypes.EXTENSION_LINK_CLICKED, {
      screen,
      link_id: linkId
    });
  }

  trackPlaygroundLoaded(): void {
    this.track(TelemetryEventTypes.PLAYGROUND_LOADED);
  }

  trackPlaygroundSaved(): void {
    this.track(TelemetryEventTypes.PLAYGROUND_SAVED);
  }

  trackDocumentUpdated(source: string, success: boolean): void {
    this.track(TelemetryEventTypes.DOCUMENT_UPDATED, { source, success });
  }

  trackOpenMongoDBDocumentFromPlayground(source: DocumentSource): void {
    this.track(TelemetryEventTypes.DOCUMENT_EDITED, { source });
  }
}
