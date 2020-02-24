import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import CollectionDocumentsProvider, {
  NAMESPACE_URI_IDENTIFIER,
  VIEW_COLLECTION_SCHEME
} from './collectionDocumentsProvider';
import { createLogger } from '../logging';

const log = createLogger('editors controller');

/**
 * This controller manages when our extension needs to open
 * new editors and the data they need. It also manages active editors.
 */
export default class EditorsController {
  activate(connectionController: ConnectionController): void {
    log.info('activating...');
    const collectionViewProvider = new CollectionDocumentsProvider(connectionController);

    vscode.workspace.registerTextDocumentContentProvider(
      VIEW_COLLECTION_SCHEME, collectionViewProvider
    );

    log.info('activated.');
  }

  onViewCollectionDocuments(namespace): Thenable<void> {
    const uriQuery = `?${NAMESPACE_URI_IDENTIFIER}=${namespace}`;
    // We attach the current time to ensure a new editor window is opened on
    // each query and maybe help the user know when the query started.
    // The part of the URI after the scheme and before the query is the file name.
    const uri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${namespace} ${Date.now()}.json${uriQuery}`
    );
    return new Promise((resolve, reject) => {
      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window.showTextDocument(doc, { preview: false }).then(
          () => resolve(),
          reject
        );
      }, reject);
    });
  }
}
