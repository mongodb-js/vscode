import type { ExtensionCommand } from '../commands';
import type { DocumentSourceDetails } from '../documentSource';
import { DocumentSource } from '../documentSource';
import type {
  ExportToPlaygroundError,
  ParticipantErrorType,
} from '../participant/participantErrorTypes';
import type {
  ParticipantCommandType,
  ParticipantRequestType,
  ParticipantResponseType,
} from '../participant/participantTypes';
import type { ShellEvaluateResult } from '../types/playgroundType';
import type { NewConnectionTelemetryEventProperties } from './connectionTelemetry';
import * as vscode from 'vscode';

type PlaygroundFileType = 'other' | 'mongodbjs' | 'mongodb';

type TelemetryFeedbackKind = 'positive' | 'negative' | undefined;

/**
 * The purpose of the internal prompt - e.g. 'intent', 'namespace'
 */
export type InternalPromptPurpose = 'intent' | 'namespace' | undefined;

export type ParticipantTelemetryMetadata = {
  /** The source of the participant prompt - e.g. 'codelens', 'treeview', etc. */
  source: DocumentSource;

  /** Additional details about the source - e.g. if it's 'treeview', the detail can be 'database' or 'collection'. */
  source_details: DocumentSourceDetails;
};

export type ParticipantPromptProperties = {
  command: ParticipantCommandType;
  userInputLength: number;
  totalMessageLength: number;
  hasSampleDocuments: boolean;
  historySize: number;
  internalPurpose: InternalPromptPurpose;
};

function getPlaygroundFileTypeFromUri(
  fileUri?: vscode.Uri,
): PlaygroundFileType {
  let fileType: PlaygroundFileType = 'other';

  if (fileUri?.fsPath.match(/\.(mongodb\.js)$/gi)) {
    fileType = 'mongodbjs';
  } else if (fileUri?.fsPath.match(/\.(mongodb)$/gi)) {
    fileType = 'mongodb';
  }

  return fileType;
}

type PlaygroundType =
  | 'search'
  | 'createCollection'
  | 'createDatabase'
  | 'index'
  | 'agent'
  | 'cloneDocument'
  | 'insertDocument'
  | 'createStreamProcessor'
  | 'fromDatabaseTreeItem'
  | 'fromCollectionTreeItem'
  | 'crud';

abstract class TelemetryEventBase {
  abstract type: string;
  abstract properties: Record<string, any>;
}

/** Reported when a playground file is run */
export class PlaygroundExecutedTelemetryEvent implements TelemetryEventBase {
  type = 'Playground Code Executed';
  properties: {
    /**
     * The type of the executed operation. Common CRUD operations are mapped to
     * 'insert', 'update', 'delete', 'query', 'aggregation'. Other operations return
     * the type of the result returned by the shell API - e.g. 'collection', 'database',
     * 'help', etc. for known shell types and 'string', 'number', 'undefined', etc. for
     * plain JS types. In the unlikely case the shell evaluator was unable to determine
     * a type, 'other' is returned.
     */
    type: string | null;

    /** Whether the entire script was run or just a part of it */
    partial: boolean;

    /** Whether an error occurred during execution */
    error: boolean;
  };

  constructor(result: ShellEvaluateResult, partial: boolean, error: boolean) {
    this.properties = {
      type: result ? this.getPlaygroundResultType(result) : null,
      partial,
      error,
    };
  }

  private getPlaygroundResultType(res: ShellEvaluateResult): string {
    if (!res || !res.result || !res.result.type) {
      return 'other';
    }

    const shellApiType = res.result.type.toLocaleLowerCase();

    // See: https://github.com/mongodb-js/mongosh/blob/main/packages/shell-api/src/shell-api.ts
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

    return shellApiType;
  }
}

/** Reported when a user clicks a hyperlink - e.g. from the Help pane */
export class LinkClickedTelemetryEvent implements TelemetryEventBase {
  type = 'Link Clicked';
  properties: {
    /** The screen where the link was clicked */
    screen: string;

    /** The ID of the clicked link - e.g. `whatsNew`, `extensionDocumentation`, etc. */
    link_id: string;
  };

