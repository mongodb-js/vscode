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
import { ParticipantErrorTypes } from '../participant/participantErrorTypes';
import type { ExtensionCommand } from '../commands';
import type {
  ParticipantCommandType,
  ParticipantRequestType,
  ParticipantResponseType,
} from '../participant/participantTypes';

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
  command: ExtensionCommand;
};

type DocumentUpdatedTelemetryEventProperties = {
  source: DocumentSource;
  success: boolean;
};

type DocumentEditedTelemetryEventProperties = {
  source: DocumentSource;
};

type PlaygroundExportedToLanguageTelemetryEventProperties = {
  language?: string;
  exported_code_length: number;
  with_driver_syntax?: boolean;
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

type TelemetryFeedbackKind = 'positive' | 'negative' | undefined;

type ParticipantFeedbackProperties = {
  feedback: TelemetryFeedbackKind;
  response_type: ParticipantResponseType;
  reason?: String;
};

type ParticipantResponseFailedProperties = {
  command: ParticipantResponseType;
  error_code?: string;
  error_name: ParticipantErrorTypes;
};

export type InternalPromptPurpose = 'intent' | 'namespace' | undefined;

export type ParticipantPromptProperties = {
  command: ParticipantCommandType;
  user_input_length: number;
  total_message_length: number;
  has_sample_documents: boolean;
  history_size: number;
  internal_purpose: InternalPromptPurpose;
};

export type ParticipantResponseProperties = {
  command: ParticipantResponseType;
  has_cta: boolean;
  has_runnable_content: boolean;
  found_namespace: boolean;
  output_length: number;
};

export type ParticipantPromptSubmittedFromActionProperties = {
  source: DocumentSource;
  input_length: number;
  command: ParticipantRequestType;
};

export type ParticipantChatOpenedFromActionProperties = {
  source: DocumentSource;
  command?: ParticipantCommandType;
};

export type ParticipantInputBoxSubmitted = {
  source: DocumentSource;
  input_length: number | undefined;
  dismissed: boolean;
  command?: ParticipantCommandType;
};

export function chatResultFeedbackKindToTelemetryValue(
  kind: vscode.ChatResultFeedbackKind
): TelemetryFeedbackKind {
  switch (kind) {
    case vscode.ChatResultFeedbackKind.Helpful:
      return 'positive';
    case vscode.ChatResultFeedbackKind.Unhelpful:
      return 'negative';
    default:
      return undefined;
  }
}

type TelemetryEventProperties =
  | PlaygroundTelemetryEventProperties
  | LinkClickedTelemetryEventProperties
  | ExtensionCommandRunTelemetryEventProperties
  | NewConnectionTelemetryEventProperties
  | DocumentUpdatedTelemetryEventProperties
  | ConnectionEditedTelemetryEventProperties
  | DocumentEditedTelemetryEventProperties
  | PlaygroundExportedToLanguageTelemetryEventProperties
  | PlaygroundCreatedTelemetryEventProperties
  | PlaygroundSavedTelemetryEventProperties
  | PlaygroundLoadedTelemetryEventProperties
  | KeytarSecretsMigrationFailedProperties
  | SavedConnectionsLoadedProperties
  | ParticipantFeedbackProperties
  | ParticipantResponseFailedProperties
  | ParticipantPromptProperties
  | ParticipantPromptSubmittedFromActionProperties
  | ParticipantChatOpenedFromActionProperties
  | ParticipantResponseProperties;

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
  PLAYGROUND_EXPORTED_TO_LANGUAGE = 'Playground Exported To Language',
  PLAYGROUND_CREATED = 'Playground Created',
  KEYTAR_SECRETS_MIGRATION_FAILED = 'Keytar Secrets Migration Failed',
  SAVED_CONNECTIONS_LOADED = 'Saved Connections Loaded',
  PARTICIPANT_FEEDBACK = 'Participant Feedback',
  PARTICIPANT_WELCOME_SHOWN = 'Participant Welcome Shown',
  PARTICIPANT_RESPONSE_FAILED = 'Participant Response Failed',
  /** Tracks all submitted prompts */
  PARTICIPANT_PROMPT_SUBMITTED = 'Participant Prompt Submitted',
  /** Tracks prompts that were submitted as a result of an action other than
   * the user typing the message, such as clicking on an item in tree view or a codelens */
  PARTICIPANT_PROMPT_SUBMITTED_FROM_ACTION = 'Participant Prompt Submitted From Action',
  /** Tracks when a new chat was opened from an action such as clicking on a tree view. */
  PARTICIPANT_CHAT_OPENED_FROM_ACTION = 'Participant Chat Opened From Action',
  /** Tracks after a participant interacts with the input box we open to let the user write the prompt for participant. */
  PARTICIPANT_INPUT_BOX_SUBMITTED = 'Participant Inbox Box Submitted',
  PARTICIPANT_RESPONSE_GENERATED = 'Participant Response Generated',
  PARTICIPANT_SUBMITTED_FROM_INPUT_BOX = 'Participant Submitted From Input Box',
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

  trackCommandRun(command: ExtensionCommand): void {
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

  getTelemetryUserIdentity(): { anonymousId: string } {
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

  trackPlaygroundExportedToLanguageExported(
    playgroundExportedProps: PlaygroundExportedToLanguageTelemetryEventProperties
  ): void {
    this.track(
      TelemetryEventTypes.PLAYGROUND_EXPORTED_TO_LANGUAGE,
      playgroundExportedProps
    );
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

  trackParticipantFeedback(props: ParticipantFeedbackProperties): void {
    this.track(TelemetryEventTypes.PARTICIPANT_FEEDBACK, props);
  }

  trackParticipantPromptSubmittedFromAction(
    props: ParticipantPromptSubmittedFromActionProperties
  ): void {
    this.track(
      TelemetryEventTypes.PARTICIPANT_PROMPT_SUBMITTED_FROM_ACTION,
      props
    );
  }

  trackParticipantChatOpenedFromAction(
    props: ParticipantChatOpenedFromActionProperties
  ): void {
    this.track(TelemetryEventTypes.PARTICIPANT_CHAT_OPENED_FROM_ACTION, props);
  }

  trackParticipantInputBoxSubmitted(props: ParticipantInputBoxSubmitted): void {
    this.track(TelemetryEventTypes.PARTICIPANT_INPUT_BOX_SUBMITTED, props);
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

    this.track(TelemetryEventTypes.PARTICIPANT_RESPONSE_FAILED, {
      command,
      error_code: errorCode,
      error_name: errorName,
    } satisfies ParticipantResponseFailedProperties);
  }

  trackParticipantPrompt(stats: ParticipantPromptProperties): void {
    this.track(TelemetryEventTypes.PARTICIPANT_PROMPT_SUBMITTED, stats);
  }

  trackParticipantResponse(props: ParticipantResponseProperties): void {
    this.track(TelemetryEventTypes.PARTICIPANT_RESPONSE_GENERATED, props);
  }
}
