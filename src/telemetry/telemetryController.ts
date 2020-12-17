import * as vscode from 'vscode';
import SegmentAnalytics = require('analytics-node');
import * as path from 'path';
import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

import { createLogger } from '../logging';
import { StorageController } from '../storage';
import { ConnectionTypes } from '../connectionController';
import type { ExecuteAllResult } from '../utils/types';
import {
  getConnectionTelemetryProperties,
  NewConnectionTelemetryEventProperties
} from './telemetryConnectionHelper';

const log = createLogger('telemetry');
const fs = require('fs');

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

type LinkClickedTelemetryEventProperties = {
  screen: string;
  // eslint-disable-next-line camelcase
  link_id: string;
};

type ExtensionCommandRunTelemetryEventProperties = {
  command: string;
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
  NEW_CONNECTION = 'New Connection',
  PLAYGROUND_SAVED = 'Playground Saved',
  PLAYGROUND_LOADED = 'Playground Loaded'
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

  public needTelemetry(): boolean {
    return !!vscode.workspace.getConfiguration('mdb').get('sendTelemetry');
  }

  public track(
    eventType: TelemetryEventTypes,
    properties?: TelemetryEventProperties
  ): void {
    if (this.needTelemetry()) {
      const segmentProperties: SegmentProperties = {
        event: eventType,
        userId: this._segmentUserID
      };

      if (properties) {
        segmentProperties.properties = properties;
      }

      log.info('TELEMETRY track', segmentProperties);

      this._segmentAnalytics?.track(segmentProperties, (error?: Error) => {
        if (error) {
          log.error('TELEMETRY track error', error);
        }

        log.info('TELEMETRY track done');
      });
    }
  }

  async trackNewConnection(
    dataService: MongoClient,
    connectionType: ConnectionTypes
  ): Promise<void> {
    if (!this.needTelemetry()) {
      return;
    }

    try {
      const connectionTelemetryProperties = await getConnectionTelemetryProperties(
        dataService,
        connectionType
      );

      this.track(TelemetryEventTypes.NEW_CONNECTION, connectionTelemetryProperties);
    } catch (error) {
      log.error('TELEMETRY data service error', error);
    }
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
      // eslint-disable-next-line @typescript-eslint/camelcase
      link_id: linkId
    });
  }

  trackPlaygroundLoaded(): void {
    this.track(TelemetryEventTypes.PLAYGROUND_LOADED);
  }

  trackPlaygroundSaved(): void {
    this.track(TelemetryEventTypes.PLAYGROUND_SAVED);
  }
}