  constructor(screen: string, linkId: string) {
    this.properties = { screen, link_id: linkId };
  }
}

/**
 * Reported when any command is run by the user. Commands are the building blocks
 * of the extension and can be executed either by clicking a UI element or by opening
 * the command pallette (CMD+Shift+P). This event is likely to duplicate other events
 * as it's fired automatically, regardless of other more-specific events.
 */
export class CommandRunTelemetryEvent implements TelemetryEventBase {
  type = 'Command Run';
  properties: {
    /** The command that was executed - e.g. `mdb.connect`, `mdb.openMongoDBIssueReporter`, etc. */
    command: ExtensionCommand;
  };

  constructor(command: ExtensionCommand) {
    this.properties = { command };
  }
}

/** Reported every time we connect to a cluster/db */
export class NewConnectionTelemetryEvent implements TelemetryEventBase {
  type = 'New Connection';
  properties: NewConnectionTelemetryEventProperties;

  constructor(properties: NewConnectionTelemetryEventProperties) {
    this.properties = properties;
  }
}

/** Reported when a connection is edited */
export class ConnectionEditedTelemetryEvent implements TelemetryEventBase {
  type = 'Connection Edited';
  properties = {};
}

/** Reported when the user opens the connection editor */
export class OpenEditConnectionTelemetryEvent implements TelemetryEventBase {
  type = 'Open Edit Connection';
  properties = {};
}

/** Reported when a playground file is saved */
export class PlaygroundSavedTelemetryEvent implements TelemetryEventBase {
  type = 'Playground Saved';
  properties: {
    /** The type of the file, e.g. 'mongodbjs' for .mongodb.js or 'mongodb' for .mongodb */
    file_type: PlaygroundFileType;
  };

  constructor(fileUri?: vscode.Uri) {
    this.properties = { file_type: getPlaygroundFileTypeFromUri(fileUri) };
  }
}

/** Reported when a playground file is opened */
export class PlaygroundLoadedTelemetryEvent implements TelemetryEventBase {
  type = 'Playground Loaded';
  properties: {
    /** The type of the file, e.g. 'mongodbjs' for .mongodb.js or 'mongodb' for .mongodb */
    file_type: PlaygroundFileType;
  };

  constructor(fileUri?: vscode.Uri) {
    this.properties = { file_type: getPlaygroundFileTypeFromUri(fileUri) };
  }
}

/** Reported when a document is saved (e.g. when the user edits a document from a collection) */
export class DocumentUpdatedTelemetryEvent implements TelemetryEventBase {
  type = 'Document Updated';
  properties: {
    /** The source of the document update, e.g. 'editor', 'tree_view', etc. */
    source: DocumentSource;

    /** Whether the operation was successful */
    success: boolean;
  };

  constructor(source: DocumentSource, success: boolean) {
    this.properties = { source, success };
  }
}

/** Reported when a document is opened in the editor, e.g. from a query results view */
export class DocumentEditedTelemetryEvent implements TelemetryEventBase {
  type = 'Document Edited';
  properties: {
    /** The source of the document - e.g. codelens, treeview, etc. */
    source: DocumentSource;
  };

  constructor(source: DocumentSource) {
    this.properties = { source };
  }
}

/** Reported when a playground file is exported to a language */
export class PlaygroundExportedToLanguageTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Playground Exported To Language';
  properties: {
    /** The target language of the export */
    language: string;

    /** The length of the exported code */
    exported_code_length: number;

    /** Whether the user opted to include driver syntax (e.g. import statements) */
    with_driver_syntax: boolean;
  };

  constructor(
    language: string,
    exportedCodeLength: number | undefined,
    withDriverSyntax: boolean,
  ) {
    this.properties = {
      language,
      exported_code_length: exportedCodeLength || 0,
      with_driver_syntax: withDriverSyntax,
    };
  }
}

