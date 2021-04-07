import * as path from 'path';
import * as vscode from 'vscode';
import { config } from 'dotenv';
import fs from 'fs';
import SegmentAnalytics from 'analytics-node';
import { MongoClient } from 'mongodb';

import { ConnectionModel } from '../types/connectionModelType';
import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import { DocumentSource } from '../documentSource';
import type { ShellExecuteAllResult } from '../types/playgroundType';
import { StorageController } from '../storage';
import {
  NewConnectionTelemetryEventProperties,
  getConnectionTelemetryProperties
} from './connectionTelemetry';

const { version } = require('../../package.json');

const log = createLogger('telemetry');

type PlaygroundTelemetryEventProperties = {
  type: string | null;
  partial: boolean;
  error: boolean;
};

export type SegmentProperties = {
  event: string;
  userId: string;
  properties: any;
};

type LinkClickedTelemetryEventProperties = {
  screen: string;
  link_id: string; // eslint-disable-line camelcase
};

type ExtensionCommandRunTelemetryEventProperties = {
  command: string;
};

type DocumentUpdatedTelemetryEventProperties = {
  source: DocumentSource;
  success: boolean;
};

type DocumentEditedTelemetryEventProperties = {
  source: DocumentSource;
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

  track(
    eventType: TelemetryEventTypes,
    properties?: TelemetryEventProperties
  ): void {
    if (this._isTelemetryFeatureEnabled()) {
      const segmentProperties: SegmentProperties = {
        event: eventType,
        userId: this._segmentUserID,
        properties: {
          ...properties,
          extension_version: `${version}`
        }
      };

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
    model: ConnectionModel,
    connectionType: ConnectionTypes
  ): Promise<void> {
    try {
      if (!this._isTelemetryFeatureEnabled()) {
        return;
      }

      const connectionTelemetryProperties = await getConnectionTelemetryProperties(
        dataService,
        model,
        connectionType
      );

      this.track(TelemetryEventTypes.NEW_CONNECTION, connectionTelemetryProperties);
    } catch (error) {
      log.error('TELEMETRY track new connection', error);
    }
  }

  trackCommandRun(command: string): void {
    this.track(TelemetryEventTypes.EXTENSION_COMMAND_RUN, { command });
  }

  getPlaygroundResultType(res: ShellExecuteAllResult): string {
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
    result: ShellExecuteAllResult,
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

  trackDocumentUpdated(source: DocumentSource, success: boolean): void {
    this.track(TelemetryEventTypes.DOCUMENT_UPDATED, { source, success });
  }

  trackDocumentOpenedInEditor(source: DocumentSource): void {
    this.track(TelemetryEventTypes.DOCUMENT_EDITED, { source });
  }
}
