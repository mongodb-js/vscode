import path from 'path';
import * as vscode from 'vscode';
import { config } from 'dotenv';
import type { DataService } from 'mongodb-data-service';
import fs from 'fs/promises';
import { Analytics as SegmentAnalytics } from '@segment/analytics-node';
import { throttle } from 'lodash';

import type { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import { getConnectionTelemetryProperties } from './connectionTelemetry';
import type { StorageController } from '../storage';
import { ParticipantErrorTypes } from '../participant/participantErrorTypes';
import type { ParticipantResponseType } from '../participant/participantTypes';
import type { TelemetryEvent } from './telemetryEvents';
import {
  NewConnectionTelemetryEvent,
  SidePanelOpenedTelemetryEvent,
  ParticipantResponseFailedTelemetryEvent,
} from './telemetryEvents';
import { getDeviceId } from '@mongodb-js/device-id';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeMachineId = require('node-machine-id');

const log = createLogger('telemetry');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

export type SegmentProperties = {
  event: string;
  anonymousId: string;
  deviceId?: string;
  properties: Record<string, any>;
};

/**
 * This controller manages telemetry.
 */
export class TelemetryService {
  private _segmentAnalytics?: SegmentAnalytics;
  public _segmentKey?: string; // The segment API write key.
  private eventBuffer: TelemetryEvent[] = [];
  private isBufferingEvents = true;
  public readonly anonymousId: string;
  private readonly _context: vscode.ExtensionContext;
  private readonly _shouldTrackTelemetry: boolean; // When tests run the extension, we don't want to track telemetry.

  private readonly _deviceIdAbortController = new AbortController();

  public deviceId: string | undefined;

  constructor(
    storageController: StorageController,
    context: vscode.ExtensionContext,
    shouldTrackTelemetry?: boolean,
  ) {
    const { anonymousId } = storageController.getUserIdentity();
    this._context = context;
    this._shouldTrackTelemetry = shouldTrackTelemetry || false;
    this.anonymousId = anonymousId;
  }

  public getCommonProperties(): Record<string, string | undefined> {
    return { extension_version: `${version}`, device_id: this.deviceId };
  }

  private async readSegmentKey(): Promise<string | undefined> {
    config({ path: path.join(this._context.extensionPath, '.env') });

    try {
      const segmentKeyFileLocation = path.join(
        this._context.extensionPath,
        './constants.json',
      );
      // eslint-disable-next-line no-sync
      const constantsFile = await fs.readFile(segmentKeyFileLocation, {
        encoding: 'utf8',
      });
      const { segmentKey } = JSON.parse(constantsFile) as {
        segmentKey?: string;
      };
      return segmentKey;
    } catch (error) {
      log.error('Failed to read segmentKey from the constants file', error);
      return undefined;
    }
  }

  async activateSegmentAnalytics(): Promise<void> {
    this._segmentKey = await this.readSegmentKey();
    if (!this._segmentKey) {
      return;
    }
    this._segmentAnalytics = new SegmentAnalytics({
      writeKey: this._segmentKey,
      // The number of milliseconds to wait
      // before flushing the queue automatically.
      flushInterval: 10000, // 10 seconds is the default libraries' value.
    });

    this.deviceId = await this.getDeviceId();

    const userIdentity = {
      anonymousId: this.anonymousId,
      traits: {
        device_id: this.deviceId,
      },
    };

    this._segmentAnalytics.identify(userIdentity);
    this.isBufferingEvents = false;
    log.info('Segment analytics activated', userIdentity);

    // Process buffered events
    let event: TelemetryEvent | undefined;
    while ((event = this.eventBuffer.shift())) {
      this.track(event);
    }
  }

  deactivate(): void {
    this._deviceIdAbortController.abort();
    // Flush on demand to make sure that nothing is left in the queue.
    void this._segmentAnalytics?.closeAndFlush();
  }

  // Checks user settings and extension running mode
  // to determine whether or not we should track telemetry.
  _isTelemetryFeatureEnabled(): boolean {
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

  _segmentAnalyticsTrack(segmentProperties: SegmentProperties): void {
    if (!this._isTelemetryFeatureEnabled()) {
      return;
    }

    this._segmentAnalytics?.track(segmentProperties, (error?: unknown) => {
      if (error) {
        log.error('Failed to track telemetry', error);
      } else {
        log.info('Telemetry sent', segmentProperties);
      }
    });
  }

  track(event: TelemetryEvent): void {
    try {
      if (this.isBufferingEvents) {
        this.eventBuffer.push(event);
        return;
      }

      this._segmentAnalyticsTrack({
        anonymousId: this.anonymousId,
        event: event.type,
        properties: {
          ...this.getCommonProperties(),
          ...event.properties,
        },
      });
    } catch (e) {
      log.error('Exception caught while tracking telemetry', e);
    }
  }

  async trackNewConnection(
    dataService: DataService,
    connectionType: ConnectionTypes,
  ): Promise<void> {
    const connectionTelemetryProperties =
      await getConnectionTelemetryProperties(dataService, connectionType);

    this.track(new NewConnectionTelemetryEvent(connectionTelemetryProperties));
  }

  trackParticipantError(err: any, command: ParticipantResponseType): void {
    let errorCode: string | undefined;
    let errorName: ParticipantErrorTypes;
    // Making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    if (err instanceof vscode.LanguageModelError) {
      errorCode = err.code;
    }

    if (err instanceof Error) {
      // Unwrap the error if a cause is provided
      err = err.cause || err;
    }

    const message: string = err.message || err.toString();

    if (message.includes('off_topic')) {
      errorName = ParticipantErrorTypes.CHAT_MODEL_OFF_TOPIC;
    } else if (message.includes('Filtered by Responsible AI Service')) {
      errorName = ParticipantErrorTypes.FILTERED;
    } else if (message.includes('Prompt failed validation')) {
      errorName = ParticipantErrorTypes.INVALID_PROMPT;
    } else {
      errorName = ParticipantErrorTypes.OTHER;
    }

    this.track(
      new ParticipantResponseFailedTelemetryEvent(
        command,
        errorName,
        errorCode,
      ),
    );
  }

  trackTreeViewActivated: () => void = throttle(
    () => {
      this.track(new SidePanelOpenedTelemetryEvent());
    },
    5000,
    { leading: true, trailing: false },
  );

  private getDeviceId(): Promise<string> {
    return getDeviceId({
      getMachineId: (): Promise<string> => nodeMachineId.machineId(true),
      abortSignal: this._deviceIdAbortController.signal,
    });
  }
}