/** Reported when a new playground is created */
export class PlaygroundCreatedTelemetryEvent implements TelemetryEventBase {
  type = 'Playground Created';
  properties: {
    /**
     * The playground type - e.g. 'search', 'createCollection', 'createDatabase', etc. This is typically
     * indicative of the element the user clicked to create the playground.
     */
    playground_type: PlaygroundType;
  };

  constructor(playgroundType: PlaygroundType) {
    this.properties = { playground_type: playgroundType };
  }
}
/** Reported when exporting to playground fails */
export class ExportToPlaygroundFailedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Export To Playground Failed';
  properties: {
    /** The length of the playground code */
    input_length: number | undefined;

    /** The name of the error that occurred */
    error_name?: ExportToPlaygroundError;
  };

  constructor(
    inputLength: number | undefined,
    errorName: ExportToPlaygroundError,
  ) {
    this.properties = { input_length: inputLength, error_name: errorName };
  }
}

/**
 * Reported when saved connections are loaded from disk. This is currently disabled
 * due to the large volume of events.
 */
export class SavedConnectionsLoadedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Saved Connections Loaded';
  properties: {
    /** Total number of connections saved on disk */
    saved_connections: number;

    /** Total number of connections from preset settings */
    preset_connections: number;

    /**
     * Total number of connections that extension was able to load, it might
     * differ from saved_connections since there might be failures in loading
     * secrets for a connection in which case we don't list the connections in the
     * list of loaded connections.
     *  */
    loaded_connections: number;

    /** Total number of connections that have secrets stored in keytar */
    connections_with_secrets_in_keytar: number;

    /** Total number of connections that have secrets stored in secret storage */
    connections_with_secrets_in_SecretStorage: number;
  };

  constructor({
    savedConnections,
    presetConnections,
    loadedConnections,
    connectionsWithSecretsInKeytar,
    connectionsWithSecretsInSecretStorage,
  }: {
    savedConnections: number;
    presetConnections: number;
    loadedConnections: number;
    connectionsWithSecretsInKeytar: number;
    connectionsWithSecretsInSecretStorage: number;
  }) {
    this.properties = {
      saved_connections: savedConnections,
      preset_connections: presetConnections,
      loaded_connections: loadedConnections,
      connections_with_secrets_in_keytar: connectionsWithSecretsInKeytar,
      connections_with_secrets_in_SecretStorage:
        connectionsWithSecretsInSecretStorage,
    };
  }
}

/** Reported when the user provides feedback to the chatbot on a response */
export class ParticipantFeedbackTelemetryEvent implements TelemetryEventBase {
  type = 'Participant Feedback';
  properties: {
    /** The type of feedback provided - e.g. 'positive', 'negative' */
    feedback: TelemetryFeedbackKind;

    /** The response type that the feedback was provided for - e.g. 'query', 'schema', 'docs' */
    response_type: ParticipantResponseType;

    /** If the feedback was negative, the reason for the negative feedback. It's picked from
     * a set of predefined options and not a free-form text field.
     *  */
    reason?: String;
  };

  constructor(
    feedback: vscode.ChatResultFeedbackKind,
    responseType: ParticipantResponseType,
    reason?: String,
  ) {
    this.properties = {
      feedback: this.chatResultFeedbackKindToTelemetryValue(feedback),
      response_type: responseType,
      reason,
    };
  }

  private chatResultFeedbackKindToTelemetryValue(
    kind: vscode.ChatResultFeedbackKind,
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
}

/** Reported when the participant welcome message is shown */
export class ParticipantWelcomeShownTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Welcome Shown';
  properties = {};
}

/** Reported when a participant response fails */
export class ParticipantResponseFailedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Response Failed';
  properties: {
    /** The type of the command that failed - e.g. 'query', 'schema', 'docs' */
    command: ParticipantResponseType;

    /** The error code that caused the failure */
    error_code?: string;

    /** The name of the error that caused the failure */
    error_name: ParticipantErrorType;

    /** Additional details about the error if any. */
    error_details?: string;
  };

  constructor(
    command: ParticipantResponseType,
    errorName: ParticipantErrorType,
    errorCode?: string,
    errorDetails?: string,
  ) {
    this.properties = {
      command,
      error_code: errorCode,
      error_name: errorName,
      error_details: errorDetails,
    };
  }
}

