import * as vscode from 'vscode';
import { createLogger } from '../logging';
import SegmentAnalytics = require('analytics-node');
import { resolve } from 'path';
import { config } from 'dotenv';
import { StorageController } from '../storage';

config({ path: resolve(__dirname, '../../.env') });

const log = createLogger('analytics');

export enum TelemetryEventTypes {
  PLAYGROUND_CODE_EXECUTED = 'playground code executed',
}

/**
 * This controller manages telemetry.
 */
export default class TelemetryController {
  private _segmentAnalytics: SegmentAnalytics;
  private _segmentUserID: string | undefined; // The user uuid from the global storage.
  private _segmentKey: string | undefined; // The segment API write key.

  constructor(storageController: StorageController) {
    this._segmentUserID = storageController.getUserID();

    try {
      const segmentKeyFileLocation = '../../constants';
      this._segmentKey = require(segmentKeyFileLocation)?.segmentKey;
    } catch (error) {
      this._segmentKey = process.env.SEGMENT_KEY;
      log.error('TELEMETRY file reading', error);
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
        flushInterval: 10000, // 10 seconds is the default libraries' value.
      });
      this._segmentAnalytics.identify({ userId: this._segmentUserID });
    }
  }

  public deactivate(): void {
    // Flush on demand to make sure that nothing is left in the queue.
    this._segmentAnalytics?.flush();
  }

  public track(eventType: TelemetryEventTypes, properties: object): void {
    const shouldSendTelemetry = vscode.workspace
      .getConfiguration('mdb')
      .get('sendTelemetry');

    if (shouldSendTelemetry) {
      this._segmentAnalytics?.track(
        {
          userId: this._segmentUserID,
          event: eventType,
          properties,
        },
        (error) => {
          if (error) {
            log.error(error);
          }

          const analytics = [
            `The "${eventType}" metric was sent.`,
            `The user: "${this._segmentUserID}."`,
            'The props:',
          ];

          log.info(analytics.join(' '), properties);
        }
      );
    }
  }
}
