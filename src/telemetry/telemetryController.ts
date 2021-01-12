import * as vscode from 'vscode';
import { createLogger } from '../logging';
import SegmentAnalytics = require('analytics-node');
import * as path from 'path';
import { config } from 'dotenv';
import { StorageController } from '../storage';
import { ConnectionTypes } from '../connectionController';
import { getCloudInfo } from 'mongodb-cloud-info';
import { DataServiceType } from '../dataServiceType';
import type { ExecuteAllResult } from '../utils/types';

const log = createLogger('telemetry');
const fs = require('fs');

const ATLAS_REGEX = /mongodb.net[:/]/i;
const LOCALHOST_REGEX = /(localhost|127\.0\.0\.1)/i;

type PlaygroundTelemetryEventProperties = {
  type: string | null;
  partial: boolean;
  error: boolean;
};

type SegmentProperties = {
  event: string;
  userId?: string;
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
  server_version: string;
  server_arch: string;
  server_os: string;
  is_used_connect_screen: boolean;
  is_used_command_palette: boolean;
  is_used_saved_connection: boolean;
  /* eslint-enable camelcase */
};

type DocumentUpdatedTelemetryEventProperties = {
  source: string;
  success: boolean;
};

export type TelemetryEventProperties =
  | PlaygroundTelemetryEventProperties
  | LinkClickedTelemetryEventProperties
  | ExtensionCommandRunTelemetryEventProperties
  | NewConnectionTelemetryEventProperties
  | DocumentUpdatedTelemetryEventProperties;

export enum TelemetryEventTypes {
  PLAYGROUND_CODE_EXECUTED = 'Playground Code Executed',
  EXTENSION_LINK_CLICKED = 'Link Clicked',
  EXTENSION_COMMAND_RUN = 'Command Run',
  NEW_CONNECTION = 'New Connection',
  PLAYGROUND_SAVED = 'Playground Saved',
  PLAYGROUND_LOADED = 'Playground Loaded',
  DOCUMENT_UPDATED = 'Document Updated'
}

/**
 * This controller manages telemetry.
 */
export default class TelemetryController {
  private _shouldTrackTelemetry: boolean; // When tests run the extension, we don't want to track telemetry.
  private _segmentAnalytics: SegmentAnalytics;
  private _segmentUserID: string | undefined; // The user uuid from the global storage.
  private _segmentKey: string | undefined; // The segment API write key.

  constructor(
    storageController: StorageController,
    context: vscode.ExtensionContext,
    shouldTrackTelemetry?: boolean
  ) {
    this._segmentUserID = storageController.getUserID();
    this._shouldTrackTelemetry = shouldTrackTelemetry || false;

    config({ path: path.join(context.extensionPath, '.env') });

    try {
      const segmentKeyFileLocation = path.join(
        context.extensionPath,
        './constants.json'
      );
      const constants = fs.readFileSync(segmentKeyFileLocation);

      this._segmentKey = JSON.parse(constants)?.segmentKey;
      log.info('TELEMETRY key received', typeof this._segmentKey);
    } catch (error) {
      log.error('TELEMETRY key error', error);
    }

    vscode.workspace.onDidOpenTextDocument((document) => {
      if (
        document &&
        document.languageId === 'mongodb' &&
        document.uri.scheme === 'file'
      ) {
        // Send metrics to Segment.
        this.trackPlaygroundLoaded();
      }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document && document.languageId === 'mongodb') {
        // Send metrics to Segment.
        this.trackPlaygroundSaved();
      }
    });
  }

  get segmentUserID(): string | undefined {
    return this._segmentUserID;
  }

  get segmentKey(): string | undefined {
    return this._segmentKey;
  }

  public activateSegmentAnalytics(): void {
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

  public deactivate(): void {
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

  public track(
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

  trackNewConnection(
    dataService: DataServiceType,
    connectionType: ConnectionTypes
  ): void {
    dataService.instance({}, async (error: any, data: any) => {
      if (error) {
        log.error('TELEMETRY data service error', error);
      }

      if (data) {
        const firstServerHostname = dataService.client.model.hosts[0].host;
        const cloudInfo = await this.getCloudInfoFromDataService(
          firstServerHostname
        );
        const nonGenuineServerName = data.genuineMongoDB.isGenuine
          ? null
          : data.genuineMongoDB.dbType;
        const preparedProperties = {
          is_atlas: !!data.client.s.url.match(ATLAS_REGEX),
          is_localhost: !!data.client.s.url.match(LOCALHOST_REGEX),
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
    });
  }

  trackCommandRun(command: string): void {
    this.track(TelemetryEventTypes.EXTENSION_COMMAND_RUN, { command });
  }

  public getPlaygroundResultType(res: ExecuteAllResult): string {
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

  trackDocumentUpdated(
    source: string,
    success: boolean
  ): void {
    this.track(TelemetryEventTypes.DOCUMENT_UPDATED, { source, success });
  }
}
