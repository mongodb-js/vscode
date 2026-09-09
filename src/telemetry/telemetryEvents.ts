import type { ExtensionCommand } from '../commands';
import { DocumentSource } from '../documentSource';
import type { DocumentViewAndEditFormat } from '../editors/types';
import type { ShellEvaluateResult } from '../types/playgroundType';
import type { NewConnectionTelemetryEventProperties } from './connectionTelemetry';
import type * as vscode from 'vscode';

type PlaygroundFileType = 'other' | 'mongodbjs' | 'mongodb';

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

    /** Whether the user saved the document in shell format or ejson */
    view_format: DocumentViewAndEditFormat;
  };

  constructor(
    source: DocumentSource,
    success: boolean,
    view_format: DocumentViewAndEditFormat,
  ) {
    this.properties = { source, success, view_format };
  }
}

/** Reported when a document is opened in the editor, e.g. from a query results view */
export class DocumentEditedTelemetryEvent implements TelemetryEventBase {
  type = 'Document Edited';
  properties: {
    /** The source of the document - e.g. codelens, treeview, etc. */
    source: DocumentSource;

    /** Whether the user opened the document in shell format or ejson */
    view_format: DocumentViewAndEditFormat;
  };

  constructor(source: DocumentSource, view_format: DocumentViewAndEditFormat) {
    this.properties = { source, view_format };
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
/**
 * Reported when saved connections are loaded from disk. This is currently disabled
 * due to the large volume of events.
 */
export class SavedConnectionsLoadedTelemetryEvent implements TelemetryEventBase {
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

/** Reported when a preset connection is edited */
export class PresetConnectionEditedTelemetryEvent implements TelemetryEventBase {
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
      source: DocumentSource.treeview,
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
  properties: Record<string, never>;

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

/** Whether the user is browsing a collection directly or viewing playground query results */
type DataBrowserSource = 'collection' | 'query-results';

/** Reported when the data browser is opened (either as a webview or as an editor) */
export class DataBrowserOpenedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Opened';
  properties: {
    /** The type of the collection being browsed - e.g. 'collection', 'view', 'timeseries', 'unknown' */
    collection_type: string;

    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;

    /** Whether the user has the `mdb.useWebViewDataBrowser` setting enabled. */
    use_webview_data_browser: boolean;

    /** Whether the user is viewing the documents in shell format or ejson */
    view_format: DocumentViewAndEditFormat;
  };

  constructor(
    collectionType: string,
    source: DataBrowserSource,
    useWebViewDataBrowser: boolean,
    view_format: DocumentViewAndEditFormat,
  ) {
    this.properties = {
      collection_type: collectionType,
      source,
      view_format,
      use_webview_data_browser: useWebViewDataBrowser,
    };
  }
}

/** Reported when the data browser webview is closed */
export class DataBrowserClosedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Closed';
  properties: {
    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;
  };

  constructor(source: DataBrowserSource) {
    this.properties = { source };
  }
}

/** Reported when documents are fetched/loaded in the data browser */
export class DataBrowserDocumentsFetchedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Documents Fetched';
  properties: {
    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;
  };

  constructor(source: DataBrowserSource) {
    this.properties = { source };
  }
}

/** Reported when a document is opened for editing from the data browser */
export class DataBrowserDocumentEditedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Document Edited';
  properties: {
    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;

    /** Whether the user opened the document in shell format or ejson */
    view_format: DocumentViewAndEditFormat;
  };

  constructor(
    source: DataBrowserSource,
    view_format: DocumentViewAndEditFormat,
  ) {
    this.properties = { source, view_format };
  }
}

/** Reported when a document is cloned from the data browser */
export class DataBrowserDocumentClonedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Document Cloned';
  properties: {
    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;
  };

  constructor(source: DataBrowserSource) {
    this.properties = { source };
  }
}

/** Reported when a new document is inserted from the data browser or tree view */
export class DataBrowserDocumentInsertedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Document Inserted';
  properties: {
    /** Whether the action was triggered from the tree view or the data browser */
    view: 'tree' | 'data-browser';

    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;
  };

  constructor(view: 'tree' | 'data-browser', source: DataBrowserSource) {
    this.properties = { view, source };
  }
}

/** Reported when one or more documents are deleted from the data browser or tree view */
export class DataBrowserDocumentDeletedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Document Deleted';
  properties: {
    /** Whether all documents in the collection were deleted */
    delete_all: boolean;

    /** Whether the action was triggered from the tree view or the data browser */
    view: 'tree' | 'data-browser';

    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;
  };

  constructor(
    deleteAll: boolean,
    view: 'tree' | 'data-browser',
    source: DataBrowserSource,
  ) {
    this.properties = { delete_all: deleteAll, view, source };
  }
}

/** Reported when the collection is refreshed in the data browser or tree view */
export class DataBrowserCollectionRefreshedTelemetryEvent implements TelemetryEventBase {
  type = 'Data Browser Collection Refreshed';
  properties: {
    /** Whether the action was triggered from the tree view or the data browser */
    view: 'tree' | 'data-browser';

    /** Whether the user is browsing a collection or viewing playground query results */
    source: DataBrowserSource;
  };

  constructor(view: 'tree' | 'data-browser', source: DataBrowserSource) {
    this.properties = { view, source };
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
  | PlaygroundCreatedTelemetryEvent
  | SavedConnectionsLoadedTelemetryEvent
  | PresetConnectionEditedTelemetryEvent
  | SidePanelOpenedTelemetryEvent
  | TreeItemExpandedTelemetryEvent
  | DeepLinkTelemetryEvent
  | DataBrowserOpenedTelemetryEvent
  | DataBrowserDocumentsFetchedTelemetryEvent
  | DataBrowserDocumentEditedTelemetryEvent
  | DataBrowserDocumentClonedTelemetryEvent
  | DataBrowserDocumentInsertedTelemetryEvent
  | DataBrowserDocumentDeletedTelemetryEvent
  | DataBrowserClosedTelemetryEvent
  | DataBrowserCollectionRefreshedTelemetryEvent;
