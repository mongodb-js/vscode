import * as path from 'path';
import * as vscode from 'vscode';
import { config } from 'dotenv';
import { DataService } from 'mongodb-data-service';
import fs from 'fs';
import SegmentAnalytics from 'analytics-node';

import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import { DocumentSource } from '../documentSource';
import { getConnectionTelemetryProperties } from './connectionTelemetry';
import type { NewConnectionTelemetryEventProperties } from './connectionTelemetry';
import type { ShellEvaluateResult } from '../types/playgroundType';
import { StorageController } from '../storage';

const log = createLogger('telemetry');
const { version } = require('../../package.json');

type PlaygroundTelemetryEventProperties = {
  type: string | null;
  partial: boolean;
  error: boolean;
};

export type SegmentProperties = {
  event: string;
  userId?: string;
  anonymousId?: string;
  properties: unknown;
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

/* eslint-disable camelcase */
type QueryExportedTelemetryEventProperties = {
  language: string;
  num_stages?: number;
  with_import_statements: boolean;
  with_builders: boolean;
  with_driver_syntax: boolean;
};
/* eslint-enable camelcase */

export type TelemetryEventProperties =
  | PlaygroundTelemetryEventProperties
  | LinkClickedTelemetryEventProperties
  | ExtensionCommandRunTelemetryEventProperties
  | NewConnectionTelemetryEventProperties
  | DocumentUpdatedTelemetryEventProperties
  | DocumentEditedTelemetryEventProperties
  | QueryExportedTelemetryEventProperties;

export enum TelemetryEventTypes {
  PLAYGROUND_CODE_EXECUTED = 'Playground Code Executed',
  EXTENSION_LINK_CLICKED = 'Link Clicked',
  EXTENSION_COMMAND_RUN = 'Command Run',
  NEW_CONNECTION = 'New Connection',
  PLAYGROUND_SAVED = 'Playground Saved',
  PLAYGROUND_LOADED = 'Playground Loaded',
  DOCUMENT_UPDATED = 'Document Updated',
  DOCUMENT_EDITED = 'Document Edited',
  QUERY_EXPORTED = 'Query Exported',
  AGGREGATION_EXPORTED = 'Aggregation Exported',
}

/**
 * This controller manages telemetry.
 */
export default class TelemetryService {
  _segmentAnalytics?: SegmentAnalytics;
  _segmentUserId?: string;
  _segmentAnonymousId?: string;
  _segmentKey?: string; // The segment API write key.

  private _context: vscode.ExtensionContext;
  private _shouldTrackTelemetry: boolean; // When tests run the extension, we don't want to track telemetry.

  constructor(
    storageController: StorageController,
    context: vscode.ExtensionContext,
    shouldTrackTelemetry?: boolean
  ) {
    const { userId, anonymousId } = storageController.getUserIdentity();
    this._context = context;
    this._shouldTrackTelemetry = shouldTrackTelemetry || false;
    this._segmentUserId = userId;
    this._segmentAnonymousId = anonymousId;
    this._segmentKey = this._readSegmentKey();
  }

  private _readSegmentKey(): string | undefined {
    config({ path: path.join(this._context.extensionPath, '.env') });

    try {
      const segmentKeyFileLocation = path.join(
        this._context.extensionPath,
        './constants.json'
      );
      // eslint-disable-next-line no-sync
      const constantsFile = fs.readFileSync(segmentKeyFileLocation, 'utf8');
      const constants = JSON.parse(constantsFile) as { segmentKey: string };

      log.info('SegmentKey received', { type: typeof constants.segmentKey });

      return constants.segmentKey;
    } catch (error) {
      log.error('Reading SegmentKey failed', error);
      return;
    }
  }

  activateSegmentAnalytics(): void {
    if (this._segmentKey) {
      log.info('Activating segment analytics...');
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

      const segmentProperties = this.getTelemetryUserIdentity();
      this._segmentAnalytics.identify(segmentProperties);
      log.info(
        'Segment analytics activated with properties',
        segmentProperties
      );
    }
  }

  deactivate(): void {
    // Flush on demand to make sure that nothing is left in the queue.
    void this._segmentAnalytics?.flush();
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

  _segmentAnalyticsTrack(segmentProperties: SegmentProperties) {
    if (!this._isTelemetryFeatureEnabled()) {
      return;
    }

    this._segmentAnalytics?.track(segmentProperties, (error?: Error) => {
      if (error) {
        log.error('Failed to track telemetry', error);
      } else {
        log.info('Telemetry sent', error);
      }
    });
  }

  track(
    eventType: TelemetryEventTypes,
    properties?: TelemetryEventProperties
  ): void {
    this._segmentAnalyticsTrack({
      ...this.getTelemetryUserIdentity(),
      event: eventType,
      properties: {
        ...properties,
        extension_version: `${version}`,
      },
    });
  }

  async _getConnectionTelemetryProperties(
    dataService: DataService,
    connectionType: ConnectionTypes
  ) {
    return await getConnectionTelemetryProperties(dataService, connectionType);
  }

  async trackNewConnection(
    dataService: DataService,
    connectionType: ConnectionTypes
  ): Promise<void> {
    const connectionTelemetryProperties =
      await this._getConnectionTelemetryProperties(dataService, connectionType);

    this.track(
      TelemetryEventTypes.NEW_CONNECTION,
      connectionTelemetryProperties
    );
  }

  trackCommandRun(command: string): void {
    this.track(TelemetryEventTypes.EXTENSION_COMMAND_RUN, { command });
  }

  getPlaygroundResultType(res: ShellEvaluateResult): string {
    if (!res || !res.result || !res.result.type) {
      return 'other';
    }

    const shellApiType = res.result.type.toLocaleLowerCase();

    // See: https://github.com/mongodb-js/mongosh/blob/main/packages/shell-api/src/shell-api.js
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

  getTelemetryUserIdentity() {
    if (this._segmentUserId) {
      return {
        userId: this._segmentUserId,
      };
    }

    return {
      anonymousId: this._segmentAnonymousId,
    };
  }

  trackPlaygroundCodeExecuted(
    result: ShellEvaluateResult,
    partial: boolean,
    error: boolean
  ): void {
    this.track(TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED, {
      type: result ? this.getPlaygroundResultType(result) : null,
      partial,
      error,
    });
  }

  trackLinkClicked(screen: string, linkId: string): void {
    this.track(TelemetryEventTypes.EXTENSION_LINK_CLICKED, {
      screen,
      link_id: linkId,
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

  trackQueryExported(
    queryExportedProps: QueryExportedTelemetryEventProperties
  ): void {
    this.track(TelemetryEventTypes.QUERY_EXPORTED, queryExportedProps);
  }

  trackAggregationExported(
    aggExportedProps: QueryExportedTelemetryEventProperties
  ): void {
    this.track(TelemetryEventTypes.AGGREGATION_EXPORTED, aggExportedProps);
  }
}