/** Reported when a participant prompt is submitted */
export class ParticipantPromptSubmittedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Prompt Submitted';
  properties: {
    /** The type of the command that was submitted - e.g. 'query', 'schema', 'docs' */
    command: ParticipantCommandType;

    /** The length of the user input */
    user_input_length: number;

    /** The total length of the message - i.e. user input + participant prompt */
    total_message_length: number;

    /** Whether the prompt has sample documents */
    has_sample_documents: boolean;

    /** The size of the history */
    history_size: number;

    /** For internal prompts - e.g. trying to extract the 'intent', 'namespace' or the
     * namespace from the chat history.
     */
    internal_purpose: InternalPromptPurpose;
  };

  constructor({
    command,
    userInputLength,
    totalMessageLength,
    hasSampleDocuments,
    historySize,
    internalPurpose,
  }: ParticipantPromptProperties) {
    this.properties = {
      command: command,
      user_input_length: userInputLength,
      total_message_length: totalMessageLength,
      has_sample_documents: hasSampleDocuments,
      history_size: historySize,
      internal_purpose: internalPurpose,
    };
  }
}

/**
 * Reported when a participant prompt is submitted from an action other than typing directly.
 * This is typically one of the activation points - e.g. clicking on the tree view, a codelens, etc.
 */
export class ParticipantPromptSubmittedFromActionTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Prompt Submitted From Action';
  properties: ParticipantTelemetryMetadata & {
    /** The length of the input */
    input_length: number;

    /** The command we're requesting - e.g. 'query', 'schema', 'docs' */
    command: ParticipantRequestType;
  };

  constructor(
    sourceMetadata: ParticipantTelemetryMetadata,
    requestType: ParticipantRequestType,
    inputLength: number,
  ) {
    this.properties = {
      ...sourceMetadata,
      input_length: inputLength,
      command: requestType,
    };
  }
}

/** Reported when a new chat is initiated from an activation point in the extension (e.g. the database tree view) */
export class ParticipantChatOpenedFromActionTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Chat Opened From Action';
  properties: ParticipantTelemetryMetadata & {
    /** The command - if any - we're opening a chat for - e.g. 'query', 'schema', 'docs' */
    command?: ParticipantCommandType;
  };

  constructor(
    sourceMetadata: ParticipantTelemetryMetadata,
    command?: ParticipantCommandType,
  ) {
    this.properties = { ...sourceMetadata, command };
  }
}

/** Reported when we open an input box to ask the user for a message that we'll send to copilot */
export class ParticipantInputBoxSubmittedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Inbox Box Submitted';
  properties: ParticipantTelemetryMetadata & {
    /** The supplied input length */
    input_length: number;

    /** Whether the input was dismissed */
    dismissed: boolean;

    /** The command we're requesting - e.g. 'query', 'schema', 'docs' */
    command?: ParticipantCommandType;
  };

  constructor(
    sourceMetadata: ParticipantTelemetryMetadata,
    message: string | undefined,
    command?: ParticipantCommandType,
  ) {
    this.properties = {
      ...sourceMetadata,
      input_length: message?.length || 0,
      dismissed: message === undefined,
      command,
    };
  }
}

/** Reported when a participant response is generated */
export class ParticipantResponseGeneratedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Participant Response Generated';
  properties: {
    /** The type of the command that was requested - e.g. 'query', 'schema', 'docs' */
    command: ParticipantResponseType;

    /** Whether the response has a call to action (e.g. 'Open in playground' button) */
    has_cta: boolean;

    /** Whether the response has runnable content (e.g. a code block) */
    has_runnable_content: boolean;

    /** Whether the response contains namespace information */
    found_namespace: boolean;

    /** The length of the output */
    output_length: number;
  };

  constructor({
    command,
    hasCta,
    hasRunnableContent,
    foundNamespace,
    outputLength,
  }: {
    command: ParticipantResponseType;
    hasCta: boolean;
    hasRunnableContent: boolean;
    foundNamespace: boolean;
    outputLength: number;
  }) {
    this.properties = {
      command,
      has_cta: hasCta,
      has_runnable_content: hasRunnableContent,
      found_namespace: foundNamespace,
      output_length: outputLength,
    };
  }
}

