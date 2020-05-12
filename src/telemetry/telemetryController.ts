import * as vscode from 'vscode';
import { createLogger } from '../logging';
import SegmentAnalytics = require('analytics-node');
import * as path from 'path';
import { config } from 'dotenv';
import { StorageController } from '../storage';

const log = createLogger('telemetry');
const fs = require('fs');

type PlaygroundTelemetryEventProperties = {
  type: string;
};

type LinkClickedTelemetryEventProperties = {
  screen: string;
  link_id: string;
};

type ExtensionCommandRunTelemetryEventProperties = {
  command: string;
};

type NewConnectionTelemetryEventProperties = {
  is_atlas: boolean;
  is_localhost: boolean;
  is_data_lake: boolean;
  is_enterprise: boolean;
  is_public_cloud: boolean;
  public_cloud_name: string | null;
  is_genuine: boolean;
  non_genuine_server_name: string | null;
  server_version: string;
  server_arch: string;
  server_os: string;
  is_used_connect_screen: boolean;
  is_used_command_palette: boolean;
  is_used_saved_connection: boolean;
};

export type TelemetryEventProperties =
  | PlaygroundTelemetryEventProperties
  | LinkClickedTelemetryEventProperties
  | ExtensionCommandRunTelemetryEventProperties
  | NewConnectionTelemetryEventProperties;

export enum TelemetryEventTypes {
  PLAYGROUND_CODE_EXECUTED = 'Playground Code Executed',
  EXTENSION_LINK_CLICKED = 'Link Clicked',
  EXTENSION_COMMAND_RUN = 'Command Run',
  NEW_CONNECTION = 'New Connection'
}

/**
 * This controller manages telemetry.
 */
export default class TelemetryController {
  private _segmentAnalytics: SegmentAnalytics;
  private _segmentUserID: string | undefined; // The user uuid from the global storage.
  private _segmentKey: string | undefined; // The segment API write key.

  constructor(
    storageController: StorageController,
    context: vscode.ExtensionContext
  ) {
    this._segmentUserID = storageController.getUserID();

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
  }

  get segmentUserID(): string | undefined {
    return this._segmentUserID;
  }

  get segmentKey(): string | undefined {
    return this._segmentKey;
  }

  public activate(): void {
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

  public needTelemetry() {
    return vscode.workspace.getConfiguration('mdb').get('sendTelemetry');
  }

  public track(
    eventType: TelemetryEventTypes,
    properties: TelemetryEventProperties
  ): void {
    if (this.needTelemetry()) {
      log.info('TELEMETRY track', {
        eventType,
        segmentUserID: this._segmentUserID,
        properties
      });

      this._segmentAnalytics?.track(
        {
          userId: this._segmentUserID,
          event: eventType,
          properties
        },
        (error) => {
          if (error) {
            log.error('TELEMETRY track error', error);
          }

          log.info('TELEMETRY track done');
        }
      );
    }
  }
}
