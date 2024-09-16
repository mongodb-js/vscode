import path from 'path';
import * as vscode from 'vscode';
import { config } from 'dotenv';
import type { DataService } from 'mongodb-data-service';
import fs from 'fs';
import { Analytics as SegmentAnalytics } from '@segment/analytics-node';

import type { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import type { DocumentSource } from '../documentSource';
import { getConnectionTelemetryProperties } from './connectionTelemetry';
import type { NewConnectionTelemetryEventProperties } from './connectionTelemetry';
import type { ShellEvaluateResult } from '../types/playgroundType';
import type { StorageController } from '../storage';

const log = createLogger('telemetry');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

type PlaygroundTelemetryEventProperties = {
  type: string | null;
  partial: boolean;
  error: boolean;
};

export type SegmentProperties = {
  event: string;
  anonymousId: string;
  properties: Record<string, any>;
};

type LinkClickedTelemetryEventProperties = {
  screen: string;
  link_id: string;
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

type QueryExportedTelemetryEventProperties = {
  language: string;
  num_stages?: number;
  with_import_statements: boolean;
  with_builders: boolean;
  with_driver_syntax: boolean;
};

type PlaygroundCreatedTelemetryEventProperties = {
  playground_type: string;
};

type PlaygroundSavedTelemetryEventProperties = {
  file_type?: string;
};

type PlaygroundLoadedTelemetryEventProperties = {
  file_type?: string;
};

type KeytarSecretsMigrationFailedProperties = {
  saved_connections: number;
  loaded_connections: number;
  connections_with_failed_keytar_migration: number;
};

type ConnectionEditedTelemetryEventProperties = {
  success: boolean;
};

type SurveyActionProperties = {
  survey_id: string;
};

type SavedConnectionsLoadedProperties = {
  // Total number of connections saved on disk
  saved_connections: number;
  // Total number of connections that extension was able to load, it might
  // differ from saved_connections since there might be failures in loading
  // secrets for a connection in which case we don't list the connections in the
  // list of loaded connections.
  loaded_connections: number;
  connections_with_secrets_in_keytar: number;
  connections_with_secrets_in_secret_storage: number;
};

export type TelemetryEventProperties =
  | PlaygroundTelemetryEventProperties
  | LinkClickedTelemetryEventProperties
  | ExtensionCommandRunTelemetryEventProperties
  | NewConnectionTelemetryEventProperties
  | DocumentUpdatedTelemetryEventProperties
  | ConnectionEditedTelemetryEventProperties
  | DocumentEditedTelemetryEventProperties
  | QueryExportedTelemetryEventProperties
  | PlaygroundCreatedTelemetryEventProperties
  | PlaygroundSavedTelemetryEventProperties
  | PlaygroundLoadedTelemetryEventProperties
  | KeytarSecretsMigrationFailedProperties
  | SavedConnectionsLoadedProperties
  | SurveyActionProperties;

export enum TelemetryEventTypes {
  PLAYGROUND_CODE_EXECUTED = 'Playground Code Executed',
  EXTENSION_LINK_CLICKED = 'Link Clicked',
  EXTENSION_COMMAND_RUN = 'Command Run',
  NEW_CONNECTION = 'New Connection',
  CONNECTION_EDITED = 'Connection Edited',
  OPEN_EDIT_CONNECTION = 'Open Edit Connection',
  PLAYGROUND_SAVED = 'Playground Saved',
  PLAYGROUND_LOADED = 'Playground Loaded',
  DOCUMENT_UPDATED = 'Document Updated',
  DOCUMENT_EDITED = 'Document Edited',
  QUERY_EXPORTED = 'Query Exported',
  AGGREGATION_EXPORTED = 'Aggregation Exported',
  PLAYGROUND_CREATED = 'Playground Created',
  KEYTAR_SECRETS_MIGRATION_FAILED = 'Keytar Secrets Migration Failed',
  SAVED_CONNECTIONS_LOADED = 'Saved Connections Loaded',
  SURVEY_CLICKED = 'Survey link clicked',
  SURVEY_DISMISSED = 'Survey prompt dismissed',
}

/**
 * This controller manages telemetry.
 */
export default class TelemetryService {
  _segmentAnalytics?: SegmentAnalytics;
  _segmentAnonymousId: string;
  _segmentKey?: string; // The segment API write key.

  private _context: vscode.ExtensionContext;
  private _shouldTrackTelemetry: boolean; // When tests run the extension, we don't want to track telemetry.

  constructor(
    storageController: StorageController,
    context: vscode.ExtensionContext,
    shouldTrackTelemetry?: boolean
  ) {
    const { anonymousId } = storageController.getUserIdentity();
    this._context = context;
    this._shouldTrackTelemetry = shouldTrackTelemetry || false;
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
      const { segmentKey } = JSON.parse(constantsFile) as {
        segmentKey?: string;
      };
      return segmentKey;
    } catch (error) {
      log.error('Failed to read segmentKey from the constants file', error);
      return;
    }
  }

  activateSegmentAnalytics(): void {
    if (!this._segmentKey) {
      return;
    }
    this._segmentAnalytics = new SegmentAnalytics({
      writeKey: this._segmentKey,
      // The number of milliseconds to wait
      // before flushing the queue automatically.
      flushInterval: 10000, // 10 seconds is the default libraries' value.
    });

    const segmentProperties = this.getTelemetryUserIdentity();
    this._segmentAnalytics.identify(segmentProperties);
    log.info('Segment analytics activated', segmentProperties);
  }

  deactivate(): void {
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

  track(
    eventType: TelemetryEventTypes,
    properties?: TelemetryEventProperties
  ): void {
    try {
      this._segmentAnalyticsTrack({
        ...this.getTelemetryUserIdentity(),
        event: eventType,
        properties: {
          ...properties,
          extension_version: `${version}`,
        },
      });
    } catch (e) {
      log.error('Exception caught while tracking telemetry', e);
    }
  }

  async _getConnectionTelemetryProperties(
    dataService: DataService,
    connectionType: ConnectionTypes
  ): Promise<NewConnectionTelemetryEventProperties> {
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

  getTelemetryUserIdentity(): {
    anonymousId: string;
  } {
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

  trackPlaygroundLoaded(fileType?: string): void {
    this.track(TelemetryEventTypes.PLAYGROUND_LOADED, {
      file_type: fileType,
    });
  }

  trackPlaygroundSaved(fileType?: string): void {
    this.track(TelemetryEventTypes.PLAYGROUND_SAVED, {
      file_type: fileType,
    });
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

  trackPlaygroundCreated(playgroundType: string): void {
    this.track(TelemetryEventTypes.PLAYGROUND_CREATED, {
      playground_type: playgroundType,
    });
  }

  trackSavedConnectionsLoaded(
    savedConnectionsLoadedProps: SavedConnectionsLoadedProperties
  ): void {
    this.track(
      TelemetryEventTypes.SAVED_CONNECTIONS_LOADED,
      savedConnectionsLoadedProps
    );
  }

  trackKeytarSecretsMigrationFailed(
    keytarSecretsMigrationFailedProps: KeytarSecretsMigrationFailedProperties
  ): void {
    this.track(
      TelemetryEventTypes.KEYTAR_SECRETS_MIGRATION_FAILED,
      keytarSecretsMigrationFailedProps
    );
  }
}