/** Reported when a preset connection is edited */
export class PresetConnectionEditedTelemetryEvent
  implements TelemetryEventBase
{
  type = 'Preset Connection Edited';
  properties: {
    /** The source of the interaction - currently, only treeview */
    source: Extract<DocumentSource, 'treeview'>;

    /** Additional details about the source - e.g. if it's a specific connection element,
     * it'll be 'tree_item', otherwise it'll be 'header'.
     */
    source_details: 'tree_item' | 'header';
  };

  constructor(sourceDetails: 'tree_item' | 'header') {
    this.properties = {
      source: DocumentSource.TREEVIEW,
      source_details: sourceDetails,
    };
  }
}

/** Reported when the extension side panel is opened. VSCode doesn't expose
 * a subscribable event for this, so we're inferring it by subscribing to
 * treeView.onDidChangeVisibility for all the extension treeviews and throttling
 * the events.
 */
export class SidePanelOpenedTelemetryEvent implements TelemetryEventBase {
  type = 'Side Panel Opened';
  properties: {};

  constructor() {
    this.properties = {};
  }
}

/**
 * Reported when a tree item from the collection explorer is expanded.
 */
export class TreeItemExpandedTelemetryEvent implements TelemetryEventBase {
  type = 'Section Expanded';
  properties: {
    /**
     * The name of the section - e.g. database, collection, etc. This is obtained from the
     * `contextValue` field of the tree item.
     * */
    section_name?: string;
  };

  constructor(item: vscode.TreeItem) {
    // We suffix all tree item context values with 'TreeItem', which is redundant when sending to analytics.
    this.properties = {
      section_name: item.contextValue?.replace('TreeItem', ''),
    };
  }
}

/**
 * Reported when the extension handles a deep link (e.g. vscode://mongodb.mongodb-vscode/command)
 */
export class DeepLinkTelemetryEvent implements TelemetryEventBase {
  type = 'Deep Link Handled';
  properties: {
    /**
     * The command that the deeplink requested - e.g. `mdb.connectWithURI`. This event is reported even
     * if the command is not valid and an error eventually shown to the user.
     */
    command: string;

    /**
     * The source of the deep link - e.g. the Atlas CLI or the docs website.
     */
    source?: string;
  };

  constructor(command: string, source?: string) {
    this.properties = {
      command,
      source,
    };
  }
}

export type TelemetryEvent =
  | PlaygroundExecutedTelemetryEvent
  | LinkClickedTelemetryEvent
  | CommandRunTelemetryEvent
  | NewConnectionTelemetryEvent
  | ConnectionEditedTelemetryEvent
  | OpenEditConnectionTelemetryEvent
  | PlaygroundSavedTelemetryEvent
  | PlaygroundLoadedTelemetryEvent
  | DocumentUpdatedTelemetryEvent
  | DocumentEditedTelemetryEvent
  | PlaygroundExportedToLanguageTelemetryEvent
  | PlaygroundCreatedTelemetryEvent
  | ExportToPlaygroundFailedTelemetryEvent
  | SavedConnectionsLoadedTelemetryEvent
  | ParticipantFeedbackTelemetryEvent
  | ParticipantWelcomeShownTelemetryEvent
  | ParticipantPromptSubmittedTelemetryEvent
  | ParticipantPromptSubmittedFromActionTelemetryEvent
  | ParticipantChatOpenedFromActionTelemetryEvent
  | ParticipantInputBoxSubmittedTelemetryEvent
  | ParticipantResponseGeneratedTelemetryEvent
  | PresetConnectionEditedTelemetryEvent
  | SidePanelOpenedTelemetryEvent
  | TreeItemExpandedTelemetryEvent
  | DeepLinkTelemetryEvent;
